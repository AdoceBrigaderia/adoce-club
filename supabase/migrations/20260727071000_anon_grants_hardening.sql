begin;

-- Defesa em profundidade: o papel anônimo nunca precisa de DML direto.
do $$
declare
  target record;
begin
  for target in
    select n.nspname as schema_name, c.relname as relation_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
  loop
    execute format(
      'revoke insert, update, delete, truncate, references, trigger on table %I.%I from anon',
      target.schema_name,
      target.relation_name
    );
    execute format(
      'revoke all privileges on table %I.%I from public',
      target.schema_name,
      target.relation_name
    );
  end loop;
end;
$$;

-- A leitura anônima fica limitada ao catálogo e informações públicas.
do $$
declare
  target record;
begin
  for target in
    select n.nspname as schema_name, c.relname as relation_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
  loop
    execute format(
      'revoke select on table %I.%I from anon',
      target.schema_name,
      target.relation_name
    );
  end loop;
end;
$$;

grant select on table
  public.business_hour_exceptions,
  public.business_hours,
  public.commercial_media_items,
  public.commercial_product_options,
  public.commercial_products,
  public.commercial_segment_media,
  public.flavor_availability,
  public.flavor_images,
  public.flavors,
  public.order_sauces,
  public.pickup_locations,
  public.promotions,
  public.site_visual_assets,
  public.store_channels,
  public.weekly_service_menu
to anon;

-- Helpers de trigger não são endpoints públicos.
revoke all on function public.set_site_visual_asset_updated_at() from public, anon, authenticated;

-- Versões antigas de pedido permanecem disponíveis apenas para chamadas internas
-- das funções atuais SECURITY DEFINER, evitando bypass direto do BFF.
revoke all on function public.submit_instant_order(text,text,jsonb,text) from public, anon, authenticated;
revoke all on function public.submit_instant_order_v2(text,text,jsonb,text) from public, anon, authenticated;
revoke all on function public.submit_instant_order_v3(text,text,jsonb,text,jsonb) from public, anon, authenticated;
revoke all on function public.submit_instant_order_v4(text,text,jsonb,text) from public, anon, authenticated;

commit;
