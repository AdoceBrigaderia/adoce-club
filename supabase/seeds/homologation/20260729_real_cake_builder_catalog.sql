begin;

insert into public.cake_builder_templates(
  product_id,
  name,
  cake_layers,
  filling_layers,
  allow_mixed_cake_layers,
  allow_mixed_fillings,
  active,
  published,
  created_by,
  updated_by
)
select
  product.id,
  'Montagem oficial — ' || product.name,
  3,
  2,
  false,
  true,
  true,
  true,
  null,
  null
from public.commercial_products product
where product.product_type = 'cake'
  and product.customization_mode = 'cake_builder'
  and product.active
  and product.published
  and product.slug in ('torta-p', 'torta-m', 'torta-g')
on conflict (product_id) do update
set name = excluded.name,
    cake_layers = excluded.cake_layers,
    filling_layers = excluded.filling_layers,
    allow_mixed_cake_layers = excluded.allow_mixed_cake_layers,
    allow_mixed_fillings = excluded.allow_mixed_fillings,
    active = true,
    published = true,
    updated_at = now();

insert into public.cake_builder_options(
  template_id,
  placement,
  slug,
  label,
  description,
  price_adjustment,
  unit_cost,
  active,
  published,
  sort_order,
  cost_source_status,
  cost_source_note,
  cost_updated_at,
  costing_sync_enabled
)
select
  template.id,
  'cake_layer',
  trim(both '-' from regexp_replace(
    translate(
      lower(mass.label),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'
    ),
    '[^a-z0-9]+',
    '-',
    'g'
  )),
  mass.label,
  'Massa já cadastrada no catálogo comercial deste tamanho de torta.',
  0,
  0,
  true,
  true,
  mass.ordinality * 10,
  'manual_provisional',
  'Opção real do catálogo. O custo técnico e eventual acréscimo ainda aguardam validação da Adoce.',
  null,
  false
from public.commercial_products product
join public.cake_builder_templates template on template.product_id = product.id
cross join lateral jsonb_array_elements_text(
  coalesce(product.details->'choices'->'massas', '[]'::jsonb)
) with ordinality mass(label, ordinality)
where product.slug in ('torta-p', 'torta-m', 'torta-g')
  and product.active
  and product.published
on conflict (template_id, placement, slug) do update
set label = excluded.label,
    description = excluded.description,
    active = true,
    published = true,
    sort_order = excluded.sort_order,
    updated_at = now();

insert into public.cake_builder_options(
  template_id,
  placement,
  slug,
  label,
  description,
  price_adjustment,
  unit_cost,
  active,
  published,
  sort_order,
  cost_source_status,
  cost_source_note,
  cost_updated_at,
  costing_sync_enabled
)
select
  template.id,
  'filling_layer',
  trim(both '-' from regexp_replace(
    translate(
      lower(filling.label),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'
    ),
    '[^a-z0-9]+',
    '-',
    'g'
  )),
  filling.label,
  'Recheio já cadastrado no catálogo comercial deste tamanho de torta.',
  0,
  0,
  true,
  true,
  filling.ordinality * 10,
  'manual_provisional',
  'Opção real do catálogo. O custo técnico e eventual acréscimo ainda aguardam validação da Adoce.',
  null,
  false
from public.commercial_products product
join public.cake_builder_templates template on template.product_id = product.id
cross join lateral jsonb_array_elements_text(
  coalesce(product.details->'choices'->'recheios', '[]'::jsonb)
) with ordinality filling(label, ordinality)
where product.slug in ('torta-p', 'torta-m', 'torta-g')
  and product.active
  and product.published
on conflict (template_id, placement, slug) do update
set label = excluded.label,
    description = excluded.description,
    active = true,
    published = true,
    sort_order = excluded.sort_order,
    updated_at = now();

insert into public.cake_builder_options(
  template_id,
  placement,
  slug,
  label,
  description,
  price_adjustment,
  unit_cost,
  active,
  published,
  sort_order,
  cost_source_status,
  cost_source_note,
  cost_updated_at,
  costing_sync_enabled
)
select
  template.id,
  'topping',
  'acabamento-padrao-adoce',
  'Acabamento padrão da Adoce',
  'A finalização visual será confirmada no atendimento antes da produção e está incluída no valor-base.',
  0,
  0,
  true,
  true,
  10,
  'manual_provisional',
  'Opção neutra necessária para registrar a cobertura. Material, acabamento e custo técnico aguardam validação da Adoce.',
  null,
  false
from public.cake_builder_templates template
join public.commercial_products product on product.id = template.product_id
where product.slug in ('torta-p', 'torta-m', 'torta-g')
  and product.active
  and product.published
on conflict (template_id, placement, slug) do update
set label = excluded.label,
    description = excluded.description,
    active = true,
    published = true,
    sort_order = excluded.sort_order,
    updated_at = now();

-- Reconcilia sem apagar histórico: opções removidas do catálogo comercial deixam de ser publicadas.
update public.cake_builder_options option
set active = false,
    published = false,
    updated_at = now()
from public.cake_builder_templates template
join public.commercial_products product on product.id = template.product_id
where option.template_id = template.id
  and product.slug in ('torta-p', 'torta-m', 'torta-g')
  and option.placement = 'cake_layer'
  and (option.active or option.published)
  and not exists (
    select 1
    from jsonb_array_elements_text(
      coalesce(product.details->'choices'->'massas', '[]'::jsonb)
    ) mass(label)
    where option.slug = trim(both '-' from regexp_replace(
      translate(
        lower(mass.label),
        'áàâãäéèêëíìîïóòôõöúùûüçñ',
        'aaaaaeeeeiiiiooooouuuucn'
      ),
      '[^a-z0-9]+',
      '-',
      'g'
    ))
  );

update public.cake_builder_options option
set active = false,
    published = false,
    updated_at = now()
from public.cake_builder_templates template
join public.commercial_products product on product.id = template.product_id
where option.template_id = template.id
  and product.slug in ('torta-p', 'torta-m', 'torta-g')
  and option.placement = 'filling_layer'
  and (option.active or option.published)
  and not exists (
    select 1
    from jsonb_array_elements_text(
      coalesce(product.details->'choices'->'recheios', '[]'::jsonb)
    ) filling(label)
    where option.slug = trim(both '-' from regexp_replace(
      translate(
        lower(filling.label),
        'áàâãäéèêëíìîïóòôõöúùûüçñ',
        'aaaaaeeeeiiiiooooouuuucn'
      ),
      '[^a-z0-9]+',
      '-',
      'g'
    ))
  );

update public.cake_builder_options option
set active = false,
    published = false,
    updated_at = now()
from public.cake_builder_templates template
join public.commercial_products product on product.id = template.product_id
where option.template_id = template.id
  and product.slug in ('torta-p', 'torta-m', 'torta-g')
  and (option.active or option.published)
  and (
    (option.placement = 'topping' and option.slug <> 'acabamento-padrao-adoce')
    or option.placement not in ('cake_layer', 'filling_layer', 'topping')
  );

do $$
declare
  expected_products integer;
  valid_templates integer;
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
    raise exception 'Esperadas 3 tortas reais publicadas; encontradas %', expected_products;
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
    and template.allow_mixed_fillings = true
    and (
      select count(*)
      from public.cake_builder_options option
      where option.template_id = template.id
        and option.placement = 'cake_layer'
        and option.active
        and option.published
    ) >= 1
    and (
      select count(*)
      from public.cake_builder_options option
      where option.template_id = template.id
        and option.placement = 'filling_layer'
        and option.active
        and option.published
    ) >= 1
    and (
      select count(*)
      from public.cake_builder_options option
      where option.template_id = template.id
        and option.placement = 'topping'
        and option.slug = 'acabamento-padrao-adoce'
        and option.active
        and option.published
    ) = 1
    and not exists (
      select 1
      from public.cake_builder_options option
      where option.template_id = template.id
        and option.active
        and option.published
        and (
          option.placement not in ('cake_layer', 'filling_layer', 'topping')
          or (option.placement = 'topping' and option.slug <> 'acabamento-padrao-adoce')
        )
    )
    and not exists (
      select 1
      from public.cake_builder_options option
      where option.template_id = template.id
        and option.placement = 'cake_layer'
        and option.active
        and option.published
        and not exists (
          select 1
          from jsonb_array_elements_text(
            coalesce(product.details->'choices'->'massas', '[]'::jsonb)
          ) mass(label)
          where option.slug = trim(both '-' from regexp_replace(
            translate(lower(mass.label), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
            '[^a-z0-9]+',
            '-',
            'g'
          ))
        )
    )
    and not exists (
      select 1
      from public.cake_builder_options option
      where option.template_id = template.id
        and option.placement = 'filling_layer'
        and option.active
        and option.published
        and not exists (
          select 1
          from jsonb_array_elements_text(
            coalesce(product.details->'choices'->'recheios', '[]'::jsonb)
          ) filling(label)
          where option.slug = trim(both '-' from regexp_replace(
            translate(lower(filling.label), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
            '[^a-z0-9]+',
            '-',
            'g'
          ))
        )
    );

  if valid_templates <> 3 then
    raise exception 'O catálogo real de tortas ficou incompleto ou divergente: % de 3 templates válidos', valid_templates;
  end if;
end;
$$;

commit;
