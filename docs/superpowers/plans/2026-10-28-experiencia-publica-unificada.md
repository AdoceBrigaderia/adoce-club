# Experiência Pública Unificada Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir uma proposta visual pública completamente nova e uniforme, sem revenda e sem publicação.

**Architecture:** Um tema compartilhado define shell, tipografia, cores, espaçamento, cartões, heróis, navegação e rodapé. Componentes vivos preservam suas fontes de dados e recebem apenas a nova composição; o catálogo remove conteúdo comercial encerrado.

**Tech Stack:** React, TypeScript, CSS, Vitest, Vite.

**Spec:** `docs/superpowers/specs/2026-10-28-experiencia-publica-unificada-design.md`

## Global Constraints

- Trabalhar somente em `D:\AdoceOnLine` e preservar alterações existentes.
- Não criar hospedagem, preview público, worktree ou cópia do projeto.
- Não publicar sem autorização explícita posterior.
- Mobile first; validar 320–430 px e computador.
- Produtos, estoque, disponibilidade e Clube permanecem ligados às fontes reais.
- Revenda, Eventos, Adoce na Escola e Aluguel de decoração não aparecem no site público.

## Review Focus

- Conteúdo comercial encerrado não pode permanecer em JSX, navegação ou documentação oficial.
- Barras fixas não podem encobrir a última ação em celulares com safe area.
- Rotas com dados reais precisam conservar carregamento, vazio e erro.
- Usuário conectado precisa manter nome e progresso reais.
- Fotografias devem preservar proporção sem distorcer produto ou logo.

---

### Task 1: Contratos públicos e conteúdo atual

**Files:**
- Modify: `src/public-commercial-experience.test.ts`
- Modify: `src/public-navigation.test.ts`
- Modify: `src/public-experience-routes.test.ts`

**Interfaces:**
- Produces: contratos que proíbem revenda e exigem shell e linguagem compartilhados.

- [ ] Escrever testes que falham com a seção de revenda atual e com shells divergentes.
- [ ] Executar os testes e confirmar RED pela presença do conteúdo antigo.
- [ ] Implementar o contrato mínimo junto das Tasks 2–4.
- [ ] Executar novamente e confirmar GREEN.

### Task 2: Sistema visual e shell compartilhado

**Files:**
- Modify: `src/PublicHeader.tsx`
- Modify: `src/PublicMobileNav.tsx`
- Modify: `src/PublicFooter.tsx`
- Create: `src/public-unified-2026.css`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: cabeçalho, navegação, tokens e composição usados por todas as superfícies públicas.

- [ ] Implementar o tema mobile-first e os componentes compartilhados.
- [ ] Garantir foco, contraste, safe area e adaptação progressiva.
- [ ] Validar testes de navegação.

### Task 3: Vitrines comerciais unificadas

**Files:**
- Modify: `src/AdoceLandingPage.tsx`
- Modify: `src/AdoceHoje.tsx`
- Modify: `src/CatalogPage2026.tsx`
- Modify: `src/CakeCatalogPage.tsx`
- Modify: `src/CommercialCatalog.tsx`
- Modify: CSS específico dessas superfícies.

**Interfaces:**
- Consumes: shell e tokens da Task 2.
- Produces: Home, Cardápio, Sabores, Tortas e Docinhos visualmente coerentes.

- [ ] Remover revenda do Catálogo.
- [ ] Aplicar heróis, cartões, ações e espaçamento comuns sem alterar fontes reais.
- [ ] Validar carregamento, vazio, erro e fluxos de produto.

### Task 4: Clube e acesso unificados

**Files:**
- Modify: `src/AdoceClube.tsx`
- Modify: `src/AccessApp.tsx`
- Modify: `src/access-app.css`
- Modify: CSS do Clube.

**Interfaces:**
- Consumes: shell e tokens da Task 2.
- Produces: Clube, login e cadastro com a mesma identidade e regras preservadas.

- [ ] Aplicar o sistema visual sem alterar autenticação, sessão ou progresso.
- [ ] Verificar formulários, erros e estados autenticados.

### Task 5: Documentação e validação local

**Files:**
- Modify: `docs/09-catalogo-agenda-crm.md`
- Modify: `docs/26-arquitetura-publica-e-redesign-visual.md`
- Modify: `docs/documentation-manifest.json`
- Create: `design-qa-unified.md`

**Interfaces:**
- Consumes: todas as telas anteriores.
- Produces: documentação oficial coerente, QA visual e prévia local para aprovação.

- [ ] Registrar a retirada de revenda da oferta pública.
- [ ] Gerar a documentação consolidada.
- [ ] Executar testes, lint e build local.
- [ ] Validar celular e computador, capturar evidências e apresentar sem publicar.
