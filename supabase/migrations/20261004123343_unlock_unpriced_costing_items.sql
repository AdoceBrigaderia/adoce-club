CREATE OR REPLACE FUNCTION public.manager_update_costing_item_details(target_item_id uuid, next_details jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 exists(select 1 from public.costing_item_prices p
 left join public.costing_purchase_invoices invoice on invoice.id=p.source_invoice_id
 where p.item_id=item.id and p.purchase_price>0 and p.purchased_quantity>0
 and coalesce(p.useful_quantity,p.purchased_quantity)>0
 and (p.source_invoice_id is null or (invoice.archived_at is null and invoice.replaced_by is null)))
 then raise exception 'Este item tem preço de compra registrado. Nome, código, categoria, marca e observações podem ser editados; a alteração de tipo ou unidade precisa preservar a conversão dos custos.'; end if;
 update public.costing_items set name=name_value,internal_code=code_value,item_kind=kind_value,consumption_unit=unit_value,
 purchase_unit=case when unit_value<>item.consumption_unit then unit_value else purchase_unit end,
 category=left(btrim(coalesce(next_details->>'category','')),120),brand=left(btrim(coalesce(next_details->>'brand','')),120),updated_at=now(),updated_by=auth.uid()
 where id=item.id;
 update public.costing_item_commercial_settings set notes=left(coalesce(next_details->>'notes',''),2000),updated_at=now(),updated_by=auth.uid() where item_id=item.id;
 insert into public.audit_events(actor_user_id,action,entity_type,entity_id,payload)
 values(auth.uid(),'costing.item_details_updated','costing_item',item.id::text,
 jsonb_build_object('before',to_jsonb(item),'after',next_details,'unpriced_unit_change',unit_value<>item.consumption_unit));
 return private.costing_commercial_item_json(item.id);
end $function$
;
