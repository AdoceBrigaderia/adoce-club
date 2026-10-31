# Site Publico Cantinho da Adoce Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Aplicar no projeto principal o visual aprovado no Figma sem alterar conteudo, dados ou fluxos reais.

**Architecture:** Preservar os componentes e rotas existentes, concentrando o redesign no shell publico, pagina inicial, catalogo e estilos compartilhados. A identidade usa a logo oficial, Fraunces para titulos e Inter para interface.

**Tech Stack:** React, TypeScript, Vite, Vitest e CSS.

**Spec:** `docs/superpowers/specs/2026-10-28-experiencia-publica-unificada-design.md`

## Global Constraints

- Trabalhar somente em `D:\AdoceOnLine` e nunca criar hospedagem ou checkout paralelo.
- Nao publicar sem aprovacao explicita.
- Preservar conteudo e dados reais de producao.
- Excluir somente a secao e os valores de revenda.
- Usar `Logo_Cantinho_Adoge.png` como marca oficial.

## Review Focus

- Os tres caminhos da home devem manter titulos e destinos de producao.
- O catalogo deve manter precos ao consumidor e nunca divulgar revenda.
- Cardapio, sabores, docinhos e Clube devem continuar dinamicos.
- Navegacao deve permanecer utilizavel em desktop e mobile.
- A logo deve manter proporcao e contraste.

---

### Task 1: Identidade e home publica

**Files:**
- Modify: `src/AdoceLandingPage.tsx`
- Modify: `src/PublicHeader.tsx`
- Modify: `src/PublicFooter.tsx`
- Modify: `src/adoce-landing-2026.css`
- Modify: `src/public-unified-2026.css`
- Test: `src/public-commercial-experience.test.ts`

- [ ] Fixar os tres titulos e destinos reais em teste.
- [ ] Aplicar a logo oficial e os jargoes aprovados.
- [ ] Validar navegacao e responsividade.

### Task 2: Catalogo real sem revenda

**Files:**
- Modify: `src/CatalogPage2026.tsx`
- Modify: `src/catalog-2026.css`
- Test: `src/public-commercial-experience.test.ts`

- [ ] Preservar tamanhos, precos ao consumidor, docinhos e regras de encomenda.
- [ ] Confirmar ausencia de revenda e seus valores.

### Task 3: Verificacao visual local

**Files:**
- Create: `design-qa.md`

- [ ] Executar testes focados, lint e build.
- [ ] Inspecionar home, cardapio, catalogo, sabores, docinhos e Clube em desktop e mobile.
- [ ] Manter a visualizacao local aberta para aprovacao.
