# Pedidos, Compras e Estoque, clientes e fidelidade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar e publicar a reorganização de Compras e Estoque, a tela unificada de Pedidos, as correções de fichas/tabelas/Oreo e o fluxo seguro de clientes e fidelidade.

**Architecture:** A interface será dividida em componentes focados para navegação, identificação do cliente e escolha da unidade gratuita. A finalização de venda será concentrada em uma função transacional do Supabase com chave idempotente, mantendo a interface como orquestradora e preservando os fluxos existentes de estoque, caixa e impressão.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Supabase/PostgreSQL, Netlify Functions, CSS responsivo e Capacitor Android.

**Spec:** `docs/superpowers/specs/2026-10-12-pedidos-compras-estoque-clientes-fidelidade-design.md`

## Global Constraints

- Trabalhar exclusivamente em `D:\AdoceOnLine`, sem cópia, worktree ou checkout paralelo.
- Preservar alterações locais existentes e dados reais.
- Não expor dados pessoais, recursos internos ou credenciais no navegador público.
- Alterações públicas no Supabase exigem RLS, permissões mínimas, auditoria e idempotência.
- Fidelidade digital e fidelidade manual são mutuamente exclusivas.
- Estoque de insumos continuará identificado como evolução futura, sem simular controle inexistente.
- Produção só será publicada após `npm run release:check` passar; a autorização de publicação foi dada em 12/10/2026.

## Review Focus

- Duplo clique ou repetição após falha de rede não pode duplicar cliente, venda, carimbo nem resgate; Task 5 cobre repetição da mesma chave.
- Cliente encontrado depois de fidelidade manual selecionada deve limpar a seleção manual antes da conclusão; Task 4 cobre a transição.
- Tabela dentro de modal, página e contêiner horizontal deve manter cabeçalho alinhado sem aparecer em cartões móveis; Task 1 cobre os três contextos.
- Telefone formatado, incompleto ou com cadastro fora da primeira página precisa resultar em busca determinística; Tasks 4 e 6 cobrem normalização e busca no servidor.
- Uma recompensa digital só pode tornar gratuita uma unidade existente do carrinho e deve preservar sabor, calda e baixa física; Task 5 cobre cálculo e persistência.

---

### Task 1: Tabelas responsivas e cabeçalhos persistentes

**Files:**
- Create: `src/table-and-sheet-ui.ts`
- Create: `src/table-and-sheet-ui.test.ts`
- Create: `src/PersistentTableHeaders.tsx`
- Modify: `src/main.tsx`
- Modify: `src/styles.css`
- Modify: `src/CostSheetTable.tsx`
- Modify: `src/operation-costs.css`

**Interfaces:**
- Produces: `compactCostHeader(label: string): string`, `floatingTableIndex(rects, viewport): number`, `<PersistentTableHeaders />`.

- [ ] **Step 1: Escrever testes que fixem abreviações, escolha da tabela ativa, limite inferior e ausência do cabeçalho em modo cartão.**
- [ ] **Step 2: Executar `npm test -- src/table-and-sheet-ui.test.ts` e confirmar falha pelas funções/componente ausentes.**
- [ ] **Step 3: Implementar os helpers, o espelho global do `thead`, sincronização horizontal e os estilos de duas linhas.**
- [ ] **Step 4: Executar o teste direcionado e validar PASS.**
- [ ] **Step 5: Validar uma tabela de página, uma de modal e uma com rolagem horizontal em 390 px, 1024 px e 1920 px.**
- [ ] **Step 6: Registrar somente os arquivos desta tarefa em commit dedicado.**

### Task 2: Fichas em modal e diagnóstico do Oreo

**Files:**
- Modify: `src/OperationCosts.tsx`
- Modify: `src/operation-costs.css`
- Modify: `src/lib/purchase-planner.ts`
- Modify: `src/lib/purchase-planner.test.ts`
- Modify: `src/operation-costs-regression.test.ts`

**Interfaces:**
- Consumes: `compactCostHeader` da Task 1.
- Produces: `firstProblemRow(...)` e `describeItemUsage(...)` para foco e explicação de cadastros semelhantes.

- [ ] **Step 1: Escrever testes para primeira pendência, foco estrutural e aviso de item semelhante usado.**
- [ ] **Step 2: Executar os testes direcionados e confirmar falha.**
- [ ] **Step 3: Substituir `scrollIntoView` por modal com retorno de foco/posição e destaque da primeira pendência.**
- [ ] **Step 4: Exibir nome/código do item sem uso e referência ao registro semelhante efetivamente vinculado, sem mesclar dados.**
- [ ] **Step 5: Executar os testes direcionados e validar PASS.**
- [ ] **Step 6: Validar visualmente abertura, salvamento, fechamento, rolagem e foco no computador e tablet.**
- [ ] **Step 7: Registrar os arquivos desta tarefa em commit dedicado.**

### Task 3: Novo módulo Compras e Estoque

**Files:**
- Create: `src/OperationPurchasingInventory.tsx`
- Modify: `src/AccessApp.tsx`
- Modify: `src/OperationManagement.tsx`
- Modify: `src/lib/operation-navigation.ts`
- Modify: `src/operation-information-architecture.test.ts`
- Modify: `src/operation-mobile-layout.test.ts`

**Interfaces:**
- Produces: view principal `purchasing_inventory`, rótulo amplo `Compras e Estoque` e rótulo curto `Compras`.

- [ ] **Step 1: Escrever testes que exijam o novo item principal e ausência de `Custos e fichas` em Gestão.**
- [ ] **Step 2: Executar os testes direcionados e confirmar falha.**
- [ ] **Step 3: Criar o módulo reutilizando `OperationCosts` e mover a entrada de navegação sem duplicar estado ou consultas.**
- [ ] **Step 4: Restringir o módulo a gerente/proprietário e mostrar aviso claro de estoque de insumos ainda futuro.**
- [ ] **Step 5: Executar os testes direcionados e validar PASS.**
- [ ] **Step 6: Validar navegação desktop, celular e tablet, inclusive retorno e seleção ativa.**
- [ ] **Step 7: Registrar os arquivos desta tarefa em commit dedicado.**

### Task 4: Tela unificada de Pedidos e identificação de cliente

**Files:**
- Create: `src/CashCustomerSelector.tsx`
- Create: `src/cash-customer-selector.test.ts`
- Modify: `src/OperationManualSale.tsx`
- Modify: `src/OperationCommercialAdmin.tsx`
- Modify: `src/cash-fast-checkout.ts`
- Modify: `src/cash-fast-checkout.test.ts`
- Modify: `src/cash-fast-checkout.css`

**Interfaces:**
- Produces: `SelectedCashCustomer`, `normalizeCashPhone`, `resolveLoyaltyMode`, seletor pesquisável e previsão de carimbos.
- Consumes: RPC protegida `staff_search_customers(text)`.

- [ ] **Step 1: Escrever testes para ordem Clube/Celular/Nome, pesquisa com pausa, lista alfabética e exclusão de WhatsApp particular.**
- [ ] **Step 2: Escrever testes de estado para cliente identificado desabilitar/limpar fidelidade manual e fatias pagas gerarem carimbos.**
- [ ] **Step 3: Executar os testes direcionados e confirmar falhas.**
- [ ] **Step 4: Implementar o seletor, preenchimento por telefone, estados de progresso/recompensa e validação conjunta de nome/telefone.**
- [ ] **Step 5: Renomear a área para `Pedidos`, manter WhatsApp oficial e renderizar `OperationInstantOrders` abaixo do caixa local.**
- [ ] **Step 6: Adicionar ao carrinho a escolha manual de exatamente uma unidade gratuita somente sem cliente identificado.**
- [ ] **Step 7: Executar os testes direcionados e validar PASS.**
- [ ] **Step 8: Validar carrinho, fila online, busca e estados vazios em desktop, celular e tablet.**
- [ ] **Step 9: Registrar os arquivos desta tarefa em commit dedicado.**

### Task 5: Finalização transacional, cadastro, carimbos e recompensas

**Files:**
- Create: `supabase/migrations/20261012XXXXXX_cash_sale_customer_loyalty_atomic.sql`
- Create: `src/cash-sale-customer-loyalty.test.ts`
- Modify: `src/OperationManualSale.tsx`
- Modify: `src/CashCheckoutDialog.tsx`
- Modify: `src/sale-club-enroll.ts`
- Modify: `src/cash-register-domain.ts`
- Modify: `src/cash-register-domain.test.ts`

**Interfaces:**
- Produces: RPC `staff_finalize_cash_sale_with_customer(...)` com `operation_key`, itens, unidade gratuita, identidade opcional e pagamentos; retorna venda, cliente, carimbos e recompensa consumida.

- [ ] **Step 1: Inspecionar ao vivo as assinaturas, tipos, políticas e grants das funções/tabelas de caixa, cliente, estoque e fidelidade.**
- [ ] **Step 2: Escrever testes SQL/contratuais para venda anônima, cliente existente, novo cliente, recompensa digital, fidelidade manual e chave repetida.**
- [ ] **Step 3: Executar os testes direcionados e confirmar falhas.**
- [ ] **Step 4: Criar a função transacional reutilizando as regras vigentes de baixa/reserva/pagamento e gravando auditoria idempotente.**
- [ ] **Step 5: Alterar a interface para enviar uma única intenção e preservar a mesma chave em nova tentativa.**
- [ ] **Step 6: Executar testes de integração em transação reversível ou ambiente seguro, confirmando que falha intermediária não deixa gravações parciais.**
- [ ] **Step 7: Aplicar a migração no projeto de produção somente após comparar novamente o schema e validar o SQL local.**
- [ ] **Step 8: Reconsultar função, grants e comportamento idempotente em produção sem criar venda real desnecessária.**
- [ ] **Step 9: Registrar os arquivos desta tarefa em commit dedicado.**

### Task 6: Cadastro rápido abre cliente existente

**Files:**
- Modify: `src/CadastroRapido.tsx`
- Modify: `src/AccessApp.tsx`
- Modify: `src/staff-create-customer.ts`
- Modify: `src/customer-fast-registration.test.ts`

**Interfaces:**
- Consumes: resposta `{ existing, profileId, accountId, fullName, phone }` de `createStaffCustomer` e busca completa protegida.
- Produces: abertura automática do perfil sem carimbo implícito.

- [ ] **Step 1: Escrever testes para duplicidade local, duplicidade encontrada no servidor e ausência de `carimbarBalcao` ao apenas abrir.**
- [ ] **Step 2: Executar o teste direcionado e confirmar falha.**
- [ ] **Step 3: Pesquisar telefone no servidor durante o cadastro e tratar `existing: true` como navegação, não erro.**
- [ ] **Step 4: Fechar o formulário, atualizar a lista necessária e abrir o perfil pelo `profileId`, sem lançar carimbo.**
- [ ] **Step 5: Executar o teste direcionado e validar PASS.**
- [ ] **Step 6: Validar visualmente os dois caminhos de duplicidade e uma falha real.**
- [ ] **Step 7: Registrar os arquivos desta tarefa em commit dedicado.**

### Task 7: Documentação oficial e regressão completa

**Files:**
- Modify: `docs/03-operacao-e-administracao.md`
- Modify: `docs/17-mapa-funcional-e-estado-real.md`
- Modify: `docs/documentation-manifest.json` somente se versão/data/ordem mudar.
- Regenerate: `docs/clube-adoce-documentacao.html`

**Interfaces:**
- Consumes: comportamento efetivamente implementado nas Tasks 1–6.

- [ ] **Step 1: Atualizar somente as seções oficiais afetadas, distinguindo estoque atual de evolução futura.**
- [ ] **Step 2: Executar `node scripts/generate-docs.mjs` e confirmar HTML autocontido regenerado.**
- [ ] **Step 3: Executar testes direcionados de todas as tarefas.**
- [ ] **Step 4: Executar `npm test`, `npm run lint` e `npm run build`; corrigir regressões dentro do escopo.**
- [ ] **Step 5: Executar `git diff --check` e revisar o diff sem incluir alterações alheias.**
- [ ] **Step 6: Registrar documentação e ajustes de regressão em commit dedicado.**

### Task 8: Validação visual, tablet e publicação

**Files:**
- Create: `entregas/qa-pedidos-compras-estoque-20261012.json`
- Create: capturas de evidência em `entregas/` somente quando geradas pela validação.

**Interfaces:**
- Produces: evidências separadas de validação automática, visual, publicação web e estado do tablet.

- [ ] **Step 1: Iniciar a aplicação local da pasta principal e executar os fluxos alterados em 1920 px, 390 px e viewport de tablet.**
- [ ] **Step 2: Confirmar botões, modais, rolagem, cabeçalhos, estados vazios, mensagens e console sem erros relevantes.**
- [ ] **Step 3: Detectar o tablet conectado e validar o serviço/operação disponível sem apagar dados ou criar venda real.**
- [ ] **Step 4: Executar `npm run release:check` e interromper a publicação se qualquer gate falhar.**
- [ ] **Step 5: Executar `npm run release:prod` uma única vez e guardar URL/identificador retornado.**
- [ ] **Step 6: Conferir o domínio oficial e a versão servida sem disparar novo deploy.**
- [ ] **Step 7: Fazer smoke test autenticado, sem venda/cliente real desnecessário, e registrar o resultado.**
- [ ] **Step 8: Informar separadamente: implementado, testes automáticos, validação visual, produção web, migração do banco e validação/instalação no tablet.**
