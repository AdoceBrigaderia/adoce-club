-- staff-redeem-reward-slice.ts fazia ~13 gravacoes sequenciais direto da
-- function, com a chave de servico, sem transacao: reward -> loyalty_tracks
-- -> ledger_entries -> flavor_availability -> flavor_availability_batches.
-- O decremento do estoque era leitura-e-escrita sem trava; dois resgates
-- simultaneos no mesmo sabor podiam vender a mesma ultima fatia duas vezes,
-- e uma falha no meio deixava o premio "redeemed" sem baixar o estoque.
--
-- public.staff_redeem_reward ja existe, e correto e atomico pra parte do
-- premio (reward + loyalty_tracks + ledger_entries + outbox + audit, com
-- "for update" e idempotencia). Esta funcao reaproveita ela e acrescenta,
-- na mesma transacao e com o mesmo padrao de trava, a baixa do sabor
-- escolhido - sem duplicar a logica do premio.

begin;

create or replace function public.staff_redeem_reward_slice(
  reward_id uuid,
  flavor_id uuid,
  idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  flavor_row public.flavors%rowtype;
  availability public.flavor_availability%rowtype;
  already_redeemed boolean;
  redemption jsonb;
  today date := (now() at time zone 'America/Fortaleza')::date;
  batch_id uuid;
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso não autorizado';
  end if;
  if staff_redeem_reward_slice.idempotency_key is null
     or char_length(staff_redeem_reward_slice.idempotency_key) < 12 then
    raise exception 'Chave de idempotência inválida';
  end if;

  select * into flavor_row from public.flavors
  where id = staff_redeem_reward_slice.flavor_id;
  if not found then
    raise exception 'Sabor não encontrado';
  end if;

  -- Trava o premio antes de decidir qualquer coisa. Se esta chamada e uma
  -- repeticao exata (mesma idempotency_key ja gravada), a baixa de estoque
  -- abaixo e pulada - repetir a baixa numa repeticao venderia a fatia de novo.
  -- coalesce é essencial aqui: redemption_idempotency_key é nulo num prêmio
  -- nunca resgatado, e "null = texto" avalia null, não false - um "if not
  -- already_redeemed" com already_redeemed nulo pula o bloco calado,
  -- deixando a baixa de estoque de fora justamente no resgate novo.
  select coalesce(redemption_idempotency_key = staff_redeem_reward_slice.idempotency_key, false)
  into already_redeemed
  from public.rewards
  where id = staff_redeem_reward_slice.reward_id
  for update;
  if not found then
    raise exception 'Prêmio não encontrado';
  end if;

  if not already_redeemed then
    -- "flavor_id" sozinho seria ambíguo aqui: é o nome do parâmetro da
    -- função E o nome da coluna da tabela.
    select * into availability from public.flavor_availability fa
    where fa.flavor_id = staff_redeem_reward_slice.flavor_id and fa.service_date = today
    for update;
    if not found or availability.status not in ('available', 'last_units') then
      raise exception 'Este sabor não está disponível hoje para baixar o presente';
    end if;
    if availability.quantity_available is not null
       and (availability.quantity_available - coalesce(availability.quantity_reserved, 0)) < 1 then
      raise exception 'Não há unidade deste sabor para baixar a fatia-presente';
    end if;
  end if;

  -- Reaproveita a RPC ja existente e testada pro premio: ela mesma valida
  -- status, aplica ledger/outbox/auditoria e trata a idempotencia dela.
  redemption := public.staff_redeem_reward(
    staff_redeem_reward_slice.reward_id, false, 0, staff_redeem_reward_slice.idempotency_key
  );

  if not already_redeemed and availability.quantity_available is not null then
    update public.flavor_availability
    set quantity_available = greatest(0, quantity_available - 1),
        updated_at = now()
    where id = availability.id;

    select b.id into batch_id from public.flavor_availability_batches b
    where b.flavor_id = staff_redeem_reward_slice.flavor_id
      and b.service_date = today
      and b.active
      and (b.quantity_available - coalesce(b.quantity_reserved, 0)) >= 1
    order by b.available_from asc
    limit 1
    for update;
    if batch_id is not null then
      update public.flavor_availability_batches
      set quantity_available = greatest(0, quantity_available - 1),
          updated_at = now()
      where id = batch_id;
    end if;
  end if;

  return redemption || jsonb_build_object(
    'flavor_id', staff_redeem_reward_slice.flavor_id,
    'flavor_name', flavor_row.name,
    'already', already_redeemed
  );
end;
$function$;

revoke all on function public.staff_redeem_reward_slice(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.staff_redeem_reward_slice(uuid, uuid, text)
  to authenticated;

commit;
