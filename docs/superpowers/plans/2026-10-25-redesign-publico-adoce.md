# Adoce Public Experience Redesign Implementation Plan

> **For Codex:** Execute directly in `D:\AdoceOnLine`, preserving existing changes. Production deployment is a separate, explicit approval gate.

**Goal:** Rebuild the public Adoce experience from the approved mockups while preserving all business behavior and old route compatibility.

**Architecture:** Introduce explicit intent-based public routes and reusable visual shell/components. Keep live product, inventory, account and loyalty data in their existing single sources; aliases share implementations instead of copying data.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, CSS, Supabase, Netlify Functions.

---

### Task 1: Route contract and compatibility

- [x] Add failing tests for `/`, `/cardapio`, `/sabores`, `/catalogo`, `/clube`, and `/clube/cadastro`.
- [x] Implement canonical route recognition while preserving old aliases.
- [x] Verify focused route tests.

### Task 2: Visual assets and reusable public shell

- [x] Import the supplied landing, cardápio, catálogo, Clube and registration assets into `public/brand-2026`.
- [x] Build reusable branded header, footer, navigation and responsive tokens.
- [x] Verify accessible labels, keyboard behavior and mobile layout.

### Task 3: Entry page

- [x] Rebuild `/` from the approved three-intent mockup.
- [x] Connect each CTA to its canonical route.
- [x] Validate mobile and desktop rendering.

### Task 4: Cardápio and sabores

- [x] Make `/cardapio` the canonical Adoce Hoje ordering route.
- [x] Build `/sabores` from the same flavor source without availability, stock, notification or purchase controls.
- [x] Keep `/adoce-hoje` as a compatibility alias.
- [x] Test both modes and zero-stock behavior.

### Task 5: Commercial catalog

- [x] Rebuild `/catalogo` with the supplied real cake photos and vector assets.
- [x] Present P/M/G prices, resale, sweets, order steps and WhatsApp CTA as live HTML.
- [x] Verify R$ 70,00 and R$ 90,00 per 50 units.

### Task 6: Clube and registration

- [x] Apply the approved Clube visual structure without changing loyalty data or actions.
- [x] Apply the approved registration structure to `/clube/cadastro` without changing validation or consent behavior.
- [x] Preserve old account and registration URLs as aliases.

### Task 7: Regression and design QA

- [x] Run focused tests, TypeScript, lint and full automated checks.
- [x] Validate every changed page in the in-app browser at mobile and desktop sizes.
- [x] Exercise links, menus, scrolling, empty/error states and inspect console errors.
- [x] Compare rendered screenshots with the approved references and record `design-qa.md` with `final result: passed` only when no major visual mismatch remains.
- [x] Run `npm run release:check` only as a release candidate check; do not deploy.
