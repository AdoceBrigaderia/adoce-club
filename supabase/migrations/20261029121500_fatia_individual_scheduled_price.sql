-- Cadastro do produto "Fatia individual" no Catálogo comercial (fonte única
-- de preço de torta/fatia pedida pelo proprietário em 29/10/2026): começa em
-- R$ 16,00 e sobe para R$ 18,00 automaticamente em 03/11/2026, sem precisar
-- de outra tela ou de outro lugar guardando esse valor.
insert into public.commercial_products (
  slug, segment, subcategory, name, short_description, description,
  base_price, price_suffix, minimum_quantity, lead_business_days,
  requires_schedule, meta_retailer_id, published, active, sort_order
) values (
  'fatia-individual', 'cakes', null, 'Fatia individual',
  'Fatia avulsa para retirada no balcão.', '',
  16.00, '', 1, 0, false, 'fatia-individual', true, true, 40
)
on conflict (slug) do nothing;

create or replace function private.apply_fatia_individual_scheduled_price()
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.commercial_products set base_price = 18.00, updated_at = now()
  where slug = 'fatia-individual';
  perform cron.unschedule('adoce-fatia-individual-price-20261103');
end; $$;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'adoce-fatia-individual-price-20261103';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule(
    'adoce-fatia-individual-price-20261103',
    '0 3 3 11 *',
    'select private.apply_fatia_individual_scheduled_price();'
  );
end;
$$;
