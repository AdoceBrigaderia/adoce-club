\set ON_ERROR_STOP on

begin;

select pg_advisory_xact_lock(hashtextextended('adoce:homologation:cake-builder-catalog-audit', 0));

do $$
declare
  expected_products integer;
  valid_templates integer;
  missing_mass_options integer;
  missing_filling_options integer;
  invalid_toppings integer;
  provisional_values integer;
begin
  select count(*)
  into expected_products
  from public.commercial_products product
  where product.slug in ('torta-p', 'torta-m', 'torta-g')
    and product.product_type = 'cake'
    and product.customization_mode = 'cake_builder'
    and product.active
    and product.published;

  if expected_products <> 3 then
    raise exception 'Catálogo comercial divergente: esperadas 3 tortas publicadas; encontradas %', expected_products;
  end if;

  select count(*)
  into valid_templates
  from public.cake_builder_templates template
  join public.commercial_products product on product.id = template.product_id
  where product.slug in ('torta-p', 'torta-m', 'torta-g')
    and template.active
    and template.published
    and template.cake_layers = 3
    and template.filling_layers = 2
    and template.allow_mixed_cake_layers = false
    and template.allow_mixed_fillings = true;

  if valid_templates <> 3 then
    raise exception 'Templates divergentes: esperados 3; encontrados %', valid_templates;
  end if;

  select count(*)
  into missing_mass_options
  from public.commercial_products product
  join public.cake_builder_templates template on template.product_id = product.id
  cross join lateral jsonb_array_elements_text(
    coalesce(product.details->'choices'->'massas', '[]'::jsonb)
  ) mass(label)
  where product.slug in ('torta-p', 'torta-m', 'torta-g')
    and not exists (
      select 1
      from public.cake_builder_options option
      where option.template_id = template.id
        and option.placement = 'cake_layer'
        and option.label = mass.label
        and option.active
        and option.published
    );

  if missing_mass_options <> 0 then
    raise exception 'Massas comerciais ausentes no montador: %', missing_mass_options;
  end if;

  select count(*)
  into missing_filling_options
  from public.commercial_products product
  join public.cake_builder_templates template on template.product_id = product.id
  cross join lateral jsonb_array_elements_text(
    coalesce(product.details->'choices'->'recheios', '[]'::jsonb)
  ) filling(label)
  where product.slug in ('torta-p', 'torta-m', 'torta-g')
    and not exists (
      select 1
      from public.cake_builder_options option
      where option.template_id = template.id
        and option.placement = 'filling_layer'
        and option.label = filling.label
        and option.active
        and option.published
    );

  if missing_filling_options <> 0 then
    raise exception 'Recheios comerciais ausentes no montador: %', missing_filling_options;
  end if;

  select count(*)
  into invalid_toppings
  from public.cake_builder_templates template
  join public.commercial_products product on product.id = template.product_id
  where product.slug in ('torta-p', 'torta-m', 'torta-g')
    and (
      select count(*)
      from public.cake_builder_options option
      where option.template_id = template.id
        and option.placement = 'topping'
        and option.slug = 'acabamento-padrao-adoce'
        and option.active
        and option.published
    ) <> 1;

  if invalid_toppings <> 0 then
    raise exception 'Acabamento padrão inválido em % template(s)', invalid_toppings;
  end if;

  select count(*)
  into provisional_values
  from public.cake_builder_options option
  join public.cake_builder_templates template on template.id = option.template_id
  join public.commercial_products product on product.id = template.product_id
  where product.slug in ('torta-p', 'torta-m', 'torta-g')
    and option.active
    and option.published
    and option.cost_source_status = 'manual_provisional'
    and (option.price_adjustment <> 0 or option.unit_cost <> 0);

  if provisional_values <> 0 then
    raise exception 'Opções provisórias não podem possuir preço ou custo inventado: %', provisional_values;
  end if;
end;
$$;

select
  product.slug,
  template.id as template_id,
  template.cake_layers,
  template.filling_layers,
  count(*) filter (where option.placement = 'cake_layer' and option.active and option.published) as massas_ativas,
  count(*) filter (where option.placement = 'filling_layer' and option.active and option.published) as recheios_ativos,
  count(*) filter (where option.placement = 'topping' and option.active and option.published) as acabamentos_ativos
from public.commercial_products product
join public.cake_builder_templates template on template.product_id = product.id
join public.cake_builder_options option on option.template_id = template.id
where product.slug in ('torta-p', 'torta-m', 'torta-g')
group by product.slug, template.id, template.cake_layers, template.filling_layers
order by product.slug;

rollback;
