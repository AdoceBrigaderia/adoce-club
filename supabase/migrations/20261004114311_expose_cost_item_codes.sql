CREATE OR REPLACE FUNCTION public.manager_get_costing_workspace_with_times()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare workspace jsonb;
begin
  if not private.is_manager() then raise exception 'Apenas proprietários e gerentes podem consultar fichas'; end if;
  workspace := public.manager_get_costing_technical_workspace();
  workspace := jsonb_set(workspace, '{items}', coalesce((
    select jsonb_agg(entry || jsonb_build_object('internal_code', item.internal_code))
    from jsonb_array_elements(workspace->'items') entry
    join public.costing_items item on item.id = (entry->>'id')::uuid
  ), '[]'::jsonb));
  return jsonb_set(workspace, '{versions}', coalesce((select jsonb_agg(version ||
    jsonb_build_object('preparation_minutes', timing.preparation_minutes,
      'cooking_minutes', timing.cooking_minutes, 'cooling_minutes', timing.cooling_minutes))
    from jsonb_array_elements(workspace->'versions') version
    left join public.costing_preparation_times timing on timing.version_id = (version->>'id')::uuid), '[]'::jsonb));
end;
$function$

