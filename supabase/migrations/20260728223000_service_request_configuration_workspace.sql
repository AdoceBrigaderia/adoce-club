begin;

create or replace function public.staff_get_service_request_workspace(
  search_text text default '',
  requested_status text default null,
  result_limit integer default 80
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_search text := lower(btrim(coalesce(search_text, '')));
  normalized_status text := nullif(lower(btrim(coalesce(requested_status, ''))), '');
  safe_limit integer := greatest(1, least(coalesce(result_limit, 80), 100));
begin
  if (select auth.uid()) is null or not exists (
    select 1
    from public.staff_members staff
    where staff.user_id = (select auth.uid())
      and staff.active
      and (
        staff.role::text in ('owner', 'manager')
        or exists (
          select 1
          from public.staff_store_assignments assignment
          where assignment.staff_user_id = staff.user_id
            and assignment.active
            and assignment.can_manage_orders
        )
      )
  ) then
    raise exception 'Acesso às encomendas não autorizado';
  end if;

  if normalized_status is not null and normalized_status not in (
    'prebooked', 'quoted', 'awaiting_deposit', 'confirmed', 'in_production',
    'ready', 'completed', 'cancelled', 'expired'
  ) then
    raise exception 'Situação de encomenda inválida';
  end if;

  return coalesce((
    select jsonb_agg(scoped.payload order by scoped.priority, scoped.desired_start, scoped.created_at desc)
    from (
      select
        case request.status
          when 'confirmed' then 1
          when 'in_production' then 2
          when 'ready' then 3
          when 'awaiting_deposit' then 4
          when 'quoted' then 5
          when 'prebooked' then 6
          else 20
        end as priority,
        request.desired_start,
        request.created_at,
        jsonb_build_object(
          'id', request.id,
          'request_number', request.request_number,
          'profile_id', request.profile_id,
          'status', request.status,
          'source', request.source,
          'customer_name', request.customer_name,
          'customer_phone', request.customer_phone,
          'customer_email', request.customer_email,
          'quantity', request.quantity,
          'desired_start', request.desired_start,
          'desired_end', request.desired_end,
          'service_location', request.service_location,
          'customer_notes', request.customer_notes,
          'internal_notes', request.internal_notes,
          'quoted_total', request.quoted_total,
          'deposit_amount', request.deposit_amount,
          'deposit_paid_at', request.deposit_paid_at,
          'expires_at', request.expires_at,
          'created_at', request.created_at,
          'updated_at', request.updated_at,
          'product', jsonb_build_object(
            'id', product.id,
            'name', product.name,
            'segment', product.segment,
            'product_type', product.product_type,
            'customization_mode', product.customization_mode,
            'image_url', product.image_url,
            'base_price', product.base_price
          ),
          'configuration', case
            when cake.request_id is not null then jsonb_build_object(
              'kind', 'cake',
              'summary', cake.selection_summary,
              'selection', cake.canonical_selection,
              'estimated_price', cake.estimated_price,
              'estimated_internal_cost', case when private.is_manager() then cake.estimated_internal_cost else null end
            )
            when configured.request_id is not null then jsonb_build_object(
              'kind', configured.product_type,
              'summary', configured.selection_summary,
              'selection', configured.canonical_selection,
              'estimated_price', configured.estimated_price,
              'estimated_internal_cost', case when private.is_manager() then configured.estimated_internal_cost else null end
            )
            else jsonb_build_object(
              'kind', coalesce(product.product_type, 'fixed'),
              'summary', coalesce(request.selections->'preferences', '[]'::jsonb),
              'selection', request.selections,
              'estimated_price', coalesce(request.quoted_total, product.base_price),
              'estimated_internal_cost', null
            )
          end,
          'pricing', case
            when pricing.request_id is null then null
            when private.is_manager() then jsonb_build_object(
              'total_price', pricing.total_price,
              'total_cost', pricing.total_cost,
              'gross_profit', pricing.gross_profit,
              'margin', pricing.margin,
              'markup', pricing.markup,
              'minimum_margin', pricing.minimum_margin,
              'margin_alert', pricing.margin_alert,
              'data_status', pricing.data_status,
              'captured_at', pricing.captured_at
            )
            else jsonb_build_object(
              'total_price', pricing.total_price,
              'margin_alert', pricing.margin_alert,
              'data_status', pricing.data_status,
              'captured_at', pricing.captured_at
            )
          end
        ) as payload
      from public.service_requests request
      join public.commercial_products product on product.id = request.product_id
      left join public.service_request_cake_builds cake on cake.request_id = request.id
      left join public.service_request_product_configurations configured on configured.request_id = request.id
      left join public.service_request_pricing_snapshots pricing on pricing.request_id = request.id
      where (normalized_status is null or request.status = normalized_status)
        and (
          normalized_search = ''
          or lower(concat_ws(' ',
            request.request_number,
            request.customer_name,
            request.customer_phone,
            coalesce(request.customer_email, ''),
            product.name,
            coalesce(request.customer_notes, '')
          )) like '%' || normalized_search || '%'
        )
      order by priority, request.desired_start, request.created_at desc
      limit safe_limit
    ) scoped
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.staff_get_service_request_workspace(text,text,integer)
  from public, anon, authenticated;
grant execute on function public.staff_get_service_request_workspace(text,text,integer)
  to authenticated;

comment on function public.staff_get_service_request_workspace(text,text,integer) is
  'Lista encomendas com composição estruturada, ocultando custos internos de perfis não gerenciais.';

commit;
