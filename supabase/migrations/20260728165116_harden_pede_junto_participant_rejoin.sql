begin;

-- O convite identifica o grupo, não a pessoa. Um telefone que já participa
-- só pode reutilizar a entrada quando apresenta o token HttpOnly emitido
-- anteriormente. Isso impede que o convite compartilhado seja usado para
-- substituir silenciosamente a identidade de outro participante.
create or replace function public.join_pede_junto_group_v2(
  group_code text,
  invitation_token text,
  participant_name text,
  participant_phone text,
  current_participant_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.pede_junto_groups%rowtype;
  existing_participant public.pede_junto_participants%rowtype;
  normalized_phone text;
  issued_participant_token text;
  target_participant_id uuid;
begin
  select *
  into target
  from public.pede_junto_groups target_group
  where target_group.public_code = upper(trim(group_code))
  for update;

  if not found
    or target.invitation_token_hash <> private.pede_junto_hash(invitation_token)
  then
    raise exception 'Convite inválido ou expirado';
  end if;

  if target.status <> 'open' or target.closes_at <= now() then
    raise exception 'Este grupo já foi encerrado';
  end if;

  if char_length(trim(participant_name)) not between 2 and 80 then
    raise exception 'Informe seu nome';
  end if;

  normalized_phone := private.normalize_br_phone(participant_phone);

  select *
  into existing_participant
  from public.pede_junto_participants participant
  where participant.group_id = target.id
    and participant.phone_e164 = normalized_phone
  for update;

  if found then
    if nullif(btrim(current_participant_token), '') is null
      or existing_participant.participant_token_hash
        <> private.pede_junto_hash(current_participant_token)
    then
      raise exception using
        message = 'Não foi possível concluir a entrada com este acesso.',
        hint = 'Continue no aparelho já autorizado ou valide o WhatsApp para recuperar o acesso.';
    end if;

    issued_participant_token := current_participant_token;
    target_participant_id := existing_participant.id;

    update public.pede_junto_participants participant
    set name = trim(participant_name),
        status = 'active',
        updated_at = now()
    where participant.id = existing_participant.id;
  else
    issued_participant_token := encode(extensions.gen_random_bytes(24), 'hex');

    insert into public.pede_junto_participants(
      group_id,
      name,
      phone_e164,
      participant_token_hash
    )
    values (
      target.id,
      trim(participant_name),
      normalized_phone,
      private.pede_junto_hash(issued_participant_token)
    )
    returning id into target_participant_id;
  end if;

  return jsonb_build_object(
    'participant_id', target_participant_id,
    'participant_token', issued_participant_token,
    'room', private.pede_junto_room_payload(
      target.id,
      issued_participant_token
    )
  );
end;
$$;

-- A versão anterior girava o token no conflito por telefone. Ela permanece
-- no histórico para compatibilidade de migrations, porém não é mais chamável.
revoke all on function public.join_pede_junto_group(text,text,text,text)
  from public, anon, authenticated, service_role;

revoke all on function public.join_pede_junto_group_v2(text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.join_pede_junto_group_v2(text,text,text,text,text)
  to service_role;

comment on function public.join_pede_junto_group_v2(text,text,text,text,text) is
  'Entrada BFF no Pede Junto sem permitir rotação do token de outro participante.';

commit;
