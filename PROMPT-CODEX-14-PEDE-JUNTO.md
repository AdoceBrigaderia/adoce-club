# Prompt 14 para o Codex — Pede Junto com pagamento individual
**11/08/2026** · Cole tudo abaixo da linha. Só homologação.

---

## Por que esta tela existe

O Rubens descreveu o gargalo:

> "o organizador pergunta tudo, fica com toda a responsabilidade dos pagamentos e isso faz com que eles desistam"

Já existe demanda e já existe quem organize. A venda morre no ponto em que **uma pessoa precisa cobrar os amigos**. Tirar o dinheiro das costas do organizador é a mudança que destrava o Pede Junto.

E ela pode ser testada em homologação **agora**: a credencial do Mercado Pago em homologação é de teste, e credencial de teste existe exatamente para isso. Produção continua fora deste prompt.

---

## Arquivos novos deste prompt

```
src/pede-junto-pagamento.ts          (lógica, sem React)
src/pede-junto-pagamento.test.ts     (17 testes, verdes aqui)
src/PedeJuntoPagamento.tsx           (tela)
src/pede-junto-pagamento.css
supabase/migrations/20260811150000_pede_junto_pagamento.sql
```

`tsc --noEmit` limpo e os 17 testes passando na minha verificação.

---

## As três regras que a tela obedece

1. **Ninguém paga antes de a Adoce confirmar que separou.** `podeCobrar()` exige `fechado && separado`. Enquanto o grupo está aberto, não existe link — nem para o organizador.
2. **O organizador acompanha, não cobra.** `listaParaOrganizador()` devolve exatamente `nome`, `fatias`, `pagou`. Nada de meio de pagamento, valor pago ou dado de cartão. Há um teste que trava isso.
3. **Cinco fatias é o mínimo, não o teto.** Já houve grupo com onze moradores. Passando de cinco, a tela diz "ainda cabe mais gente" em vez de fechar.

---

## ⚠️ Confirme os nomes das tabelas antes de aplicar a migração

A migração referencia `public.group_orders` e `public.group_order_participants`. **Não consegui verificar esses nomes** — o Supabase que tenho conectado aqui é de outro projeto. Antes de aplicar:

```sql
select table_name from information_schema.tables
 where table_schema = 'public' and table_name like '%group%';
```

Se os nomes reais forem outros, **corrija as duas `references` e me avise qual é o nome certo.** Não crie tabela nova para contornar.

---

## O que ligar

1. **Rota `#pede-junto`** em `App.tsx`, lazy como as demais.
2. **BFF, nunca a tabela direto.** As duas tabelas novas estão com `revoke all` para `anon` e `authenticated`, como o resto do projeto. Crie:
   - `netlify/functions/auth-bff-pede-junto-grupo.ts` — devolve o grupo, os participantes e os recados
   - `netlify/functions/auth-bff-pede-junto-recado.ts` — grava um recado
   - `netlify/functions/pede-junto-gerar-links.ts` — chamado **quando a operação marca "separado"**: cria uma preferência do Mercado Pago por participante, grava `mp_preference_id` e `payment_url`, e passa o status para `a_pagar`
3. **Webhook do Mercado Pago** — ao confirmar, achar a linha por `mp_payment_id`, marcar `pago` e `paid_at`. Se todos ficarem `pago`, avisar a operação pelo canal que já existe (Telegram / Web Push).
4. **Botão "separei tudo"** na tela da operação, que é o que dispara o passo 3.

O organizador não dispara nada disso. Ele só vê acontecer.

---

## Verificação — de ligação, não de existência

```bash
git grep -l "PedeJuntoPagamento"      -- src
git grep -l "pede-junto-pagamento"    -- src netlify
```

O primeiro tem que listar `App.tsx`. Se listar só o próprio arquivo e o `.test.ts`, **não foi integrado** — e nesse caso não diga que está pronto.

E os dois dados de sempre: **hash do topo de `adoce-oficial/homologacao-adoce`** e **id do deploy do Netlify**.

---

## Teste de aceitação, no celular

1. abrir um grupo ainda aberto → **nenhum botão de pagar em lugar nenhum**, e o texto avisa que se paga depois
2. fechar o grupo, sem marcar separado → continua sem link
3. marcar "separei tudo" → cada participante passa a ver o próprio valor e o próprio link
4. pagar com cartão de teste do Mercado Pago → a linha da pessoa vira ✓ e a conta no rodapé sobe
5. mandar um recado → ele aparece para os outros, e o recado da Adoce vem marcado
6. sair da tela pelo topo **e** pelo rodapé

---

## O que NÃO fazer

- Não mexer em produção nem trocar credencial do Mercado Pago
- Não dar `grant` novo a `anon` ou `authenticated`
- Não mostrar ao organizador nada além de nome, fatias e "pagou"
- Não gerar link de pagamento antes de `separado = true`
- Não dizer que está pronto sem a saída dos dois `git grep`
