begin;
create table private.costing_margin_settings (
  singleton boolean primary key default true check(singleton),
  payment_fee_percent numeric(6,4) not null default 1 check(payment_fee_percent>=0 and payment_fee_percent<100),
  reference_sales_total numeric(12,2) not null default 4494,
  reference_fees_total numeric(12,2) not null default 44.86,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table private.costing_margin_settings enable row level security;
revoke all on private.costing_margin_settings from public,anon,authenticated;
grant all on private.costing_margin_settings to service_role;
insert into private.costing_margin_settings(singleton) values(true);

create function public.manager_get_costing_margin_settings()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_manager() then raise exception 'Apenas proprietários e gerentes podem consultar a taxa estimada das fichas'; end if;
  return (select jsonb_build_object('payment_fee_percent',payment_fee_percent,'reference_sales_total',reference_sales_total,'reference_fees_total',reference_fees_total) from private.costing_margin_settings where singleton);
end;
$$;
create function public.manager_set_costing_payment_fee(next_percent numeric)
returns numeric language plpgsql security definer set search_path='' as $$
declare previous_percent numeric;
begin
  if not private.is_manager() then raise exception 'Apenas proprietários e gerentes podem alterar a taxa estimada das fichas'; end if;
  if next_percent is null or next_percent::text in ('NaN','Infinity','-Infinity') or next_percent<0 or next_percent>=100 or next_percent<>round(next_percent,4) then raise exception 'Informe uma taxa de 0 a menos de 100%%, com até quatro casas decimais'; end if;
  select payment_fee_percent into previous_percent from private.costing_margin_settings where singleton for update;
  update private.costing_margin_settings set payment_fee_percent=next_percent,updated_at=now(),updated_by=(select auth.uid()) where singleton;
  if not found then raise exception 'Configuração de margem indisponível'; end if;
  if previous_percent is distinct from next_percent then
    insert into public.audit_events(actor_user_id,action,entity_type,entity_id,payload)
    values((select auth.uid()),'costing.payment_fee_updated','costing_margin_settings','global',jsonb_build_object('previous_percent',previous_percent,'next_percent',next_percent));
  end if;
  return next_percent;
end;
$$;
revoke all on function public.manager_get_costing_margin_settings() from public,anon,authenticated;
revoke all on function public.manager_set_costing_payment_fee(numeric) from public,anon,authenticated;
grant execute on function public.manager_get_costing_margin_settings() to authenticated;
grant execute on function public.manager_set_costing_payment_fee(numeric) to authenticated;
comment on table private.costing_margin_settings is 'Taxa média estimada para margens das fichas. Inicialmente 1%, baseada no relatório fornecido: R$4494 de vendas e R$44,86 de taxas estimadas (0,99821985%). Não altera taxas do caixa nem preços comerciais.';
commit;
