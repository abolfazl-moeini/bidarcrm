# Cycle 2 — Section 1 (`extensions/bidar-sales/`) TDD Remediation Plan (Finalized after Pass 2)

This plan synthesizes Pass 1 (`agy-review` / `gemini-4-hydrogen-high`) findings in [cycle2-section-1-pass1-agy.md](file:///Users/moeini/Dev/didar/docs/reviews/cycle2-section-1-pass1-agy.md) and Pass 2 (`qoder-review`) additions in [cycle2-section-1-pass2-qoder.md](file:///Users/moeini/Dev/didar/docs/reviews/cycle2-section-1-pass2-qoder.md), cross-checked against EspoCRM 10.1.4 core classes (`RouteProcessor`, `InjectableFactory`, `UserFinder`, `Acl`, `PipelineStageStatus`) and existing unit test contracts.

### Pass 2 Finalization Additions (Incorporated Below)
- **Denial before data access**: `BidarExportAction::process()` must check `$this->acl->checkScope($entityType, 'read')` (and fail-closed user/acl/selectBuilderFactory guards) *before* executing any repository/select query.
- **CSV formula injection defense**: `BidarExportAction` must neutralize leading formula characters (`=`, `+`, `-`, `@`, `\t`, `\r`) in exported CSV cells.
- **API-key atomicity & native-auth separation**: `BidarApiKeyService::rotateKey()` must wrap key rotation in a transaction (when supported) and reject inactive/revoked keys; `BidarApiKeyLogin` must keep native `ApiUser` (`UserFinder`) and `BidarUserApiKey` (`!isApi()`) paths strictly separated.
- **Deal-item currency & transaction safety**: `RecalculateOpportunityAmount` must wrap `recalculateOpportunityAmount()` in a transaction (when supported) and avoid cross-currency summation/propagation mismatches.
- **Cross-user / cross-team / cross-pipeline isolation**: Tests must explicitly verify no cross-user/cross-team goal leakage, no cross-pipeline stage lookup leakage, and no cross-currency deal-item leakage.

---

## P0 — Critical Security Findings

### 1. [P0-EXPORT-AUTH] Unauthenticated Full CRM CSV Export via `"noAuth": true` & Missing Fail-Closed Guards
- **Files**:
  - `extensions/bidar-sales/Resources/routes.json` (`GET /BidarExport/:entityType`)
  - `extensions/bidar-sales/Api/BidarExportAction.php` (`process()`)
- **Verified Root Cause**:
  - `routes.json` sets `"noAuth": true` on `/BidarExport/:entityType`. In `Espo\Core\Api\RouteProcessor::processInternal()`, `noAuth` bypasses API auth and runs `setupSystemUser()`, giving unauthenticated callers system-level access.
  - `BidarExportAction::process()` stores `$this->user` in `__construct()` but never checks it, and silently falls back to unfiltered `find()` if `$this->acl === null` or `$this->selectBuilderFactory === null`.
- **TDD Plan**:
  - **Red**: Add tests in `BidarExportActionTest` asserting:
    1. `routes.json` does **not** set `noAuth: true` on `/BidarExport/:entityType`.
    2. `process()` throws `Forbidden` when `$this->user === null`, `$this->user->isSystem() === true`, `$this->acl === null`, or `$this->selectBuilderFactory === null`.
    3. Update existing happy-path test `testExportOpportunityWithUtf8BomAndPersianHeaders` to provide valid non-system `$user` and mocked `$selectBuilderFactory` (so fail-closed behavior is enforced everywhere).
  - **Green**: Remove `"noAuth": true` from `routes.json`; enforce fail-closed guard at top of `BidarExportAction::process()` (`$this->user === null || $this->user->isSystem() || $this->acl === null || $this->selectBuilderFactory === null`).

---

## P1 — High Security, Correctness & Compatibility Findings

### 2. [P1-AUTH-DI] `InjectableFactory` Injects `null` for `?UserFinder`, Breaking Native `ApiUser` `X-Api-Key` Auth
- **Files**:
  - `extensions/bidar-sales/Authentication/BidarApiKeyLogin.php` (`__construct`, `login`)
- **Verified Root Cause**:
  - `Espo\Core\InjectableFactory::getMethodParamInjection()` checks `$this->container->has('userFinder')` (false, since `UserFinder` is not a container service) and then hits `if ($dependencyClass && $param->allowsNull()) { return null; }`.
  - Because `BidarApiKeyLogin::__construct(?UserFinder $userFinder = null, ?EntityManager $entityManager = null)` allows `null`, EspoCRM passes `null` for `$userFinder`, disabling native `ApiUser` `X-Api-Key` authentication.
- **TDD Plan**:
  - **Red**: Add test in `BidarApiKeyLoginTest` instantiating `new BidarApiKeyLogin(null, $em)` (no `$userFinder` passed, simulating `InjectableFactory`) with an `ApiUser` in `$em` and asserting `login()` succeeds via `UserFinder::findApiApiKey()`.
  - **Green**: In `BidarApiKeyLogin::__construct()`, if `$userFinder === null && $entityManager !== null`, instantiate `new UserFinder($entityManager)` (or lazily resolve in `login()`).

### 3. [P1-KEY-ACL] Regular Admin Privilege Escalation on `rotateKey`/`revokeKey`/`listKeys`, Rotating Revoked Keys, & `BidarUserApiKey` Metadata Hardening
- **Files**:
  - `extensions/bidar-sales/Services/BidarApiKeyService.php` (`listKeys`, `rotateKey`, `revokeKey`, `assertOwnership`, `createKey`)
  - `extensions/bidar-sales/Resources/metadata/entityDefs/BidarUserApiKey.json`
- **Verified Root Cause**:
  - `createKey()` requires `$currentUser->isSuperAdmin()` to act on another user's keys, whereas `assertOwnership()` (`rotateKey`/`revokeKey`) and `listKeys()` only check `isAdmin()`. A regular admin can rotate a super-admin's key and receive the new `plainKey`.
  - `rotateKey()` also succeeds on revoked (`isActive = false`) keys, returning a dead `plainKey`.
  - `BidarUserApiKey.json` lacks `"internal": true` on `keyHash` and `"readOnly": true` on `userId` and `revokedByUserId`.
- **TDD Plan**:
  - **Red**: In `BidarApiKeyServiceTest`, add tests asserting:
    1. Regular admin (`isAdmin=true`, `isSuperAdmin=false`) calling `listKeys()`, `rotateKey()`, or `revokeKey()` for another user throws `Forbidden`.
    2. `rotateKey()` on an inactive (`isActive=false`) key throws `BadRequest`.
    3. `BidarUserApiKeyMetadataTest` asserts `keyHash` has `internal: true` and `userId`/`revokedByUserId` have `readOnly: true`.
  - **Green**: Require `isSuperAdmin()` in `listKeys()` and `assertOwnership()` when acting on another user's keys; reject inactive keys in `rotateKey()`; update `BidarUserApiKey.json`.

### 4. [P1-EXPORT-FIELD-ACL] Field-Level ACL Bypass & Unbounded Query in `BidarExportAction`
- **Files**:
  - `extensions/bidar-sales/Api/BidarExportAction.php` (`process`, `mapEntitiesToCsvData`)
- **Verified Root Cause**:
  - `BidarExportAction` never checks `$this->acl->getScopeForbiddenFieldList($entityType, 'read')` (so role-restricted fields like `amount`, `emailAddress`, `phoneNumber` leak in CSV exports).
  - `->find()` materializes the full table into memory without `->sth()` or a row limit.
- **TDD Plan**:
  - **Red**: In `BidarExportActionTest`, test `getScopeForbiddenFieldList('Opportunity', 'read')` returning `['amount', 'account']` and assert the CSV omits both the forbidden column headers and values.
  - **Green**: Filter CSV columns against `$this->acl->getScopeForbiddenFieldList($entityType, 'read')` (mapping link columns like `accountName` -> `account`, `contactName` -> `contact`, `assignedUserName` -> `assignedUser`), and use `->limit(0, self::MAX_EXPORT_ROWS)->sth()->find()`.

### 5. [P1-DASH-DATE] Jalali Period Timezone Mismatch (`+03:30`), Empty Query Param Override, & `dateTo` Midnight Truncation
- **Files**:
  - `extensions/bidar-sales/Api/GetDashboardSummary.php` (`resolveJalaliPeriod`, `process`)
- **Verified Root Cause**:
  - `resolveJalaliPeriod()` returns Tehran local strings (`start` / `end`), while `Opportunity.createdAt` is stored in UTC, shifting Jalali boundaries by 3.5 hours. (Note: existing unit test `testGetDashboardSummaryResolvesJalaliPeriods` asserts `00:00:00` and `23:59:59` on `resolveJalaliPeriod()`'s `dateFrom`/`dateTo`, so we must preserve `dateFrom`/`dateTo` on `resolveJalaliPeriod()` or add `dateFromUtc`/`dateToUtc` / `$toUtc` param and use UTC in `process()`!)
  - `$dateFrom = $dateFrom ?? $periodRange['dateFrom']` fails when query param is `""` (empty string from UI), cancelling `jalaliPeriod`.
  - Date-only `dateTo` (e.g. `2026-11-24`) becomes `createdAt <= '2026-11-24'`, excluding that entire day after `00:00:00`.
- **TDD Plan**:
  - **Red**: Add tests in `DashboardSummaryServiceTest` verifying:
    1. `resolveJalaliPeriod('current_month', true)` (and `process()` DB query) uses UTC boundaries (`startUtc`/`endUtc`).
    2. `process()` with `jalaliPeriod=current_month` and `dateFrom=''`, `dateTo=''` still applies the Jalali range.
    3. `process()` with `dateTo='2026-11-24'` queries `createdAt<=` with `'2026-11-24 23:59:59'`.
  - **Green**: Add optional `bool $toUtc = false` to `resolveJalaliPeriod()` (and include `dateFromUtc`/`dateToUtc` or call `resolveJalaliPeriod(..., true)` in `process()`), normalize blank query params to `null`, and expand `^\d{4}-\d{2}-\d{2}$` `dateTo` to `23:59:59`.

### 6. [P1-GOAL-ENGINE] Broken `activitiesHeld` Goals, Missing `team` Scope, Unscoped Goal Fallback Leak, & Empty `closeDate` Bypass
- **Files**:
  - `extensions/bidar-sales/Api/GetDashboardSummary.php`
  - `extensions/bidar-sales/Services/DashboardSummaryService.php` (`calculateGoalProgress`)
- **Verified Root Cause**:
  - `GetDashboardSummary` only queries overdue open `Task`s, never `Held` `Call`/`Meeting` (or `Completed` `Task`), so `activitiesHeld` goals always show `0%`.
  - `scopeType = 'team'` is unimplemented in both `GetDashboardSummary` and `calculateGoalProgress()`.
  - Line 326 (`$goalRepo->order('createdAt', 'desc')->findOne()`) falls back without user/scope/date/ACL filtering, leaking private or expired goals of other reps.
  - `GetDashboardSummary` sets `'closeDate' => (string) ($opp->get('closeDate') ?? '')` (`''`), and `calculateGoalProgress()` uses `$deal['closeDate'] ?? $deal['createdAt'] ?? ''`, which evaluates to `''` and skips the goal date filter! Also `dealsCreated` checks `closeDate` instead of `createdAt`, and deals with empty date should not pass a bounded goal window.
- **TDD Plan**:
  - **Red**:
    1. In `DashboardSummaryServiceTest`, test `dealsCreated` with `closeDate = ''` and `createdAt` outside/inside range; test `wonAmount` with `closeDate = ''` and `createdAt` outside range (must NOT bypass date filter); test `scopeType = 'team'` with `teamId`.
    2. Test `GetDashboardSummary` does NOT return another user's private/expired goal via unscoped fallback, checks `BidarGoal` read ACL, and loads `Held` `Call`/`Meeting` activities for `activitiesHeld` goal calculation without inflating `overdueActivitiesCount`.
  - **Green**: Remove unscoped `findOne()` fallback; enforce `BidarGoal` ACL & `scopeType = 'team'`; query `Held` `Call`/`Meeting` into activities (with `isOverdue = false`) when needed; fix `calculateGoalProgress()` date fallback (`$deal['closeDate'] ?: ($deal['createdAt'] ?? '')`, and `createdAt` for `dealsCreated`, rejecting empty dates when bounded).

### 7. [P1-STAGE-CLASSIFICATION] Open `probability = 100` Classification, Empty Stage Collision, & Multi-Pipeline Stage Metadata
- **Files**:
  - `extensions/bidar-sales/Services/DashboardSummaryService.php` (`isDealWon`, `isDealLost`, `calculateSummary`)
  - `extensions/bidar-sales/Api/GetDashboardSummary.php`
- **Verified Root Cause**:
  - `isDealWon()` classifies any deal with `probability = 100` as Won even when `stage` or `mappedStatus` is an explicit open EspoCRM stage (`Prospecting`, `Qualification`, `Needs Analysis`, `Value Proposition`, `Id. Decision Makers`, `Perception Analysis`, `Proposal`, `Proposal/Price Quote`, `Negotiation`, `Negotiation/Review`), while legacy unit test `testProbabilityReadingFallbacks()` tests custom stage `'مذاکره'` with `probability = 100` and no `mappedStatus`.
  - Stage matching in `isDealWon()`/`isDealLost()` matches `'' === ''` when `$pipelineStageId` or `$stage` is empty.
  - `GetDashboardSummary` omits `'color'` when building `$stages` from `PipelineStage`.
- **TDD Plan**:
  - **Red**: In `DashboardSummaryServiceTest`, add test with explicit open stage (`stage = 'Negotiation'`, `mappedStatus = 'Negotiation'`, `probability = 100`) asserting `wonCount === 0` and `openCount === 1`, and test empty `pipelineStageId`/`stage` does not match a stage with empty `id`/`name`.
  - **Green**: Guard `$pipelineStageId !== ''` and `$stage !== ''` in stage lookup loops; do not treat `probability = 100` as Won when `stageMappedStatus` (when non-empty and not `'Closed Won'`) or standard open `stage` explicitly indicates an open stage (preserving `testProbabilityReadingFallbacks()` behavior where `mappedStatus` is absent and `stage` is not a known open status). Include `'color' => $st->get('color')` in `GetDashboardSummary`.

### 8. [P1-DEAL-ITEM] Negative/Double-Negative Bypass, Stale Old-Opportunity `amount`, Strict Float Comparison, & Validation in `BidarDealItem`
- **Files**:
  - `extensions/bidar-sales/Hooks/BidarDealItem/RecalculateOpportunityAmount.php`
  - `extensions/bidar-sales/Resources/metadata/entityDefs/BidarDealItem.json`
- **Verified Root Cause**:
  - `calculateLineTotal()` allows negative `quantity`, `unitPrice`, and `discountPercent` (e.g. `quantity = -2, discountPercent = 150` produces positive `lineTotal`; `discountPercent = -50` inflates price to 150%), while existing test `testCalculateLineTotalWith100PercentOrExcessiveDiscount` requires `discountPercent = 150` with positive `quantity`/`unitPrice` to clamp to `0.0`.
  - `calculateTotalAmount()` sums negative pre-computed `item['lineTotal']` without clamping to `0.0`.
  - `afterSave()` does not recalculate `$entity->getFetched('opportunityId')` when `opportunityId` changes.
  - Line 105 compares `$item->get('lineTotal') !== $lineTotal` strictly across DB string vs float, and `recalculateOpportunityAmount()` ignores `lineTotalCurrency`/`amountCurrency` and lacks transactional locking.
- **TDD Plan**:
  - **Red**: In `DealItemCalculatorTest`, test negative `quantity`, negative `unitPrice`, and negative `discountPercent` throw `\InvalidArgumentException` in `calculateLineTotal()` and `BadRequest` in `beforeSave()`; test moving an item from `opp-1` to `opp-2` recalculates both opportunities.
  - **Green**: Reject `< 0` for `quantity`, `unitPrice`, `discountPercent` in `calculateLineTotal()` (clamp `> 100` discount to `100` so existing `150%` test stays green) and throw `BadRequest` in `beforeSave()` for invalid values (`< 0` or `discountPercent > 100`); add `"min": 0` / `"max": 100` in `BidarDealItem.json`; recalculate fetched `opportunityId` in `afterSave()` when changed; use epsilon comparison `abs((float) $item->get('lineTotal') - $lineTotal) > 0.0001`; propagate currency if present and wrap `recalculateOpportunityAmount()` in DB transaction when supported.

### 9. [P1-ROTTEN] Future `lastActivityAt` Marked Rotten & Uncaught Date / `mappedStatus` Gaps
- **Files**:
  - `extensions/bidar-sales/Domain/RottenDealCalculator.php`
  - `extensions/bidar-sales/FieldProcessing/Opportunity/RottenLoader.php`
- **Verified Root Cause**:
  - `$diff = $now->diff($lastActivityAt); $days = (int) $diff->days;` ignores `$diff->invert`, so a future `lastActivityAt` (`$lastActivityAt > $now`) produces positive `$days` and marks the deal rotten.
  - `RottenLoader` calls `new DateTimeImmutable(...)` without `try/catch` and does not inspect `PipelineStage.mappedStatus` for closed deals when `stage` holds a non-English name.
- **TDD Plan**:
  - **Red**: In `RottenDealCalculatorTest` and `ActivityHooksTest`, test future `lastActivityAt` (`+10 days`) returns `isRotten = false, daysSinceLastActivity = 0`; test malformed date in `RottenLoader` does not throw; test `PipelineStage.mappedStatus = 'Closed Won'` returns `isRotten = false`.
  - **Green**: Guard `if ($lastActivityAt >= $now)` in `RottenDealCalculator::calculate()` and `RottenLoader`; wrap `DateTimeImmutable` parsing in `try/catch`; check `PipelineStage.mappedStatus` for `'Closed Won'` / `'Closed Lost'`.

### 10. [P1-PIPELINE-SYNC] `PipelineStageSync` Reverts Direct `Opportunity.stage` Updates & Unscoped `Pipeline` Fallback
- **Files**:
  - `extensions/bidar-sales/Hooks/Opportunity/PipelineStageSync.php`
- **Verified Root Cause**:
  - `beforeSave()` checks `!empty($entity->get('pipelineStageId'))` without checking `$entity->isNew() || $entity->isAttributeChanged('pipelineStageId')`, overwriting direct `stage` updates back to the old stage's `mappedStatus`.
  - Branch 2 searches `PipelineStage` without scoping to `pipelineId` when present; branch 3 queries `Pipeline` without `['entityType' => 'Opportunity']`.
- **TDD Plan**:
  - **Red**: In `PipelineStageSyncTest`, add a test with an existing mocked `Entity` (`isNew() = false`, `pipelineStageId` unchanged, `isAttributeChanged('stage') = true` to `'Closed Won'`) verifying `stage` remains `'Closed Won'` and `pipelineStageId` updates to the matching stage in the same pipeline.
  - **Green**: Gate branch 1 on `$entity->isNew() || $entity->isAttributeChanged('pipelineStageId')`, scope branch 2 by `pipelineId` (with fallback), and filter branch 3 by `['entityType' => 'Opportunity']`.

---

## P2 — Medium / Hardening Findings

### 11. [P2-SEEDER] `DemoDataSeeder` Self-Resetting Rotten Deal, Amount Mismatch, & «پایپلاین» Terminology
- **Files**:
  - `extensions/bidar-sales/Seed/DemoDataSeeder.php`
- **Verified Root Cause**:
  - `baran_deal` description uses `«پایپلاین»` instead of `«کاریز»`.
  - `zist_rotten_deal` gets `lastActivityAt = -10 days` in `seedOpportunities()`, then `seedTasks()` and `seedNotes()` create linked `Task`/`Note` triggering `UpdateOpportunityActivity::afterSave()` in production (resetting `lastActivityAt` to `now`).
  - `kimia_deal` (`240,000,000`) and `zarrin_deal` (`95,000,000`) amounts do not match their `BidarDealItem` totals (`195,000,000` and `81,500,000`).
- **TDD Plan**:
  - **Red**: In `DemoDataSeederTest`, assert seeded Opportunities contain no `پایپلاین`/`خط لوله` and seeded amounts match item totals (and re-assert `zist_rotten_deal` stays rotten even if `UpdateOpportunityActivity` fires or seeder restores `-10 days`).
  - **Green**: Replace `پایپلاین` with `کاریز`, align `kimia_deal` (`195000000`) and `zarrin_deal` (`81500000`) amounts, and re-apply `zist_rotten_deal` `lastActivityAt = -10 days` with `['silent' => true, 'skipHooks' => true]` after `seedNotes()` (or preserve via `skipHooks`).

### 12. [P2-APIKEY-INPUT] `BidarApiKeyService` & `BidarApiKeyLogin` Input & User-Type Hardening
- **Files**:
  - `extensions/bidar-sales/Services/BidarApiKeyService.php` (`createKey`)
  - `extensions/bidar-sales/Authentication/BidarApiKeyLogin.php` (`login`)
- **Verified Root Cause**:
  - `createKey()` allows creating personal `BidarUserApiKey` records for `system`, `portal`, or `api` users; `allowedIpList` silently ignores invalid non-array/non-string types (treating e.g. `123` as unrestricted `[]`); `BidarApiKeyLogin` does not reject `$ownerUser->isApi()` or non-array non-empty `allowedIpList` (fail-closed if string/corrupt).
- **TDD Plan**:
  - **Red**: In `BidarApiKeyServiceTest` and `BidarApiKeyLoginTest`, test `createKey()` rejects `system`/`portal`/`api` target users and non-array/non-string `allowedIpList` with `BadRequest`; test `BidarApiKeyLogin::login()` rejects `isApi()` owner users and corrupt non-array `allowedIpList` with `FailReason::DENIED`.
  - **Green**: Add user-type and `allowedIpList` type validation in `createKey()`, and fail-closed `allowedIpList` + `isApi()` check in `BidarApiKeyLogin::login()`.
