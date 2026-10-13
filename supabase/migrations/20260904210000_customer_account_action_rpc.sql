-- customer-account-action.ts fazia ~11 gravacoes sequenciais direto da
-- function, com a chave de servico, sem transacao. Se qualquer passo do
-- meio falhasse, a reversao era escrita a mao (restorePreviousState) e a
-- limpeza de dados do delete_account (customer_account_actions,
-- audit_events, service_requests, crm_notes, crm_tasks) nao tinha reversao
-- nenhuma - so juntava os erros num aviso e devolvia "aplicado" mesmo assim.
--
-- Esta RPC junta profile + customer_account_actions + a limpeza de
-- delete_account numa unica transacao. A chamada ao GoTrue (ban/exclusao de
-- auth.users) continua na function, pois passa pela API administrativa; se
-- ela falhar, a function chama server_revert_customer_account_action(), que
-- desfaz numa unica transacao usando o retrato anterior guardado em
-- metadata->'previous_profile'.

begin;

create or replace function public.server_customer_account_action(
  target_profile_id uuid,
  requested_action text,
  requested_reason_code text,
  requested_reason_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  actor_role text;
  profile_row public.profiles%rowtype;
  resulting_status text;
  will_be_active boolean;
  now_ts timestamptz := now();
  previous_snapshot jsonb;
  profile_update jsonb;
  action_id uuid;
  initial_notification_status text;
begin
  if actor is null then
    raise exception 'Acesso não autorizado';
  end if;
  select role into actor_role from public.staff_members
  where user_id = actor and active;
  if actor_role is null or actor_role not in ('owner', 'manager') then
    raise exception 'Somente proprietários e gerentes podem alterar cadastros';
  end if;

  if requested_action not in (
    'deactivate', 'reactivate', 'request_deletion', 'delete_account',
    'mark_duplicate', 'cancel_deletion'
  ) then
    raise exception 'Ação inválida';
  end if;
  if requested_reason_code not in (
    'duplicate_registration', 'customer_request', 'created_by_mistake',
    'security_review', 'terms_violation', 'legal_requirement', 'other'
  ) then
    raise exception 'Motivo inválido';
  end if;
  if requested_reason_code = 'other'
     and (requested_reason_note is null or char_length(requested_reason_note) < 5) then
    raise exception 'Explique o motivo com pelo menos 5 caracteres';
  end if;
  if target_profile_id = actor then
    raise exception 'Você não pode alterar o próprio cadastro por esta tela';
  end if;

  select * into profile_row from public.profiles
  where id = target_profile_id
  for update;
  if not found then
    raise exception 'Cliente não encontrado';
  end if;

  resulting_status := case requested_action
    when 'delete_account' then 'anonymized'
    when 'request_deletion' then 'pending_deletion'
    when 'reactivate' then 'active'
    when 'cancel_deletion' then 'active'
    else 'deactivated'
  end;
  will_be_active := resulting_status = 'active';

  -- Retrato de antes da mudanca, guardado pra permitir desfazer se a chamada
  -- ao GoTrue (ban/exclusao) falhar depois. member_code pode ser nulo em
  -- cadastros antigos importados - o retrato guarda o que houver.
  previous_snapshot := to_jsonb(profile_row.*);

  profile_update := jsonb_build_object(
    'account_status', resulting_status,
    'active', will_be_active,
    'status_reason_code', requested_reason_code,
    'status_reason_note', requested_reason_note,
    'status_changed_at', now_ts,
    'status_changed_by', actor,
    'updated_at', now_ts
  );
  if requested_action = 'delete_account' then
    profile_update := profile_update || jsonb_build_object(
      'full_name', 'Cadastro excluído ' || right(coalesce(profile_row.member_code, profile_row.id::text), 4),
      'email', null,
      'phone_e164', null,
      'birth_date', null,
      'preferred_channel', 'none',
      'postal_code', null,
      'address_line', null,
      'address_number', null,
      'address_complement', null,
      'neighborhood', null,
      'city', null,
      'state_code', null,
      'flavor_preferences', '[]'::jsonb,
      'whatsapp_verified_at', null,
      'auth_upgraded_at', null
    );
  end if;

  update public.profiles set
    account_status = coalesce(profile_update->>'account_status', account_status),
    active = coalesce((profile_update->>'active')::boolean, active),
    status_reason_code = profile_update->>'status_reason_code',
    status_reason_note = profile_update->>'status_reason_note',
    status_changed_at = now_ts,
    status_changed_by = actor,
    updated_at = now_ts,
    full_name = coalesce(profile_update->>'full_name', full_name),
    email = case when profile_update ? 'email' then null else email end,
    phone_e164 = case when profile_update ? 'phone_e164' then null else phone_e164 end,
    birth_date = case when profile_update ? 'birth_date' then null else birth_date end,
    preferred_channel = coalesce(profile_update->>'preferred_channel', preferred_channel),
    postal_code = case when profile_update ? 'postal_code' then null else postal_code end,
    address_line = case when profile_update ? 'address_line' then null else address_line end,
    address_number = case when profile_update ? 'address_number' then null else address_number end,
    address_complement = case when profile_update ? 'address_complement' then null else address_complement end,
    neighborhood = case when profile_update ? 'neighborhood' then null else neighborhood end,
    city = case when profile_update ? 'city' then null else city end,
    state_code = case when profile_update ? 'state_code' then null else state_code end,
    flavor_preferences = case when profile_update ? 'flavor_preferences' then '{}'::text[] else flavor_preferences end,
    whatsapp_verified_at = case when profile_update ? 'whatsapp_verified_at' then null else whatsapp_verified_at end,
    auth_upgraded_at = case when profile_update ? 'auth_upgraded_at' then null else auth_upgraded_at end
  where id = target_profile_id;

  initial_notification_status := case when profile_row.email is not null then 'pending' else 'not_applicable' end;
  insert into public.customer_account_actions(
    profile_id, actor_user_id, action, reason_code, reason_note,
    previous_status, resulting_status, notification_email, notification_status,
    metadata
  ) values (
    target_profile_id, actor, requested_action, requested_reason_code, requested_reason_note,
    profile_row.account_status, resulting_status, profile_row.email, initial_notification_status,
    jsonb_build_object('previous_profile', previous_snapshot)
  )
  returning id into action_id;

  if requested_action = 'delete_account' then
    update public.customer_account_actions
    set notification_email = null, reason_note = null
    where profile_id = target_profile_id and id <> action_id;
    update public.audit_events
    set payload = jsonb_build_object('anonymized', true)
    where entity_type = 'profile' and entity_id = target_profile_id::text;
    update public.service_requests
    set customer_name = 'Cliente excluído', customer_phone = '550000000000',
        customer_email = null, service_location = 'Dados removidos', customer_notes = ''
    where profile_id = target_profile_id;
    update public.crm_notes
    set note = 'Conteúdo removido após exclusão do cadastro.'
    where profile_id = target_profile_id;
    update public.crm_tasks
    set title = 'Cadastro excluído', description = ''
    where profile_id = target_profile_id;
  end if;

  return jsonb_build_object(
    'action_id', action_id,
    'resulting_status', resulting_status,
    'will_be_active', will_be_active,
    'notification_email', profile_row.email,
    'notification_status', initial_notification_status,
    'full_name', profile_row.full_name
  );
end;
$function$;

create or replace function public.server_revert_customer_account_action(
  action_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  actor_role text;
  action_row public.customer_account_actions%rowtype;
  snapshot jsonb;
begin
  if actor is null then
    raise exception 'Acesso não autorizado';
  end if;
  select role into actor_role from public.staff_members
  where user_id = actor and active;
  if actor_role is null or actor_role not in ('owner', 'manager') then
    raise exception 'Somente proprietários e gerentes podem alterar cadastros';
  end if;

  select * into action_row from public.customer_account_actions
  where id = action_id
  for update;
  if not found then
    raise exception 'Ação não encontrada';
  end if;
  snapshot := action_row.metadata->'previous_profile';
  if snapshot is null then
    raise exception 'Nada para desfazer nesta ação';
  end if;

  update public.profiles set
    account_status = snapshot->>'account_status',
    active = (snapshot->>'active')::boolean,
    status_reason_code = snapshot->>'status_reason_code',
    status_reason_note = snapshot->>'status_reason_note',
    status_changed_at = (snapshot->>'status_changed_at')::timestamptz,
    status_changed_by = (snapshot->>'status_changed_by')::uuid,
    full_name = snapshot->>'full_name',
    email = snapshot->>'email',
    phone_e164 = snapshot->>'phone_e164',
    birth_date = (snapshot->>'birth_date')::date,
    preferred_channel = snapshot->>'preferred_channel',
    postal_code = snapshot->>'postal_code',
    address_line = snapshot->>'address_line',
    address_number = snapshot->>'address_number',
    address_complement = snapshot->>'address_complement',
    neighborhood = snapshot->>'neighborhood',
    city = snapshot->>'city',
    state_code = snapshot->>'state_code',
    flavor_preferences = coalesce(
      (select array_agg(value::text) from jsonb_array_elements_text(snapshot->'flavor_preferences')),
      '{}'::text[]
    ),
    whatsapp_verified_at = (snapshot->>'whatsapp_verified_at')::timestamptz,
    auth_upgraded_at = (snapshot->>'auth_upgraded_at')::timestamptz,
    updated_at = now()
  where id = action_row.profile_id;

  delete from public.customer_account_actions where id = action_id;
end;
$function$;

revoke all on function public.server_customer_account_action(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.server_customer_account_action(uuid, text, text, text)
  to authenticated;
revoke all on function public.server_revert_customer_account_action(uuid)
  from public, anon, authenticated;
grant execute on function public.server_revert_customer_account_action(uuid)
  to authenticated;

commit;
