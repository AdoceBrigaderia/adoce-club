# Operação Integrada Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar os 14 itens do prompt mestre como uma operação única, transacional, responsiva e auditável.

**Architecture:** Reusar os modelos existentes de clientes, pedidos, caixa, reservas, fidelidade, WhatsApp, lotes e compras. Consolidar regras em RPCs transacionais e apresentar no React apenas estados derivados dessas fontes.

**Tech Stack:** React, TypeScript, Vite, Vitest, Supabase/PostgreSQL, Netlify Functions, Twilio e Capacitor Android.

**Spec:** `docs/superpowers/specs/2026-10-16-operacao-integrada-design.md`

## Global Constraints

- Trabalhar exclusivamente em `D:\AdoceOnLine`, sem worktree ou cópia.
- Preservar dados e histórico; nenhuma migração destrutiva.
- Usar `America/Fortaleza` para datas operacionais.
- Produção autorizada diretamente após validação; sem homologação separada.
- Carimbos são concedidos na conclusão operacional, inclusive com pagamento parcial, e revertidos por compensação em cancelamento/estorno.

## Review Focus

- Repetição da mesma requisição não pode duplicar venda, pagamento, resgate, carimbo ou transferência.
- Concorrência entre dois operadores não pode vender/resgatar a mesma unidade ou benefício.
- Navegar, desconectar e retornar não pode perder o rascunho nem perpetuar reserva órfã.
- Cancelamento após pagamento parcial deve conciliar caixa, contas a receber, estoque e carimbos.
- Alteração de telefone não pode vincular pedidos ou mensagens de outro cliente.

---

### Task 1: Diretório e edição de clientes

**Files:** `src/AccessApp.tsx`, novos componentes de clientes, `netlify/functions/staff-create-customer.ts`, migração aditiva e testes de clientes.

**Interfaces:** Produz diretório paginado, busca normalizada, códigos de erro e atualização pelo `profile_id` estável.

- [ ] Escrever testes falhos para filtros, paginação, dados obrigatórios, duplicidade, abertura automática e edição preservando vínculos.
- [ ] Criar RPCs de listagem/edição com filtros combináveis, RLS/permissões e retorno agregado sem N+1.
- [ ] Implementar listagem, estados e formulário completo de edição.
- [ ] Verificar testes focados e suíte relacionada.

### Task 2: Busca no pedido, rascunho recuperável e indicadores de estoque

**Files:** `src/OperationManualSale.tsx`, `src/CashCustomerSelector.tsx`, componentes/estilos auxiliares, migração de rascunhos e testes.

**Interfaces:** Consome diretório da Task 1; produz rascunho estável, reserva recuperável e snapshot agregado de estoque.

- [ ] Escrever testes falhos para debounce/race, teclado/toque, restauração e liberação de reservas.
- [ ] Persistir conteúdo completo do rascunho no servidor e criar ciclo de vida/TTL seguro.
- [ ] Implementar recuperação, cancelamento e reconciliação concorrente.
- [ ] Mostrar estoque, reservado e livre sem dupla subtração.
- [ ] Verificar navegação real e concorrência.

### Task 3: Motor financeiro, fidelidade, folha e parcial

**Files:** `src/CashCheckoutDialog.tsx`, `src/OperationManualSale.tsx`, domínio financeiro, migrações/RPCs e testes.

**Interfaces:** Consome rascunho da Task 2; produz alocações recebidas, saldo a receber, funcionário de folha e movimentos de fidelidade auditáveis.

- [ ] Escrever testes falhos para pagamento parcial/misto, folha, fidelidade, quitação posterior, cancelamento e estorno.
- [ ] Implementar RPC transacional idempotente e lançamentos financeiros imutáveis.
- [ ] Implementar seleção obrigatória de funcionário para folha.
- [ ] Conceder carimbos imediatamente e reverter por compensação.
- [ ] Implementar UI de parcial, saldo e recebimentos posteriores.
- [ ] Verificar precisão decimal e relatórios de caixa/contas a receber.

### Task 4: Ciclo online e WhatsApp

**Files:** `src/WhatsAppSupportInbox.tsx`, `netlify/functions/whatsapp-support.ts`, bot Twilio, migrações e testes.

**Interfaces:** Produz paginação de conversas/mensagens, arquivamento lógico em lote e decisão pedido anterior versus nova compra.

- [ ] Escrever testes falhos para paginação, ordenação, seleção em lote, falha parcial e eventos duplicados.
- [ ] Separar expiração do pedido da expiração da reserva física.
- [ ] Implementar consultas e índices paginados e carregamento progressivo de anexos.
- [ ] Implementar arquivamento em lote com confirmação e permissões.
- [ ] Consultar pedidos do dia antes de nova intenção e exigir escolha quando ambíguo.
- [ ] Verificar webhooks repetidos e pedidos múltiplos legítimos.

### Task 5: Produção, continuidade e compras

**Files:** telas de Produtos/Compras e Estoque, `src/lib/purchase-planner.ts`, migração de lotes/rotina e testes.

**Interfaces:** Produz continuidade às 08:00 por lote e cálculo de compra com margem única de 20%.

- [ ] Escrever testes falhos para lote, validade, reservas, repetição, atraso e fuso horário.
- [ ] Implementar continuidade mantendo produção/origem/validade e auditoria.
- [ ] Aplicar margem de 20% uma vez, descontar estoque aproveitável e arredondar pacotes.
- [ ] Exibir consumo, margem, estoque e compra separadamente.
- [ ] Remover os dois cards solicitados preservando lógica compartilhada.
- [ ] Verificar impressão e planejamento.

### Task 6: Auditoria integrada, documentação e produção

**Files:** testes integrados, documentação oficial, manifesto e artefatos Android.

**Interfaces:** Consome todas as tarefas; produz release verificável e rollback.

- [ ] Executar cenários ponta a ponta dos 14 itens e segurança/RLS.
- [ ] Validar computador, celular e tablet, incluindo rolagem, modal, teclado, estados e console.
- [ ] Atualizar documentação/manifesto e regenerar HTML.
- [ ] Executar `npm run release:check` e revisar o diff integral.
- [ ] Aplicar migrações, consultar invariantes e publicar web.
- [ ] Atualizar o tablet e verificar serviço, Realtime, heartbeat e impressora.
- [ ] Conferir o domínio oficial sem iniciar outro deploy e emitir relatório final.
