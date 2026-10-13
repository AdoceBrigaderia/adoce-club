create or replace function public.manager_update_costing_item_details(target_item_id uuid,next_details jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.costing_items; commercial public.costing_item_commercial_settings; name_value text; code_value text; unit_value text; kind_value text;
begin
 if not private.is_manager() then raise exception 'Apenas proprietários e gerentes podem editar insumos'; end if;
 select * into item from public.costing_items where id=target_item_id for update;
 if item.id is null then raise exception 'Insumo não encontrado'; end if;
 select * into commercial from public.costing_item_commercial_settings where item_id=item.id for update;
 if nullif(next_details->>'updated_at','') is null or (next_details->>'updated_at')::timestamptz is distinct from greatest(item.updated_at,commercial.updated_at) then raise exception 'Este cadastro foi alterado. Feche e abra a edição novamente.'; end if;
 name_value:=btrim(next_details->>'name'); code_value:=upper(btrim(next_details->>'internal_code'));
 unit_value:=next_details->>'consumption_unit'; kind_value:=next_details->>'item_kind';
 if coalesce(name_value,'')='' or length(name_value)>160 then raise exception 'Informe um nome de até 160 caracteres'; end if;
 if coalesce(code_value,'') !~ '^[A-Z0-9][A-Z0-9._-]{0,39}$' then raise exception 'Código interno inválido'; end if;
 if unit_value is null or unit_value not in ('g','ml','unit') or kind_value is null or kind_value not in ('ingredient','packaging') then raise exception 'Tipo ou unidade inválidos'; end if;
 if (unit_value<>item.consumption_unit or kind_value<>item.item_kind) and
 (exists(select 1 from public.costing_item_prices where item_id=item.id) or exists(select 1 from public.costing_recipe_components where item_id=item.id) or item.reference_quantity is not null)
 then raise exception 'Este item já tem compras, receitas ou referência vinculadas. O tipo e a unidade devem ser preservados.'; end if;
 update public.costing_items set name=name_value,internal_code=code_value,item_kind=kind_value,consumption_unit=unit_value,
 purchase_unit=case when unit_value<>item.consumption_unit then unit_value else purchase_unit end,
 category=left(btrim(coalesce(next_details->>'category','')),120),brand=left(btrim(coalesce(next_details->>'brand','')),120),updated_at=now(),updated_by=auth.uid()
 where id=item.id;
 update public.costing_item_commercial_settings set notes=left(coalesce(next_details->>'notes',''),2000),updated_at=now(),updated_by=auth.uid() where item_id=item.id;
 return private.costing_commercial_item_json(item.id);
end $$;
revoke all on function public.manager_update_costing_item_details(uuid,jsonb) from public,anon;
grant execute on function public.manager_update_costing_item_details(uuid,jsonb) to authenticated;
