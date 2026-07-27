begin;

-- Índices direcionados aos fluxos de maior uso da operação. Eles cobrem as
-- chaves estrangeiras usadas por relatórios, caixa, reconciliação, CRM,
-- check-in e pedidos sem criar índices indiscriminadamente em toda a base.

create index if not exists instant_orders_store_id_idx
  on public.instant_orders (store_id)
  where store_id is not null;
create index if not exists instant_orders_cash_session_id_idx
  on public.instant_orders (cash_session_id)
  where cash_session_id is not null;
create index if not exists instant_orders_cash_register_id_idx
  on public.instant_orders (cash_register_id)
  where cash_register_id is not null;
create index if not exists instant_orders_pickup_location_id_idx
  on public.instant_orders (pickup_location_id)
  where pickup_location_id is not null;
create index if not exists instant_orders_payment_method_code_idx
  on public.instant_orders (payment_method_code)
  where payment_method_code is not null;
create index if not exists instant_order_items_flavor_id_idx
  on public.instant_order_items (flavor_id)
  where flavor_id is not null;

create index if not exists cash_movements_order_id_idx
  on public.cash_movements (order_id)
  where order_id is not null;
create index if not exists cash_movements_register_id_idx
  on public.cash_movements (register_id);
create index if not exists cash_movements_payment_method_code_idx
  on public.cash_movements (payment_method_code)
  where payment_method_code is not null;
create index if not exists cash_reconciliation_queue_session_id_idx
  on public.cash_reconciliation_queue (reconciled_cash_session_id)
  where reconciled_cash_session_id is not null;

create index if not exists customer_checkins_register_id_idx
  on public.customer_checkins (register_id)
  where register_id is not null;

create index if not exists service_requests_product_id_idx
  on public.service_requests (product_id);
create index if not exists service_requests_assigned_to_idx
  on public.service_requests (assigned_to)
  where assigned_to is not null;
create index if not exists crm_tasks_profile_id_idx
  on public.crm_tasks (profile_id)
  where profile_id is not null;
create index if not exists crm_tasks_service_request_id_idx
  on public.crm_tasks (service_request_id)
  where service_request_id is not null;
create index if not exists crm_tasks_assigned_to_idx
  on public.crm_tasks (assigned_to)
  where assigned_to is not null;
create index if not exists crm_notes_service_request_id_idx
  on public.crm_notes (service_request_id)
  where service_request_id is not null;

commit;
