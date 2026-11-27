# Cycle 3 Remediation Plan 04a — Headless SPA Critical Blockers & Kanban Core (`apps/web/`)

```yaml
Scope (Allowed Files):
  - apps/web/src/features/activities/components/JalaliCalendarView.tsx
  - apps/web/src/features/activities/components/ActivityCreateModal.tsx
  - apps/web/src/pages/ActivitiesPage.tsx
  - apps/web/src/components/layout/VoipCallToast.tsx
  - apps/web/src/App.tsx
  - apps/web/src/pages/LeadsPage.tsx
  - apps/web/src/pages/DealDetailPage.tsx
  - apps/web/src/features/deals/components/DealSidebar.tsx
  - apps/web/src/features/deals/components/LossReasonModal.tsx
  - apps/web/src/lib/api-client.ts
  - apps/web/src/features/kanban/components/KanbanBoard.tsx
  - apps/web/src/features/kanban/components/KanbanColumn.tsx
  - apps/web/src/features/kanban/components/DealCreateModal.tsx
  - apps/web/src/pages/KanbanPage.tsx
  - apps/web/src/test/**
Forbidden Changes:
  - Anything outside apps/web/
  - Do NOT edit SettingsPage.tsx, ContactsPage.tsx, AccountsPage.tsx, ReportsPage.tsx, jalali.ts, number-to-words.ts, theme.ts, SmsModal.tsx, UserNav.tsx (those belong to Plan 04b)
  - apps/web/package.json version field (must remain 1.0.4)
Prerequisites: None
Estimated Context Size: Medium (8 atomic tasks covering all 5 P0s + 3 Kanban P1s)
Recommended Model Tier: Weak / Fast (Flash, GLM-5.3-Flash, hy4-flash, Haiku)
```

## Global Execution Rules

1. **Read ONLY** the files listed in each task's `Targets`.
2. **Never edit** files owned by Plan `04b` or outside `apps/web/`.
3. **Strict TDD:** Step 1 (add/run RED Vitest test -> confirm FAIL) -> Step 2 (apply exact minimal fix) -> Step 3 (run `npm --prefix apps/web run test:ci` -> confirm GREEN).
4. **Terminology & Versioning:** Always use «کاریز» (never «خط لوله»). Do NOT bump `apps/web/package.json` version (`1.0.4`).
5. **Escalate immediately** on any condition in `Stop / Escalate If`.

---

## T4a.1 [P0] Jalali Calendar Day Click Submits Year 1405 AD & Renders Blank Date Input

- **Severity:** `P0` (Blocker — Severe Data Corruption)
- **Targets:**
  - `apps/web/src/features/activities/components/JalaliCalendarView.tsx` (line 175)
  - `apps/web/src/features/activities/components/ActivityCreateModal.tsx` (lines 22-36, 64-69, 302-307)
  - `apps/web/src/test/ActivitiesPage.test.tsx`
- **Root Cause:** Clicking day `15` of Azar `1405` in `JalaliCalendarView.tsx:175` emits Jalali string `"1405/9/15"` instead of Gregorian ISO `"YYYY-MM-DD"`. `<input type="date" value="1405/9/15" />` renders blank while `ActivityCreateModal`'s `formatEspoDateTime` runs `new Date("1405/9/15")` and saves a 15th-century Gregorian date (`1405-09-14`) to EspoCRM.

### Step 1 — RED Test
Add to `apps/web/src/test/ActivitiesPage.test.tsx`:
```tsx
it('emits Gregorian YYYY-MM-DD on JalaliCalendarView day click so ActivityCreateModal submits valid 20xx year', async () => {
  const onSelectDate = vi.fn();
  render(<JalaliCalendarView activities={[]} onSelectDate={onSelectDate} />);
  fireEvent.click(screen.getByText('۱۵'));
  expect(onSelectDate).toHaveBeenCalledWith(expect.stringMatching(/^20\d{2}-\d{2}-\d{2}$/));
});
```
Run: `npx --prefix apps/web vitest run src/test/ActivitiesPage.test.tsx` -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
1. In `apps/web/src/features/activities/components/JalaliCalendarView.tsx`:
   - Import `jalaliToGregorian` from `../../../lib/jalali`.
   - At line 175, replace ``onClick={() => onSelectDate?.(`${currentYear}/${currentMonth}/${day}`)}`` with:
     ```tsx
     onClick={() => {
       const [gy, gm, gd] = jalaliToGregorian(currentYear, currentMonth, day);
       const isoDate = `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
       onSelectDate?.(isoDate);
     }}
     ```
2. In `apps/web/src/features/activities/components/ActivityCreateModal.tsx` (lines 25-36 and `dateDue` initialization around lines 64-69):
   - When normalizing `dateDue` from `initialData?.dateEnd`, strip time suffix (`YYYY-MM-DD HH:mm:ss` -> `YYYY-MM-DD`) so `<input type="date">` displays cleanly.
   - Inside `formatEspoDateTime`: guard `if (Number.isNaN(date.getTime())) { date = new Date(); }` so invalid input never produces `NaN` or wrong centuries.

### Step 3 — Verify GREEN
Run: `npx --prefix apps/web vitest run src/test/ActivitiesPage.test.tsx`
Expected: `PASS`, 0 failures.

### Stop / Escalate If
- Any existing test in `ActivitiesPage.test.tsx` asserts Jalali string `'1405/...'` as `onSelectDate` payload.

---

## T4a.2 [P0] `VoipCallToast` "مشاهده پرونده" Never Navigates (`bidar:route-change` Unhandled in `App.tsx`)

- **Severity:** `P0` (Blocker — Dead Navigation)
- **Targets:**
  - `apps/web/src/App.tsx` (lines 88-105)
  - `apps/web/src/components/layout/VoipCallToast.tsx` (lines 59-68)
  - `apps/web/src/test/AppRouting.test.tsx`
- **Root Cause:** `App.tsx` renders `<VoipCallToast />` without an `onNavigate` callback. `VoipCallToast` calls `navigateWithAppPrefix(target)`, which updates `history.pushState` and dispatches `APP_ROUTE_CHANGE_EVENT` (`bidar:route-change`), but `App.tsx` only listens to `popstate`, leaving the UI stuck on the previous page.

### Step 1 — RED Test
Add to `apps/web/src/test/AppRouting.test.tsx`:
```tsx
it('navigates App when VoipCallToast clicks مشاهده پرونده (APP_ROUTE_CHANGE_EVENT)', async () => {
  // Mock authenticated admin user & apiClient.get returning deal-99
  // Trigger window.dispatchEvent(new CustomEvent('bidar:incoming_call', { detail: { callerPhone: '09121234567', callerName: 'علی', dealId: 'deal-99' } })) within act(...)
  // Click 'مشاهده پرونده' and assert DealDetailPage renders heading 'معامله VoIP' and pathname is '/app/deals/deal-99'
});
```
(Inspect `AppRouting.test.tsx` first to match its exact mock helpers.)
Run: `npx --prefix apps/web vitest run src/test/AppRouting.test.tsx` -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
In `apps/web/src/App.tsx`:
1. Import `APP_ROUTE_CHANGE_EVENT` from `./lib/url`.
2. In `useEffect` (lines 88-98):
   ```ts
   const handleRouteSync = () => {
     if (typeof window !== 'undefined') {
       const normalized = normalizePath(window.location.pathname);
       setCurrentPath(normalized === '/' ? '/dashboard' : normalized);
     }
   };
   window.addEventListener('popstate', handleRouteSync);
   window.addEventListener(APP_ROUTE_CHANGE_EVENT, handleRouteSync);
   return () => {
     window.removeEventListener('popstate', handleRouteSync);
     window.removeEventListener(APP_ROUTE_CHANGE_EVENT, handleRouteSync);
   };
   ```
3. Inside `App.tsx`'s `navigate(path)` helper, also dispatch `window.dispatchEvent(new CustomEvent(APP_ROUTE_CHANGE_EVENT))` after `history.pushState` so query-param route sync listeners in pages receive same-route query updates.

### Step 3 — Verify GREEN
Run: `npx --prefix apps/web vitest run src/test/AppRouting.test.tsx`
Expected: `PASS`, 0 failures.

### Stop / Escalate If
- `App.tsx` causes infinite recursion if `handleRouteSync` calls `navigate` (ensure `handleRouteSync` ONLY calls `setCurrentPath`, never `navigate`).

---

## T4a.3 [P0] `LeadsPage` Ignores `onSelectDeal` Prop Passed by `App.tsx` — Post-Conversion Navigation Is Dead

- **Severity:** `P0` (Blocker — Dead Conversion Redirect)
- **Targets:**
  - `apps/web/src/pages/LeadsPage.tsx` (lines 71, 149-154)
  - `apps/web/src/test/AccountsLeadsReports.test.tsx`
- **Root Cause:** `App.tsx:124` renders `<LeadsPage onSelectDeal={(id) => navigate(\`/deals/\${id}\`)} />`, yet `LeadsPage.tsx:71` renames `onSelectDeal` to `_onSelectDeal` (discarded) and calls `onNavigate?.(...)`, which is `undefined`.

### Step 1 — RED Test
Add to `apps/web/src/test/AccountsLeadsReports.test.tsx`:
```tsx
it('calls onSelectDeal(opportunityId) after successful 1-click lead conversion in LeadsPage', async () => {
  const onSelectDeal = vi.fn();
  vi.spyOn(apiClient, 'get').mockResolvedValue({ list: [{ id: 'l-1', name: 'سارا', status: 'New' }], total: 1 });
  vi.spyOn(apiClient, 'post').mockResolvedValue({ opportunityId: 'opp-77' });
  renderWithClient(<LeadsPage onSelectDeal={onSelectDeal} />);
  fireEvent.click(await screen.findByRole('button', { name: /تبدیل به معامله/i }));
  await waitFor(() => expect(onSelectDeal).toHaveBeenCalledWith('opp-77'));
});
```
Run: `npx --prefix apps/web vitest run src/test/AccountsLeadsReports.test.tsx` -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
In `apps/web/src/pages/LeadsPage.tsx`:
1. Line 71: replace `onSelectDeal: _onSelectDeal` with `onSelectDeal`.
2. Lines 149-154:
   ```ts
   if (oppId) {
     if (onSelectDeal) {
       onSelectDeal(oppId);
     } else {
       onNavigate?.(`/deals/${oppId}`);
     }
   }
   ```

### Step 3 — Verify GREEN
Run: `npx --prefix apps/web vitest run src/test/AccountsLeadsReports.test.tsx`
Expected: `PASS`, 0 failures.

### Stop / Escalate If
- None.

---

## T4a.4 [P0] Remove Hardcoded Seed User ID `'2b45fd50209e2a898'` Fallback

- **Severity:** `P0` (Blocker — Cross-Tenant / Production 403 Failure)
- **Targets:**
  - `apps/web/src/pages/DealDetailPage.tsx` (lines 166-167)
  - `apps/web/src/features/activities/components/ActivityCreateModal.tsx` (lines 94-97)
  - `apps/web/src/test/ActivitiesPage.test.tsx`
- **Root Cause:** Both `DealDetailPage` and `ActivityCreateModal` fall back to `'2b45fd50209e2a898'` when `authStore.getState().user?.id` is missing, sending a dev seed ID that fails or misassigns records on any real EspoCRM database.

### Step 1 — RED Test
Add to `apps/web/src/test/ActivitiesPage.test.tsx`:
Assert that when `authStore.getState()` has `user: null`, submitting `ActivityCreateModal` does NOT include `assignedUserId: '2b45fd50209e2a898'` in the `POST` body.
Run: `npx --prefix apps/web vitest run src/test/ActivitiesPage.test.tsx` -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
1. In `apps/web/src/pages/DealDetailPage.tsx` lines 166-167:
   - Before:
     ```ts
     const currentUserId = authStore.getState().user?.id || '2b45fd50209e2a898';
     const assignedUserId = deal?.assignedUserId || currentUserId;
     ```
   - After:
     ```ts
     const currentUserId = authStore.getState().user?.id;
     const assignedUserId = deal?.assignedUserId || currentUserId || undefined;
     ```
     (Also omit `assignedUserId` key in payload or pass `...(assignedUserId ? { assignedUserId } : {})`.)
2. In `apps/web/src/features/activities/components/ActivityCreateModal.tsx` lines 94-97:
   - Replace `|| '2b45fd50209e2a898'` with `|| undefined`, and include `...(assignedUserId ? { assignedUserId } : {})` in the payload.

### Step 3 — Verify GREEN
Run: `npx --prefix apps/web vitest run src/test/ActivitiesPage.test.tsx src/test/DealDetailPage.test.tsx`
Expected: `PASS`, 0 failures.

### Stop / Escalate If
- Any existing test asserts `'2b45fd50209e2a898'` explicitly (update such test if found after reading it).

---

## T4a.5 [P0] `ApiClient.applyAuthHeaders` Unconditionally Overwrites Caller-Supplied `Espo-Authorization` Header

- **Severity:** `P0` (Blocker — Auth Spoofing / Login Failure)
- **Targets:**
  - `apps/web/src/lib/api-client.ts` (lines 118-124, 182-186)
  - `apps/web/src/test/api-client.test.ts`
- **Root Cause:** `applyAuthHeaders()` overwrites an explicit `Espo-Authorization` header (e.g. basic credentials during `authStore.login()`) with stale stored token credentials and sets `Espo-Authorization-By-Token: true`.

### Step 1 — RED Test
Add to `apps/web/src/test/api-client.test.ts`:
```ts
it('preserves explicit Espo-Authorization header instead of overwriting with stored token', async () => {
  // Set mock fetch, call apiClient.setAuth('oldUser', 'oldToken')
  // Request '/App/user' with explicit 'Espo-Authorization' header
  // Assert fetch received explicit header and NO 'Espo-Authorization-By-Token' header
});
```
Run: `npx --prefix apps/web vitest run src/test/api-client.test.ts` -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
In `apps/web/src/lib/api-client.ts`:
Inside `applyAuthHeaders(headers: Headers)`:
1. Add early return at start of method:
   ```ts
   if (headers.has('Espo-Authorization')) {
     return;
   }
   ```
2. Also guard cross-origin leaks by accepting `targetUrl: string` in `applyAuthHeaders(headers, targetUrl)` (or checking `isSameOrigin(url)` before calling `this.applyAuthHeaders(headers)`): only attach auth headers if `url.startsWith('/')` or `new URL(url, window.location.origin).origin === window.location.origin`.

### Step 3 — Verify GREEN
Run: `npx --prefix apps/web vitest run src/test/api-client.test.ts`
Expected: `PASS`, 0 failures.

### Stop / Escalate If
- `api-client.test.ts` mocks `window.location` without `origin` (fallback `typeof window !== 'undefined' ? window.location.origin : 'http://localhost'`).

---

## T4a.6 [P1] Partition Kanban Deals by Stage & Prioritize `pipelineStageId` in `isCurrent` Stage Highlighting

- **Severity:** `P1` (Major — Duplicate Cards & Multi-Stage Highlight Bug)
- **Targets:**
  - `apps/web/src/features/kanban/components/KanbanBoard.tsx`
  - `apps/web/src/features/kanban/components/KanbanColumn.tsx` (lines 35-43)
  - `apps/web/src/pages/DealDetailPage.tsx` (lines 445, 491-494)
  - `apps/web/src/features/deals/components/DealSidebar.tsx` (lines 88-91)
  - `apps/web/src/test/KanbanBoard.test.tsx`, `apps/web/src/test/DealDetailPage.test.tsx`
- **Root Cause:**
  1. Legacy deals without `pipelineStageId` match EVERY column sharing `mappedStatus` (e.g., two stages with `mappedStatus: 'Negotiation'`), rendering duplicate cards and inflated column sums.
  2. `DealDetailPage.tsx:445,491` and `DealSidebar.tsx:88` evaluate `deal.pipelineStageId === stage.id || ...` without checking `if (deal.pipelineStageId)` first, highlighting multiple stages as active simultaneously.

### Step 1 — RED Test
1. In `KanbanBoard.test.tsx`: pass two stages sharing `mappedStatus: 'Negotiation'` and one deal `{ id: 'd1', name: 'معامله مشترک', stage: 'Negotiation', amount: 1000 }` (no `pipelineStageId`). Assert `screen.getAllByTestId('deal-card-d1')` has length `1`.
2. In `DealDetailPage.test.tsx`: pass deal with `pipelineStageId: 's1', stage: 'Negotiation'` and two stages sharing `mappedStatus: 'Negotiation'`. Assert only `'s1'` is active.
Run: `npx --prefix apps/web vitest run src/test/KanbanBoard.test.tsx src/test/DealDetailPage.test.tsx` -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
1. In `apps/web/src/features/kanban/components/KanbanBoard.tsx`: pre-partition `deals` into `Map<string, Opportunity[]>` keyed by `stage.id` so each deal is assigned to at most ONE stage:
   - Pass 1: if `deal.pipelineStageId` matches a `stage.id` in `stages`, assign to that stage.
   - Pass 2 (only if no `pipelineStageId`): assign to the FIRST stage matching `deal.stage === stage.name`, else FIRST stage matching `Boolean(stage.mappedStatus && deal.stage === stage.mappedStatus)`.
   - Pass `deals={dealsByStage.get(stage.id) ?? []}` to `<KanbanColumn />`.
2. In `apps/web/src/pages/DealDetailPage.tsx` (lines 445, 491-494) and `apps/web/src/features/deals/components/DealSidebar.tsx` (lines 88-91):
   ```ts
   const isCurrent = deal.pipelineStageId
     ? deal.pipelineStageId === stage.id
     : (deal.stage === stage.name || Boolean(stage.mappedStatus && deal.stage === stage.mappedStatus));
   ```

### Step 3 — Verify GREEN
Run: `npx --prefix apps/web vitest run src/test/KanbanBoard.test.tsx src/test/DealDetailPage.test.tsx src/test/section4-headless.test.tsx`
Expected: `PASS`, 0 failures.

### Stop / Escalate If
- Existing `KanbanBoard.test.tsx` renders `<KanbanColumn />` directly with mixed-stage `deals` expecting `KanbanColumn` to filter them! (If so, keep `KanbanColumn`'s own `pipelineStageId` priority filter intact while partitioning in `KanbanBoard` for legacy `mappedStatus` dedup.)

---

## T4a.7 [P1] `KanbanPage` Uses `resolveEspoStageEnum` for Lost Interception & `LossReasonModal` Resets State on Reopen

- **Severity:** `P1` (Major — Missing Loss Reason & Cross-Deal Leak)
- **Targets:**
  - `apps/web/src/pages/KanbanPage.tsx` (lines 140-175, 363-368)
  - `apps/web/src/features/deals/components/LossReasonModal.tsx` (lines 35-38)
  - `apps/web/src/test/section4-headless.test.tsx`
- **Root Cause:** `KanbanPage.tsx:142` uses brittle substring matching that misses `targetStage?.isLost` and stage names like «عدم تایید»/«لغو» (which `resolveEspoStageEnum` maps to `'Closed Lost'`). Meanwhile, `LossReasonModal` never resets `lossReason`/`lossReasonNote` when `isOpen` becomes `true`, leaking the prior deal's input, and `KanbanPage` clears `pendingLoss` immediately without `isSubmitting` protection.

### Step 1 — RED Test
Add to `apps/web/src/test/section4-headless.test.tsx`:
1. Reopening `LossReasonModal` after selecting `'Competitor'` + note resets back to `'PriceTooHigh'` and `''`.
2. Dropping a deal onto a stage `{ id: 'st-deny', name: 'عدم تایید', order: 5 }` in `KanbanPage` opens `LossReasonModal` instead of immediately firing `PATCH`.
Run: `npx --prefix apps/web vitest run src/test/section4-headless.test.tsx` -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
1. In `apps/web/src/features/deals/components/LossReasonModal.tsx`: add `useEffect` resetting `lossReason` (`'PriceTooHigh'`), `lossReasonNote` (`''`), and validation error whenever `isOpen` changes to `true`.
2. In `apps/web/src/pages/KanbanPage.tsx` lines 140-175:
   - Compute `const isLost = Boolean(targetStage?.isLost) || resolveEspoStageEnum(targetStage?.name || targetStageName, targetStage?.mappedStatus) === 'Closed Lost';`
   - Track `isLossSubmitting` state during `handleConfirmLoss`, keeping `pendingLoss` until resolved (and closing cleanly on success or showing error on rejection).

### Step 3 — Verify GREEN
Run: `npx --prefix apps/web vitest run src/test/section4-headless.test.tsx src/test/gap-features.test.tsx`
Expected: `PASS`, 0 failures.

### Stop / Escalate If
- `LossReasonModal` accepts optional `isSubmitting` prop or uses different internal state names (read `LossReasonModal.tsx` lines 1-90 first).

---

## T4a.8 [P1] `DealCreateModal`: Jalali Day Overflow Clamp, `resolveEspoStageEnum`, Pipeline Stage Sync, & Pure Amount Update

- **Severity:** `P1` (Major — Form Corruption & React Anti-Pattern)
- **Targets:**
  - `apps/web/src/features/kanban/components/DealCreateModal.tsx` (lines 270-352, 663-671)
  - `apps/web/src/test/DealCreateModal.test.tsx`
- **Root Cause:**
  1. Selecting day `31` then switching month to Esfand passes invalid `1405/12/31` to `jalaliToGregorian`, overflowing into the next year.
  2. Line 351 falls back to `'Prospecting'` when `mappedStatus` is absent instead of calling `resolveEspoStageEnum`.
  3. Switching pipelines leaves `stageId` pointing to the old pipeline's stage when new stages load asynchronously.
  4. Line 305 calls `setAmount(...)` inside `setSelectedProducts` state updater and skips resetting when `newTotal === 0`.

### Step 1 — RED Test
Add to `apps/web/src/test/DealCreateModal.test.tsx`:
1. Submitting a deal in stage `{ id: 'st-prop', name: 'ارسال پیش‌فاکتور', order: 1 }` (no `mappedStatus`) sends `stage: 'Proposal', pipelineStageId: 'st-prop'`.
2. Switching Jalali month from `1` (day `31`) to `12` clamps day <= `29`/`30` cleanly without overflowing Gregorian year.
Run: `npx --prefix apps/web vitest run src/test/DealCreateModal.test.tsx` -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
In `apps/web/src/features/kanban/components/DealCreateModal.tsx`:
1. Line 270 (`handleJalaliDateChange`): clamp `d = Math.min(d, getJalaliMonthLength(y, m))` before `setJDay(d)` and `jalaliToGregorian(y, m, safeDay)`.
2. Line 351: replace `selectedStage?.mappedStatus || 'Prospecting'` with `resolveEspoStageEnum(selectedStage?.name || '', selectedStage?.mappedStatus)`.
3. Add `useEffect` syncing `stageId` whenever `stages.length > 0 && !stages.some((s) => s.id === stageId)` -> `setStageId(stages[0]!.id)`.
4. Compute `updated` products array outside `setSelectedProducts`, then call `setSelectedProducts(updated)` and `setAmount(newTotal > 0 ? String(newTotal) : '')` cleanly.

### Step 3 — Verify GREEN & Build Gate
Run full Section 4a verification (required before unlocking Plan `04b`):
`npm --prefix apps/web run test:ci && npm --prefix apps/web run build`
Expected: all Vitest suites PASS (`0` failures), `tsc` exits `0`, Vite build succeeds.

### Stop / Escalate If
- `DealCreateModal.test.tsx` mocks `resolveEspoStageEnum` or expects `'Prospecting'` fallback for a stage named `'ارسال پیش‌فاکتور'`.
