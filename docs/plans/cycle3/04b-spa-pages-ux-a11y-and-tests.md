# Cycle 3 Remediation Plan 04b — Headless SPA Pages, UX, A11y & Test Coverage (`apps/web/`)

```yaml
Scope (Allowed Files):
  - apps/web/src/** (EXCLUDING files touched exclusively by T4a except DealDetailPage.tsx, App.tsx, DealSidebar.tsx, DealCard.tsx, GlobalSearchBar.tsx)
Forbidden Changes:
  - Anything outside apps/web/
  - apps/web/package.json version field (must remain 1.0.4)
Prerequisites:
  - Plan 04a MUST be completed and `npm --prefix apps/web run test:ci && npm --prefix apps/web run build` GREEN before starting 04b!
Estimated Context Size: Medium (10 atomic tasks covering remaining 8 P1s + 7 P2s + 3 Test Gaps)
Recommended Model Tier: Weak / Fast (Flash, GLM-5.3-Flash, hy4-flash, Haiku)
```

## Global Execution Rules

1. **Verify Prerequisite First:** Run `npm --prefix apps/web run test:ci` before any edit to confirm Plan `04a` is green.
2. **Read ONLY** the files listed in each task's `Targets`.
3. **Strict TDD:** Step 1 (RED test) -> Step 2 (minimal fix) -> Step 3 (run `npx --prefix apps/web vitest run ...` -> GREEN).
4. **Terminology & Versioning:** Always use «کاریز» (never «خط لوله»). Do NOT bump `apps/web/package.json` version (`1.0.4`).
5. **Escalate immediately** on any condition in `Stop / Escalate If`.

---

## T4b.1 [P1] Sync `?search=` Query Parameter in `ContactsPage`, `AccountsPage`, and `LeadsPage`

- **Severity:** `P1` (Major — GlobalSearchBar Destination Unfiltered)
- **Targets:**
  - `apps/web/src/pages/ContactsPage.tsx` (line 41)
  - `apps/web/src/pages/AccountsPage.tsx` (line 54)
  - `apps/web/src/pages/LeadsPage.tsx` (line 73)
  - `apps/web/src/test/GlobalSearchBar.test.tsx`, `apps/web/src/test/ContactsTable.test.tsx`
- **Root Cause:** `GlobalSearchBar` navigates to `/contacts?id=...&search=...`, `/accounts?search=...`, and `/leads?search=...`, yet all three pages initialize `useState('')` and ignore `window.location.search`.

### Step 1 — RED Test
Add tests asserting `ContactsPage`, `AccountsPage`, and `LeadsPage` filter records matching `window.location.search = '?search=رضا'` on initial mount and when `APP_ROUTE_CHANGE_EVENT` fires.
Run targeted tests -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
In all 3 pages, initialize `searchQuery` with:
```ts
const [searchQuery, setSearchQuery] = useState(() =>
  typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('search') || '') : ''
);
```
And subscribe to `popstate` and `APP_ROUTE_CHANGE_EVENT` inside `useEffect` to update `searchQuery` from `window.location.search`.

### Step 3 — Verify GREEN
Run: `npx --prefix apps/web vitest run src/test/GlobalSearchBar.test.tsx src/test/ContactsTable.test.tsx src/test/AccountsLeadsReports.test.tsx`

### Stop / Escalate If
- Existing page tests leave dirty `window.location.search` from prior tests (reset in `beforeEach` in new tests).

---

## T4b.2 [P1] Replace Raw `<a href="/accounts">` & `<a href="/contacts">` Links with SPA Navigation

- **Severity:** `P1` (Major — Breaks `/app/` Subpath in Production)
- **Targets:**
  - `apps/web/src/pages/ContactsPage.tsx` (lines 111-117)
  - `apps/web/src/pages/AccountsPage.tsx` (lines 127-133)
  - `apps/web/src/App.tsx` (lines 118-130)
  - `apps/web/src/test/ContactsTable.test.tsx`
- **Root Cause:** Raw `<a href="/accounts">` and `<a href="/contacts">` omit `/app/` base path and trigger full page reloads out of the SPA.

### Step 1 — RED Test
Assert clicking the «شرکت‌ها» tab link in `ContactsPage` (with `onNavigate` prop) calls `e.preventDefault()` and invokes `onNavigate('/accounts')`.
Run: `npx --prefix apps/web vitest run src/test/ContactsTable.test.tsx` -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
Add `onNavigate?: (path: string) => void` to `ContactsPageProps` and `AccountsPageProps`, pass `onNavigate={navigate}` from `App.tsx`, use `buildAppUrl('/accounts')` / `buildAppUrl('/contacts')` for `href`, and attach `onClick={(e) => { e.preventDefault(); navigateWithAppPrefix('/accounts', onNavigate); }}`.

### Step 3 — Verify GREEN
Run: `npx --prefix apps/web vitest run src/test/ContactsTable.test.tsx src/test/AccountsLeadsReports.test.tsx src/test/AppRouting.test.tsx`

### Stop / Escalate If
- `buildAppUrl` is not exported from `lib/url.ts` (read `lib/url.ts` first; export `withAppPrefix` or use `navigateWithAppPrefix`).

---

## T4b.3 [P1] `SettingsPage` Modals Errors/Submit Locks, Mobile Overflow, Goal Units, & Lead-Form Builder Sync

- **Severity:** `P1` / `P2` (Major — Silent Modal Errors & Broken Settings Widgets)
- **Targets:**
  - `apps/web/src/pages/SettingsPage.tsx` (lines 277-336, 497, 531, 746, 821-1164, 1276-1317)
  - `apps/web/src/test/SettingsPage.test.tsx`
- **Root Cause:**
  1. Product, Goal, and SMS modals store `modalError` in catch blocks and track `isSubmitting`, yet NEVER render `{modalError && ...}` or disable submit buttons!
  2. Two tables wrap with `overflow-hidden` without `overflow-x-auto`, clipping columns on mobile.
  3. Goal cards hardcode «تومان» & wrong metric labels (`activitiesHeld` displays `'تعداد معامله'` + `'۲۵ تومان'`), API-key/SMS-template badges ignore `isActive: false`, and Tab 5 Web Lead checkboxes never update `embedSnippet`.

### Step 1 — RED Test
Add tests in `SettingsPage.test.tsx`:
1. Saving a Product when `apiClient.post` rejects renders the error text inside the Product modal dialog (`role="alert"`).
2. Inactive API key (`isActive: false`) renders «غیرفعال» badge (not «فعال»).
3. `BidarGoal` with `metricType: 'activitiesHeld'` and `targetValue: 25` displays `'۲۵'` WITHOUT `'تومان'`.
Run: `npx --prefix apps/web vitest run src/test/SettingsPage.test.tsx` -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
In `SettingsPage.tsx`:
1. Render `{modalError && <div role="alert" className="...">{modalError}</div>}` and pass `disabled={isSubmitting}` inside Product, Goal, and SMS modals; clear `setModalError(null)` when opening any modal.
2. Wrap the two settings `<table>` elements inside `<div className="overflow-x-auto">`.
3. Format goal metric labels (`wonAmount` -> `'درآمد تحقق یافته'`, `wonCount` -> `'تعداد معامله موفق'`, `dealsCreated` -> `'معاملات ایجادشده'`, `activitiesHeld` -> `'فعالیت‌های انجام‌شده'`) and format non-`wonAmount` targets with `toPersianDigits(g.targetValue)`.
4. Render `{item.isActive === false ? 'غیرفعال' : 'فعال'}` with conditional badge colors on API keys & SMS templates.
5. Pass active `formFields` into `embedSnippet` query param & preview rendering (`email`, `description`, etc.).

### Step 3 — Verify GREEN
Run: `npx --prefix apps/web vitest run src/test/SettingsPage.test.tsx`

### Stop / Escalate If
- Existing `SettingsPage.test.tsx` expects mocked `getEmbedSnippet()` static text that doesn't include field params (check `SettingsPage.test.tsx` first).

---

## T4b.4 [P1] `QuickLogBar` Retains Unsaved Note Text on Failure & `DealDetailPage` Resets State on `dealId` Change

- **Severity:** `P1` (Major — Data Loss on Network Error)
- **Targets:**
  - `apps/web/src/features/deals/components/QuickLogBar.tsx` (lines 107-115)
  - `apps/web/src/pages/DealDetailPage.tsx` (lines 107-118, 254-259)
  - `apps/web/src/test/DealDetailPage.test.tsx`
- **Root Cause:** `DealDetailPage::handleAddNote` catches errors without rethrowing, causing `QuickLogBar` to execute `setText('')` and wipe typed text. Also switching `/deals/A` -> `/deals/B` leaves `localDeal` showing Deal A until Deal B resolves.

### Step 1 — RED Test
Add to `DealDetailPage.test.tsx`:
1. When `POST /Note` rejects, `QuickLogBar` keeps the entered note text in the textarea while showing `role="alert"`.
2. Re-rendering `DealDetailPage` with `dealId="d2"` while `d2` fetch is pending clears `d1`'s title from screen.
Run: `npx --prefix apps/web vitest run src/test/DealDetailPage.test.tsx` -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
1. In `DealDetailPage.tsx`: add `throw err;` at the end of `handleAddNote`'s `catch` block, and add `useEffect(() => { setLocalDeal(null); setLocalNotes([]); setActionError(null); }, [dealId]);`.
2. In `QuickLogBar.tsx` lines 107-112: wrap `await onSubmit(...)` in `try { await onSubmit(...); setText(''); } catch { /* DealDetailPage displays error; keep typed text */ }`.

### Step 3 — Verify GREEN
Run: `npx --prefix apps/web vitest run src/test/DealDetailPage.test.tsx`

### Stop / Escalate If
- None.

---

## T4b.5 [P1] `ActivitiesPage` & `TaskKanbanBoard`: Date Crash Guard, Priority Badge (`Low` != High), Drop Guard, & Single-Item Rollback

- **Severity:** `P1` (Major — Page Crash & Data Duplication)
- **Targets:**
  - `apps/web/src/pages/ActivitiesPage.tsx` (lines 141-196, 238-258, 488-491)
  - `apps/web/src/features/activities/components/TaskKanbanBoard.tsx` (lines 62-70, 149-153)
  - `apps/web/src/test/ActivitiesPage.test.tsx`
- **Root Cause:**
  1. Malformed `dateEnd`/`dateDue` causes `getTehranDateString(new Date(actDate))` to throw `RangeError`, crashing `ActivitiesPage`.
  2. `TaskKanbanBoard` displays red «بالا» (High) badge for `priority === 'Low'`, fires `PATCH` on arbitrary non-task drops, duplicates tasks if clicking a task opens create-only `ActivityCreateModal`, and rolls back the whole `localActivities` array.

### Step 1 — RED Test
Add to `ActivitiesPage.test.tsx`:
1. Rendering `ActivitiesPage` with malformed `dateEnd: 'not-a-date'` does not throw.
2. In `TaskKanbanBoard`, `{ priority: 'Low' }` renders «پایین» (not «بالا»), and dropping `'random-text'` onto a column does NOT invoke `onUpdateStatus`.
Run: `npx --prefix apps/web vitest run src/test/ActivitiesPage.test.tsx` -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
1. In `ActivitiesPage.tsx`: wrap `new Date(actDate)` with `if (Number.isNaN(d.getTime())) return false;`; exclude `status === 'Canceled'` from `overdue` filter; roll back only the single failed `activityId` in `handleToggleComplete` / `handleUpdateTaskKanbanStatus` and surface inline `role="alert"` error; do NOT pass `onSelectTask` to open a create-only modal for existing tasks (or guard edit vs create).
2. In `TaskKanbanBoard.tsx`: handle `Urgent` -> `'فوری'`, `High` -> `'بالا'`, `Low` -> `'پایین'` (slate badge); on drop, confirm `tasks.some((t) => t.id === taskId)` and `task.status !== targetStatus` before calling `onUpdateStatus`.

### Step 3 — Verify GREEN
Run: `npx --prefix apps/web vitest run src/test/ActivitiesPage.test.tsx`

### Stop / Escalate If
- Existing `ActivitiesPage.test.tsx` tests clicking a `TaskKanbanBoard` card expecting `ActivityCreateModal` to open. (Check test file first!)

---

## T4b.6 [P1] `jalali.ts` (`پس‌فردا` + Future Relative Digits) & `number-to-words.ts` Safe Scientific Parsing

- **Severity:** `P1` (Major — Wrong Date & Uncaught `RangeError`)
- **Targets:**
  - `apps/web/src/lib/jalali.ts` (lines 59-68, 296-304)
  - `apps/web/src/lib/number-to-words.ts` (lines 54-60)
  - `apps/web/src/test/jalali.test.ts`, `apps/web/src/test/number-to-words.test.ts`
- **Root Cause:**
  1. `parseNaturalPersianDate('پس‌فردا')` hits `.includes('فردا')` first (+1 day instead of +2); `formatRelativeJalali` emits ASCII digits and returns `"0 روز دیگر"` for future hours.
  2. `numberToWords('hello')` / `numberToWords('1e999')` triggers `BigInt(Math.trunc(Number(s)))` -> `RangeError`.

### Step 1 — RED Test
1. In `jalali.test.ts`: assert `parseNaturalPersianDate('پس‌فردا')` is 2 days after today and `formatRelativeJalali(new Date(Date.now() + 2 * 3600_000)) === '۲ ساعت دیگر'`.
2. In `number-to-words.test.ts`: assert `numberToWords('hello') === ''` and `numberToWords('1e999') === ''` without throwing.
Run: `npx --prefix apps/web vitest run src/test/jalali.test.ts src/test/number-to-words.test.ts` -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
1. In `apps/web/src/lib/jalali.ts`: check `پس‌فردا` / `پس فردا` BEFORE `فردا` (line 298); in `formatRelativeJalali`, wrap numbers in `toPersianDigits(...)` and add future minute/hour branches (`futureMin < 60`, `futureHour < 24`).
2. In `apps/web/src/lib/number-to-words.ts` lines 57-59:
   ```ts
   if (/^[-+]?\d+(?:\.\d+)?e[+-]?\d+$/i.test(s)) {
     const num = Number(s);
     if (!Number.isFinite(num)) return null;
     s = BigInt(Math.trunc(num)).toString();
   }
   ```

### Step 3 — Verify GREEN
Run: `npx --prefix apps/web vitest run src/test/jalali.test.ts src/test/jalali-extended.test.ts src/test/number-to-words.test.ts`

### Stop / Escalate If
- Any existing `jalali.test.ts` expects ASCII digits from `formatRelativeJalali()`.

---

## T4b.7 [P1] Surface Query & CSV Export Errors in `AccountsPage`, `ContactsPage`, and `ReportsPage`

- **Severity:** `P1` (Major — Silent Error Swallowing)
- **Targets:**
  - `apps/web/src/pages/AccountsPage.tsx` (lines 59-62, 90-99)
  - `apps/web/src/pages/ContactsPage.tsx` (lines 66-75)
  - `apps/web/src/pages/ReportsPage.tsx` (lines 61-71)
  - `apps/web/src/test/AccountsLeadsReports.test.tsx`, `apps/web/src/test/ContactsTable.test.tsx`
- **Root Cause:** `AccountsPage` ignores `isError` / `error` from `useQuery` and shows empty state on failure; all 3 pages only `console.error` when CSV export fails.

### Step 1 — RED Test
In `AccountsLeadsReports.test.tsx`: mock `apiClient.get` rejection for `AccountsPage` -> expect visible `role="alert"` error message with retry button. Mock `getBlob` rejection on export -> expect visible `role="alert"` error.
Run targeted test -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
Destructure `isError, error` in `AccountsPage` and render a `role="alert"` retry box (matching `LeadsPage.tsx`); add `exportError` state + dismissible `role="alert"` banner in `AccountsPage`, `ContactsPage`, and `ReportsPage`.

### Step 3 — Verify GREEN
Run: `npx --prefix apps/web vitest run src/test/AccountsLeadsReports.test.tsx src/test/ContactsTable.test.tsx`

### Stop / Escalate If
- None.

---

## T4b.8 [P2] Timer Leak (`SmsModal`), Theme Mount Persistence (`useTheme`), Persian Digits & Task `dateEnd`

- **Severity:** `P2` (Minor)
- **Targets:**
  - `apps/web/src/components/common/SmsModal.tsx` (lines 145-149)
  - `apps/web/src/lib/theme.ts` (lines 58-91)
  - `apps/web/src/features/kanban/components/DealCard.tsx` (line 107)
  - `apps/web/src/features/deals/components/DealSidebar.tsx` (line 126)
  - `apps/web/src/features/dashboard/components/PendingActivitiesWidget.tsx` (lines 79, 95)
  - `apps/web/src/test/SmsModal.test.tsx`, `apps/web/src/test/theme.test.ts`, `apps/web/src/test/DashboardPage.test.tsx`
- **Root Cause:** `SmsModal` leaves an uncleaned 1200ms `setTimeout`; `useTheme` writes `localStorage` on mount (killing OS `prefers-color-scheme` sync); counts in `DealCard`, `DealSidebar`, `PendingActivitiesWidget` omit `toPersianDigits()`; and `PendingActivitiesWidget:95` omits `act.dateEnd`.

### Step 1 — RED Test
Add tests checking:
1. Unmounting `SmsModal` cancels its 1200ms auto-close timeout.
2. Mounting `useTheme` with empty `localStorage` leaves `localStorage.getItem(THEME_STORAGE_KEY)` as `null`.
3. `DealCard` renders `daysSinceLastActivity: 4` as `'۴ روز پیش'`; `PendingActivitiesWidget` renders `'۱ مورد'` and formats `act.dateEnd`.
Run targeted tests -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
1. Store `SmsModal` timer in `closeTimerRef` and clear in `useEffect` cleanup & when `isOpen` changes.
2. In `theme.ts`, keep mount `useEffect` DOM-only (`applyThemeClass(theme)`) and only write `localStorage` on explicit `toggle`/`setTheme`, broadcasting a `bidar:theme-change` CustomEvent to sync instances.
3. Wrap numeric counts in `toPersianDigits(...)` at `DealCard.tsx:107`, `DealSidebar.tsx:126`, `PendingActivitiesWidget.tsx:79`; update `PendingActivitiesWidget.tsx:95` to `act.dateDue || act.dateEnd || act.dateStart`.

### Step 3 — Verify GREEN
Run: `npx --prefix apps/web vitest run src/test/SmsModal.test.tsx src/test/theme.test.ts src/test/DashboardPage.test.tsx`

### Stop / Escalate If
- Existing `theme.test.ts` explicitly asserts `localStorage.getItem(THEME_STORAGE_KEY)` is populated immediately on hook mount (check `theme.test.ts` first!).

---

## T4b.9 [P2] Safe `tel:`/`mailto:` Hrefs, Encode `dealId` in URLs, & Eliminate 12 Explicit `any` Types

- **Severity:** `P2` (Minor — URI Safety & TypeScript Strictness)
- **Targets:**
  - `apps/web/src/lib/url.ts`
  - `apps/web/src/pages/DealDetailPage.tsx` (lines 53, 62, 74, 292, 319, 371)
  - `apps/web/src/features/deals/components/DealItemsPanel.tsx` (lines 57, 87, 154)
  - `apps/web/src/features/deals/components/DealSidebar.tsx` (lines 158, 169)
  - `apps/web/src/features/contacts/components/ContactsTable.tsx` (lines 185, 202)
  - `apps/web/src/pages/AccountsPage.tsx` (line 281), `apps/web/src/pages/LeadsPage.tsx` (lines 386, 413)
  - `any` removal: `ActivityCreateModal.tsx:67,109,138`, `ActivitiesPage.tsx:87,89,110,112`, `DashboardPage.tsx:172,341,344`, `ReportsPage.tsx:186,192`
  - Note on `authStore.ts`: Do NOT switch `localStorage` key `'bidar_auth'` without coordinating Playwright E2E scripts (`packages/e2e` reads/seeds `localStorage` if applicable — keep storage key unchanged unless verified!).
- **Root Cause:** Unsanitized `tel:`/`mailto:` allow `\r\n` or `?bcc=` URI injection; unencoded `dealId` in REST URLs allows path traversal; 12 explicit `any` casts suppress TS type checks.

### Step 1 — RED Test
Add tests in `src/test/url.test.ts` (or existing test):
`safeTelHref('0912\r\n123') === null`, `safeMailtoHref('user@example.ir?bcc=evil@x.com') === null`, `DealDetailPage` with `dealId="id/with?chars"` calls `apiClient.get('/Opportunity/id%2Fwith%3Fchars')`.

### Step 2 — Minimal Fix
1. Add `safeTelHref` and `safeMailtoHref` in `apps/web/src/lib/url.ts` and apply them across `DealSidebar`, `ContactsTable`, `AccountsPage`, `LeadsPage`.
2. Wrap `${encodeURIComponent(dealId)}` in `DealDetailPage.tsx` and `DealItemsPanel.tsx`.
3. Replace all 12 explicit `any` casts in `ActivityCreateModal`, `ActivitiesPage`, `DashboardPage`, and `ReportsPage` using existing `Call`, `Meeting`, `SalesRepMetric`, `LeadSourceMetric` types.

### Step 3 — Verify GREEN
Run: `npm --prefix apps/web run test:ci`
Expected: `tsc --noEmit` exits `0` with zero `any` regressions and all Vitest tests pass.

### Stop / Escalate If
- Removing any `as any` reveals an actual interface mismatch between `DashboardSummary` and widget props (if so, align the interface types cleanly without adding new `any`).

---

## T4b.10 [P2] Accessibility (`Escape` + Keyboard Access + `UserNav` Abort) & Missing Test Coverage Gaps

- **Severity:** `P2` (Minor — A11y & QA Hygiene)
- **Targets:**
  - `apps/web/src/features/accounts/components/AccountCreateModal.tsx` (or check actual path via `find`), `apps/web/src/features/leads/components/LeadCreateModal.tsx` (verify exact file paths!)
  - `apps/web/src/features/kanban/components/DealCard.tsx`, `DealCreateModal.tsx`, `LossReasonModal.tsx`, `ActivityCreateModal.tsx`, `GlobalSearchBar.tsx`, `AppShell.tsx`, `JalaliCalendarView.tsx`, `UserNav.tsx`
  - `apps/web/src/test/authStore.test.ts` (lines 117, 128), `apps/web/src/test/VoipCallToast.test.tsx` (lines 19, 54)
- **Root Cause:**
  1. `AccountCreateModal` and `LeadCreateModal` lack Escape close; `DealCard` / `JalaliCalendarView` clickable `<div>`s lack keyboard handlers; `GlobalSearchBar` lacks `aria-label`; `DealCreateModal` dropdowns don't close on outside click; `UserNav` 30s polling lacks `AbortController`.
  2. `authStore.test.ts:117,128` asserts wrong key `'bidar_auth_token'` instead of `'bidar_auth'` (false-positive test). `VoipCallToast.test.tsx` dispatches events outside `act(...)`.

### Step 1 — RED Test & Path Check
First locate exact modal file paths (`find apps/web/src -name '*CreateModal.tsx'`). Fix `authStore.test.ts:117,128` to assert `'bidar_auth'`, wrap `VoipCallToast.test.tsx` `dispatchEvent` calls in `act(...)`, and add unit tests for `DealItemsPanel`, `AccountCreateModal`, `LeadCreateModal`, and `UserNav` unmount `AbortController`.

### Step 2 — Minimal Fix
1. Bind `window.addEventListener('keydown', ...)` Escape close on `AccountCreateModal`, `LeadCreateModal`, `DealCreateModal`, `LossReasonModal`, `ActivityCreateModal`.
2. Add `role="button" tabIndex={0} onKeyDown` (`Enter`/`Space`) on clickable `DealCard`, pinned items in `AppShell`, and day cells in `JalaliCalendarView`; add `focus:opacity-100` to `AppShell` unpin button; add `aria-label` to `GlobalSearchBar` input; close `DealCreateModal` autocomplete dropdowns on outside click.
3. Pass `AbortController.signal` to `UserNav` notification polling.

### Step 3 — Verify GREEN & Final Gate
Run full SPA verification:
`npm --prefix apps/web run test:ci && npm --prefix apps/web run build`
Expected: **100% PASS** (`0` failures, `0` TS errors, zero `act(...)` warnings, clean Vite dist build). Confirm `apps/web/package.json` remains `"version": "1.0.4"`.

### Stop / Escalate If
- Any modal path differs from expected location or changing `DealCard` `role="button"` breaks existing E2E selector assumptions (verify `DealCard.test` / `KanbanBoard.test`).
