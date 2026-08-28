begin;

-- Um pedido so pode apontar para um membro ativo cujo telefone normalizado
-- corresponda ao telefone informado no proprio pedido. A sessao autenticada
-- pode pertencer ao atendente ou a outro cliente e nao e prova de identidade.
create or replace function private.attach_instant_order_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_phone text := right(
    regexp_replace(coalesce(new.customer_phone, ''), '\D', '', 'g'),
    11
  );
  matching_profile_id uuid;
  matching_profile_count integer := 0;
begin
  if nullif(order_phone, '') is null then
    new.profile_id := null;
    return new;
  end if;

  if new.profile_id is not null and not exists (
    select 1
    from public.profiles profile
    where profile.id = new.profile_id
      and profile.active
      and right(
        regexp_replace(coalesce(profile.phone_e164, ''), '\D', '', 'g'),
        11
      ) = order_phone
  ) then
    new.profile_id := null;
  end if;

  if new.profile_id is null then
    select min(profile.id::text)::uuid, count(*)::integer
    into matching_profile_id, matching_profile_count
    from public.profiles profile
    where profile.active
      and right(
        regexp_replace(coalesce(profile.phone_e164, ''), '\D', '', 'g'),
        11
      ) = order_phone;

    if matching_profile_count = 1 then
      new.profile_id := matching_profile_id;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.attach_instant_order_profile()
  from public, anon, authenticated;

create or replace function private.link_instant_order_member(target_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile_id uuid;
  order_phone text;
  matching_profile_id uuid;
  matching_profile_count integer := 0;
begin
  select target.profile_id,
    right(regexp_replace(coalesce(target.customer_phone, ''), '\D', '', 'g'), 11)
  into current_profile_id, order_phone
  from public.instant_orders target
  where target.id = target_order_id
  for update;

  if not found then
    return null;
  end if;

  if current_profile_id is not null and not exists (
    select 1
    from public.profiles profile
    where profile.id = current_profile_id
      and profile.active
      and right(
        regexp_replace(coalesce(profile.phone_e164, ''), '\D', '', 'g'),
        11
      ) = order_phone
  ) then
    update public.instant_orders
    set profile_id = null,
        updated_at = now()
    where id = target_order_id;

    insert into public.audit_events(
      actor_user_id,
      action,
      entity_type,
      entity_id,
      payload
    ) values (
      (select auth.uid()),
      'instant_order.invalid_profile_link_removed',
      'instant_order',
      target_order_id::text,
      jsonb_build_object('reason', 'phone_mismatch')
    );

    current_profile_id := null;
  end if;

  if current_profile_id is not null then
    return current_profile_id;
  end if;

  if nullif(order_phone, '') is null then
    return null;
  end if;

  select min(profile.id::text)::uuid, count(*)::integer
  into matching_profile_id, matching_profile_count
  from public.profiles profile
  where profile.active
    and right(
      regexp_replace(coalesce(profile.phone_e164, ''), '\D', '', 'g'),
      11
    ) = order_phone;

  if matching_profile_count <> 1 then
    return null;
  end if;

  update public.instant_orders
  set profile_id = matching_profile_id,
      updated_at = now()
  where id = target_order_id
  returning profile_id into current_profile_id;

  return current_profile_id;
end;
$$;

revoke all on function private.link_instant_order_member(uuid)
  from public, anon, authenticated;

-- Corrige somente pedidos ainda ativos. Historico concluido nunca e reescrito.
with invalid_active_links as (
  select target.id, target.profile_id as previous_profile_id
  from public.instant_orders target
  left join public.profiles profile on profile.id = target.profile_id
  where target.profile_id is not null
    and target.status not in ('completed', 'cancelled', 'expired')
    and (
      profile.id is null
      or not profile.active
      or right(
        regexp_replace(coalesce(profile.phone_e164, ''), '\D', '', 'g'),
        11
      ) <> right(
        regexp_replace(coalesce(target.customer_phone, ''), '\D', '', 'g'),
        11
      )
    )
), cleared_links as (
  update public.instant_orders target
  set profile_id = null,
      updated_at = now()
  from invalid_active_links invalid_link
  where target.id = invalid_link.id
  returning target.id, invalid_link.previous_profile_id
)
insert into public.audit_events(
  actor_user_id,
  action,
  entity_type,
  entity_id,
  payload
)
select
  null,
  'instant_order.invalid_profile_link_removed',
  'instant_order',
  cleared_link.id::text,
  jsonb_build_object(
    'reason', 'migration_phone_mismatch',
    'previous_profile_id', cleared_link.previous_profile_id
  )
from cleared_links cleared_link;

comment on function private.attach_instant_order_profile() is
  'Vincula pedido ao Clube somente quando ha exatamente um perfil ativo com o mesmo telefone normalizado.';

comment on function private.link_instant_order_member(uuid) is
  'Revalida telefone e atividade antes de expor ou aplicar fidelidade a um pedido instantaneo.';

commit;
