# Prompt 16 para o Codex — produção, e o Pede Junto no lugar certo
**11/08/2026** · Cole tudo abaixo da linha.

---

## Antes de tudo: dois acertos seus

Você recusou aplicar as 102 sobre estado divergente, e recusou dizer que integrou o que não integrou. As duas decisões estavam certas. A segunda expôs um erro meu, descrito na Parte 2.

---

# Parte 1 — Produção

## Por que a aplicação foi recusada

A interface de banco que você usou **atribui carimbo novo a cada migração** — ela não aceita preservar `version` histórico. Não é permissão faltando; é a ferramenta errada para a tarefa.

O caminho que preserva carimbo é o CLI, ligado ao projeto de produção:

```bash
supabase link --project-ref <ref-de-producao>
supabase db push --dry-run     # lista o que vai rodar, sem rodar
supabase db push
```

`db push` lê `supabase/migrations/`, compara com `supabase_migrations.schema_migrations` do alvo e aplica **só o que falta, com o `version` do arquivo**. É exatamente o que você precisa.

Se o CLI não estiver disponível no seu ambiente, o equivalente manual, uma migração por vez:

```sql
begin;
  -- o conteúdo do arquivo
  insert into supabase_migrations.schema_migrations (version, name, statements)
  values ('<version do nome do arquivo>', '<name>', array[...]);
commit;
```

Cada uma na própria transação. Falhou uma, `rollback` e siga para a seguinte — anote qual e continue.

## As três que só existem em produção

```sql
select version, name, statements
  from supabase_migrations.schema_migrations
 where name in ('fin_personal_planning_schema',
                'fin_recurrence_engine_v2',
                'app_saas_homologacao_multi_conta')
 order by version;
```

`statements` traz o SQL que rodou. Salve as três como arquivos em `supabase/migrations/` **com o `version` que já está gravado** — carimbo novo faria rodar de novo. Commit na homologação e siga. Se alguma vier sem `statements`, reconstrua do estado real (`information_schema.columns`, `pg_policies`, `pg_get_functiondef`) e siga também. Não pare por isso.

⚠️ As duas `fin_*` são o planejamento financeiro pessoal do Rubens e da Beth, isoladas por RLS, com dados reais. Não apague, não mova, não "limpe".

## O cuidado que não pode faltar

Existe em produção um gatilho aplicado direto no banco, `private.sincronizar_reserva_de_fatias()`, que é o que faz a reserva **baixar fatia do estoque**. Sem ele, o site vende e o estoque não anda — foi assim que a Adoce perdeu cliente em 07/08.

Antes de aplicar:

```bash
git grep -l "submit_instant_order" -- supabase/migrations
```

Guarde `pg_get_functiondef` do gatilho e das versões atuais. Se o lote recriar `submit_instant_order`, **recrie o gatilho depois** e confirme que está ativo. Não é motivo para parar; é motivo para conferir no fim.

## Conferir, nesta ordem

1. o site abre e mostra o que tem hoje
2. uma reserva de teste **baixa a fatia do estoque** ← se falhar, é o gatilho
3. o aviso de pedido chega (Telegram e Web Push)
4. quem já tem carimbos entra no Clube **sem** ver oferta de cadastro
5. `#sabores` abre com foto grande e tem saída

---

# Parte 2 — Pede Junto: eu errei o alvo

Você disse que as três funções BFF não existem em cópia local. Não existem mesmo: **eu pedi que você as criasse em vez de escrevê-las.** Corrigido agora.

Mas o erro maior é outro, e mudou o desenho:

**O Pede Junto já está inteiro no banco desde 21/07.** Existem `pede_junto_groups`, `pede_junto_participants`, `pede_junto_items`, a RPC `pede_junto_room()`, e a tela `GroupOrderPage.tsx` já roteada em `#pede-junto`. Mais que isso: **`pede_junto_participants` já tem `payment_url`, `payment_expires_at`, `paid_at` e os status `payment_pending` e `paid`.**

Metade do pagamento individual já estava construída e parada.

Minha migração criava `group_orders` e `group_order_participants` — tabelas que nunca existiram. **Não crie tela nova em `#pede-junto`.** Reescrevi:

```
supabase/migrations/20260811150000_pede_junto_pagamento.sql   (refeita, agora só o que falta)
src/pede-junto-pagamento.ts                                    (+ adaptador do banco real)
src/pede-junto-pagamento.test.ts                               (25 testes verdes aqui)
src/PedeJuntoPagamento.tsx
src/pede-junto-pagamento.css
```

A migração agora acrescenta só duas coisas: `mp_preference_id` / `mp_payment_id` em `pede_junto_participants`, e a tabela `pede_junto_messages` para os recados.

## O que ligar

**`PedeJuntoPagamento` é seção dentro de `GroupOrderPage`, não rota nova.** Ela entra quando o grupo já foi enviado — o participante abre o mesmo link de sempre e agora vê a própria parte.

`montarGrupo(linhaDoGrupo, linhasDosParticipantes)` traduz o banco para a tela. As fatias e o valor de cada pessoa vêm de `pede_junto_items`; some por participante antes de passar.

Três funções, no padrão de `customer-profile-update.ts` (`export const config = { path: "/api/..." }`, token no `Authorization`, chave secreta só no servidor):

- `netlify/functions/pede-junto-recado.ts` — grava em `pede_junto_messages`. Confere o `participant_token_hash` antes. Recado da Adoce exige sessão de `staff_members` com `active`.
- `netlify/functions/pede-junto-gerar-links.ts` — roda quando a operação move o grupo para `awaiting_payment`. Cria uma preferência do Mercado Pago por participante, grava `mp_preference_id` e `payment_url`, `payment_expires_at`, e passa cada um para `payment_pending`. **Nunca antes de `awaiting_payment`.**
- `netlify/functions/pede-junto-webhook-mp.ts` — acha por `mp_payment_id`, marca `paid` e `paid_at`. Se todos ficarem `paid`, avisa a operação pelo canal que já existe.

A leitura pode aproveitar `pede_junto_room()`, que já existe — estenda-a com os recados em vez de criar rota de leitura nova.

Em homologação, credencial de teste do Mercado Pago. Em produção, **não troque credencial**: se ainda estiver em teste, deixe a seção de pagamento desligada por variável de ambiente e me avise.

## Verificação

```bash
git grep -l "PedeJuntoPagamento" -- src
```

Tem que listar `GroupOrderPage.tsx`. Se listar só o próprio arquivo e o `.test.ts`, não foi integrado — e nesse caso diga isso, como você já fez uma vez.

---

## Me devolva

- hash e id do deploy de homologação e de produção
- quantas migrações entraram em produção e quantas restaram
- `submit_instant_order` foi recriada? o gatilho está de pé?
- a saída do `git grep`

## O que NÃO fazer

- Não mexer nas tabelas `fin_*`
- Não inventar `version` novo para as três
- Não criar tabela ou rota nova de Pede Junto — use o que já existe
- Não gerar link de pagamento antes de `awaiting_payment`
- Não deixar produção sem o gatilho de baixa de estoque
- Não parar para pedir aprovação: se travar, pule e deixe por último
