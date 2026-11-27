# Cycle 2 — Section 4 (`apps/web/`) Remediation & TDD Plan

> **Scope**: Strictly `apps/web/` (Headless React 19 + TypeScript + Tailwind CSS v3 + TanStack Query SPA).  
> **Source**: Synthesized from Pass 1 Code Review (`docs/reviews/cycle2-section-4-pass1-agy.md`) and direct source inspection.  
> **Constraints**: Enforce Persian CRM term «کاریز» (never «خط لوله»), do NOT modify `apps/web/package.json` version, follow strict TDD (Red → Green) in `apps/web/src/test/`.

---

## Work Package A — P0 Blockers (Must Fix First)

### A1. Replace undefined `primary-*` and invalid Tailwind v4/custom classes
- **Files**:
  - `apps/web/src/pages/SettingsPage.tsx` (~35 `primary-*` occurrences)
  - `apps/web/src/components/layout/VoipCallToast.tsx` (`primary-*`, `w-84`, `animate-bounce-subtle`)
  - `apps/web/src/components/layout/AppShell.tsx` (`py-0.2`, `animate-in`, `fade-in`)
  - `apps/web/src/components/layout/GlobalSearchBar.tsx` (`slate-750`, `backdrop-blur-xs`, `shadow-xs`, `animate-in`, `fade-in`)
  - `apps/web/src/components/layout/UserNav.tsx` (`shadow-xs`, `animate-in`, `fade-in`)
  - `apps/web/src/components/layout/Sidebar.tsx` (`backdrop-blur-xs`, `shadow-xs`, `shadow-2xs`)
  - `apps/web/src/features/kanban/components/DealCard.tsx` (`dark:hover:bg-slate-750`, `shadow-2xs`)
  - `apps/web/src/features/kanban/components/DealCreateModal.tsx` (`py-0.2`, `backdrop-blur-xs`, `shadow-xs`)
  - `apps/web/src/pages/KanbanPage.tsx` (`dark:border-slate-750`, `shadow-2xs`, `shadow-xs`)
  - `apps/web/src/features/activities/components/ActivityItemRow.tsx` (`dark:hover:bg-slate-750`, `shadow-2xs`)
  - `apps/web/src/features/dashboard/components/PendingActivitiesWidget.tsx` (`dark:hover:bg-slate-750`, `shadow-2xs`)
  - `apps/web/src/pages/ActivitiesPage.tsx` (`animate-in`, `fade-in`, `shadow-2xs`, `shadow-xs`)
  - Remaining `shadow-2xs` / `shadow-xs` / `backdrop-blur-xs` usages across `apps/web/src/`.
- **Root Cause**: `tailwind.config.js` uses Tailwind CSS v3.4.15 without `primary` color palette, `slate-750`, `py-0.2`, `w-84`, or Tailwind v4 `shadow-2xs`/`shadow-xs`/`backdrop-blur-xs`/`tailwindcss-animate` utilities. Built CSS emits 0 rules for `bg-primary-600`, making Settings & VoIP primary buttons invisible (white text on transparent background) in light mode.
- **Fix**:
  - Replace all `primary-*` classes with `emerald-*` (consistent with the rest of BidarCRM).
  - Replace `slate-750` with `slate-700/70` or `slate-800`, `py-0.2` with `py-0.5`, `w-84` with `w-80`, `shadow-2xs` / `shadow-xs` with `shadow-sm`, `backdrop-blur-xs` with `backdrop-blur-sm`, and drop dead `animate-in` / `fade-in` / `animate-bounce-subtle` (or replace with standard `transition-opacity`).
- **TDD**: Test that `SettingsPage` and `VoipCallToast` render primary action buttons with valid `bg-emerald-*` classes and no undefined `primary-*` classes remain in `apps/web/src/`.

### A2. `SettingsPage`: Remove fake mock fallbacks and silent write failures
- **File**: `apps/web/src/pages/SettingsPage.tsx` (lines 100–293, plus tab UI)
- **Root Cause**: Catch blocks on `fetchApiKeys`, `fetchProducts`, `fetchGoals`, `fetchSmsTemplates` inject hardcoded mock data instead of displaying an error state; catch blocks on `handleCreateApiKey`, `handleRevokeKey`, `handleSaveProduct`, `handleCreateGoal`, `handleSaveSmsTemplate` fabricate fake local entities (including fake `bidar_live_*` raw keys) and close modals as if saved. Also line 227 uses blocking `window.confirm`, line 296 uses unguarded `navigator.clipboard.writeText`, and line 454 uses `toLocaleDateString('fa-IR')` instead of `formatJalaliDate`.
- **Fix**:
  - Add proper `tabError` / `modalError` state and inline error + retry UI for failed fetches and failed mutations; never fabricate fake records or fake API keys on failure.
  - Replace `window.confirm` on key revocation with an inline React confirmation modal/popover.
  - Guard `navigator.clipboard?.writeText` with try/catch and clear clipboard timers on unmount.
  - Add `AbortController` / stale-request guard on tab fetches.
  - Use `formatJalaliDate` for API key creation dates and add `whitespace-nowrap shrink-0` to status badges.
- **TDD**: Failing tests for `SettingsPage` verifying: (1) GET failure renders error state without fake mock items, (2) POST failure keeps modal open and shows error without adding fake key/product, (3) successful create/edit/revoke updates state cleanly.

### A3. Authenticated CSV exports in `LeadsPage` and `ReportsPage`
- **Files**: `apps/web/src/pages/LeadsPage.tsx` (lines 134–136), `apps/web/src/pages/ReportsPage.tsx` (lines 60–62)
- **Root Cause**: `window.open('/api/v1/BidarExport/...')` omits `Espo-Authorization` / `Espo-Authorization-By-Token` headers and bypasses 401 handling.
- **Fix**: Use `apiClient.getBlob(...)` + `URL.createObjectURL(blob)` + `<a download>` + `URL.revokeObjectURL` (matching `ContactsPage` and `AccountsPage`), with loading/error handling. Extract a shared `downloadCsvBlob` helper in `lib/api-client.ts` or `lib/download.ts` to eliminate duplication across all 4 pages (`ContactsPage`, `AccountsPage`, `LeadsPage`, `ReportsPage`).
- **TDD**: Tests verifying `LeadsPage` and `ReportsPage` export buttons call `apiClient.getBlob('/BidarExport/Lead')` and `apiClient.getBlob('/BidarExport/Opportunity', { params: { period } })` instead of `window.open`.

### A4. `DealDetailPage`: Fix stage enum resolution, Closed Won/Lost `pipelineStageId`, LossReasonModal interception, and error handling
- **File**: `apps/web/src/pages/DealDetailPage.tsx` (lines 55–76, 131–291)
- **Root Cause**:
  1. `handleUpdateStage` sends raw Persian `stageName` instead of calling `resolveEspoStageEnum(...)`, ignores `targetStage` when stage ID length != 17, never intercepts Closed Lost stages to open `LossReasonModal`, and swallows errors in `catch {}`.
  2. `handleMarkWon` and `handleMarkLost` patch `stage` without updating/clearing `pipelineStageId` (so `KanbanColumn` keeps the card in its old column!) and lack `try/catch` error handling / rollback.
  3. `handleAddNote` does not revert optimistic `localDeal` (`isRotten: false`) on failure and surfaces no error.
  4. `streamQuery` swallows all fetch errors into `{ list: [], total: 0 }`, making `streamQuery.isError` unreachable.
- **Fix**:
  - Use `resolveEspoStageEnum` in `handleUpdateStage`; if resolved stage is `'Closed Lost'` (or stage matches loss keywords / `isLost`), open `LossReasonModal` instead of immediately patching without a reason.
  - In `handleMarkWon` / `handleMarkLost`, find matching Won/Lost `PipelineStage` from `stages` (setting `pipelineStageId: matchedStage?.id ?? null`), wrap in `try/catch` with rollback and visible error alert.
  - Revert both `localNotes` and `localDeal` on `handleAddNote` failure and display error feedback.
  - Let `streamQuery` propagate real network/500 errors (only fallback to `/Note` when `/stream` returns 404/405).
- **TDD**: Failing tests for `DealDetailPage` covering: (1) `handleUpdateStage` sends valid Espo enum `'Qualification'` for Persian stage `'مذاکره اولیه'`, (2) selecting a Lost stage opens `LossReasonModal` and sends `lossReason` + `pipelineStageId`, (3) `handleMarkWon` updates `pipelineStageId`, (4) `handleAddNote` error reverts `isRotten` & shows error.

### A5. `authStore.checkAuth()` & `ApiClient.getBlob()` 401/500 handling
- **Files**: `apps/web/src/features/auth/authStore.ts` (lines 88–92, 126–132, 166–216), `apps/web/src/lib/api-client.ts` (lines 180–199, 227–265)
- **Root Cause**:
  1. `authStore.checkAuth()` catches *all* errors (including 500, 502, network offline) and calls `this.logout(true)`, wiping `localStorage` on transient server errors.
  2. `ApiClient.getBlob()` skips response body error parsing and never dispatches `API_UNAUTHORIZED_EVENT` or notifies `unauthorizedListeners` on 401.
  3. `ApiClient.request()` dispatches `API_UNAUTHORIZED_EVENT` even on `/App/user` login attempt when `skipUnauthorizedBroadcast` isn't set (bad password on LoginForm triggers logout event).
- **Fix**:
  - In `authStore.checkAuth()`, only call `logout(true)` when `err instanceof ApiError && (err.status === 401 || err.status === 403)` (preserve session on 5xx / network errors).
  - Refactor `ApiClient` to share URL construction, auth headers, error parsing, and 401 broadcast between `request()` and `getBlob()`. Add optional `skipUnauthorizedEvent?: boolean` on `RequestOptions` and set it on `authStore.login()`.
- **TDD**: Failing tests in `api-client.test.ts` and `authStore.test.ts` for `getBlob` 401 broadcast & JSON error detail parsing, `checkAuth` preserving session on 500/network error while logging out on 401, and `login` 401 not broadcasting logout.

---

## Work Package B — P1 Majors (Reliability, Theme Contrast, Navigation & Memory Leaks)

### B1. Kanban DnD Reliability, Optimistic Rollback, Stage Mapping & `LossReasonModal`
- **Files**:
  - `apps/web/src/features/kanban/hooks/useKanbanDeals.ts`
  - `apps/web/src/features/kanban/components/KanbanColumn.tsx`
  - `apps/web/src/features/kanban/components/DealCreateModal.tsx`
  - `apps/web/src/features/deals/components/LossReasonModal.tsx`
  - `apps/web/src/pages/KanbanPage.tsx`
  - `apps/web/src/features/activities/components/TaskKanbanBoard.tsx`
  - `apps/web/src/pages/ActivitiesPage.tsx`
- **Fixes**:
  1. **Single-item rollback + in-flight protection** (`useKanbanDeals.ts`): Track `previousDeal` per `dealId` instead of cloning whole `localDeals` array so concurrent moves do not clobber each other; track in-flight move IDs so stale `useEffect` syncs don't overwrite pending optimistic moves. Same single-item rollback in `ActivitiesPage.handleUpdateTaskKanbanStatus`.
  2. **Same-column drop guard**: In `KanbanColumn.tsx` / `KanbanPage.tsx` and `TaskKanbanBoard.tsx`, check if the deal/task is already in the target column before calling `onMoveDeal` / `onUpdateStatus` (prevents spurious PATCH + unintended `LossReasonModal` or `completedPromptItem`).
  3. **Custom drag MIME validation**: Set and read `application/x-bidar-deal` (with `text/plain` fallback only when `dealId` exists in `deals`) in `DealCard`/`KanbanColumn` (and `application/x-bidar-task` in `TaskKanbanBoard`) so dropping arbitrary text doesn't trigger API calls.
  4. **Pipeline switching clarity** (`useKanbanDeals.ts`): Use one base query or clear/derive filtered deals cleanly without showing stale deals from another pipeline.
  5. **`resolveEspoStageEnum` keyword fix** (`useKanbanDeals.ts`): Narrow `'تایید'` in `Closed Won` to `'تایید نهایی'` / `'تایید مشتری'` (or order Proposal/Negotiation before generic `'تایید'`) so `'تایید پیش‌فاکتور'` resolves to `'Proposal'`, not `'Closed Won'`.
  6. **`DealCreateModal` stage enum** (`DealCreateModal.tsx:351`): Use `resolveEspoStageEnum(selectedStage?.name || '', selectedStage?.mappedStatus)`. Also report item creation warnings if `BidarDealItem` POST fails instead of silent swallow.
  7. **`LossReasonModal` reset & `isSubmitting`** (`LossReasonModal.tsx`, `KanbanPage.tsx`, `DealDetailPage.tsx`): Reset `lossReason`/`lossReasonNote`/`validationError` in `useEffect([isOpen])`; pass `isSubmitting`; in `KanbanPage.handleConfirmLoss`, await `moveDeal` before closing modal and handle error without uncaught rejection.
  8. **`TaskKanbanBoard` status grouping** (`TaskKanbanBoard.tsx:79`): Don't silently hide/lump `Canceled`/`Deferred` or preserve filter cleanly; add `dragResetTimerRef` click-suppression if needed.

### B2. Light vs Dark Theme Contrast, Shell & Sidebar Styling
- **Files**: `AppShell.tsx`, `Sidebar.tsx`, `GlobalSearchBar.tsx`, `ThemeToggle.tsx`, `UserNav.tsx`, `RottenBadge.tsx`
- **Fixes**:
  - `RottenBadge.tsx`: Change `text-rose-400` to `text-rose-700 dark:text-rose-400` (and icon `text-rose-600 dark:text-rose-400`) so light-mode contrast passes WCAG AA on white cards.
  - `Sidebar.tsx`: Use `border-l` (RTL inner separator) instead of `border-r border-l`.
  - `AppShell.tsx` + `ThemeToggle.tsx` + `GlobalSearchBar.tsx` + `UserNav.tsx`: Ensure light/dark adaptation is crisp and readable in both modes (`AppShell` topbar & shell adapt cleanly or maintain intentional contrast with proper text/bg tokens; remove `text-slate-100` from outer wrapper so light-mode children never inherit white text).

### B3. SPA Navigation, `/app` Prefix Safety & `GlobalSearchBar` Query Propagation
- **Files**: `App.tsx`, `ContactsPage.tsx`, `AccountsPage.tsx`, `LeadsPage.tsx`, `GlobalSearchBar.tsx`, `VoipCallToast.tsx`, `PendingActivitiesWidget.tsx`
- **Fixes**:
  - Pass `onNavigate` to `ContactsPage` and `AccountsPage` from `App.tsx`, replacing `<a href="/accounts">` and `<a href="/contacts">` full-page reloads with SPA `onNavigate` calls (preserving `/app` prefix and React Query cache).
  - Extract a shared `navigateWithAppPrefix(path)` helper (or use `onNavigate` callback) for `VoipCallToast` and `PendingActivitiesWidget` so `/app` prefix is never stripped.
  - Read `?search=` from `window.location.search` (and listen to `popstate`) in `ContactsPage`, `AccountsPage`, and `LeadsPage` so selecting a result in `GlobalSearchBar` pre-filters the target table.
  - In `GlobalSearchBar.tsx`: Add `AbortController` / request sequence ID to prevent stale async responses from overwriting newer searches; don't fire `onSearch` on every keystroke inside the modal (or pass `onSearch` cleanly without hijacking typing); fix `setTimeout` focus cleanup on unmount.

### B4. Contact/Account Group Filter Height, Error Visibility & Blocking Dialogs
- **Files**: `AccountsPage.tsx`, `LeadsPage.tsx`, `DealItemsPanel.tsx`, `QuickLogBar.tsx`
- **Fixes**:
  - `AccountsPage.tsx:179`: Change group filter bar from `overflow-x-auto pb-1` to `flex-wrap min-h-fit overflow-visible` (matching `ContactsPage.tsx`).
  - `LeadsPage.tsx`: Propagate `useQuery` error (`isError` + retry banner instead of swallowing into `{ list: [], total: 0 }`), replace `alert(...)` on conversion error with an inline dismissible error banner.
  - `DealItemsPanel.tsx`: Surface errors on item delete / Opportunity amount sync failure instead of silent `catch {}`.
  - `QuickLogBar.tsx`: Display inline upload error if `/Attachment` upload fails.

### B5. Hooks Lifecycle, Uncleaned Timers, `ContactQuickCreateModal` & `VoipCallToast`
- **Files**: `App.tsx`, `ContactQuickCreateModal.tsx`, `SmsModal.tsx`, `VoipCallToast.tsx`, `LeadsPage.tsx`, `GlobalSearchBar.tsx`
- **Fixes**:
  - Clean up all `setTimeout` handles via `useRef` + `useEffect` unmount cleanup in `GlobalSearchBar`, `SmsModal`, `VoipCallToast`, `LeadsPage`, `SettingsPage`.
  - `ContactQuickCreateModal.tsx`: Declare `handleClose` with `useCallback` before `useEffect` and include it in deps.
  - `App.tsx`: Fix `useEffect` dependencies on mount auth check (run once on mount safely via ref or `[checkAuth]`).
  - `VoipCallToast.tsx`: Wire `handleSaveNote` to real `apiClient.post('/Note', ...)` (or `/Call`) with proper error state instead of fake `setSavedSuccess(true)` stub, and use typed `CustomEvent<IncomingCallData>` listener without `as any`.

---

## Work Package C — P2 Minors (Persian Digits, Vazirmatn, URL Safety, A11y, Type Safety)

### C1. Persian Digits, Vazirmatn Typography, RTL Percentages & Translated Labels
- Convert remaining ASCII digits to `toPersianDigits(...)`:
  - `DealCard.tsx:106` (`daysSinceLastActivity`)
  - `DealSidebar.tsx:126` (`daysSinceLastActivity`)
  - `PendingActivitiesWidget.tsx:79` (`activities.length`)
  - `lib/jalali.ts:60-67` (`formatRelativeJalali`)
  - `DealDetailPage.tsx:404` (stepper index `idx + 1`)
  - `VoipCallToast.tsx:114,137` (`formatIranPhone` / `toPersianDigits`)
  - `LeadsPage.tsx:314` (`formatIranPhone(lead.phoneNumber)`)
- Replace `font-mono` on Persian amounts/counts with `font-vazirmatn tabular-nums` (`KanbanColumn`, `DealCard`, `KanbanPage`, `DealSidebar`, `DealItemsPanel`, `TaskKanbanBoard`, `SalesGoalWidget`, `LossReasonsWidget`, `ActivityItemRow`) and use `dir="rtl"` for Persian `%` badges (`LossReasonsWidget:66`, `SalesGoalWidget:46`).
- Translate raw English enums in UI: `LeadsPage.tsx:300` (`lead.source`), `DealSidebar.tsx:79` & `DealDetailPage.tsx:357` (show `deal.pipelineStageName` or Persian stage label), `UserNav.tsx:208` (`relatedType`).
- Add `whitespace-nowrap inline-flex items-center shrink-0` to remaining status/count/tag badges (`AppShell`, `UserNav`, `ActivitiesPage`, `PendingActivitiesWidget`, `LossReasonsWidget`, `SalesFunnelChart`, `SalesGoalWidget`, `TaskKanbanBoard`, `DealSidebar`, `DealTimeline`, `SettingsPage`).

### C2. URL Safety & Accessibility
- Add safe URL helper `safeExternalUrl(raw)` for `AccountsPage.tsx:303` (reject `javascript:` / `data:` / `vbscript:`, allow only `http:` / `https:`) and use `rel="noopener noreferrer"`.
- Add `Escape` key handler (`window` listener or auto-focused dialog) to `SmsModal`, `AccountCreateModal`, `LeadCreateModal`, `LossReasonModal`, `ActivityCreateModal`, and the 4 `SettingsPage` modals (plus `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and `aria-label` on close buttons).
- Add keyboard support (`tabIndex={0}`, `role="button"`, `onKeyDown` Enter/Space) to interactive `DealCard`, `ContactsTable` rows, `TaskKanbanBoard` cards, `JalaliCalendarView` day cells, `AppShell` pinned items, `UserNav` notifications.
- Eliminate avoidable `any` casts in `ActivitiesPage`, `ActivityCreateModal`, `DashboardPage`, `ReportsPage`, `LeadsPage`, `SettingsPage`, `VoipCallToast`.

---

## Work Package D — TDD Test Suite Expansion (`apps/web/src/test/`)
Write failing tests FIRST (Red), then implement fixes (Green), covering:
1. `api-client.test.ts`: `getBlob` 401 broadcast + error detail parsing, `skipUnauthorizedEvent` option.
2. `authStore.test.ts`: `checkAuth` keeps session on 500/network error and logs out on 401/403; `login` 401 does not broadcast session expiry.
3. `SettingsPage.test.tsx` (new): API keys / Products / Goals / SMS error handling (no mock fallback on failure, inline error on failed POST), valid `bg-emerald-*` classes (no `primary-*`), Jalali dates.
4. `DealDetailPage.test.tsx` & `KanbanBoard.test.tsx`: `resolveEspoStageEnum` (`تایید پیش‌فاکتور` -> `Proposal`), concurrent `moveDeal` rollback isolation, same-column drop guard, `DealDetailPage` stage stepper + `LossReasonModal` + `pipelineStageId` on Won/Lost + `handleAddNote` failure rollback.
5. `DealItemsPanel.test.tsx` (new): discount calculation, add/delete item, error surfacing.
6. `SmsModal.test.tsx` & `VoipCallToast.test.tsx` (new): `calculatePersianSmsPages`, template interpolation, validation, Escape close, VoIP note POST & Persian digits.
7. `AccountsLeadsReports.test.tsx` (new): `AccountsPage` group filter bar wrapping + URL XSS guard + CSV blob export; `LeadsPage` 1-click convert error banner + `apiClient.getBlob` export + Persian phone/source labels; `ReportsPage` `apiClient.getBlob` export.
8. `GlobalSearchBar.test.tsx` (new): keyboard navigation (`ArrowDown`/`ArrowUp`/`Enter`/`Escape`), async race cancellation, query param navigation to `/contacts?id=...&search=...`.
9. Additional Pass 2 TDD items:
   - `TaskKanbanBoard` & `ActivitiesPage`: same-column drop guard, `application/x-bidar-task` MIME validation, `Canceled`/`Deferred` visibility, `handleUpdateTaskKanbanStatus` single-item rollback.
   - `DealCreateModal`: valid Espo stage enum + non-duplicating error handling if `BidarDealItem` POST fails after `Opportunity` succeeds.
   - Persian normalization in `resolveEspoStageEnum`: `'پیش‌فاکتور'` (ZWNJ), `'پیش فاکتور'`, `'عدم تایید'` (must not match `Closed Won`), Arabic `ي`/`ك` variants.
   - `PendingActivitiesWidget` & SPA URL sync: `/app` prefix preservation, `ContactsPage`/`AccountsPage` SPA link clicks, reading `?search=` + `?id=` including same-pathname updates.
   - `QuickLogBar`: `/Attachment` upload failure inline error.
   - `safeExternalUrl` & Modal `Escape` / Keyboard A11y: control-char/scheme XSS tests, bare-domain handling, stacked-modal `Escape` isolation, `Space`/`Enter` keyboard tests.
   - Terminology & Typography: `toPersianDigits` / `formatRelativeJalali` zero-ASCII-digit assertions, `font-vazirmatn` token existence, zero `خط لوله` strings across `apps/web/src/`.

---

## Pass 2 Additions & Verification Gates (Finalized)

1. **TanStack Query Cache & Concurrent Move Safety (A4, B1)**:
   - Call `queryClient.cancelQueries` on optimistic deal/task moves and invalidate both deal detail and Kanban deals list query keys on `DealDetailPage` mutations (`handleUpdateStage`, `handleMarkWon`, `handleMarkLost`, `handleAddNote`).
   - Lock or sequence-guard `inFlightMoveIds` per deal ID in `useKanbanDeals` so rapid same-card double-drags cannot corrupt rollback.
   - In `DealDetailPage`, scope Won/Lost `PipelineStage` lookup by `deal.pipelineId` and prefer structured flags (`isLost`, `mappedStatus`) over keyword matching.
   - In `LossReasonModal`, trigger `moveDeal` only after user confirmation (keeping modal open with `isSubmitting` + error banner if `PATCH` fails).
   - In `DealCreateModal`, if `POST /Opportunity` succeeds and `POST /BidarDealItem` fails, switch to created/item-retry warning state rather than allowing duplicate `Opportunity` creation.
2. **Auth & Blob Resilience (A3, A5)**:
   - In `authStore.checkAuth()`, deduplicate concurrent checks with an in-flight promise lock, preserve `localStorage` on 5xx/network errors while exposing `authError` + retry (with `isLoading: false`), and guard `logout(true)` against 401 broadcast storms.
   - In `ApiClient.getBlob()`, handle non-JSON error bodies safely without `SyntaxError`, defer `URL.revokeObjectURL` (`setTimeout(..., 1000)`) for Safari/WebKit compatibility, and forward `signal?: AbortSignal`.
3. **SettingsPage & VoIP Edge Cases (A2, B5)**:
   - Suppress `AbortError` when cancelling stale `SettingsPage` tab fetches; disable submit buttons during `isSubmitting`; keep revoke confirmation open on `DELETE` failure; show visual fallback if `navigator.clipboard.writeText` throws.
   - In `VoipCallToast`, handle unidentified callers (`parentId` missing) cleanly and pause auto-dismiss while typing/submitting a note.
4. **SPA Navigation, `safeExternalUrl` & A11y (B3, C2)**:
   - Dispatch a custom route-change event (or reactive location state) inside `navigateWithAppPrefix` / `onNavigate` so same-route `?search=` / `?id=` updates propagate immediately; normalize leading slashes to prevent `/app/app/...`.
   - `safeExternalUrl(raw)` trims whitespace, strips/rejects control characters (`\u0000-\u001F`), rejects protocol-relative `//...` and non-`http:`/`https:` schemes, and auto-prefixes scheme-less domains with `https://`.
   - Stacked modals stop `Escape` propagation to parent modals; interactive cards/rows guard `e.target === e.currentTarget` (or attach keyboard handlers to title buttons) and `e.preventDefault()` on `Space`.
5. **Mandatory Verification Gates**:
   - `npm --prefix apps/web run test:ci` (`tsc --noEmit && vitest run`) — 100% pass.
   - `npm --prefix apps/web run build` (`tsc && vite build`) — 100% pass.
   - Static grep: zero `primary-`, zero `خط لوله`, zero `window.confirm`, zero `alert(`, zero `slate-750` / `shadow-2xs` / `shadow-xs` / `backdrop-blur-xs` / `py-0.2` / `w-84` in `apps/web/src/`.
   - `git diff -- apps/web/package.json` is empty.
