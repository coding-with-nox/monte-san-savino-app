# UI Modernization Plan — Monte San Savino App (Miniatures Contest)

Date: 2026-06-12
Branch base: `feat/teams-levels-displaynumber`
Target style: Material 3 / Expressive Dark — tonal surfaces, rounded containers, color-expressive tokens, elevation via color.

---

## Overview

### Current state
- Theme defined inline in `frontend/src/App.tsx` — only sets `palette.mode`, `palette.primary.main`. No `shape`, `components` overrides, secondary color, or surface tokens.
- Every page uses `<Container>` with inconsistent `maxWidth` (`md`/`lg`/`sm`). No shared layout primitive.
- Cards use bare `<Card><CardContent>` with default flat dark elevation. Section headers are ad-hoc `Stack + Icon + Typography` repeated across pages.
- Empty states render literal `—` (Profile, PublicEvents, Admin).
- **8 of 10 pages hardcode `severity="info"`** even for errors. Only `Judge.tsx` tracks severity correctly.
- Edit actions use `variant="outlined"` (dated).
- No bottom navigation on mobile.

### Goals
1. Centralize and modernize the theme so most visual gains apply to all 12 pages at once.
2. Introduce a small set of shared components to remove duplication and enforce M3 patterns.
3. Polish each page on top of the new foundation.

### Non-goals
- No state-management library, no routing changes, no API/backend changes.
- Preserve the existing 3-preset color system (violet/ocean/forest) and light/dark toggle.

### Sequencing rule
Phase 1 must land before Phase 2; Phase 2 before Phase 3. Phase 3 tasks are parallelizable.

---

## Phase 1 — Theme & Foundation

### Task 1.1 — Extract theme into a dedicated module
- **File (new):** `frontend/src/lib/theme.ts`
- **What:** Move `presetPrimary` map and `createTheme(...)` call out of `App.tsx` into an exported factory `buildTheme(mode, preset): Theme`. Keep identical inputs/outputs.
- **Edit:** `App.tsx` L125-141 — replace inline theme creation with `useMemo(() => buildTheme(themeMode, themePreset), [themeMode, themePreset])`.
- **Acceptance:** App compiles; theme switching still works via Settings; no visual regression.

### Task 1.2 — M3 shape + tonal surface tokens
- **File:** `frontend/src/lib/theme.ts`
- **What:**
  - Add `shape: { borderRadius: 16 }` as global default.
  - Add `secondary` palette entry per preset (tonal complement of primary).
  - Define tonal `background.default` / `background.paper` per mode: dark uses near-black tinted toward primary hue (`background.default: "#141218"`, `background.paper: "#1d1b20"` for violet; analogous for ocean/forest). Light uses faint tinted surface.
  - Add custom palette extensions `surfaceVariant` / `surfaceContainer` via TypeScript module augmentation.
- **Acceptance:** Cards and app background show subtle hue-tinted tonal surfaces; corners visibly rounded; three presets each produce coherent surface tint.

### Task 1.3 — Typography scale (M3-leaning)
- **File:** `frontend/src/lib/theme.ts`
- **What:**
  - `h4` (page titles): `fontWeight: 600`, tighter `letterSpacing`.
  - `h6` (section headers): `fontWeight: 600`, `fontSize: "1rem"`, `letterSpacing: 0.1`.
  - `caption`: `fontWeight: 500`, `letterSpacing: 0.4` — for the "small muted label" pattern in `Field` (Phase 2).
- **Acceptance:** Page titles and section headers have clearer hierarchy across all pages.

### Task 1.4 — Component default overrides
- **File:** `frontend/src/lib/theme.ts` (`components` key)
- **What:**
  - `MuiCard`: `elevation: 0`, tonal `bgcolor` from `surfaceContainer`, `borderRadius: 20`, subtle `border: 1px solid divider`.
  - `MuiCardContent`: consistent `p: 3`, last-child fix.
  - `MuiButton`: `disableElevation: true`, `borderRadius: 20`, `textTransform: "none"`, `fontWeight: 600`.
  - `MuiAlert`: `borderRadius: 16`; severity colors enforced.
  - `MuiAppBar`: tonal surface (see Task 3.0).
  - `MuiChip`: `borderRadius: 8`.
  - `MuiTextField`/`MuiOutlinedInput`: `borderRadius: 12`. Verify no conflict with `MuiTelInput` or AppBar `Select` (App.tsx L247).
- **Acceptance:** Buttons, cards, alerts, chips, inputs adopt M3 styling globally with zero page edits.

---

## Phase 2 — Shared Components

All files under `frontend/src/components/`.

### Task 2.1 — `PageContainer`
- **File (new):** `frontend/src/components/PageContainer.tsx`
- **Props:** `{ children, maxWidth? }` — defaults to `"md"` (~900px).
- **What:** Renders `<Container maxWidth={maxWidth ?? "md"} sx={{ py: { xs: 2, md: 4 } }}>`. Login passes `maxWidth="sm"`.
- **Acceptance:** Pages using `PageContainer` are centered at ~900px with consistent vertical padding.

### Task 2.2 — `SectionCard`
- **File (new):** `frontend/src/components/SectionCard.tsx`
- **Props:** `{ icon?: ReactNode, title: string, action?: ReactNode, children }`
- **What:** Tonal `Card` (inherits Phase 1 styling) with a header row (icon in small tonal badge, `Typography variant="h6"`, optional right-aligned `action` slot) and `CardContent` body. Replaces the 3 inline section blocks in Profile and similar patterns elsewhere.
- **Acceptance:** Profile compiles with `<SectionCard>` replacing inline section markup; visual parity-plus.

### Task 2.3 — `Field`
- **File (new):** `frontend/src/components/Field.tsx`
- **Props:** `{ label: string, value?: ReactNode, empty?: string }`
- **What:** `caption` muted uppercase label above + `body1 fontWeight 500` value below. Empty value renders `EmptyValue` (Task 2.4) instead of `—`.
- **Acceptance:** Profile fields (L105-120, 133-144, 157-160) replaced; no `—` in migrated fields.

### Task 2.4 — `EmptyState` and `EmptyValue`
- **File (new):** `frontend/src/components/EmptyState.tsx`
- **What:**
  - `EmptyValue`: inline muted placeholder for a missing field.
  - `EmptyState`: block-level empty-list component with optional icon, muted title/description, optional action.
- **Acceptance:** No literal `—` for empty data in migrated pages; empty lists show centered icon + message.

### Task 2.5 — `useToast` hook
- **File (new):** `frontend/src/components/useToast.tsx`
- **What:** `const { show, error, info, node } = useToast()`. `node` renders a MUI `Snackbar + Alert` with correct `severity`, `variant="filled"`, auto-hide. Generalizes the correct pattern from `Judge.tsx` (L52/L180) to all pages.
- **Acceptance:** `toast.error(msg)` shows red; `toast.show(msg)` / `toast.info(msg)` shows green/blue. Replaces per-page `message`/`setMessage` + hardcoded `severity="info"`.

### Task 2.6 — `TonalButton` convention
- **Decision:** Use `<Button variant="contained" color="secondary">` convention directly (no wrapper component) for the "MODIFICA"/edit actions. Document in this spec.
- **Acceptance:** Edit/primary-secondary actions use filled tonal button. `variant="outlined"` reserved for low-emphasis/cancel actions only.

---

## Phase 3 — Page-by-Page Polish

All tasks parallelizable after Phase 2 lands. Each page: adopt `PageContainer`, `SectionCard`, `Field`, `EmptyState`/`EmptyValue`, `useToast`, tonal buttons.

### Task 3.0 — AppBar / Navigation (do first in Phase 3)
- **File:** `frontend/src/App.tsx`
- **AppBar:** Change from `color="primary"` to tonal surface treatment using new surface tokens. Re-verify `Select` background hack at L247.
- **Desktop active state:** Replace outlined-button-with-white-border (L233-243) with filled tonal pill for active item; `text` for inactive. Remove `rgba(255,255,255,0.4)` border hack.
- **Mobile bottom navigation:** Add `BottomNavigation` fixed at bottom for top ~4 primary destinations, shown only when `isMobile` and logged in. Keep `Drawer` for full menu + logout. Add bottom padding to content `Box` so content is not occluded.
- **Acceptance:** Desktop: tonal pill on active route. Mobile: bottom nav works; hamburger drawer still opens; content not occluded. Roles still gate items via existing `navItems` filter.

### Task 3.1 — Profile (`frontend/src/pages/Profile.tsx`)
- `PageContainer`; 3 sections → `SectionCard`; label/values → `Field`; role Chip fallback → `EmptyValue`; edit button → `variant="contained" color="secondary"`; 2 alerts → `useToast` (load error red, save success green).

### Task 3.2 — Models (`frontend/src/pages/Models.tsx`)
- `PageContainer`; empty list → `EmptyState`; error alerts (L394, L466) → `toast.error`; success alerts → `toast.show`; tonal primary actions.

### Task 3.3 — PublicEvents (`frontend/src/pages/PublicEvents.tsx`)
- `PageContainer`; empty list (L56) → `EmptyState`; Refresh button → tonal.

### Task 3.4 — Enrollments (`frontend/src/pages/Enrollments.tsx`)
- `PageContainer`; alert (L324) + all `setMessage(err...)` paths → `useToast`; empty lists → `EmptyState`; tonal primary actions.

### Task 3.5 — Judge (`frontend/src/pages/Judge.tsx`)
- `PageContainer`; severity already correct — optionally migrate to `useToast` for consistency; `SectionCard`/`Field` for scoring panels; `EmptyState` for no-assigned-models; tonal actions.

### Task 3.6 — Users (`frontend/src/pages/Users.tsx`)
- `PageContainer`; alert (L286) + error paths → `useToast`; empty user list → `EmptyState`; tonal create/export buttons.

### Task 3.7 — Admin (`frontend/src/pages/Admin.tsx`)
- `PageContainer`; alert (L330) + `setMessage(err)` → `useToast`; `?? "—"` in category date → `EmptyValue`; sections → `SectionCard`; tonal actions.

### Task 3.8 — Labels (`frontend/src/pages/Labels.tsx`)
- `PageContainer`; alert (L215) + DYMO error paths → `useToast`; export/print panels → `SectionCard`; tonal actions.

### Task 3.9 — Settings (`frontend/src/pages/Settings.tsx`)
- `PageContainer`; all 6+ `setMessage(err...)` paths → `useToast`; settings groups → `SectionCard`; ensure `theme-settings-updated` dispatch still fires; tonal save buttons.

### Task 3.10 — StaffCheckin (`frontend/src/pages/StaffCheckin.tsx`)
- `PageContainer`; alert (L63) → `useToast`; scan panel → `SectionCard`; large tonal primary action for on-site/mobile use.

### Task 3.11 — Login (`frontend/src/pages/Login.tsx`)
- `PageContainer maxWidth="sm"`; form → `SectionCard`; login error → `toast.error`; submit → `variant="contained"`.

### Task 3.12 — Dashboard (`frontend/src/pages/Dashboard.tsx`)
- `PageContainer`; `SectionCard` for summary blocks; tonal nav/action buttons. **Note:** Confirm with product owner whether Dashboard is reachable — not wired in `App.tsx` Routes; may be deferred.

---

## Files Created
- `frontend/src/lib/theme.ts`
- `frontend/src/components/PageContainer.tsx`
- `frontend/src/components/SectionCard.tsx`
- `frontend/src/components/Field.tsx`
- `frontend/src/components/EmptyState.tsx`
- `frontend/src/components/useToast.tsx`

## Files Edited
- `frontend/src/App.tsx` (theme extraction + AppBar/nav)
- `frontend/src/components/ProfileEditSections.tsx`
- All 12 pages under `frontend/src/pages/`

---

## Risks
1. **Theme augmentation** (`surfaceVariant`/`surfaceContainer`): must be declared once in `theme.ts` or a `.d.ts`; mis-scoped augmentation breaks the build.
2. **Input border-radius override** may conflict with `MuiTelInput` and AppBar `Select` (App.tsx L247) — verify those two after Task 1.4.
3. **AppBar color change to tonal**: can reduce contrast for `color="inherit"` icons/text — verify after Task 3.0.
4. **Toast migration**: do per-page to keep diffs surgical (per repo CLAUDE rules).
5. **Dashboard** may be unrouted dead code — confirm before Phase 3 effort.

## Open Decisions
1. Exact max-width: MUI `"md"` (~900px) vs a custom `900px` value.
2. `TonalButton` wrapper vs documented convention (recommendation: convention only, no wrapper).
3. Dashboard (Task 3.12) in scope or deferred.
4. Dark-surface hex values per preset (Task 1.2) — architect/owner sign-off recommended.

---

## Cross-cutting Acceptance Criteria
- `npm run build` passes after each phase; no new TS errors.
- All 3 presets (violet/ocean/forest) × both modes (light/dark) render correctly.
- One error + one success triggered per migrated page: error is red, success is green.
- No literal `—` for empty data in any migrated page.
- Mobile bottom nav shows on narrow viewport; content not occluded.
