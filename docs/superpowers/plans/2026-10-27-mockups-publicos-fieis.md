# Faithful Adoce Public Mockups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reproduce the five approved Adoce mockups faithfully in the existing public experience while preserving real data, business rules, accessibility and the current production boundary.

**Architecture:** Keep the current React/Vite application and canonical routes. Reuse the supplied `public/brand-2026` assets and existing live-data components; visual shells may change, but product, inventory, loyalty and authentication facts remain in their current single sources. Implement and review Home, Cardapio and Catalogo first, then Clube and authentication after visual approval.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, CSS, Supabase and the existing Adoce asset packs.

**Spec:** `docs/26-arquitetura-publica-e-redesign-visual.md`, `docs/15-guia-de-marca-e-interface.md`, and the five mockups supplied by the owner on 27/10/2026.

## Global Constraints

- Work only in `D:\AdoceOnLine`; do not create another project, checkout, worktree, hosted preview or deployment.
- Preserve all existing uncommitted changes and do not commit files whose ownership is unclear.
- Do not publish; production requires a new explicit authorization after local visual review.
- Mobile first from 320 px; validate 320, 360, 375, 390, 412, 430, 768, 1024 and 1280 px.
- Preserve the official logo and supplied real product photography without distortion.
- Never hardcode live customer, stock, availability, date, loyalty or price facts from the mockups.
- Do not reintroduce Eventos, Adoce na Escola, Aluguel de decoracao or other retired offers.
- Public pages must never expose operational controls, metrics, secrets or internal data.
- Reuse existing product sources; no duplicated database fields, fallback prices or copied business facts.

## Review Focus

- Empty or failed live-data responses render a clear public state without showing mockup sample values.
- A zero-stock product cannot appear available or enter the order flow.
- Long product names, dynamic customer names and dates do not overflow at 320 px.
- Logged-out and logged-in Clube states preserve their existing security and navigation behavior.
- Old route aliases continue to land on the same implementation as canonical routes.

---

### Task 1: Protect the visual and data contract

**Files:**
- Modify: `src/public-experience-routes.test.ts`
- Modify: `src/public-navigation.test.ts`
- Modify: `src/public-commercial-experience.test.ts`
- Modify: `src/connected-club-home.test.ts`
- Test: the same four files

**Interfaces:**
- Consumes: current canonical route mapping and existing component source.
- Produces: regression assertions for real-data boundaries, canonical links and required mockup landmarks.

- [ ] **Step 1: Add failing tests for the approved visual landmarks**

  Assert that Home exposes the three intents, Cardapio keeps the real availability view, Catalogo links to `/sabores` and `/docinhos`, and Clube preserves real loyalty state rather than fixed mockup values.

- [ ] **Step 2: Run the focused tests and confirm RED**

  Run: `npm test -- src/public-experience-routes.test.ts src/public-navigation.test.ts src/public-commercial-experience.test.ts src/connected-club-home.test.ts`

  Expected: at least one new assertion fails because the faithful landmarks are not all present.

- [ ] **Step 3: Record the existing dirty-file baseline**

  Run: `git status --short` and `git diff --stat`.

  Expected: the pre-existing public UI files remain visible and no unrelated file is changed by this task.

### Task 2: Rebuild the shared public shell

**Files:**
- Modify: `src/PublicHeader.tsx`
- Modify: `src/PublicFooter.tsx`
- Modify: `src/public-shell-2026.css`
- Modify: `src/adoce-mobile-first-2026.css`
- Modify: `src/public-navigation.test.ts`

**Interfaces:**
- Consumes: existing route helpers and session-aware header data.
- Produces: one responsive shell used by Home, Cardapio, Catalogo, Clube and authentication surfaces.

- [ ] **Step 1: Add failing navigation and shell assertions**

  Pin the five destinations shown in the mockups, active-state semantics, menu accessibility, official logo treatment and absence of operation-only links.

- [ ] **Step 2: Run the shell tests and confirm RED**

  Run: `npm test -- src/public-navigation.test.ts src/connected-club-home.test.ts`

- [ ] **Step 3: Implement the minimal shared shell**

  Use the supplied SVG/icon packs and existing session data. Keep controls as real links/buttons with keyboard focus and accessible names.

- [ ] **Step 4: Run the shell tests and confirm GREEN**

  Run: `npm test -- src/public-navigation.test.ts src/connected-club-home.test.ts`

### Task 3: Reproduce the Home mockup

**Files:**
- Modify: `src/AdoceLandingPage.tsx`
- Modify: `src/adoce-landing-2026.css`
- Modify: `src/public-minimal-2026.css`
- Test: `src/public-experience-routes.test.ts`
- Test: `src/public-contact-links.test.ts`

**Interfaces:**
- Consumes: shared public shell and canonical routes `/cardapio`, `/catalogo`, `/clube`.
- Produces: faithful three-intent Home with real navigation and official footer information.

- [ ] **Step 1: Add failing Home content assertions**

  Assert the exact three user intentions and their canonical destinations; reject static mock customer names and retired offers.

- [ ] **Step 2: Run the Home tests and confirm RED**

  Run: `npm test -- src/public-experience-routes.test.ts src/public-contact-links.test.ts`

- [ ] **Step 3: Implement the Home composition**

  Match the approved hierarchy, cards, illustrated asset treatment, pink/chocolate palette and footer; use responsive CSS rather than flattening the mockup into one image.

- [ ] **Step 4: Run the Home tests and confirm GREEN**

  Run: `npm test -- src/public-experience-routes.test.ts src/public-contact-links.test.ts`

### Task 4: Reproduce Cardapio with live availability

**Files:**
- Modify: `src/AdoceHoje.tsx`
- Modify: `src/cardapio-2026.css`
- Modify: `src/adoce-hoje-order.test.ts`
- Modify: `src/availability-sort.test.ts`
- Modify: `src/inventory-day-continuity.test.ts`

**Interfaces:**
- Consumes: existing Supabase-backed flavor, batch, inventory and order behavior.
- Produces: mockup-faithful weekly/date header and product grid without changing availability semantics.

- [ ] **Step 1: Add failing availability presentation tests**

  Assert that dynamic dates remain dynamic, zero stock is unavailable, long names remain represented, and `catalogOnly` does not leak ordering controls.

- [ ] **Step 2: Run focused Cardapio tests and confirm RED**

  Run: `npm test -- src/adoce-hoje-order.test.ts src/availability-sort.test.ts src/inventory-day-continuity.test.ts`

- [ ] **Step 3: Implement the Cardapio visual composition**

  Preserve existing data queries and actions; change only semantic markup and styling needed to match the mockup.

- [ ] **Step 4: Run focused Cardapio tests and confirm GREEN**

  Run: `npm test -- src/adoce-hoje-order.test.ts src/availability-sort.test.ts src/inventory-day-continuity.test.ts`

### Task 5: Reproduce the commercial Catalogo

**Files:**
- Modify: `src/CatalogPage2026.tsx`
- Modify: `src/catalog-2026.css`
- Modify: `src/public-commercial-experience.test.ts`
- Modify: `src/commercial-price-label.test.ts`

**Interfaces:**
- Consumes: existing commercial product price source and supplied P/M/G and docinho assets.
- Produces: faithful torta, docinho and order-instructions composition with links to `/sabores`, `/docinhos` and WhatsApp.

- [ ] **Step 1: Add failing Catalogo source-of-truth tests**

  Assert that sizes and displayed prices use the current data boundary, retired categories are absent, and the two destination links are present.

- [ ] **Step 2: Run focused Catalogo tests and confirm RED**

  Run: `npm test -- src/public-commercial-experience.test.ts src/commercial-price-label.test.ts`

- [ ] **Step 3: Implement the Catalogo composition**

  Match the mockup sections using supplied product cutouts and SVG assets, without embedding mockup text as an image.

- [ ] **Step 4: Run focused Catalogo tests and confirm GREEN**

  Run: `npm test -- src/public-commercial-experience.test.ts src/commercial-price-label.test.ts`

### Task 6: First visual approval gate

**Files:**
- Create or update: `design-qa.md`
- Create: local screenshots under the existing project QA output location only

**Interfaces:**
- Consumes: Tasks 2-5 and mockups 1-3.
- Produces: same-viewport comparisons for Home, Cardapio and Catalogo in mobile and desktop.

- [ ] **Step 1: Start the existing local Vite application**

  Use the project `npm run dev` workflow after its primary-workspace verification passes. Do not create a hosted preview.

- [ ] **Step 2: Inspect all three routes in the in-app browser**

  Exercise navigation, menus, product details, scrolling and main CTAs; inspect browser console errors.

- [ ] **Step 3: Compare reference and implementation at matching viewports**

  Record P0-P3 mismatches in `design-qa.md`, fix P0-P2, recapture and repeat until `final result: passed` or an explicit blocker is recorded.

- [ ] **Step 4: Present screenshots to the owner and stop for visual approval**

  Do not begin Clube/authentication or publication until this approval is received.

### Task 7: Reproduce Clube, login and registration after approval

**Files:**
- Modify: `src/AccessApp.tsx`
- Modify: `src/access-app.css`
- Modify: `src/customer-experience-2026.test.ts`
- Modify: `src/customer-onboarding.test.ts`
- Modify: `src/customer-login-feedback.test.ts`
- Modify: `src/connected-club-home.test.ts`

**Interfaces:**
- Consumes: shared shell, authenticated profile/loyalty data and existing login/registration services.
- Produces: faithful mockups 4-5 without changing authentication, consent, deletion or loyalty rules.

- [ ] **Step 1: Add failing authenticated and logged-out presentation tests**

  Cover long customer names, 0/14 and 14/14 loyalty states, loading/error states, validation feedback and canonical login/registration navigation.

- [ ] **Step 2: Run the focused account tests and confirm RED**

  Run: `npm test -- src/customer-experience-2026.test.ts src/customer-onboarding.test.ts src/customer-login-feedback.test.ts src/connected-club-home.test.ts`

- [ ] **Step 3: Implement the approved account compositions**

  Preserve current services, validation and security; change only presentation and accessible structure.

- [ ] **Step 4: Run the focused account tests and confirm GREEN**

  Run: `npm test -- src/customer-experience-2026.test.ts src/customer-onboarding.test.ts src/customer-login-feedback.test.ts src/connected-club-home.test.ts`

### Task 8: Complete regression and local acceptance

**Files:**
- Update: `design-qa.md`
- Modify only if required by verified regression: affected test or source file

**Interfaces:**
- Consumes: all implemented tasks.
- Produces: automatically and visually validated local release candidate; no deployment.

- [ ] **Step 1: Run the complete automated suite**

  Run: `npm test`

  Expected: all tests pass; report any unrelated pre-existing failure by name instead of hiding it.

- [ ] **Step 2: Run typecheck and production build**

  Run: `npm run lint` and `npm run build`.

- [ ] **Step 3: Run the release candidate gate**

  Run: `npm run release:check`.

  Expected: the gate passes locally; this does not authorize deployment.

- [ ] **Step 4: Complete final browser QA**

  Validate all changed routes at required widths, main interactions, loading/empty/error states and console output. Ensure `design-qa.md` says `final result: passed` only with matching evidence.

- [ ] **Step 5: Present the final local result and request a separate production decision**

  Classify delivery as locally implemented, automatically validated and visually validated. Do not call it production-validated and do not deploy.
