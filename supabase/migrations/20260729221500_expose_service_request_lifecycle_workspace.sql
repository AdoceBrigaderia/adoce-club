begin;

drop function if exists public.staff_get_service_request_workspace(text,text,integer,uuid);

create or replace function public.staff_get_service_request_workspace(
  search_text text default '',
  requested_status text default null,
  result_limit integer default 80,
  target_store_id uuid default null
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
  if (select auth.uid()) is null
     or not private.staff_has_any_capability('manage_orders') then
    raise exception 'Acesso às encomendas não autorizado';
  end if;

  if target_store_id is not null
     and not private.staff_has_capability(target_store_id, 'manage_orders') then
    raise exception 'Você não possui acesso às encomendas desta loja';
  end if;

  if normalized_status is not null and normalized_status not in (
    'prebooked', 'quoted', 'awaiting_deposit', 'confirmed', 'in_production',
    'ready', 'completed', 'cancelled', 'expired'
  ) then
    raise exception 'Situação de encomenda inválida';
  end if;

  return coalesce((
    select jsonb_agg(
      scoped.payload
      order by scoped.priority, scoped.desired_start, scoped.created_at desc
    )
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
          'store_id', request.store_id,
          'store', jsonb_build_object(
            'id', store.id,
            'name', store.name,
            'public_label', store.public_label
          ),
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
          'quoted_at', request.quoted_at,
          'deposit_amount', request.deposit_amount,
          'deposit_paid_at', request.deposit_paid_at,
          'deposit_payment_method', request.deposit_payment_method,
          'payment_status', request.payment_status,
          'paid_amount', request.paid_amount,
          'balance_paid_at', request.balance_paid_at,
          'balance_payment_method', request.balance_payment_method,
          'production_started_at', request.production_started_at,
          'ready_at', request.ready_at,
          'completed_at', request.completed_at,
          'cancelled_at', request.cancelled_at,
          'cancellation_reason', request.cancellation_reason,
          'refunded_at', request.refunded_at,
          'refund_method', request.refund_method,
          'last_action', request.last_action,
          'last_action_at', request.last_action_at,
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
              'estimated_internal_cost', case
                when private.staff_has_capability(request.store_id, 'view_finance')
                  then cake.estimated_internal_cost
                else null
              end
            )
            when configured.request_id is not null then jsonb_build_object(
              'kind', configured.product_type,
              'summary', configured.selection_summary,
              'selection', configured.canonical_selection,
              'estimated_price', configured.estimated_price,
              'estimated_internal_cost', case
                when private.staff_has_capability(request.store_id, 'view_finance')
                  then configured.estimated_internal_cost
                else null
              end
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
            when private.staff_has_capability(request.store_id, 'view_finance') then jsonb_build_object(
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
      join public.stores store on store.id = request.store_id
      join public.commercial_products product on product.id = request.product_id
      left join public.service_request_cake_builds cake on cake.request_id = request.id
      left join public.service_request_product_configurations configured
        on configured.request_id = request.id
      left join public.service_request_pricing_snapshots pricing
        on pricing.request_id = request.id
      where request.store_id is not null
        and private.staff_has_capability(request.store_id, 'manage_orders')
        and (target_store_id is null or request.store_id = target_store_id)
        and (normalized_status is null or request.status = normalized_status)
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

revoke all on function public.staff_get_service_request_workspace(text,text,integer,uuid)
  from public, anon;
grant execute on function public.staff_get_service_request_workspace(text,text,integer,uuid)
  to authenticated;

comment on function public.staff_get_service_request_workspace(text,text,integer,uuid) is
  'Lista encomendas das lojas autorizadas com ciclo operacional, pagamentos e custos condicionados à capacidade financeira.';

do $$
declare
  workspace_routine regprocedure := to_regprocedure(
    'public.staff_get_service_request_workspace(text,text,integer,uuid)'
  );
  definition text;
begin
  if workspace_routine is null then
    raise exception 'Lifecycle workspace for service requests was not created';
  end if;
  if has_function_privilege('anon', workspace_routine, 'EXECUTE') then
    raise exception 'Lifecycle workspace remains executable by anon';
  end if;
  if not has_function_privilege('authenticated', workspace_routine, 'EXECUTE') then
    raise exception 'Authenticated BFF lost the lifecycle workspace';
  end if;

  select pg_get_functiondef(workspace_routine::oid) into definition;
  if position('private.staff_has_capability(request.store_id, ''manage_orders'')' in definition) = 0
     or position('target_store_id is null or request.store_id = target_store_id' in definition) = 0
     or position('private.staff_has_capability(request.store_id, ''view_finance'')' in definition) = 0
     or position('''payment_status'', request.payment_status' in definition) = 0
     or position('''production_started_at'', request.production_started_at' in definition) = 0
     or position('''refunded_at'', request.refunded_at' in definition) = 0 then
    raise exception 'Lifecycle workspace lost store, finance, payment, production or refund fields';
  end if;
end;
$$;

commit;
