-- Pede Junto: recados do grupo e o elo com o Mercado Pago.
--
-- CORRECAO DE ROTA. A primeira versao desta migracao criava `group_orders` e
-- `group_order_participants` — tabelas que nunca existiram. O Pede Junto ja
-- esta inteiro no banco desde 21/07, em `pede_junto_groups` e
-- `pede_junto_participants`, e o participante **ja tem** `payment_url`,
-- `payment_expires_at`, `paid_at` e os status `payment_pending` e `paid`.
--
-- Ou seja: metade do pagamento individual ja estava construida e parada.
-- Esta migracao acrescenta so o que falta de verdade:
--
--   1. o id da preferencia do Mercado Pago, para o webhook achar a pessoa
--   2. os recados do grupo
--
-- O gargalo que isso resolve, nas palavras do Rubens:
--
--   "o organizador fica com toda a responsabilidade dos pagamentos e isso faz
--    com que eles desistam"

-- ------------------------------------------------- 1. o elo com o Mercado Pago

alter table public.pede_junto_participants
  add column if not exists mp_preference_id text,
  add column if not exists mp_payment_id text;

-- O webhook do Mercado Pago chega com o id do pagamento e mais nada. Sem este
-- indice, achar de quem e o pagamento vira varredura na tabela inteira.
create index if not exists pede_junto_participants_mp_payment_idx
  on public.pede_junto_participants (mp_payment_id)
  where mp_payment_id is not null;

comment on column public.pede_junto_participants.mp_preference_id is
  'Preferencia do Mercado Pago desta pessoa. So nasce quando a operacao marca que separou — ninguem paga antes disso.';

-- ------------------------------------------------------------ 2. os recados

-- A combinacao do grupo acontece de qualquer jeito. Hoje ela acontece num
-- WhatsApp onde a Adoce nao esta, e por isso a duvida que trava o pedido
-- ("cabe mais uma?", "que horas busca?") nao chega em quem sabe responder.

create table if not exists public.pede_junto_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.pede_junto_groups(id) on delete cascade,
  participant_id uuid references public.pede_junto_participants(id) on delete set null,
  -- Recado da Adoce nao tem participante: e a operacao respondendo.
  from_adoce boolean not null default false,
  author_name text not null,
  body text not null check (char_length(btrim(body)) between 1 and 280),
  created_at timestamptz not null default now(),
  constraint recado_tem_dono check (from_adoce or participant_id is not null)
);

create index if not exists pede_junto_messages_group_idx
  on public.pede_junto_messages (group_id, created_at);

comment on table public.pede_junto_messages is
  'Recados do grupo. A conversa acontece de qualquer jeito; aqui ela acontece onde a Adoce consegue responder.';

-- ----------------------------------------------------------------------- RLS
-- Mesmo caminho do resto do Pede Junto desde `pede_junto_bff_only`: o
-- navegador nunca fala com a tabela. Tudo passa pelo BFF, que confere o token
-- do participante antes de qualquer leitura ou escrita.

alter table public.pede_junto_messages enable row level security;
revoke all on public.pede_junto_messages from anon, authenticated;
