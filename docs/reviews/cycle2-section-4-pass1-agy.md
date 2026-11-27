## Pass 1 Senior Principal Code Review — `apps/web/`

**Baseline verification (read-only run before review):**
- `npx tsc --noEmit`: passed (0 errors)
- `npx vitest run`: 24 test files / 138 tests passed (note: `SettingsPage`, `AccountCreateModal`, `LeadCreateModal`, `DealItemsPanel`, `SmsModal`, `VoipCallToast`, `ApiClient.getBlob`, and `authStore.checkAuth` have zero tests)
- `apps/web/dist/assets/index-CFV-LFTu.css`: verified 0 generated rules for `primary-*`, `slate-750`, `py-0.2`, `w-84`, `shadow-2xs`, `shadow-xs`, `backdrop-blur-xs`, `animate-in`, `fade-in`, `animate-bounce-subtle`.

---

### Summary by Severity

| Severity | Count | Key Themes |
| :--- | :---: | :--- |
| **P0 Blocker** | 6 | Broken `primary-*` buttons (white-on-white), `SettingsPage` fake fallback data & silent write failures, `window.open` unauthenticated exports, `DealDetailPage` sending raw Persian stage enums + stale `pipelineStageId`, `checkAuth()` logging users out on 500/network errors, `getBlob` missing 401 broadcast |
| **P1 Major** | 14 | Concurrent Kanban rollback clobbering, missing same-column drop guard, `resolveEspoStageEnum` keyword collision (`تایید`), `DealCreateModal` ignoring `resolveEspoStageEnum`, `LossReasonModal` stale state & missing `isSubmitting`, full-page `<a href>` breaking SPA + `/app` prefix, `GlobalSearchBar` query params ignored & race condition, `AccountsPage` filter bar wrapping, `RottenBadge` light-mode contrast, Tailwind v4 shadow/blur classes dead in v3, `VoipCallToast` stubbed note save, `alert`/`confirm`, uncleaned `setTimeout`s, `getBlob` / `streamQuery` / `LeadsPage` swallowed errors |
| **P2 Minor** | 11 | Missing `toPersianDigits` & `font-mono` overriding Vazirmatn, RTL `dir="ltr"` flipping `٪`, raw English enums in UI, missing `whitespace-nowrap shrink-0` badges, unsafe `acc.website` URL scheme check, modal Escape/focus/label a11y gaps, clickable `<tr>`/`<div>` without keyboard support, `any` type escapes, `TaskKanbanBoard` status/drop bugs, test coverage gaps |

---

### 1. Kanban DnD Reliability & Optimistic Rollback Edge Cases

1. **[P0] `DealDetailPage.handleUpdateStage` sends raw Persian stage names instead of EspoCRM enums**
   - **Location**: [DealDetailPage.tsx](file:///Users/moeini/Dev/didar/apps/web/src/pages/DealDetailPage.tsx#L272-L291)
   - **Root Cause**: Line 276 computes `const stageVal = targetStage?.mappedStatus || stageName || stageIdOrName;` instead of calling `resolveEspoStageEnum`. For any pipeline stage without `mappedStatus` (e.g. custom EspoCRM stages like `'مذاکره اولیه'`), `PATCH /Opportunity/${dealId}` sends Persian text for the `stage` enum field, causing EspoCRM validation failure (which line 288–289 silently swallows in `catch {}`). Line 277 also hardcodes `stageIdOrName.length === 17` and never opens `LossReasonModal` when selecting a Closed Lost stage from the stepper or sidebar.
   - **Fix**: Route through `resolveEspoStageEnum(targetStage?.name || stageName || '', targetStage?.mappedStatus)`, intercept Closed Lost stages to open `LossReasonModal`, and surface errors via banner instead of swallowing.

2. **[P0] `DealDetailPage.handleMarkWon` / `handleMarkLost` leave stale `pipelineStageId` & lack error handling**
   - **Location**: [DealDetailPage.tsx](file:///Users/moeini/Dev/didar/apps/web/src/pages/DealDetailPage.tsx#L253-L270)
   - **Root Cause**: Both handlers patch `{ stage: 'Closed Won' }` / `{ stage: 'Closed Lost', ... }` without updating or clearing `pipelineStageId`, and neither has a `try/catch`. Because [KanbanColumn.tsx](file:///Users/moeini/Dev/didar/apps/web/src/features/kanban/components/KanbanColumn.tsx#L35-L38) matches strictly by `d.pipelineStageId === stage.id` when `pipelineStageId` is truthy, a deal marked Won/Lost from the detail page stays visually stuck in its old Kanban column.
   - **Fix**: Resolve the matching Won/Lost `PipelineStage` from `stages` and include `pipelineStageId` (or `null` if absent) in the PATCH; wrap in `try/catch` with rollback and error alert.

3. **[P1] Concurrent `moveDeal` rollback clobbers newer moves; `useEffect` overwrites in-flight optimistic state**
   - **Location**: [useKanbanDeals.ts](file:///Users/moeini/Dev/didar/apps/web/src/features/kanban/hooks/useKanbanDeals.ts#L165-L229), [ActivitiesPage.tsx](file:///Users/moeini/Dev/didar/apps/web/src/pages/ActivitiesPage.tsx#L178-L196)
   - **Root Cause**: `const previousSnapshot = [...localDeals];` (line 183) snapshots the whole array. If Deal A is moved at `t0`, Deal B is moved at `t1`, and Deal A fails at `t2`, `setLocalDeals(previousSnapshot)` (line 225) reverts Deal B too. Conversely, `moveDeal` triggers un-awaited `invalidateQueries` (lines 221–222); when an earlier refetch finishes while another move is in-flight, `useEffect` (lines 165–172) calls `setLocalDeals(list)` and overwrites the optimistic state. `ActivitiesPage.handleUpdateTaskKanbanStatus` has the identical whole-array snapshot bug.
   - **Fix**: Capture only the single moved item (`previousDeal`) and roll back functionally (`prev.map((d) => (d.id === dealId ? previousDeal : d))`), or drive optimistic updates directly on React Query cache via `onMutate` + `cancelQueries` + `setQueryData`.

4. **[P1] Missing same-column drop guard in `KanbanBoard` / `KanbanPage` and `TaskKanbanBoard`**
   - **Location**: [KanbanColumn.tsx](file:///Users/moeini/Dev/didar/apps/web/src/features/kanban/components/KanbanColumn.tsx#L60-L67), [KanbanPage.tsx](file:///Users/moeini/Dev/didar/apps/web/src/pages/KanbanPage.tsx#L140-L163), [TaskKanbanBoard.tsx](file:///Users/moeini/Dev/didar/apps/web/src/features/activities/components/TaskKanbanBoard.tsx#L62-L70)
   - **Root Cause**: Dropping a card back onto its current column still fires `onMoveDeal` → `PATCH` + query invalidation (and opens `LossReasonModal` if dropped in Closed Lost). Same in `TaskKanbanBoard`, which also triggers `completedPromptItem` in [ActivitiesPage.tsx](file:///Users/moeini/Dev/didar/apps/web/src/pages/ActivitiesPage.tsx#L184-L187).
   - **Fix**: Check whether the deal/task already belongs to the target column before invoking `moveDeal` / `onUpdateStatus`.

5. **[P1] `DealCreateModal` fails to call `resolveEspoStageEnum` on submit**
   - **Location**: [DealCreateModal.tsx](file:///Users/moeini/Dev/didar/apps/web/src/features/kanban/components/DealCreateModal.tsx#L351)
   - **Root Cause**: `selectedStage?.mappedStatus || 'Prospecting'` ignores Persian stage names when `mappedStatus` is absent, defaulting every stage to `'Prospecting'`.
   - **Fix**: Use `resolveEspoStageEnum(selectedStage?.name || '', selectedStage?.mappedStatus)`.

6. **[P1] `resolveEspoStageEnum` keyword collision (`تایید`)**
   - **Location**: [useKanbanDeals.ts](file:///Users/moeini/Dev/didar/apps/web/src/features/kanban/hooks/useKanbanDeals.ts#L36-L56)
   - **Root Cause**: `'تایید'` is in `Closed Won` (rule #2, line 38) ahead of `Proposal` (line 45) and `Negotiation` (line 49). A custom stage named `'تایید پیش‌فاکتور'` or `'تایید اولیه'` matches `'تایید'` first and erroneously maps to `'Closed Won'`.
   - **Fix**: Tighten Closed Won keywords (e.g. `'تایید نهایی'`, `'فروش موفق'`, `'برنده'`) or move `'تایید'` below proposal/negotiation rules.

7. **[P1] `LossReasonModal` retains stale state across deals and ignores `isSubmitting`**
   - **Location**: [LossReasonModal.tsx](file:///Users/moeini/Dev/didar/apps/web/src/features/deals/components/LossReasonModal.tsx#L28-L39), [KanbanPage.tsx](file:///Users/moeini/Dev/didar/apps/web/src/pages/KanbanPage.tsx#L170-L175,L363-L368)
   - **Root Cause**: `LossReasonModal` never resets `lossReason`/`lossReasonNote`/`validationError` when `isOpen` becomes `true`, so a previous deal's note persists. Neither `KanbanPage` nor `DealDetailPage` passes `isSubmitting`, and `KanbanPage` clears `pendingLoss` before `moveDeal` resolves, swallowing any error with `.catch(() => {})`.
   - **Fix**: Reset `LossReasonModal` state in a `useEffect([isOpen])`, await `moveDeal` before closing, and bind `isSubmitting`.

8. **[P1] Pipeline switching shows stale deals & refetches all 200 deals per pipeline**
   - **Location**: [useKanbanDeals.ts](file:///Users/moeini/Dev/didar/apps/web/src/features/kanban/hooks/useKanbanDeals.ts#L158-L172)
   - **Root Cause**: `dealsQuery` keys on `activePipelineId` yet fetches `/Opportunity?maxSize=200` unfiltered. While switching pipelines, `localDeals` is not cleared so the previous pipeline's deals remain visible until the new fetch resolves; deals without `pipelineId` appear in every pipeline.
   - **Fix**: Filter server-side when supported or share one base cache key and derive filtered deals via `useMemo`.

9. **[P2] Drag data validation & keyboard accessibility on Kanban cards**
   - **Location**: [KanbanColumn.tsx](file:///Users/moeini/Dev/didar/apps/web/src/features/kanban/components/KanbanColumn.tsx#L63), [DealCard.tsx](file:///Users/moeini/Dev/didar/apps/web/src/features/kanban/components/DealCard.tsx#L62-L71), [TaskKanbanBoard.tsx](file:///Users/moeini/Dev/didar/apps/web/src/features/activities/components/TaskKanbanBoard.tsx#L65,L76-L80,L126-L144)
   - **Root Cause**:
     - `KanbanColumn` and `TaskKanbanBoard` read generic `'text/plain'` on drop without validating a custom MIME type (`application/x-bidar-deal`) or verifying the ID exists in `deals`/`tasks`, allowing external text drops to trigger `PATCH` calls.
     - `DealCard` and `TaskKanbanBoard` cards are `<div draggable onClick>` with zero keyboard navigation (`tabIndex`, `role="button"`, `onKeyDown`) or keyboard move controls on `DealCard`.
     - `TaskKanbanBoard.tsx:79` lumps `'Canceled'` and `'Deferred'` tasks into `'Not Started'`.

---

### 2. Light vs Dark Theme Contrast, Tailwind v3 Validity & Sidebar Styling

1. **[P0] Non-existent `primary-*` classes leave Settings & VoIP primary buttons invisible in light mode**
   - **Location**: [tailwind.config.js](file:///Users/moeini/Dev/didar/apps/web/tailwind.config.js#L14-L40), [SettingsPage.tsx](file:///Users/moeini/Dev/didar/apps/web/src/pages/SettingsPage.tsx#L319-L1185) (~35 occurrences, e.g. lines 319, 333, 407, 516, 572, 603, 769, 795, 918, 944, 1020, 1185), [VoipCallToast.tsx](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/VoipCallToast.tsx#L136,L150,L163,L173)
   - **Root Cause**: `tailwind.config.js` defines `brand` and `bidar`, not `primary`. Verified 0 `primary-*` rules in the compiled CSS (`apps/web/dist/assets/index-CFV-LFTu.css`). All primary action buttons (`bg-primary-600 text-white`) render with **transparent backgrounds and white text** in light mode (completely invisible until hovered/inspected).
   - **Fix**: Replace `primary-*` with `emerald-*` (matching the rest of the app) or define `primary` in `tailwind.config.js`.

2. **[P1] Tailwind v4 utilities & unconfigured classes produce zero CSS in Tailwind v3.4.15**
   - **Locations** (all verified 0 occurrences in built CSS):
     - `shadow-2xs`, `shadow-xs`, `backdrop-blur-xs` (Tailwind v4 syntax) across 20+ files including [AppShell.tsx](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/AppShell.tsx#L148), [Sidebar.tsx](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/Sidebar.tsx#L136,L144,L200), [KanbanPage.tsx](file:///Users/moeini/Dev/didar/apps/web/src/pages/KanbanPage.tsx#L196,L228,L261), [KpiCard.tsx](file:///Users/moeini/Dev/didar/apps/web/src/features/dashboard/components/KpiCard.tsx#L68), and all modals.
     - `slate-750` in [DealCard.tsx:69](file:///Users/moeini/Dev/didar/apps/web/src/features/kanban/components/DealCard.tsx#L69), [ActivityItemRow.tsx:97](file:///Users/moeini/Dev/didar/apps/web/src/features/activities/components/ActivityItemRow.tsx#L97), [PendingActivitiesWidget.tsx:101](file:///Users/moeini/Dev/didar/apps/web/src/features/dashboard/components/PendingActivitiesWidget.tsx#L101), [KanbanPage.tsx:221](file:///Users/moeini/Dev/didar/apps/web/src/pages/KanbanPage.tsx#L221), [GlobalSearchBar.tsx:188](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/GlobalSearchBar.tsx#L188).
     - `py-0.2` in [AppShell.tsx:148](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/AppShell.tsx#L148) and [DealCreateModal.tsx:828](file:///Users/moeini/Dev/didar/apps/web/src/features/kanban/components/DealCreateModal.tsx#L828).
     - `w-84` in [VoipCallToast.tsx:76](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/VoipCallToast.tsx#L76).
     - `animate-in`, `fade-in`, `animate-bounce-subtle` (no `tailwindcss-animate` plugin or keyframe) in [AppShell.tsx:156](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/AppShell.tsx#L156), [GlobalSearchBar.tsx:199](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/GlobalSearchBar.tsx#L199), [UserNav.tsx:137](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/UserNav.tsx#L137), [ActivitiesPage.tsx:355](file:///Users/moeini/Dev/didar/apps/web/src/pages/ActivitiesPage.tsx#L355), [VoipCallToast.tsx:76](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/VoipCallToast.tsx#L76).
   - **Fix**: Replace with valid Tailwind v3 classes (`shadow-sm`, `shadow`, `backdrop-blur-sm`, `slate-700`/`slate-800`, `py-0.5`, `w-80`) or define the missing tokens/keyframes in `tailwind.config.js`.

3. **[P1] Hard-coded dark `AppShell` header/outer frame vs light `Sidebar`, plus light-mode contrast defects**
   - **Location**: [AppShell.tsx](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/AppShell.tsx#L95,L110,L123-L152), [GlobalSearchBar.tsx](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/GlobalSearchBar.tsx#L185-L188), [ThemeToggle.tsx](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/ThemeToggle.tsx#L23-L31), [Sidebar.tsx](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/Sidebar.tsx#L144), [RottenBadge.tsx](file:///Users/moeini/Dev/didar/apps/web/src/features/kanban/components/RottenBadge.tsx#L37,L41)
   - **Root Cause**:
     - `AppShell` outer `<div>` (`bg-slate-900 text-slate-100`) and `<header>` (`bg-slate-900 border-slate-800/90`) are permanently dark even in light mode, while `Sidebar` (`bg-slate-50`) and `<main>` (`bg-[#F4F6F8]`) are light—creating an inconsistent split shell, and `text-slate-100` on the root wrapper leaks if any child omits text color.
     - `RottenBadge` uses `text-rose-400` (`#FB7185`) on `bg-rose-500/10` over white cards (~2.5:1 contrast in light mode, failing WCAG AA).
     - `Sidebar` applies `border-r border-l` unconditionally, putting an unnecessary outer border on the viewport edge in RTL.
   - **Fix**: Use `text-rose-700 dark:text-rose-400` in `RottenBadge`; use `border-l` only on RTL `Sidebar`; decide deliberately whether the topbar should adapt (`bg-white dark:bg-slate-900`) or stay a dark brand header (and remove `text-slate-100` from the outer shell container).

---

### 3. Vazirmatn Typography, Persian Digits & Terminology

1. **[P2] Missing `toPersianDigits` on numeric UI displays**
   - [DealCard.tsx:106](file:///Users/moeini/Dev/didar/apps/web/src/features/kanban/components/DealCard.tsx#L106): `{deal.daysSinceLastActivity} روز پیش` (ASCII).
   - [DealSidebar.tsx:126](file:///Users/moeini/Dev/didar/apps/web/src/features/deals/components/DealSidebar.tsx#L126): `{deal.daysSinceLastActivity} روز پیش` (ASCII).
   - [PendingActivitiesWidget.tsx:79](file:///Users/moeini/Dev/didar/apps/web/src/features/dashboard/components/PendingActivitiesWidget.tsx#L79): `{activities.length} مورد` (ASCII) and missing `font-vazirmatn` / `tabular-nums`.
   - [jalali.ts:60-67](file:///Users/moeini/Dev/didar/apps/web/src/lib/jalali.ts#L60-L67) (`formatRelativeJalali`): `${diffMin} دقیقه پیش`, `${diffHour} ساعت پیش`, `${diffDay} روز پیش`, `${futureDay} روز دیگر` all return ASCII digits (affects `UserNav.tsx:183` and `TaskKanbanBoard.tsx:120`).
   - [LeadsPage.tsx:314](file:///Users/moeini/Dev/didar/apps/web/src/pages/LeadsPage.tsx#L314): raw `{lead.phoneNumber}` instead of `formatIranPhone(lead.phoneNumber)`.
   - [DealDetailPage.tsx:404](file:///Users/moeini/Dev/didar/apps/web/src/pages/DealDetailPage.tsx#L404): Stage stepper index `{idx + 1}` renders ASCII digits.
   - [VoipCallToast.tsx:114,137](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/VoipCallToast.tsx#L114,L137): `{call.callerPhone}` and `{call.openDealsCount} معامله` render ASCII digits.
   - [SettingsPage.tsx:454](file:///Users/moeini/Dev/didar/apps/web/src/pages/SettingsPage.tsx#L454): uses `new Date(key.createdAt).toLocaleDateString('fa-IR')` (Gregorian calendar with Persian digits) instead of `formatJalaliDate(key.createdAt)`.

2. **[P2] `font-mono` overriding Vazirmatn on Persian currency/counts & `dir="ltr"` flipping `٪`**
   - **Location**: [KanbanColumn.tsx:101](file:///Users/moeini/Dev/didar/apps/web/src/features/kanban/components/KanbanColumn.tsx#L101), [DealCard.tsx:99](file:///Users/moeini/Dev/didar/apps/web/src/features/kanban/components/DealCard.tsx#L99), [KanbanPage.tsx:212,340](file:///Users/moeini/Dev/didar/apps/web/src/pages/KanbanPage.tsx#L212,L340), [DealSidebar.tsx:71,114](file:///Users/moeini/Dev/didar/apps/web/src/features/deals/components/DealSidebar.tsx#L71,L114), [DealItemsPanel.tsx:334-345](file:///Users/moeini/Dev/didar/apps/web/src/features/deals/components/DealItemsPanel.tsx#L334-L345), [TaskKanbanBoard.tsx:106,175](file:///Users/moeini/Dev/didar/apps/web/src/features/activities/components/TaskKanbanBoard.tsx#L106,L175), [SalesGoalWidget.tsx:46,72,79,86](file:///Users/moeini/Dev/didar/apps/web/src/features/dashboard/components/SalesGoalWidget.tsx#L46-L86), [LossReasonsWidget.tsx:66,70](file:///Users/moeini/Dev/didar/apps/web/src/features/dashboard/components/LossReasonsWidget.tsx#L66,L70), [ActivityItemRow.tsx:144](file:///Users/moeini/Dev/didar/apps/web/src/features/activities/components/ActivityItemRow.tsx#L144) (conflicting `font-sans` + `font-mono`).
   - **Root Cause**: `font-mono` forces system monospace fonts instead of Vazirmatn on Persian amounts (`تومان`) and counts. Additionally, `dir="ltr"` on [LossReasonsWidget.tsx:66](file:///Users/moeini/Dev/didar/apps/web/src/features/dashboard/components/LossReasonsWidget.tsx#L66) and [SalesGoalWidget.tsx:46](file:///Users/moeini/Dev/didar/apps/web/src/features/dashboard/components/SalesGoalWidget.tsx#L46) reverses `٪` to the wrong side (`٪۷۵`).
   - **Fix**: Replace `font-mono` on Persian text/numbers with `font-vazirmatn tabular-nums` and use `dir="rtl"` for Persian percentages/amounts.

3. **[P2] Persian CRM terminology & untranslated English enums**
   - Terminology check: `خط لوله` has 0 occurrences (`کاریز` is consistently used).
   - However, raw English EspoCRM identifiers leak directly into Persian UI:
     - [LeadsPage.tsx:300](file:///Users/moeini/Dev/didar/apps/web/src/pages/LeadsPage.tsx#L300): `{lead.source}` renders `'Web Site'`, `'Call'`, etc. instead of Persian labels.
     - [DealSidebar.tsx:79](file:///Users/moeini/Dev/didar/apps/web/src/features/deals/components/DealSidebar.tsx#L79) & [DealDetailPage.tsx:357](file:///Users/moeini/Dev/didar/apps/web/src/pages/DealDetailPage.tsx#L357): `{deal.stage}` renders `'Prospecting'` / `'Closed Won'` instead of `deal.pipelineStageName` or translated labels.
     - [UserNav.tsx:208](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/UserNav.tsx#L208): `{n.relatedType}` renders `'Opportunity'`, `'Lead'`, `'Task'`.

---

### 4. `nowrap` Status Badges & Contact Group Filter Height

1. **[P1] `AccountsPage` customer-groups filter bar still scrolls horizontally instead of wrapping**
   - **Location**: [AccountsPage.tsx:179](file:///Users/moeini/Dev/didar/apps/web/src/pages/AccountsPage.tsx#L179) vs [ContactsPage.tsx:167-168](file:///Users/moeini/Dev/didar/apps/web/src/pages/ContactsPage.tsx#L167-L168)
   - **Root Cause**: `ContactsPage` was updated to `flex flex-wrap items-center gap-1.5 min-h-fit overflow-visible`, whereas `AccountsPage` still uses `flex items-center gap-1.5 overflow-x-auto pb-1`, clipping/scrolling filter chips on narrower viewports.
   - **Fix**: Align `AccountsPage.tsx:179` with `ContactsPage.tsx:167`.

2. **[P2] Status/count/tag badges missing `whitespace-nowrap shrink-0`**
   - [AppShell.tsx:125,148](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/AppShell.tsx#L125,L148) (`کاریز فعال` and pinned count badge)
   - [UserNav.tsx:144](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/UserNav.tsx#L144) (`{unreadCount} جدید`)
   - [ActivitiesPage.tsx:279](file:///Users/moeini/Dev/didar/apps/web/src/pages/ActivitiesPage.tsx#L279) (`{localActivities.length} برنامه`)
   - [PendingActivitiesWidget.tsx:78,105](file:///Users/moeini/Dev/didar/apps/web/src/features/dashboard/components/PendingActivitiesWidget.tsx#L78,L105) (`{activities.length} مورد` and activity type badges)
   - [LossReasonsWidget.tsx:45](file:///Users/moeini/Dev/didar/apps/web/src/features/dashboard/components/LossReasonsWidget.tsx#L45) & [SalesFunnelChart.tsx:45](file:///Users/moeini/Dev/didar/apps/web/src/features/dashboard/components/SalesFunnelChart.tsx#L45) & [SalesGoalWidget.tsx:46](file:///Users/moeini/Dev/didar/apps/web/src/features/dashboard/components/SalesGoalWidget.tsx#L46)
   - [TaskKanbanBoard.tsx:106,150](file:///Users/moeini/Dev/didar/apps/web/src/features/activities/components/TaskKanbanBoard.tsx#L106,L150) (column count & priority badge)
   - [DealSidebar.tsx:58,78](file:///Users/moeini/Dev/didar/apps/web/src/features/deals/components/DealSidebar.tsx#L58,L78) & [DealTimeline.tsx:107](file:///Users/moeini/Dev/didar/apps/web/src/features/deals/components/DealTimeline.tsx#L107)
   - [SettingsPage.tsx:449,650,818,964](file:///Users/moeini/Dev/didar/apps/web/src/pages/SettingsPage.tsx#L449,L650,L818,L964) (`فعال`, `غیرفعال`, metric type chip)

---

### 5. XSS / Escaping / URL Safety & Auth Export

1. **[P0] Unauthenticated `window.open` CSV exports in `LeadsPage` and `ReportsPage`**
   - **Location**: [LeadsPage.tsx:134-136](file:///Users/moeini/Dev/didar/apps/web/src/pages/LeadsPage.tsx#L134-L136), [ReportsPage.tsx:60-62](file:///Users/moeini/Dev/didar/apps/web/src/pages/ReportsPage.tsx#L60-L62)
   - **Root Cause**: Unlike [ContactsPage.tsx:65-79](file:///Users/moeini/Dev/didar/apps/web/src/pages/ContactsPage.tsx#L65-L79) and [AccountsPage.tsx:89-103](file:///Users/moeini/Dev/didar/apps/web/src/pages/AccountsPage.tsx#L89-L103) (which use `apiClient.getBlob`), `LeadsPage` and `ReportsPage` call `window.open('/api/v1/BidarExport/...')`. That omits `Espo-Authorization` / `Espo-Authorization-By-Token` headers, bypasses 401 handling, and fails whenever session cookies aren't sufficient.
   - **Fix**: Use `apiClient.getBlob(...)` + `URL.createObjectURL(blob)` with proper `try/catch` error feedback.

2. **[P2] Weak `acc.website` URL scheme check & unvalidated `tel:`/`mailto:` hrefs**
   - **Location**: [AccountsPage.tsx:303](file:///Users/moeini/Dev/didar/apps/web/src/pages/AccountsPage.tsx#L303), [ContactsTable.tsx:185,202](file:///Users/moeini/Dev/didar/apps/web/src/features/contacts/components/ContactsTable.tsx#L185,L202), [DealSidebar.tsx:158,169](file:///Users/moeini/Dev/didar/apps/web/src/features/deals/components/DealSidebar.tsx#L158,L169)
   - **Root Cause**: `acc.website.startsWith('http')` matches `'http:...'` or `'httpfoo:...'` rather than strict `^https?://`, and `rel="noreferrer"` omits `noopener`.
   - **Fix**: Validate via `new URL(...)` ensuring `protocol === 'http:' || protocol === 'https:'` (defaulting `https://` only when no scheme is present, and rejecting `javascript:`/`data:`/`vbscript:` schemes), and use `rel="noopener noreferrer"`.

3. **[P1] Blocking native `alert()` / `window.confirm()` & silent attachment upload failure**
   - **Location**: [LeadsPage.tsx:128](file:///Users/moeini/Dev/didar/apps/web/src/pages/LeadsPage.tsx#L128) (`alert(...)`), [SettingsPage.tsx:227](file:///Users/moeini/Dev/didar/apps/web/src/pages/SettingsPage.tsx#L227) (`window.confirm(...)`), [QuickLogBar.tsx:63-84](file:///Users/moeini/Dev/didar/apps/web/src/features/deals/components/QuickLogBar.tsx#L63-L84) (upload `catch` ignored, no max file size guard).
   - **Fix**: Replace with inline error banners / confirmation modal and display upload error feedback in `QuickLogBar`. (`dangerouslySetInnerHTML`: 0 occurrences found.)

---

### 6. React Hooks Memory Leaks, Stale Closures & Timers

1. **[P1] Uncleaned `setTimeout` timers across 5 components**
   - [GlobalSearchBar.tsx:60](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/GlobalSearchBar.tsx#L60): focus timer not cleared in `useEffect` cleanup.
   - [VoipCallToast.tsx:62](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/VoipCallToast.tsx#L62): dismiss timer uncleaned on unmount (plus lines 59–64 are a **stubbed mock** that never calls `apiClient.post`!).
   - [SmsModal.tsx:135](file:///Users/moeini/Dev/didar/apps/web/src/components/common/SmsModal.tsx#L135): close timer uncleaned if user closes modal before 1200ms.
   - [LeadsPage.tsx:120](file:///Users/moeini/Dev/didar/apps/web/src/pages/LeadsPage.tsx#L120): 4000ms timer uncleaned and overlaps across rapid conversions.
   - [SettingsPage.tsx:299,302](file:///Users/moeini/Dev/didar/apps/web/src/pages/SettingsPage.tsx#L299,L302): clipboard reset timers uncleaned, and `navigator.clipboard.writeText` (line 296) is unguarded when `navigator.clipboard` is unavailable.
   - **Fix**: Track timer IDs in `useRef` and clear them on unmount/re-trigger (matching `DealCard.tsx:22-30`).

2. **[P1] `GlobalSearchBar` async race condition & uncancelled fetches**
   - **Location**: [GlobalSearchBar.tsx:68-93](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/GlobalSearchBar.tsx#L68-L93), [SettingsPage.tsx:87-97](file:///Users/moeini/Dev/didar/apps/web/src/pages/SettingsPage.tsx#L87-L97), [UserNav.tsx:61-65](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/UserNav.tsx#L61-L65)
   - **Root Cause**: Debounced search in `GlobalSearchBar` has no `AbortController` or stale-request guard: an older slow response overwrites a newer query's results. `SettingsPage` tab fetches similarly lack cancellation on rapid tab switching.

3. **[P1] `ContactQuickCreateModal` stale closure & `AppContent` `useEffect` deps**
   - **Location**: [ContactQuickCreateModal.tsx:51-66](file:///Users/moeini/Dev/didar/apps/web/src/features/contacts/components/ContactQuickCreateModal.tsx#L51-L66), [App.tsx:54-60](file:///Users/moeini/Dev/didar/apps/web/src/App.tsx#L54-L60)
   - **Root Cause**: `ContactQuickCreateModal` calls `handleClose()` inside `useEffect(..., [isOpen])` even though `handleClose` is declared below line 61's early `return null` and closes over `onClose` (missing from deps). `AppContent` runs `checkAuth` with `[]` deps instead of `[isAuthenticated, checkAuth]`.

4. **[P1] `ApiClient` fires `API_UNAUTHORIZED_EVENT` even on Login 401 & concurrent 401 floods**
   - **Location**: [api-client.ts:180-196](file:///Users/moeini/Dev/didar/apps/web/src/lib/api-client.ts#L180-L196), [authStore.ts:88-92,126,166-195](file:///Users/moeini/Dev/didar/apps/web/src/features/auth/authStore.ts#L88-L195)
   - **Root Cause**: Submitting bad credentials in `LoginForm` calls `apiClient.request('/App/user', ...)` which returns `401` and triggers `API_UNAUTHORIZED_EVENT` → `logout(true)` unnecessarily. When multiple dashboard queries 401 concurrently, `logout(true)` completes synchronously so `isLoggingOut` resets immediately and `clearStoredAuth()`/`queryClient.clear()`/`setState()` run once per failing request. Also `ApiClient` provides no request timeout or `AbortController` wiring by default.

---

### 7. TypeScript Strictness, API Error Handling & Token Expiry

1. **[P0] `SettingsPage` fabricates fake mock data on GET errors & fakes success on POST/PATCH/DELETE errors**
   - **Location**: [SettingsPage.tsx](file:///Users/moeini/Dev/didar/apps/web/src/pages/SettingsPage.tsx#L105-L293) (lines 105–115, 126–132, 142–164, 175–180, 208–223, 230–232, 253–264, 274–276, 288–290)
   - **Root Cause**: Every fetch failure silently populates hardcoded mock API keys, products, goals, and SMS templates; every mutation failure silently adds fake records (including a fake `bidar_live_...` raw key) and closes the modal as if saved. Users think changes are persisted when the server rejected them.
   - **Fix**: Replace fake fallbacks with explicit `isError` / retry states and inline form error alerts on failed mutations.

2. **[P0] `authStore.checkAuth()` logs the user out on 500 or network errors**
   - **Location**: [authStore.ts:200-216](file:///Users/moeini/Dev/didar/apps/web/src/features/auth/authStore.ts#L200-L216)
   - **Root Cause**: `catch { await this.logout(true); return false; }` treats any thrown error (500, 502, offline) as an expired session and wipes `bidar_auth` from `localStorage`.
   - **Fix**: Only log out when `err instanceof ApiError && (err.status === 401 || err.status === 403)`.

3. **[P0] `ApiClient.getBlob` ignores 401 session expiry & discards JSON error bodies**
   - **Location**: [api-client.ts:227-265](file:///Users/moeini/Dev/didar/apps/web/src/lib/api-client.ts#L227-L265)
   - **Root Cause**: Unlike `request()`, `getBlob()` throws `new ApiError(response.status, response.statusText)` without parsing error details and **never dispatches `API_UNAUTHORIZED_EVENT` or notifies `unauthorizedListeners`** on 401.
   - **Fix**: Extract shared URL/header/error/401-broadcast helper used by both `request()` and `getBlob()`.

4. **[P1] Swallowed errors in `LeadsPage`, `DealDetailPage`, `DealItemsPanel`, `ActivitiesPage`, `DealCreateModal`**
   - [LeadsPage.tsx:74-80](file:///Users/moeini/Dev/didar/apps/web/src/pages/LeadsPage.tsx#L74-L80): `queryFn` catches errors and returns `{ list: [], total: 0 }`, masking API failures as empty results.
   - [DealDetailPage.tsx:55-76,247-250,288-290](file:///Users/moeini/Dev/didar/apps/web/src/pages/DealDetailPage.tsx#L55-L76): `streamQuery` catches all errors and returns `{ list: [], total: 0 }`, making `streamQuery.isError` unreachable; `handleAddNote` failure doesn't revert optimistic `isRotten: false` on `localDeal` and shows no error.
   - [DealItemsPanel.tsx:54-75,92-94,158-160](file:///Users/moeini/Dev/didar/apps/web/src/features/deals/components/DealItemsPanel.tsx#L54-L75): swallows fetch, delete, and amount-sync errors.
   - [DealCreateModal.tsx:383-398](file:///Users/moeini/Dev/didar/apps/web/src/features/kanban/components/DealCreateModal.tsx#L383-L398): silently ignores failed `BidarDealItem` creation after creating the deal.

5. **[P1] Full-page `<a href>` navigation breaks SPA & `/app` base prefix**
   - **Location**: [ContactsPage.tsx:115-121](file:///Users/moeini/Dev/didar/apps/web/src/pages/ContactsPage.tsx#L115-L121), [AccountsPage.tsx:131-137](file:///Users/moeini/Dev/didar/apps/web/src/pages/AccountsPage.tsx#L131-L137), [VoipCallToast.tsx:51](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/VoipCallToast.tsx#L51), [PendingActivitiesWidget.tsx:57](file:///Users/moeini/Dev/didar/apps/web/src/features/dashboard/components/PendingActivitiesWidget.tsx#L57), [Sidebar.tsx:195](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/Sidebar.tsx#L195)
   - **Root Cause**: `ContactsPage` (`<a href="/accounts">`) and `AccountsPage` (`<a href="/contacts">`) trigger full browser reloads and drop the `/app` prefix configured in [vite.config.ts:8](file:///Users/moeini/Dev/didar/apps/web/vite.config.ts#L8). `VoipCallToast` and `PendingActivitiesWidget` fallback also push raw paths without `/app` prefix.
   - **Fix**: Pass `onNavigate` to `ContactsPage`/`AccountsPage` from `App.tsx`, and centralize `/app`-aware navigation helper.

6. **[P1] `GlobalSearchBar` query parameters ignored by target pages & hazardous `onSearch` prop**
   - **Location**: [GlobalSearchBar.tsx:125-131,182,217](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/GlobalSearchBar.tsx#L125-L131), [AppShell.tsx:31,131](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/AppShell.tsx#L31,L131), [App.tsx:151-164](file:///Users/moeini/Dev/didar/apps/web/src/App.tsx#L151-L164)
   - **Root Cause**: Selecting a Contact/Account/Lead navigates to `/contacts?id=...&search=...`, `/accounts?...`, `/leads?...`, yet `ContactsPage`, `AccountsPage`, and `LeadsPage` never read `window.location.search`. Meanwhile `GlobalSearchBar` invokes `onSearch?.(val)` on every `onChange` keystroke, while `App.tsx:151-155` defines `handleSearch` to call `navigate('/contacts?search=...')` (only prevented from hijacking typing because `AppShell` ignores `_onSearch`!).
   - **Fix**: Read `?search=`/`?id=` on `ContactsPage`, `AccountsPage`, `LeadsPage` (and update on `popstate`), and remove or clarify `onSearch` vs `onSubmit`.

7. **[P2] `any` type escapes in production code**
   - **Locations**: [ActivitiesPage.tsx:87,89,110,112](file:///Users/moeini/Dev/didar/apps/web/src/pages/ActivitiesPage.tsx#L87-L112), [ActivityCreateModal.tsx:67,109,138](file:///Users/moeini/Dev/didar/apps/web/src/features/activities/components/ActivityCreateModal.tsx#L67-L138), [DashboardPage.tsx:172,341,344](file:///Users/moeini/Dev/didar/apps/web/src/pages/DashboardPage.tsx#L172-L344), [ReportsPage.tsx:177,183](file:///Users/moeini/Dev/didar/apps/web/src/pages/ReportsPage.tsx#L177-L183), [LeadsPage.tsx:110](file:///Users/moeini/Dev/didar/apps/web/src/pages/LeadsPage.tsx#L110), [SettingsPage.tsx:882](file:///Users/moeini/Dev/didar/apps/web/src/pages/SettingsPage.tsx#L882), [VoipCallToast.tsx:30,32](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/VoipCallToast.tsx#L30-L32).

---

### 8. Accessibility & RTL Layout

1. **[P2] Modals missing `Escape` key handling, `role="dialog"`, and `htmlFor` label bindings**
   - **Missing `Escape` key handler**: [SmsModal.tsx:147-153](file:///Users/moeini/Dev/didar/apps/web/src/components/common/SmsModal.tsx#L147-L153), [AccountCreateModal.tsx:151-156](file:///Users/moeini/Dev/didar/apps/web/src/features/contacts/components/AccountCreateModal.tsx#L151-L156), [LeadCreateModal.tsx:111-116](file:///Users/moeini/Dev/didar/apps/web/src/features/leads/components/LeadCreateModal.tsx#L111-L116).
   - **Missing `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, AND `Escape` key**: all 4 modals in [SettingsPage.tsx:494,685,853,977](file:///Users/moeini/Dev/didar/apps/web/src/pages/SettingsPage.tsx#L494-L977).
   - **Backdrop-only `onKeyDown` without `autoFocus`**: [LossReasonModal.tsx:57](file:///Users/moeini/Dev/didar/apps/web/src/features/deals/components/LossReasonModal.tsx#L57) and [ActivityCreateModal.tsx:199](file:///Users/moeini/Dev/didar/apps/web/src/features/activities/components/ActivityCreateModal.tsx#L199) don't receive `Escape` until the user clicks inside.
   - **Missing `aria-label` on icon-only close buttons**: `SmsModal.tsx:170`, `AccountCreateModal.tsx:177`, `LeadCreateModal.tsx:134`, `DealCreateModal.tsx:460`, `LossReasonModal.tsx:82`, `ActivityCreateModal.tsx:219`, `ContactQuickCreateModal.tsx:130`, `UserNav.tsx:165`.
   - **Missing `htmlFor`/`id` pairs**: nearly all modal `<label>` elements are unlinked to their inputs/selects.

2. **[P2] Non-semantic clickable `<tr>` / `<div>` elements without keyboard support**
   - **Locations**: [DealCard.tsx:63-71](file:///Users/moeini/Dev/didar/apps/web/src/features/kanban/components/DealCard.tsx#L63-L71), [ContactsTable.tsx:134-137](file:///Users/moeini/Dev/didar/apps/web/src/features/contacts/components/ContactsTable.tsx#L134-L137), [TaskKanbanBoard.tsx:126-144](file:///Users/moeini/Dev/didar/apps/web/src/features/activities/components/TaskKanbanBoard.tsx#L126-L144), [JalaliCalendarView.tsx:173-177](file:///Users/moeini/Dev/didar/apps/web/src/features/activities/components/JalaliCalendarView.tsx#L173-L177), [AppShell.tsx:169-173](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/AppShell.tsx#L169-L173), [UserNav.tsx:189-195](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/UserNav.tsx#L189-L195).

---

### 9. Test Coverage Gaps (`apps/web/src/test/`)

The existing 24 test files (138 tests) cover utilities, basic rendering, and Section 3/4 Kanban/badge regressions, but leave critical production paths completely untested:

- **Completely untested modules/pages**:
  - [SettingsPage.tsx](file:///Users/moeini/Dev/didar/apps/web/src/pages/SettingsPage.tsx) (1,197 lines — largest file in `apps/web/`, 0 tests)
  - [AccountCreateModal.tsx](file:///Users/moeini/Dev/didar/apps/web/src/features/contacts/components/AccountCreateModal.tsx) & [LeadCreateModal.tsx](file:///Users/moeini/Dev/didar/apps/web/src/features/leads/components/LeadCreateModal.tsx) (0 tests)
  - [DealItemsPanel.tsx](file:///Users/moeini/Dev/didar/apps/web/src/features/deals/components/DealItemsPanel.tsx) (lineTotal discount math, add/delete, Opportunity amount sync — 0 tests)
  - [SmsModal.tsx](file:///Users/moeini/Dev/didar/apps/web/src/components/common/SmsModal.tsx) (`calculatePersianSmsPages`, template variable interpolation, send validation — 0 tests)
  - [VoipCallToast.tsx](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/VoipCallToast.tsx), [UserNav.tsx](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/UserNav.tsx), [ThemeToggle.tsx](file:///Users/moeini/Dev/didar/apps/web/src/components/layout/ThemeToggle.tsx), [pinned.ts](file:///Users/moeini/Dev/didar/apps/web/src/lib/pinned.ts) (0 dedicated tests)
- **Critical untested behaviors in partially tested modules**:
  - `ApiClient.getBlob` (401 handling, query params, error status) in [api-client.test.ts](file:///Users/moeini/Dev/didar/apps/web/src/test/api-client.test.ts)
  - `authStore.checkAuth` (distinguishing 401 vs 500/network error) in [authStore.test.ts](file:///Users/moeini/Dev/didar/apps/web/src/test/authStore.test.ts)
  - `AccountsPage` group filtering, search, CSV export, and website URL safety
  - `LeadsPage` 1-click convert, status filtering, and CSV export
  - `useKanbanDeals` concurrent moves rollback, same-column drop, pipeline switching, and `DealDetailPage` stage stepper / `LossReasonModal` integration
  - `GlobalSearchBar` keyboard navigation (`ArrowDown`/`ArrowUp`/`Enter`/`Escape`), race cancellation, and route query propagation
  - `KanbanPage` Forecast view (`viewMode === 'forecast'`) & `QuickLogBar` Call/Meeting/Task/Attachment modes.

