drop index public.costing_purchase_invoice_identity_idx;
create unique index costing_purchase_invoice_identity_idx on public.costing_purchase_invoices(lower(btrim(supplier_name)),upper(btrim(series)),btrim(invoice_number)) where replaced_by is null and archived_at is null;
create or replace function public.manager_edit_costing_purchase_invoice(
 target_invoice_id uuid, expected_invoice jsonb, next_supplier_name text,
 next_invoice_number text, next_series text, next_issued_on date,
 next_discount_total numeric, next_freight_total numeric, next_notes text, next_lines jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.costing_purchase_invoices; saved jsonb;
begin
 if not private.is_manager() then raise exception 'Acesso negado'; end if;
 select * into existing from public.costing_purchase_invoices where id=target_invoice_id for update;
 if existing.id is null then raise exception 'Nota não encontrada'; end if;
 if existing.archived_at is not null then raise exception 'Esta nota foi excluída. Restaure antes de editar.'; end if;
 if existing.replaced_by is not null then raise exception 'Esta nota já foi corrigida. Atualize a lista antes de editar.'; end if;
 if expected_invoice is distinct from (select value from jsonb_array_elements(public.manager_get_costing_purchase_workspace()) value where value->>'id'=target_invoice_id::text) then raise exception 'Esta nota foi alterada. Atualize e abra a edição novamente.'; end if;
 update public.costing_purchase_invoices set archived_at=now() where id=target_invoice_id;
 saved:=public.manager_save_costing_purchase_invoice_v2(next_supplier_name,next_invoice_number,next_series,next_issued_on,next_discount_total,next_freight_total,next_notes,next_lines);
 update public.costing_purchase_invoices set archived_at=existing.archived_at,replaced_by=(saved->>'id')::uuid where id=target_invoice_id;
 insert into private.costing_catalog_edit_audit(entity_kind,entity_id,before_data,after_data,actor_id) values('invoice',target_invoice_id,expected_invoice,saved,auth.uid());
 return saved;
end $$;;

