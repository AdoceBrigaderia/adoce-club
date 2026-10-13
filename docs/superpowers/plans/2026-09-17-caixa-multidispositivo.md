# Caixa Adoce multidispositivo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the approved Caixa Adoce for iPhone, tablet and desktop with three order channels, immediate stock reservation, split payments, printing and WhatsApp visibility.

**Architecture:** Extend the existing OperationManualSale and OperationInstantOrders flows with a dedicated channel-aware cash screen. Use server RPCs for reservation, sale finalization and payment allocation; use Supabase realtime for cross-device counts and print queue state.

**Tech Stack:** React/TypeScript, Supabase RPC/Postgres, Vitest, Netlify Functions, existing thermal printer bridge.

**Spec:** `docs/superpowers/specs/2026-09-17-caixa-multidispositivo-design.md`

## Global Constraints

- All devices expose the same cash capability.
- Stock mutations are transactional, idempotent and audited on the server.
- Partial and mixed payments never block an open order; finalization requires zero balance.
- WhatsApp private channel never sends automated customer messages.
- Every receipt includes the Clube Adoce QR and the 14-stamp exception text.
- Run `npm run release:check` before publication.

### Task 1: Model and tests for cash cart, reservations and split payments

**Files:**
- Create: `src/cash-register-domain.ts`
- Test: `src/cash-register-domain.test.ts`

- [ ] Write tests for add/remove quantities, optional sauce, discount amount/percent, dupla consuming two units, partial payments and remaining balance.
- [ ] Implement pure domain functions with cent-safe rounding and no UI dependencies.
- [ ] Run `npm test -- src/cash-register-domain.test.ts`.

### Task 2: Supabase RPCs for immediate reservation and mixed payments

**Files:**
- Create: `supabase/migrations/20260917120000_cash_immediate_reservation_split_payments.sql`
- Test: `src/cash-rpc-contract.test.ts`

- [ ] Add idempotent reservation/release RPCs scoped to a draft sale.
- [ ] Add payment allocation/finalization RPC accepting multiple methods and returning server totals.
- [ ] Add audit events and grants/RLS checks.
- [ ] Run contract tests and apply only after local validation.

### Task 3: Dedicated CashRegisterScreen and channel switch

**Files:**
- Create: `src/CashRegisterScreen.tsx`
- Create: `src/cash-register.css`
- Modify: `src/AccessApp.tsx`
- Test: `src/cash-register-screen.test.tsx`

- [ ] Render uniform flavor buttons, compact sauce selector, quantity keypad, cart, discounts and cancel action.
- [ ] Persist the three-channel selection per device/user.
- [ ] Call reservation on every add and release on removal/cancel.
- [ ] Implement payment sheet, partial balance and post-sale loyalty/new-order choice.
- [ ] Run focused tests and responsive visual checks.

### Task 4: Short flavor names and compact catalog

**Files:**
- Modify: `src/OperationVisualSettings.tsx`
- Modify: `src/OperationCommercialAdmin.tsx`
- Create: `supabase/migrations/20260917130000_flavor_short_name.sql`
- Test: `src/flavor-short-name.test.ts`

- [ ] Add editable short-name field with generated suggestion fallback.
- [ ] Use short names in the cash catalog while preserving full names elsewhere.
- [ ] Validate permission, uniqueness and fallback display.

### Task 5: Unified WhatsApp inbox badge and history

**Files:**
- Modify: `src/OperationInstantOrders.tsx`
- Modify: `src/OperationNotificationCenter.tsx`
- Modify: `src/operation-whatsapp.ts`
- Test: `src/operation-whatsapp-badge.test.ts`

- [ ] Add three channel buttons and yellow pending count for official WhatsApp.
- [ ] Count orders and team-chat requests in realtime; open the conversation monitor.
- [ ] Keep private WhatsApp orders manual and silent.

### Task 6: Receipt QR, loyalty copy and print queue

**Files:**
- Modify: `src/lib/operation-print.ts`
- Modify: `src/operation-print.css`
- Modify: `netlify/functions/*print*`
- Test: `src/operation-print.test.ts`

- [ ] Append QR for the Clube URL and the exact 14-stamp text.
- [ ] Print mixed payment lines, remaining balance and reprint status.
- [ ] Preserve sale completion when the printer is offline.

### Task 7: Top navigation and cross-device QA

**Files:**
- Modify: `src/operation-v3.css`
- Modify: `src/AccessApp.tsx`
- Test: `src/operation-mobile-layout.test.ts`

- [ ] Replace lateral operation navigation with responsive top bar.
- [ ] Validate iPhone, tablet and desktop flows, console and print bridge.
- [ ] Run `npm run release:check`, review production diff, then publish with explicit confirmation.
