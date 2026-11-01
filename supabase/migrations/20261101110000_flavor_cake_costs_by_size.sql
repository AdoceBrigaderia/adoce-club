begin;

-- Pedido do proprietário em 01/11/2026: mostrar no cadastro do produto o
-- custo calculado da torta inteira por tamanho (G/M/P), além do custo por
-- fatia já exposto em flavor_unit_cost_breakdown. Tamanhos sem ficha
-- técnica cadastrada (M e P, por enquanto) voltam null -- a tela mostra em
-- branco, nunca um valor inventado.
create or replace function public.flavor_cake_costs(target_flavor_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with wanted(size_code) as (values ('G'), ('M'), ('P')),
  latest as (
    select distinct on (v.size_code) v.id, v.size_code, v.yield_quantity, v.yield_unit
    from public.costing_recipes r
    join public.costing_recipe_versions v on v.recipe_id = r.id
    where r.flavor_id = target_flavor_id and r.active and r.recipe_kind = 'final_product'
      and v.size_code in ('G', 'M', 'P')
    order by v.size_code, v.version_number desc, v.created_at desc, v.id
  )
  select jsonb_object_agg(
    w.size_code,
    case when l.id is null then null else jsonb_build_object(
      'whole_cost', (private.topoint_recipe_cost(l.id)->>'amount')::numeric,
      'yield_quantity', l.yield_quantity, 'yield_unit', l.yield_unit
    ) end
  )
  from wanted w left join latest l on l.size_code = w.size_code;
$$;
revoke all on function public.flavor_cake_costs(uuid) from public, anon;
grant execute on function public.flavor_cake_costs(uuid) to authenticated;

commit;
