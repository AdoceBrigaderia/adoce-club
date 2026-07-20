create or replace function public.accept_referral_invite(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile_id uuid := (select auth.uid());
  referrer_id uuid;
  existing_referral public.referrals%rowtype;
begin
  if current_profile_id is null then
    raise exception 'Entre no Clube Adoce para aceitar o convite';
  end if;

  select profile_id into referrer_id
  from public.referral_codes
  where code = upper(trim(invite_code)) and active;

  if referrer_id is null then
    raise exception 'Convite de indicação inválido ou desativado';
  end if;
  if referrer_id = current_profile_id then
    raise exception 'Você não pode usar o próprio convite';
  end if;

  select * into existing_referral
  from public.referrals
  where referred_profile_id = current_profile_id;

  if found then
    if existing_referral.referrer_profile_id <> referrer_id then
      raise exception 'Este cadastro já está vinculado a outro convite';
    end if;
    return jsonb_build_object('status', existing_referral.status, 'accepted', false);
  end if;

  if exists (
    select 1 from public.ledger_entries
    where subject_profile_id = current_profile_id and reason = 'purchase'
  ) then
    raise exception 'O bônus de indicação é reservado antes da primeira compra';
  end if;

  insert into public.referrals(referrer_profile_id, referred_profile_id, code, status)
  values (referrer_id, current_profile_id, upper(trim(invite_code)), 'pending');

  return jsonb_build_object('status', 'pending', 'accepted', true);
end;
$$;

revoke all on function public.accept_referral_invite(text) from public, anon;
grant execute on function public.accept_referral_invite(text) to authenticated;

create or replace function public.customer_referral_overview()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when (select auth.uid()) is null then
    jsonb_build_object('pending_count', 0, 'confirmed_count', 0, 'accepted', '[]'::jsonb)
  else jsonb_build_object(
    'pending_count', count(*) filter (where r.status = 'pending'),
    'confirmed_count', count(*) filter (where r.status = 'confirmed'),
    'accepted', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'first_name', split_part(trim(p.full_name), ' ', 1),
          'status', r.status,
          'created_at', r.created_at
        ) order by r.created_at desc
      ) filter (where r.id is not null),
      '[]'::jsonb
    )
  ) end
  from (select 1) seed
  left join public.referrals r on r.referrer_profile_id = (select auth.uid())
  left join public.profiles p on p.id = r.referred_profile_id;
$$;

revoke all on function public.customer_referral_overview() from public, anon;
grant execute on function public.customer_referral_overview() to authenticated;

create or replace function public.staff_record_purchase(
  account_id uuid,
  participant_profile_id uuid,
  quantity smallint,
  idempotency_key text,
  referral_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  main_track_id uuid;
  purchase_result jsonb;
  pending_referral public.referrals%rowtype;
  referrer_id uuid;
  referrer_track_id uuid;
  purchase_entry_id uuid;
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso não autorizado';
  end if;
  if idempotency_key is null or char_length(idempotency_key) < 12 then
    raise exception 'Chave de idempotência inválida';
  end if;
  if not exists (
    select 1 from public.account_memberships m
    where m.account_id = staff_record_purchase.account_id
      and m.profile_id = participant_profile_id and m.active
  ) then raise exception 'Participante não pertence à conta'; end if;

  select id into main_track_id from public.loyalty_tracks
  where loyalty_tracks.account_id = staff_record_purchase.account_id and kind = 'main';

  purchase_result := private.advance_track(
    main_track_id, quantity, participant_profile_id, 'purchase',
    idempotency_key, jsonb_build_object('quantity', quantity)
  );
  purchase_entry_id := (purchase_result ->> 'ledger_entry_id')::uuid;

  if (select count(*) from public.ledger_entries
      where subject_profile_id = participant_profile_id and reason = 'purchase') = 1 then
    select * into pending_referral
    from public.referrals
    where referred_profile_id = participant_profile_id and status = 'pending'
    for update;

    if not found and referral_code is not null then
      select profile_id into referrer_id from public.referral_codes
      where code = upper(trim(referral_code)) and active and profile_id <> participant_profile_id;
      if referrer_id is not null then
        insert into public.referrals(referrer_profile_id, referred_profile_id, code, status)
        values (referrer_id, participant_profile_id, upper(trim(referral_code)), 'pending')
        returning * into pending_referral;
      end if;
    end if;

    if pending_referral.id is not null then
      referrer_id := pending_referral.referrer_profile_id;
      update public.referrals
      set status = 'confirmed', first_purchase_ledger_id = purchase_entry_id, confirmed_at = now()
      where id = pending_referral.id;

      perform private.advance_track(
        main_track_id, 1, participant_profile_id, 'referral_referred',
        idempotency_key || ':referred', jsonb_build_object('referrer_id', referrer_id)
      );

      select t.id into referrer_track_id
      from public.loyalty_tracks t
      join public.account_memberships m on m.account_id = t.account_id
      where m.profile_id = referrer_id and m.is_primary and m.active and t.kind = 'referral';

      perform private.advance_track(
        referrer_track_id, 1, referrer_id, 'referral_referrer',
        idempotency_key || ':referrer', jsonb_build_object('referred_profile_id', participant_profile_id)
      );
    end if;
  end if;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values ((select auth.uid()), 'purchase.recorded', 'loyalty_account', account_id::text,
    jsonb_build_object('quantity', quantity, 'participant_profile_id', participant_profile_id));

  return purchase_result || jsonb_build_object(
    'referral_confirmed', pending_referral.id is not null
  );
end;
$$;

revoke all on function public.staff_record_purchase(uuid,uuid,smallint,text,text) from public, anon;
grant execute on function public.staff_record_purchase(uuid,uuid,smallint,text,text) to authenticated;

update public.flavors
set name = 'Chocolate trufado com brigadeiro de Ninho e pedaços de morango',
    short_description = 'Chocolate trufado, brigadeiro de Ninho e pedaços de morango.',
    image_path = '/adoce-hoje/trufado-ninho-morango.webp'
where name = 'Trufado de Ninho com morangos';

insert into public.flavors(name, category, short_description, description, image_path, base_price, active, sort_order)
values
  ('Chocolatudo trufado com morangos', 'traditional', 'Chocolate intenso, recheio trufado e morangos.', 'Camadas de chocolate com recheio trufado e morangos.', '/adoce-hoje/chocolatudo-trufado-morangos.webp', 16, true, 2),
  ('Brigadeiro de chocolate com castanha de caju', 'traditional', 'Brigadeiro cremoso com a crocância da castanha de caju.', 'Massa macia, brigadeiro de chocolate e castanha de caju.', '/adoce-hoje/brigadeiro-castanha.webp', 16, true, 6)
on conflict do nothing;

delete from public.flavor_availability where service_date = current_date;
insert into public.flavor_availability(flavor_id, service_date, status, note)
select id, current_date, 'available', 'Disponível para retirada imediata'
from public.flavors
where name in (
  'Chocolatudo',
  'Chocolatudo trufado com morangos',
  'Oreo',
  'Ferrero Rocher',
  'Abacaxi com coco',
  'Brigadeiro de chocolate com castanha de caju',
  'Chocolate trufado com brigadeiro de Ninho e pedaços de morango'
);

update public.flavors set sort_order = case name
  when 'Chocolatudo' then 1
  when 'Chocolatudo trufado com morangos' then 2
  when 'Oreo' then 3
  when 'Ferrero Rocher' then 4
  when 'Abacaxi com coco' then 5
  when 'Brigadeiro de chocolate com castanha de caju' then 6
  when 'Chocolate trufado com brigadeiro de Ninho e pedaços de morango' then 7
  else sort_order + 10
end;
