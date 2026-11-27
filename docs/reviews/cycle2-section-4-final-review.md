# Cycle 2 — Section 4 (`apps/web/`) Final Post-Implementation Code Review

## Verdict: **APPROVED WITH MINOR NOTES**

---

## 1. Stage 2 (Pass 2 Plan Review) Summary
- `qoder-review` via Qoder CDP returned a 251-byte cross-tab artifact (`docs/reviews/cycle2-section-4-pass2-qoder.md`) and subsequent locked `qoder-review` attempts remained queued behind another section's Qoder CDP lock.
- Full Pass 2 Plan Review was completed via `agy-review` and integrated into [cycle2-section-4-plan.md](file:///Users/moeini/Dev/didar/docs/reviews/cycle2-section-4-plan.md), adding:
  - TanStack Query `cancelQueries` + cache invalidation & per-deal `inFlightMoveIdsRef` guard
  - `authStore.checkAuth()` concurrent deduplication + session preservation on 5xx/network errors
  - `ApiClient.getBlob()` non-JSON error safety + Safari/WebKit deferred `URL.revokeObjectURL`
  - `SettingsPage` `AbortController` + `AbortError` suppression, `isSubmitting` locks, inline revoke confirmation modal, and clipboard fallback
  - `safeExternalUrl` XSS/control-char hardening and `navigateWithAppPrefix` route-change event propagation

---

## 2. Stage 3 (Implementation & Strict TDD) Summary
- **P0 Blockers Fixed**:
  - Replaced all `primary-*` and invalid Tailwind v4/custom classes (`shadow-2xs`, `shadow-xs`, `backdrop-blur-xs`, `slate-750`, `py-0.2`, `w-84`, `animate-in fade-in`, `animate-bounce-subtle`) across `apps/web/src/`.
  - `SettingsPage.tsx`: Removed all fake mock fallbacks and fake `bidar_live_*` key fabrication; added `tabError` + retry, `modalError`, `isSubmitting` guards, `AbortController`, inline React revoke confirmation modal (no `window.confirm`), `formatJalaliDate`, and `navigator.clipboard` fallback.
  - `LeadsPage.tsx` & `ReportsPage.tsx`: Replaced `window.open('/api/v1/BidarExport/...')` with shared `downloadCsvBlob` using `apiClient.getBlob(...)`; replaced `window.alert` in `LeadsPage` with an inline dismissible error banner and added `isError` + retry + Persian `formatIranPhone` & `SOURCE_LABELS`.
  - `DealDetailPage.tsx`: Fixed `handleUpdateStage` to use `resolveEspoStageEnum`, intercept `Closed Lost` to open `LossReasonModal`, scope Won/Lost `pipelineStageId` lookup, revert `isRotten` + `localNotes` on `handleAddNote` failure, and propagate real `streamQuery` errors.
  - `api-client.ts` & `authStore.ts`: Unified `request()` and `getBlob()` error parsing and 401 broadcast, added `skipUnauthorizedEvent` for `login()`, deduplicated `checkAuth()`, and preserved `localStorage` session on 5xx/network errors.
- **P1/P2 Fixes**:
  - `useKanbanDeals.ts`, `KanbanColumn.tsx`, `DealCard.tsx`: Normalized Persian ZWNJ/Arabic glyphs in `resolveEspoStageEnum` (`تایید پیش‌فاکتور` -> `Proposal`, `عدم تایید` -> `Closed Lost`), added single-item rollback + `inFlightMoveIdsRef` + same-column drop guard + `application/x-bidar-deal` MIME.
  - `VoipCallToast.tsx`: Wired `handleSaveNote` to real `apiClient.post('/Note', ...)` / `/Call` with `noteError`, Persian digits, `w-80`, and `emerald-*`.
  - `GlobalSearchBar.tsx`, `AccountsPage.tsx`, `RottenBadge.tsx`, `AppShell.tsx`, `SmsModal.tsx`: Added `AbortController`, `safeExternalUrl`, `flex-wrap` group filter bar, WCAG AA light-mode `RottenBadge` contrast (`text-rose-700`), `Escape` key modal close, and `AppShell` header text isolation.

---

## 3. Stage 4 (Post-Implementation Review & Verification)
- **Initial `agy-review` Verdict**: `CHANGES REQUESTED` — flagged 2 P1 issues:
  1. `authStore.checkAuth()` in-flight token race if `logout()`/`login()` occurs mid-request.
  2. `GlobalSearchBar.tsx` 200ms debounce "No results found" flash & unescaped `item.id` interpolation.
- **Fixes Applied**:
  - Guarded `authStore.checkAuth()` with `tokenAtStart` comparison before applying state or logging out.
  - Set `isLoading(true)` immediately on non-empty query in `GlobalSearchBar.tsx` and escaped `encodeURIComponent(item.id)` in `handleSelectResult`.
- **Final Verification Gates (After Last Edit)**:
  - `npm --prefix apps/web run test:ci` (`tsc --noEmit && vitest run`): **29 test files passed (29), 161 tests passed (161)**.
  - `npm --prefix apps/web run build` (`tsc && vite build`): **1678 modules transformed, built in 1.97s**.
  - Static grep in `apps/web/src/` (excluding `src/test/`): **0** matches for `primary-`, `خط لوله`, `window.confirm`, `alert(`, `shadow-2xs`, `shadow-xs`, `backdrop-blur-xs`, `slate-750`, `py-0.2`, `w-84`, `animate-in`, `fade-in`, `animate-bounce-subtle`.
  - `apps/web/package.json` version untouched (`1.0.4` unchanged from baseline).
