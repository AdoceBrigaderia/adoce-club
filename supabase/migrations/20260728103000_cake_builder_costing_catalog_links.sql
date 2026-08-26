begin;

alter table public.cake_builder_options
  add column if not exists costing_item_id uuid references public.costing_items(id) on delete set null,
  add column if not exists costing_sync_enabled boolean not null default false;

create index if not exists cake_builder_options_costing_item_idx
  on public.cake_builder_options (costing_item_id)
  where costing_item_id is not null;

create or replace function private.cake_builder_apply_costing_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  effective_cost numeric := 0;
  commercial_price numeric := 0;
begin
  if not new.costing_sync_enabled then
    return new;
  end if;

  if new.costing_item_id is null then
    raise exception 'Selecione um item do catálogo para sincronizar custo e preço';
  end if;

  select
    private.costing_effective_unit_cost(settings.item_id),
    settings.sale_price
  into effective_cost, commercial_price
  from public.costing_item_commercial_settings settings
  join public.costing_items item on item.id = settings.item_id
  where settings.item_id = new.costing_item_id
    and item.active
    and settings.commercial_status <> 'blocked';

  if not found then
    raise exception 'O item de custo selecionado está indisponível';
  end if;

  new.unit_cost := round(greatest(coalesce(effective_cost, 0), 0), 2);
  new.price_adjustment := round(greatest(coalesce(commercial_price, 0), 0), 2);
  return new;
end;
$$;

create or replace function private.refresh_cake_builder_options_for_costing_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_item_id uuid;
begin
  target_item_id := case when tg_op = 'DELETE' then old.item_id else new.item_id end;

  if target_item_id is null then
    return null;
  end if;

  update public.cake_builder_options option
  set
    unit_cost = round(greatest(private.costing_effective_unit_cost(target_item_id), 0), 2),
    price_adjustment = round(greatest(settings.sale_price, 0), 2),
    updated_at = now()
  from public.costing_item_commercial_settings settings
  where option.costing_item_id = target_item_id
    and option.costing_sync_enabled
    and settings.item_id = target_item_id;

  return null;
end;
$$;

drop trigger if exists cake_builder_apply_costing_link on public.cake_builder_options;
create trigger cake_builder_apply_costing_link
before insert or update of costing_item_id, costing_sync_enabled, unit_cost, price_adjustment
on public.cake_builder_options
for each row execute function private.cake_builder_apply_costing_link();

drop trigger if exists costing_settings_refresh_cake_builder on public.costing_item_commercial_settings;
create trigger costing_settings_refresh_cake_builder
after insert or update of cost_origin, manual_unit_cost, sale_price, acquisition_cost,
  expected_uses, maintenance_per_use, cleaning_per_use, replacement_reserve_per_use,
  commercial_status
on public.costing_item_commercial_settings
for each row execute function private.refresh_cake_builder_options_for_costing_item();

drop trigger if exists costing_prices_refresh_cake_builder on public.costing_item_prices;
create trigger costing_prices_refresh_cake_builder
after insert or update or delete on public.costing_item_prices
for each row execute function private.refresh_cake_builder_options_for_costing_item();

create or replace function public.manager_get_cake_builder_costing_workspace(
  target_product_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_manager() then
    raise exception 'Apenas proprietários e gerentes podem acessar custos da montagem';
  end if;

  if not exists (
    select 1
    from public.commercial_products product
    where product.id = target_product_id
      and product.segment::text = 'cakes'
  ) then
    raise exception 'Torta não encontrada';
  end if;

  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(
        private.costing_commercial_item_json(item.id)
        order by item.active desc, item.name
      )
      from public.costing_items item
      join public.costing_item_commercial_settings settings on settings.item_id = item.id
      where item.active
        and settings.commercial_status <> 'blocked'
    ), '[]'::jsonb),
    'links', coalesce((
      select jsonb_agg(jsonb_build_object(
        'option_id', option.id,
        'placement', option.placement,
        'slug', option.slug,
        'costing_item_id', option.costing_item_id,
        'costing_sync_enabled', option.costing_sync_enabled,
        'effective_unit_cost', option.unit_cost,
        'effective_sale_price', option.price_adjustment,
        'margin', case
          when option.price_adjustment > 0 then round(
            (option.price_adjustment - option.unit_cost) / option.price_adjustment,
            6
          )
          else 0
        end
      ) order by option.placement, option.sort_order, option.label)
      from public.cake_builder_templates template
      join public.cake_builder_options option on option.template_id = template.id
      where template.product_id = target_product_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.manager_save_cake_builder_costing_links(
  target_product_id uuid,
  next_links jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_item jsonb;
  link_index integer := 0;
  target_option_id uuid;
  target_costing_item_id uuid;
  sync_enabled boolean;
  affected_rows integer;
begin
  if not private.is_manager() then
    raise exception 'Apenas proprietários e gerentes podem vincular custos da montagem';
  end if;

  if jsonb_typeof(next_links) <> 'array' or jsonb_array_length(next_links) > 200 then
    raise exception 'Lista de vínculos de custo inválida';
  end if;

  for link_item in select value from jsonb_array_elements(next_links)
  loop
    link_index := link_index + 1;

    begin
      target_option_id := nullif(link_item->>'option_id', '')::uuid;
    exception when invalid_text_representation then
      raise exception 'Opção inválida na posição %', link_index;
    end;

    begin
      target_costing_item_id := nullif(link_item->>'costing_item_id', '')::uuid;
    exception when invalid_text_representation then
      raise exception 'Item de custo inválido na posição %', link_index;
    end;

    sync_enabled := coalesce((link_item->>'costing_sync_enabled')::boolean, false);

    if sync_enabled and target_costing_item_id is null then
      raise exception 'Selecione o item de custo da opção %', link_index;
    end if;

    if target_costing_item_id is not null and not exists (
      select 1
      from public.costing_items item
      join public.costing_item_commercial_settings settings on settings.item_id = item.id
      where item.id = target_costing_item_id
        and item.active
        and settings.commercial_status <> 'blocked'
    ) then
      raise exception 'O item de custo da opção % está indisponível', link_index;
    end if;

    update public.cake_builder_options option
    set
      costing_item_id = target_costing_item_id,
      costing_sync_enabled = sync_enabled,
      updated_at = now()
    from public.cake_builder_templates template
    where option.id = target_option_id
      and option.template_id = template.id
      and template.product_id = target_product_id;

    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      raise exception 'A opção % não pertence à torta selecionada', link_index;
    end if;
  end loop;

  return public.manager_get_cake_builder_costing_workspace(target_product_id);
end;
$$;

revoke all on function private.cake_builder_apply_costing_link() from public, anon, authenticated;
revoke all on function private.refresh_cake_builder_options_for_costing_item() from public, anon, authenticated;
revoke all on function public.manager_get_cake_builder_costing_workspace(uuid) from public, anon, authenticated;
revoke all on function public.manager_save_cake_builder_costing_links(uuid, jsonb) from public, anon, authenticated;

grant execute on function public.manager_get_cake_builder_costing_workspace(uuid) to authenticated;
grant execute on function public.manager_save_cake_builder_costing_links(uuid, jsonb) to authenticated;

comment on column public.cake_builder_options.costing_item_id is
  'Item técnico que fornece custo e preço administrativo para a opção do montador.';
comment on column public.cake_builder_options.costing_sync_enabled is
  'Quando ativo, custo e preço da opção são atualizados pelo catálogo interno.';
comment on function public.manager_save_cake_builder_costing_links(uuid, jsonb) is
  'Vincula opções do Adoce do Seu Jeito ao catálogo interno sem expor custos ao cliente.';

commit;
