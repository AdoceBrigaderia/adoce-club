begin;
create table public.costing_preparation_times (
  version_id uuid primary key references public.costing_recipe_versions(id) on delete restrict,
  preparation_minutes integer check (preparation_minutes between 0 and 100000),
  cooking_minutes integer check (cooking_minutes between 0 and 100000),
  cooling_minutes integer check (cooling_minutes between 0 and 100000)
);
alter table public.costing_preparation_times enable row level security;
revoke all on public.costing_preparation_times from public, anon, authenticated;
grant all on public.costing_preparation_times to service_role;

create function public.manager_get_costing_workspace_with_times()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare workspace jsonb;
begin
  if not private.is_manager() then raise exception 'Apenas proprietários e gerentes podem consultar fichas'; end if;
  workspace := public.manager_get_costing_technical_workspace();
  return jsonb_set(workspace, '{versions}', coalesce((select jsonb_agg(version ||
    jsonb_build_object('preparation_minutes', timing.preparation_minutes,
      'cooking_minutes', timing.cooking_minutes, 'cooling_minutes', timing.cooling_minutes))
    from jsonb_array_elements(workspace->'versions') version
    left join public.costing_preparation_times timing on timing.version_id = (version->>'id')::uuid), '[]'::jsonb));
end;
$$;

create function public.manager_save_costing_sheet_with_times(
  target_recipe_id uuid, next_name text, next_kind text, next_flavor_id uuid,
  next_size_code text, next_yield_quantity numeric, next_yield_unit text,
  next_components jsonb, next_reason text,
  next_preparation_minutes integer, next_cooking_minutes integer, next_cooling_minutes integer
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved jsonb;
begin
  if not private.is_manager() then raise exception 'Apenas proprietários e gerentes podem alterar fichas'; end if;
  if next_preparation_minutes not between 0 and 100000 or next_cooking_minutes not between 0 and 100000
    or next_cooling_minutes not between 0 and 100000 then raise exception 'Informe tempos em minutos inteiros, de 0 a 100000'; end if;
  saved := public.manager_save_costing_technical_sheet(target_recipe_id, next_name, next_kind,
    next_flavor_id, next_size_code, next_yield_quantity, next_yield_unit, next_components, next_reason);
  insert into public.costing_preparation_times(version_id, preparation_minutes, cooking_minutes, cooling_minutes)
  values ((saved->>'version_id')::uuid, next_preparation_minutes, next_cooking_minutes, next_cooling_minutes);
  return saved;
end;
$$;
revoke all on function public.manager_get_costing_workspace_with_times() from public, anon, authenticated;
revoke all on function public.manager_save_costing_sheet_with_times(uuid,text,text,uuid,text,numeric,text,jsonb,text,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.manager_get_costing_workspace_with_times() to authenticated;
grant execute on function public.manager_save_costing_sheet_with_times(uuid,text,text,uuid,text,numeric,text,jsonb,text,integer,integer,integer) to authenticated;
comment on table public.costing_preparation_times is 'Tempos por versão da ficha, em minutos. Campos ausentes são desconhecidos; zero significa etapa sem duração. Ainda não geram custo de energia ou gás.';
commit;
