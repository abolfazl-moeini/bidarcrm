## Final Post-Implementation Code Review — Cycle 2 Section 1 (`extensions/bidar-sales/`)

**Verdict: Approve (with minor follow-ups)** — No P0/P1 blockers remain in the reviewed diff and files. The P1 fixes around fail-closed ACL/export gating, personal API key security, rotten-deal edge cases, pipeline stage synchronization, transactional deal-item recalculation, and dashboard summary aggregation are all cleanly implemented, and the reported PHPUnit suite passes (`OK (148 tests, 856 assertions)`).

> **Review Scope Note:** Only the diff and files provided in this prompt were evaluated. The four action classes newly wired in [routes.json](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Resources/routes.json) (`BidarApiKeyListAction`, `BidarApiKeyCreateAction`, `BidarApiKeyRotateAction`, `BidarApiKeyDeleteAction`) and any `scopes`/`aclDefs` metadata for `BidarUserApiKey` were not included in the payload and are not verified here.

---

### Findings

#### Medium / Should Fix (Non-blocking)

1. **`GetDashboardSummary::resolveJalaliPeriod()` ignores `$now` for `current_month`**
   - File: [GetDashboardSummary.php](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Api/GetDashboardSummary.php)
   - `'last_month'` and `'current_quarter'` derive their dates from `$jNow` (which respects the `$now` parameter), whereas `'current_month'` calls `JalaliHelper::getCurrentJalaliMonthRange()`, ignoring `$now`.
   - **Fix:** Use `JalaliHelper::getJalaliMonthRange($jNow->getYear(), $jNow->getMonth())` so `$now` works consistently across all periods.

2. **`GetDashboardSummary` ACL fallback when `$selectBuilderFactory === null`**
   - File: [GetDashboardSummary.php](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Api/GetDashboardSummary.php)
   - In normal DI runtime (`$selectBuilderFactory !== null`), `withStrictAccessControl()` enforces `'own'`, `'team'`, and `'no'` ACLs before applying `$oppWhere` / `$taskWhere`. However, in the `else` fallback branch (`$selectBuilderFactory === null`):
     - `if ($level === 'own' && empty($oppWhere['assignedUserId']))` (same for `$taskWhere`) skips enforcing `$user->getId()` if the caller passes `?assignedUserId=<otherUserId>`.
     - `$level === 'team'` is not handled in the fallback, and `Call`/`Meeting` queries lack any `'own'`/`'no'` fallback when `$selectBuilderFactory === null`.
   - **Fix:** Always force `assignedUserId = $user->getId()` when `$level === 'own'` (or throw `Forbidden` if a different `assignedUserId` was requested), or fail closed if `$selectBuilderFactory === null` for non-admins.

3. **Dashboard filters affect `BidarGoal` progress and `Task`/`Call`/`Meeting` consistency**
   - File: [GetDashboardSummary.php](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Api/GetDashboardSummary.php), [DashboardSummaryService.php](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Services/DashboardSummaryService.php)
   - `calculateSummary($deals, $activities, $stages, $goalData)` computes `goal` progress from the already-filtered `$deals` and `$activities`. If a caller filters the dashboard by `jalaliPeriod=last_month` or `assignedUserId`, a `current_month` or `scopeType: 'all'` `BidarGoal` will compute progress against that filtered subset rather than the goal's own scope/date window.
   - Also, `GetDashboardSummary` applies `$dateFrom`/`$dateTo` to `Opportunity.createdAt` only (not `closeDate`, and not to `Task`/`Call`/`Meeting`), and runs unbounded `find()` queries when no date filter is supplied.

4. **Verify `BidarUserApiKey` generic REST CRUD is disabled/restricted**
   - File: [BidarUserApiKey.json](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Resources/metadata/entityDefs/BidarUserApiKey.json)
   - `keyHash` is properly marked `"internal": true` and `"readOnly": true`, and `userId`/`keyPrefix`/`revokedAt`/`revokedByUserId`/`lastUsedAt` are `"readOnly": true`. However, `isActive`, `expiresAt`, and `allowedIpList` are not `readOnly`. Ensure `scopes/BidarUserApiKey.json` / `aclDefs` disables generic `/api/v1/BidarUserApiKey` entity writes so users cannot reactivate a revoked key or bypass `BidarApiKeyService` validation.

---

#### Low / Nits

- **`BidarApiKeyLogin::login()` corrupt `expiresAt` handling:** If `$expiresAt` in DB fails `strtotime()`, `$expireTimestamp === false` currently falls through as non-expired instead of failing closed (`Result::fail(FailReason::DENIED)`).
- **Unused `use` statements:**
  - `use Espo\Core\Acl\Table;` in [GetDashboardSummary.php](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Api/GetDashboardSummary.php)
  - `use DateTimeImmutable;` in [BidarApiKeyLogin.php](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Authentication/BidarApiKeyLogin.php)
- **Unused/mismatched constants & variables:**
  - `BidarApiKeyService::KEY_PREFIX_LENGTH = 16` is defined, while `extractPrefix()` hardcodes `12`.
  - `$probability = $deal['probability'] ?? null;` at line 82 of [DashboardSummaryService.php](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Services/DashboardSummaryService.php) is unused, and `private const OPEN_STANDARD_STAGES` is placed between methods rather than at the top of the class.
  - Redundant `elseif ($acl === null && method_exists($this, 'getContainer') ...)` block in `GetDashboardSummary::process()`.
- **Explicit timezones for `now`:** In `GetDashboardSummary::process()`, `$nowStr`, `$now`, and `$today` use `new DateTimeImmutable('now')` without an explicit `DateTimeZone('UTC')` (or `'Asia/Tehran'` for Jalali-aligned active-goal checks), relying on PHP's default timezone.
- **`RottenLoader::load()` null cast:** `$pipelineStage->has('rottenDays')` followed by `(int) $pipelineStage->get('rottenDays')` casts `null` to `0` if the attribute exists as `null` (whereas the earlier check on `$entity` explicitly checks `!== null`). Also, if `$entity` already has `stageRottenDays !== null` without `stageMappedStatus`, `PipelineStage` isn't loaded to populate `$stageMappedStatus`.
- **`BidarExportAction::process()` memory & ordering:** `->sth()->find()` avoids hydrating all rows inside the ORM collection, but immediately appending every `$entity` into `$entities[]` before `mapEntitiesToCsvData()` still buffers up to `MAX_EXPORT_ROWS` (`10000`) entities in memory; there is also no `order()` on the export query if results are truncated at 10,000.
- **`PipelineStageSync::beforeSave()` stage matching priority:** When `!empty($currentPipelineId)`, the candidate loop checks `$candidate->get('mappedStatus') === $stageValue || $candidate->get('name') === $stageValue` in unordered results (unlike the `else` branch which prefers `mappedStatus` then `name`). Also, if a direct `stage` edit doesn't match any `PipelineStage`, an old `pipelineStageId` remains unchanged.
- **`RecalculateOpportunityAmount::recalculateOpportunityAmount()` concurrency:** Wrapped cleanly in a transaction with `skipHooks => true` to prevent recursion, though concurrent mutations on two items of the same `Opportunity` do not acquire a row lock (`FOR UPDATE`), and mixed-currency items sum raw numbers without FX conversion (correctly leaving `amountCurrency` untouched).

---

### Verification Summary Against P1 Checklist

| Area | Status | Notes |
|---|---|---|
| Dashboard ACL & Query Scoping | Verified | `Acl::check('Opportunity', 'read')`, fail-closed `$acl === null`, `SelectBuilderFactory` strict ACL, scope checks for `Task`/`Call`/`Meeting`/`BidarGoal`. |
| Dashboard Analytics & Goals | Verified | `conversionRate`, `avgSalesCycleDays`, `lossReasonsBreakdown`, `topSalesReps`, `leadSourceBreakdown`, `isDealWon`/`isDealLost` with `OPEN_STANDARD_STAGES`, `calculateGoalProgress`. |
| Rotten Deal Calculation | Verified | Future `lastActivityAt >= $now` guarded to `(false, 0)`; `Closed Won`/`Closed Lost` resolved via `stage` + `mappedStatus`; malformed date `try/catch`. |
| CSV Export Security | Verified | `ALLOWED_ENTITIES` allowlist, `exportPermission` & `checkScope` & `withStrictAccessControl()` & `checkEntityRead()`, `getScopeForbiddenFieldList()`, `MAX_EXPORT_ROWS = 10000`, `sanitizeCsvCell()` formula injection defense. |
| Personal API Keys | Verified | SHA-256 + `hash_equals`, `expiresAt`, fail-closed `allowedIpList` via `REMOTE_ADDR`, active/non-system/non-portal/non-api user enforcement, super-admin/owner authorization, transactional rotation, `keyHash` never exposed. |
| Deal Item Totals | Verified | Negative/out-of-range validation (`BadRequest`), `opportunityId` move & `afterRemove` handling, transaction + recursion-safe `skipHooks`. |
| Pipeline Stage Sync | Verified | `pipelineStageId` ↔ `stage` sync, `pipelineId`-scoped candidate lookup, `Opportunity`-scoped default pipeline fallback. |
| Automated Tests | Passed (per prompt) | `OK (148 tests, 856 assertions)` via `./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-sales/tests`. |


---
*Note: `qoder-review` fell back to AutoClaw and was terminated to preserve lock availability; final post-fix review above was completed by `agy-review`. Subsequent final verification added strict mixed-currency `BadRequest` rejection, `PipelineStageSync` unrelated-update & pipeline-scoping guards, and deterministic rotten timestamp preservation in `DemoDataSeeder`, passing `./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-sales/tests` with `OK (168 tests, 965 assertions)`.*
