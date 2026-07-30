begin;

update public.commercial_products product
set product_type = 'sweet',
    customization_mode = 'option_groups',
    configuration_rules = coalesce(product.configuration_rules, '{}'::jsonb) || jsonb_build_object(
      'minimumTotalQuantity', product.minimum_quantity,
      'maximumTotalQuantity', coalesce((
        select max(private.configurable_positive_integer(package.value->>'quantity', product.minimum_quantity))
        from jsonb_array_elements(coalesce(product.details->'packages', '[]'::jsonb)) package(value)
      ), product.minimum_quantity),
      'maximumFlavors', coalesce((
        select max(private.configurable_positive_integer(package.value->>'flavors', 1))
        from jsonb_array_elements(coalesce(product.details->'packages', '[]'::jsonb)) package(value)
      ), 1),
      'minimumQuantityPerFlavor', 1,
      'requireExactTotal', true,
      'allowAddons', false,
      'includedQuantity', product.minimum_quantity,
      'additionalUnitPrice', 0,
      'priceTiers', coalesce((
        select jsonb_agg(jsonb_build_object(
          'quantity', private.configurable_positive_integer(package.value->>'quantity', product.minimum_quantity),
          'price', private.configurable_nonnegative_numeric(package.value->>'price', coalesce(product.base_price, 0)),
          'maximumFlavors', private.configurable_positive_integer(package.value->>'flavors', 1)
        ) order by private.configurable_positive_integer(package.value->>'quantity', product.minimum_quantity))
        from jsonb_array_elements(coalesce(product.details->'packages', '[]'::jsonb)) package(value)
      ), '[]'::jsonb),
      'groupLimits', '{}'::jsonb,
      'groupMinimums', '{}'::jsonb
    )
where product.segment::text = 'sweets'
  and product.slug in ('docinhos-tradicionais', 'docinhos-especiais');

insert into public.commercial_product_options(
  product_id,
  group_key,
  option_code,
  option_kind,
  label,
  price_adjustment,
  unit_cost,
  minimum_quantity,
  maximum_quantity,
  active,
  published,
  sort_order
)
select
  product.id,
  'sabores',
  trim(both '-' from regexp_replace(
    translate(lower(flavor.label),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'),
    '[^a-z0-9]+', '-', 'g'
  )),
  'flavor',
  flavor.label,
  0,
  0,
  1,
  coalesce((
    select max(private.configurable_positive_integer(package.value->>'quantity', product.minimum_quantity))
    from jsonb_array_elements(coalesce(product.details->'packages', '[]'::jsonb)) package(value)
  ), product.minimum_quantity),
  true,
  true,
  flavor.ordinality * 10
from public.commercial_products product
cross join lateral jsonb_array_elements_text(coalesce(product.details->'choices'->'sabores', '[]'::jsonb))
  with ordinality flavor(label, ordinality)
where product.slug in ('docinhos-tradicionais', 'docinhos-especiais')
on conflict (product_id, option_code) do update
set group_key = excluded.group_key,
    option_kind = excluded.option_kind,
    label = excluded.label,
    minimum_quantity = excluded.minimum_quantity,
    maximum_quantity = excluded.maximum_quantity,
    active = true,
    published = true,
    sort_order = excluded.sort_order,
    updated_at = now();

update public.commercial_products product
set product_type = 'school_kit',
    customization_mode = 'option_groups',
    configuration_rules = coalesce(product.configuration_rules, '{}'::jsonb) || jsonb_build_object(
      'minimumTotalQuantity', product.minimum_quantity,
      'maximumTotalQuantity', 10000,
      'maximumFlavors', 100,
      'minimumQuantityPerFlavor', 1,
      'requireExactTotal', false,
      'allowAddons', true,
      'includedQuantity', product.minimum_quantity,
      'additionalUnitPrice', private.configurable_nonnegative_numeric(product.details->>'additional_price', 0),
      'priceTiers', '[]'::jsonb,
      'groupLimits', jsonb_build_object('sucos', 2),
      'groupMinimums', jsonb_build_object('sucos', 2)
    )
where product.segment::text = 'school'
  and product.slug in (
    'escola-alegria',
    'escola-recreio-doce',
    'escola-intervalo-animado',
    'escola-recreio-completo'
  );

insert into public.commercial_product_options(
  product_id,
  group_key,
  option_code,
  option_kind,
  label,
  price_adjustment,
  unit_cost,
  minimum_quantity,
  maximum_quantity,
  active,
  published,
  sort_order
)
select
  product.id,
  'sucos',
  'suco-' || trim(both '-' from regexp_replace(
    translate(lower(juice.label),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'),
    '[^a-z0-9]+', '-', 'g'
  )),
  'variant',
  juice.label,
  0,
  0,
  1,
  1,
  true,
  true,
  juice.ordinality * 10
from public.commercial_products product
cross join lateral jsonb_array_elements_text(coalesce(product.details->'choices'->'sucos', '[]'::jsonb))
  with ordinality juice(label, ordinality)
where product.slug in (
  'escola-alegria',
  'escola-recreio-doce',
  'escola-intervalo-animado',
  'escola-recreio-completo'
)
on conflict (product_id, option_code) do update
set group_key = excluded.group_key,
    option_kind = excluded.option_kind,
    label = excluded.label,
    minimum_quantity = 1,
    maximum_quantity = 1,
    active = true,
    published = true,
    sort_order = excluded.sort_order,
    updated_at = now();

update public.commercial_product_costing_settings profile
set yield_quantity = 1,
    yield_label = 'docinho',
    data_status = case when profile.manual_total_cost > 0 then profile.data_status else 'awaiting_validation' end,
    notes = case
      when profile.manual_total_cost > 0 then profile.notes
      else 'Informe o custo real por docinho antes de aprovar a rentabilidade.'
    end,
    updated_at = now()
from public.commercial_products product
where product.id = profile.product_id
  and product.slug in ('docinhos-tradicionais', 'docinhos-especiais');

update public.commercial_product_costing_settings profile
set yield_quantity = product.minimum_quantity,
    yield_label = 'criança',
    data_status = case when profile.manual_total_cost > 0 then profile.data_status else 'awaiting_validation' end,
    notes = case
      when profile.manual_total_cost > 0 then profile.notes
      else 'Informe o custo real do kit-base para calcular o custo por criança e das quantidades adicionais.'
    end,
    updated_at = now()
from public.commercial_products product
where product.id = profile.product_id
  and product.slug in (
    'escola-alegria',
    'escola-recreio-doce',
    'escola-intervalo-animado',
    'escola-recreio-completo'
  );

comment on column public.commercial_products.configuration_rules is
  'Regras públicas do montador, incluindo pacotes, quantidade incluída, adicionais e mínimos/máximos por grupo.';

commit;
