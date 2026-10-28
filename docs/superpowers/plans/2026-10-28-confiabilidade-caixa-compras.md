# Confiabilidade do caixa e checklist de compras Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir reservas e cadastro que bloqueiam vendas e transformar a lista de compras em checklist opcional e rápido.

**Architecture:** O caixa preserva um rascunho por aba em `sessionStorage`, renova a reserva enquanto ativo e oferece uma RPC auditada para liberar somente outros carrinhos. O cadastro fica desacoplado da venda e o checklist separa conclusão rápida de detalhes opcionais.

**Tech Stack:** React, TypeScript, Vitest, Supabase PostgreSQL/PLpgSQL, Vite.

**Spec:** `docs/superpowers/specs/2026-10-28-confiabilidade-caixa-compras-design.md`

## Global Constraints

- Trabalhar somente em `D:\AdoceOnLine` e executar a verificação de fonte única.
- Preservar alterações locais existentes e não incluí-las na publicação.
- Não criar deploy preview, branch deploy ou ambiente online alternativo.
- Reservas de pedidos reais não podem ser afetadas.
- Produção autorizada somente após testes locais e `npm run release:check`.

## Review Focus

- Duas abas no mesmo caixa mantêm chaves de rascunho independentes.
- Uma reserva ativa não expira enquanto a aba permanece em uso.
- Liberação em massa preserva o carrinho atual e pedidos reais.
- Dados parciais de cliente não bloqueiam nem duplicam a venda.
- Compra parcial mantém somente a quantidade restante pendente.

---

### Task 1: Checklist simples de compras

**Files:**
- Modify: `src/TabletShoppingList.tsx`
- Modify: `src/lib/shopping-procurement.ts`
- Test: `src/lib/shopping-procurement.test.ts`

**Interfaces:**
- Produces: `purchaseCompletion(state, required)` com estados `unrecorded`, `partial` ou `complete`.

- [ ] Escrever testes que provem conclusão sem detalhes e pendência quando há quantidade parcial.
- [ ] Executar o teste e confirmar a falha esperada.
- [ ] Implementar o cálculo e remover a obrigatoriedade de preço/detalhes para marcar o item.
- [ ] Executar o teste e confirmar aprovação.

### Task 2: Cadastro opcional não bloqueia a venda

**Files:**
- Modify: `src/sale-club-enroll.ts`
- Modify: `src/OperationManualSale.tsx`
- Test: `src/sale-club-enroll.test.ts`

**Interfaces:**
- Produces: `canEnrollSaleCustomer(name, phone)` para decidir cadastro posterior sem bloquear a venda.

- [ ] Escrever testes para dados vazios, parciais, válidos e cliente existente sem telefone.
- [ ] Confirmar falha antes da implementação.
- [ ] Usar o predicado apenas para cadastro posterior; remover o bloqueio da finalização.
- [ ] Confirmar testes aprovados.

### Task 3: Rascunho por aba e renovação ativa

**Files:**
- Modify: `src/OperationManualSale.tsx`
- Test: `src/cash-draft-lifecycle.test.ts`

**Interfaces:**
- Consumes: RPC existente `staff_set_cash_draft_reservation`.
- Produces: persistência em `sessionStorage` e renovação periódica do carrinho ativo.

- [ ] Escrever teste estrutural para armazenamento por aba e renovação.
- [ ] Confirmar falha antes da implementação.
- [ ] Trocar o armazenamento e adicionar renovação sem recriar o pedido.
- [ ] Confirmar testes aprovados.

### Task 4: Liberação auditada de outros carrinhos

**Files:**
- Create: migration Supabase gerada por `supabase migration new`.
- Modify: `src/OperationManualSale.tsx`
- Test: `src/cash-draft-lifecycle.test.ts`

**Interfaces:**
- Produces: `public.staff_release_other_cash_drafts(target_session_id uuid, preserved_draft_key text) returns jsonb`.

- [ ] Escrever teste que exija autorização, preservação da chave atual, recálculo e auditoria.
- [ ] Confirmar falha antes de criar a migração.
- [ ] Gerar e implementar a migração e o botão com confirmação.
- [ ] Confirmar testes aprovados.

### Task 5: Validação e publicação isolada

**Files:**
- Modify somente documentação oficial relacionada se o comportamento documentado mudar.

- [ ] Executar testes focados, suíte completa, tipos, build e QA local responsivo.
- [ ] Executar `npm run release:check`.
- [ ] Isolar alterações locais alheias de forma recuperável, publicar somente esta rodada e restaurá-las.
- [ ] Aplicar a migração autorizada e verificar função, cron, reservas e domínio oficial.
