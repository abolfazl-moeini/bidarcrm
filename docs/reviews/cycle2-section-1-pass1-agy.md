# Adversarial Code Review: `extensions/bidar-sales/`

Reviewed all source and metadata files provided for `extensions/bidar-sales/` against EspoCRM 10.1.4 core behavior (`RouteProcessor`, `Auth`, `InjectableFactory`, `Acl`, `PipelineStageStatus`, `Opportunity`) and `bidar-iran` helpers (`JalaliHelper`, `PersianCsvExporter`).

---

## Summary of Findings

| Severity | Count | Area |
| --- | --- | --- |
| **P0** | 1 | Unauthenticated full-CRM CSV export (`noAuth: true` -> system user) |
| **P1** | 9 | DI breakage on legacy API keys, admin-to-superadmin key rotation, field-level ACL bypass in export, Jalali UTC offset & empty-string filter bugs, broken `activitiesHeld`/`team`/fallback goals, open `probability=100` counted as Won, negative/double-negative deal item math + multi-currency + race condition, future `lastActivityAt` marked rotten, `PipelineStageSync` reverting `stage` edits |
| **P2** | 2 | `DemoDataSeeder` self-resetting rotten deal / amount mismatch / «پایپلاین» terminology, `BidarApiKeyService`/`BidarApiKeyLogin` input & user-type hardening |

**Persian CRM Terminology Check**:
- `«خط لوله»` does **not** appear anywhere in `extensions/bidar-sales/`.
- `«کاریز»` is used properly in `DefaultPipelineSeeder` and `DemoDataSeeder`, **except one violation** in `DemoDataSeeder` (`baran_deal` description uses `«پایپلاین»` instead of `«کاریز»`).

---

## P0 — Critical Findings

### 1. Unauthenticated Full CRM Data Exfiltration via `"noAuth": true` on `/BidarExport/:entityType`
- **Location**:
  - [routes.json](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Resources/routes.json#L29-L34)
  - [BidarExportAction.php](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Api/BidarExportAction.php#L40-L89) (`process()`)
- **Root Cause**:
  - `/BidarExport/:entityType` sets `"noAuth": true`. In EspoCRM 10.1, `RouteProcessor` + `Auth::process()` treat unauthenticated requests to `noAuth` routes as `AuthResult::createResolvedUseNoAuth()`, calling `ApplicationUser::setupSystemUser()` to set the active user to `system` (an admin-level user).
  - `BidarExportAction::process()` never rejects `null` or `isSystem()` users (`$this->user` is stored on line 36 and never read!). Consequently, `$this->acl->check($entityType, 'read')` and `withStrictAccessControl()` run as `system`, allowing any unauthenticated attacker to download all `Opportunity`, `Contact`, `Account`, `Lead`, and `Task` records as CSV.
  - Additionally, if `$this->acl` or `$this->selectBuilderFactory` is `null`, `process()` silently falls back to an unfiltered `find()`.
- **TDD Remediation Plan**:
  1. **Failing test first**: In `BidarExportActionTest`, pass `$user = null` and a `$user` where `isSystem() === true` to `BidarExportAction::process()` and assert `Forbidden` is thrown; add a metadata test asserting `/BidarExport/:entityType` in `routes.json` does not set `noAuth: true`.
  2. **Fix**: Remove `"noAuth": true` from [routes.json](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Resources/routes.json#L29-L34). In `BidarExportAction::process()`, enforce fail-closed checks at the top:
     ```php
     if ($this->user === null || $this->user->isSystem() || $this->acl === null || $this->selectBuilderFactory === null) {
         throw new Forbidden('Authentication and ACL context required.');
     }
     ```

---

## P1 — High Findings

### 2. EspoCRM 10.1+ DI Injects `null` for `?UserFinder`, Breaking Native `ApiUser` `X-Api-Key` Auth
- **Location**:
  - [BidarApiKeyLogin.php](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Authentication/BidarApiKeyLogin.php#L26-L32) (`__construct`) and lines 48–57 (`login`)
  - [ApiKey.json](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Resources/metadata/authenticationMethods/ApiKey.json#L1-L5)
- **Root Cause**:
  - `ApiKey.json` replaces EspoCRM's built-in `ApiKey` `Login` implementation with `BidarApiKeyLogin`.
  - In EspoCRM's `InjectableFactory::getMethodParamInjection()`, `UserFinder` is not a registered container service (`container->has('userFinder')` is `false`). Because the constructor parameter is declared nullable (`?UserFinder $userFinder = null`), `InjectableFactory` hits `if ($dependencyClass && $param->allowsNull()) { return null; }` and passes `null` instead of instantiating `UserFinder` (unlike core `Espo\Core\Authentication\Logins\ApiKey`, which declares non-nullable `UserFinder $userFinder`).
  - With `$this->userFinder === null` in production, lines 48–57 are always skipped and all native EspoCRM `ApiUser` `X-Api-Key` logins fail.
- **TDD Remediation Plan**:
  1. **Failing test first**: In `BidarApiKeyLoginTest`, instantiate `BidarApiKeyLogin(null, $entityManager)` (simulating `InjectableFactory` injecting `null` for `userFinder`) with a mocked `EntityManager` containing an `ApiUser` and assert `login()` succeeds (or verify constructor requires `UserFinder` when `EntityManager` is omitted).
  2. **Fix**: Fall back to `new UserFinder($entityManager)` when `$userFinder === null && $entityManager !== null` (or make `UserFinder` non-nullable and adjust unit tests to pass it).

### 3. Regular Admin Can Rotate Super-Admin API Keys (Privilege Escalation) & `keyHash` Exposure
- **Location**:
  - [BidarApiKeyService.php](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Services/BidarApiKeyService.php#L58-L66) (`listKeys`), lines 173–235 (`rotateKey`, `revokeKey`, `assertOwnership`)
  - [BidarUserApiKey.json](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Resources/metadata/entityDefs/BidarUserApiKey.json#L10-L29)
- **Root Cause**:
  - `createKey()` restricts creating keys for other users to `$currentUser->isSuperAdmin()`, but `assertOwnership()` (called by `rotateKey()` and `revokeKey()`) only checks `!$currentUser->isAdmin()`. In EspoCRM 10.1+, `User::isAdmin()` returns `true` for regular admins and even admin users stripped of `Scope::ADMIN`. A regular admin can rotate a `super-admin`'s API key (`POST /BidarApiKey/:id/rotate`), receive the new `plainKey` in the response, and authenticate as `super-admin`.
  - `rotateKey()` also fails to reject revoked keys (`isActive === false`), regenerating a hash on a disabled record and returning a `plainKey` that cannot log in.
  - In `BidarUserApiKey.json`, `keyHash` is only `"readOnly": true` (not `"internal": true` / `"forbidden": true`), and `userId` / `revokedByUserId` lack `"readOnly": true`.
- **TDD Remediation Plan**:
  1. **Failing test first**: In `BidarApiKeyServiceTest`, test a non-super-admin `admin` calling `rotateKey()` and `revokeKey()` on a `super-admin` key and assert `Forbidden`; test `rotateKey()` on an `isActive = false` key and assert `BadRequest`.
  2. **Fix**: In `assertOwnership()`, load the owner `User` (or require `$currentUser->isSuperAdmin()` whenever `$ownerId !== $currentUser->getId()`, matching `createKey()`), and check `isEffectiveAdmin()` if `method_exists($currentUser, 'isEffectiveAdmin')`. In `rotateKey()`, throw `BadRequest` if `!$entity->get('isActive')`. Mark `keyHash` as `"internal": true` and `userId`/`revokedByUserId` as `"readOnly": true` in `BidarUserApiKey.json`.

### 4. Field-Level ACL Bypass & Unbounded In-Memory Query in `BidarExportAction`
- **Location**:
  - [BidarExportAction.php](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Api/BidarExportAction.php#L52-L89) (`process`, `mapEntitiesToCsvData`)
- **Root Cause**:
  - `BidarExportAction` checks scope `read` and `checkEntityRead()`, plus `withStrictAccessControl()`, but never checks field-level ACL (`$this->acl->getScopeForbiddenFieldList($entityType, 'read')` / `checkField()`). Users restricted by Role field-level permissions (e.g. denied `Opportunity.amount`, `Contact.emailAddress`, or `phoneNumber`) can export those forbidden fields in CSV.
  - `->find()` materializes the entire collection in memory without `->sth()` or a row cap, creating an OOM DoS vector on large datasets.
- **TDD Remediation Plan**:
  1. **Failing test first**: In `BidarExportActionTest`, mock `$acl->getScopeForbiddenFieldList('Opportunity', 'read')` returning `['amount']` (or `checkField` returning `false` for `amount`) and assert the exported CSV does not expose the `amount` column/values.
  2. **Fix**: Filter out fields listed by `$this->acl->getScopeForbiddenFieldList($entityType, 'read')` before building CSV headers/rows, and use `->sth()->find()` (with an explicit maximum row limit or streaming response).

### 5. Jalali Period Timezone Offset (`+03:30`), Empty-String Override, and `dateTo` Midnight Truncation in `GetDashboardSummary`
- **Location**:
  - [GetDashboardSummary.php](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Api/GetDashboardSummary.php#L78-L110) (`resolveJalaliPeriod`), lines 163–174, lines 199–205
- **Root Cause**:
  - `resolveJalaliPeriod()` calls `JalaliHelper::getCurrentJalaliMonthRange()`, `getJalaliMonthRange()`, and `getJalaliQuarterRange()` with `$toUtc = false` (default), returning `Asia/Tehran` local timestamps (`$range['start']` / `$range['end']`) rather than `$range['startUtc']` / `$range['endUtc']`. Comparing Tehran wall-clock strings against UTC `Opportunity.createdAt` shifts every Jalali month/quarter boundary by 3.5 hours.
  - Lines 171–172 use `$dateFrom = $dateFrom ?? $periodRange['dateFrom']`. Sending `?jalaliPeriod=current_month&dateFrom=&dateTo=` supplies `""` (not `null`), so `??` preserves `""` and `!empty($dateFrom)` skips the filter, returning all-time data.
  - Passing a date-only `dateTo` (e.g. `2026-11-24`) produces `createdAt <= '2026-11-24'` (midnight `00:00:00`), silently excluding all deals created during that day.
- **TDD Remediation Plan**:
  1. **Failing test first**: Add `GetDashboardSummaryTest` asserting `resolveJalaliPeriod('current_month')` returns UTC boundaries (`startUtc`/`endUtc`); test `process()` with `jalaliPeriod=current_month` and `dateFrom=''` still applies the Jalali range; test `dateTo='2026-11-24'` expands to `2026-11-24 23:59:59`.
  2. **Fix**: Read `$range['startUtc']` / `$range['endUtc']` (or pass `toUtc: true`) in `resolveJalaliPeriod()`; normalize empty strings (`$dateFrom = ($dateFrom !== null && trim($dateFrom) !== '') ? trim($dateFrom) : null`); expand date-only `dateTo` (`^\d{4}-\d{2}-\d{2}$`) to `$dateTo . ' 23:59:59'`.

### 6. Broken `activitiesHeld` Goals, Unimplemented `team` Goals, Unscoped Goal Fallback Leak, & Empty `closeDate` Bypass
- **Location**:
  - [GetDashboardSummary.php](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Api/GetDashboardSummary.php#L194-L205), lines 235, 247–253, 284–334
  - [DashboardSummaryService.php](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Services/DashboardSummaryService.php#L270-L355) (`calculateGoalProgress`)
- **Root Cause**:
  - **`activitiesHeld` goals always return `0%`**: `GetDashboardSummary` queries only `Task` where `status IN ['Not Started', 'Started']` and `dateEnd < now`, never fetching `Held` `Call`/`Meeting` (or `Completed` `Task`) records. `DashboardSummaryService::calculateGoalProgress()` counts `$act['status'] === 'Held'`, so `activitiesHeld` goals always compute `0.0`.
  - **`scopeType = 'team'` is unimplemented**: `BidarGoal.json` supports `'team'`, but neither `GetDashboardSummary` nor `calculateGoalProgress()` handles `teamId` filtering.
  - **Unscoped `BidarGoal` fallback leaks private/expired goals**: Line 314 runs `$goalRepo->order('createdAt', 'desc')->findOne()` with no `scopeType`, `assignedUserId`, date check, or `BidarGoal` ACL check, exposing other reps' personal or expired goals.
  - **Goal date & `createdAt` filtering bugs**:
    1) `GetDashboardSummary` filters `Opportunity` by `createdAt`, omitting older deals that were `Closed Won` during the current goal/dashboard period.
    2) `GetDashboardSummary` populates `'closeDate' => (string) ($opp->get('closeDate') ?? '')` (empty string `''`, not `null`), so `DashboardSummaryService` line 330 (`$deal['closeDate'] ?? $deal['createdAt'] ?? ''`) evaluates to `''`, causing `if ($date !== '')` to **skip the goal date check entirely**.
    3) For `metricType === 'dealsCreated'`, checking `closeDate` instead of `createdAt` drops newly created open deals whose expected `closeDate` is in a future month.
- **TDD Remediation Plan**:
  1. **Failing test first**:
     - In `DashboardSummaryServiceTest`, test `calculateGoalProgress()` for `dealsCreated` with `createdAt` inside `[dateStart, dateEnd]` and `closeDate` either `''` or after `dateEnd` (asserting inside-period deals count and out-of-period deals with `closeDate = ''` do not bypass the filter); test `scopeType = 'team'`.
     - In `GetDashboardSummaryTest`, test `activitiesHeld` goal includes `Held` Calls/Meetings; test that no goal is returned when only another user's private or expired `BidarGoal` exists.
  2. **Fix**: Fetch `Held` Calls/Meetings (and `Completed` Tasks) for goal calculation (separate from overdue open tasks); remove the unscoped `findOne()` fallback and enforce `BidarGoal` ACL + `team` scope; in `calculateGoalProgress()`, use `createdAt` for `dealsCreated` and `($deal['closeDate'] ?: $deal['createdAt'] ?? '')` for `wonAmount`/`wonCount`, rejecting deals with missing dates when `dateStart`/`dateEnd` are set.

### 7. Open Deals with `probability = 100` Misclassified as Won & Empty-String Stage Collision
- **Location**:
  - [DashboardSummaryService.php](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Services/DashboardSummaryService.php#L58-L73), lines 110–130, lines 359–437 (`isDealWon`, `isDealLost`)
  - [GetDashboardSummary.php](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Api/GetDashboardSummary.php#L176-L192)
- **Root Cause**:
  - `isDealWon()` treats any deal with `probability == 100` as `Closed Won` whenever `stage !== 'Closed Lost'` (`$is100 && $stage !== 'Closed Lost' && $stageMappedStatus !== 'Closed Lost'`). Since `Opportunity.probability` is user-editable (`0..100`), an open deal in `Proposal` or `Negotiation` with `probability = 100` is counted in `wonCount`/`wonAmount` and removed from `openCount` and `funnelStages`.
  - `isDealWon()` / `isDealLost()` stage lookups use `($st['id'] ?? '') === $pipelineStageId || ($st['name'] ?? '') === $stage` without guarding `!== ''`, causing empty `pipelineStageId`/`stage` values to match stages with empty `id`/`name`.
  - When `pipelineId` is omitted in `GetDashboardSummary`, `PipelineStage`s from all pipelines are loaded into `$stageLookup` keyed by `name`, colliding across pipelines with the same stage names, and `GetDashboardSummary` omits `color` while reading non-existent `PipelineStage.probability`.
- **TDD Remediation Plan**:
  1. **Failing test first**: In `DashboardSummaryServiceTest`, pass an open deal with `stage = 'Negotiation'`, `mappedStatus = 'Negotiation'`, `probability = 100` and assert `wonCount === 0` and `openCount === 1`.
  2. **Fix**: Only fall back to `probability === 100` when `stage` and `stageMappedStatus` are empty/unset (never override an explicit open stage like `'Negotiation'`). Guard `!== ''` before comparing `$pipelineStageId` and `$stage` in stage lookup loops.

### 8. Invalid Input / Double-Negative Bypass, Multi-Currency Mixing, Stale Parent `amount`, & Race Condition in `BidarDealItem`
- **Location**:
  - [RecalculateOpportunityAmount.php](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Hooks/BidarDealItem/RecalculateOpportunityAmount.php#L25-L119)
  - [BidarDealItem.json](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Resources/metadata/entityDefs/BidarDealItem.json#L5-L16)
- **Root Cause**:
  - **Double-negative & negative-discount bypass**: `BidarDealItem.json` defines no `"min"` / `"max"` bounds on `quantity`, `unitPrice`, or `discountPercent`, and `calculateLineTotal()` does not validate inputs. Negative `discountPercent` (e.g. `-50`) yields `$discountFactor = 1.5` (150% price). Two negatives (`quantity = -2`, `discountPercent = 150`, or `quantity = -2`, `unitPrice = -100`) multiply to a positive `lineTotal`, bypassing `max(0.0, $total)`. `calculateTotalAmount()` also sums pre-supplied negative `item['lineTotal']` without clamping.
  - **Stale `Opportunity.amount` on `opportunityId` change**: `afterSave()` only recalculates the new `$entity->get('opportunityId')` and never recalculates `$entity->getFetched('opportunityId')`, leaving the previous Opportunity's `amount` inflated when an item is moved.
  - **Multi-currency corruption**: `unitPrice` and `lineTotal` are `currency` fields, but `recalculateOpportunityAmount()` sums raw `unitPrice` ignoring `unitPriceCurrency` / `Opportunity.amountCurrency` and never sets `lineTotalCurrency` or `amountCurrency`.
  - **Concurrency race & type-strict comparison**: Concurrent writes to sibling `BidarDealItem` rows run non-transactional read-sum-write loops that overwrite `Opportunity.amount` with stale totals. Line 97 (`$item->get('lineTotal') !== $lineTotal`) compares DB string/int to `float`, causing redundant writes.
- **TDD Remediation Plan**:
  1. **Failing test first**: In `DealItemCalculatorTest`, assert `calculateLineTotal(-2.0, 100.0, 150.0)` and `calculateLineTotal(1.0, 100.0, -20.0)` throw `\InvalidArgumentException`; assert `beforeSave` throws `BadRequest` for negative `quantity`/`unitPrice` or `discountPercent` outside `[0, 100]`; assert moving an item (`opportunityId` changed from `opp-1` to `opp-2`) recalculates both `opp-1` and `opp-2`.
  2. **Fix**: Add `"min": 0` (`quantity`, `unitPrice`) and `"min": 0, "max": 100` (`discountPercent`) in `BidarDealItem.json`; validate bounds in `calculateLineTotal()` / `beforeSave()`; recalculate `$entity->getFetched('opportunityId')` in `afterSave()` when `isAttributeChanged('opportunityId')`; align/convert currencies; use float-epsilon comparison and wrap `recalculateOpportunityAmount()` in a DB transaction / atomic SQL sum.

### 9. Future `lastActivityAt` Marked as Rotten + Uncaught Date Parsing & `mappedStatus` Gap
- **Location**:
  - [RottenDealCalculator.php](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Domain/RottenDealCalculator.php#L11-L29)
  - [RottenLoader.php](file:///Users/moeini/Dev/didar/extensions/bidar-sales/FieldProcessing/Opportunity/RottenLoader.php#L25-L101)
- **Root Cause**:
  - `$diff = $now->diff($lastActivityAt); $days = (int) $diff->days;` uses unsigned `$diff->days` without checking `$diff->invert`. When `$lastActivityAt > $now` (future timestamp), `$days` is positive (`10`) and `$days > $stageRottenDays` marks the deal **rotten**.
  - `RottenLoader::process()` parses `$lastActivityStr` with `new DateTimeImmutable((string) $lastActivityStr)` outside any `try/catch`, crashing Opportunity reads on malformed dates.
  - `RottenLoader::process()` only checks `$stage === 'Closed Won' || $stage === 'Closed Lost'` (ignoring `PipelineStage.mappedStatus` when `stage` holds a Persian stage name) and casts `null` `rottenDays` via `(int) $pipelineStage->get('rottenDays')` to `0`.
- **TDD Remediation Plan**:
  1. **Failing test first**: In `RottenDealCalculatorTest`, pass `$lastActivityAt` 10 days after `$now` with `$stageRottenDays = 3` and assert `isRotten() === false` and `daysSinceLastActivity() === 0`.
  2. **Fix**: Guard `if ($lastActivityAt >= $now) { return new RottenResult(false, 0); }` in `RottenDealCalculator::calculate()` and `RottenLoader`. Wrap `DateTimeImmutable` creation in `try/catch` and check `PipelineStage.mappedStatus` for closed states.

### 10. Direct `Opportunity.stage` Updates Silently Reverted by `PipelineStageSync`
- **Location**:
  - [PipelineStageSync.php](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Hooks/Opportunity/PipelineStageSync.php#L18-L71) (`beforeSave`)
- **Root Cause**:
  - `PipelineStageSync::$order = -10` runs before core `PipelineStageStatus` (`$order = 1`).
  - Line 19 checks `!empty($entity->get('pipelineStageId'))` without checking `isAttributeChanged('pipelineStageId')` or `isAttributeChanged('stage')`. Updating only `stage` (e.g. to `'Closed Won'`) on an existing Opportunity that already has `pipelineStageId` causes `PipelineStageSync` to overwrite `stage` back to the old `pipelineStageId`'s `mappedStatus`.
  - Branch 2 searches `PipelineStage` globally without scoping to the Opportunity's `pipelineId`, and branch 3 calls `Pipeline::findOne()` without `['entityType' => 'Opportunity']`.
- **TDD Remediation Plan**:
  1. **Failing test first**: In `PipelineStageSyncTest`, simulate an existing Opportunity with fetched `pipelineStageId = 'stage-1'` and `stage = 'Prospecting'`, update only `stage = 'Closed Won'`, invoke `beforeSave()`, and assert `stage` stays `'Closed Won'` and `pipelineStageId` updates to the matching `'Closed Won'` stage.
  2. **Fix**: Only resolve from `pipelineStageId` when `$entity->isNew() || $entity->isAttributeChanged('pipelineStageId')`; otherwise, when `$entity->isAttributeChanged('stage')`, resolve the stage within the Opportunity's `pipelineId` (falling back to global `Opportunity` pipelines) and update `pipelineStageId`/`pipelineStageName`. Filter fallback `Pipeline` lookup by `['entityType' => 'Opportunity']`.

---

## P2 — Medium / Low Findings

### 11. `DemoDataSeeder` Self-Invalidates Seeded Rotten Deal, Mismatches Deal Item Totals, & Uses «پایپلاین» Instead of «کاریز»
- **Location**:
  - [DemoDataSeeder.php](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Seed/DemoDataSeeder.php) (`seedOpportunities` `baran_deal` description, `zist_rotten_deal`, `kimia_deal`, `zarrin_deal`; `seedDealItems`; `seedTasks`; `seedNotes`)
  - [UpdateOpportunityActivity.php](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Hooks/Common/UpdateOpportunityActivity.php#L27-L50)
- **Root Cause**:
  - `baran_deal.description` uses `«پایپلاین»` instead of the required Persian CRM term `«کاریز»`.
  - `seedOpportunities()` sets `zist_rotten_deal.lastActivityAt` to `-10 days`, but `seedTasks()` and `seedNotes()` immediately save a `Not Started` `Task` and a `Note` linked to `zist_rotten_deal`. `UpdateOpportunityActivity::afterSave()` fires on any `Note`/`Call`/`Meeting`/`Task` save (regardless of status) and resets `lastActivityAt` to `now`, making `zist_rotten_deal` non-rotten right after seeding.
  - `kimia_deal` (`240,000,000`) and `zarrin_deal` (`95,000,000`) do not match the sums of their seeded `BidarDealItem`s (`195,000,000` and `81,500,000`), so `RecalculateOpportunityAmount::afterSave()` overwrites those Opportunity amounts during seeding.
- **TDD Remediation Plan**:
  1. **Failing test first**: In `DemoDataSeederTest`, assert seeded strings do not contain `پایپلاین` or `خط لوله`, assert `kimia_deal`/`zarrin_deal` amounts match their item sums, and assert `zist_rotten_deal.lastActivityAt` stays `-10 days` (and `UpdateOpportunityActivity` does not bump `lastActivityAt` for `Not Started` / `Planned` tasks/meetings).
  2. **Fix**: Replace `پایپلاین` with `کاریز`; align seeded Opportunity amounts with `BidarDealItem` sums; restrict `UpdateOpportunityActivity` to completed/actual interactions (or pass `skipHooks` / re-apply `-10 days` on `zist_rotten_deal` after seeding tasks/notes).

### 12. `BidarApiKeyService` & `BidarApiKeyLogin` Input & User-Type Hardening
- **Location**:
  - [BidarApiKeyService.php](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Services/BidarApiKeyService.php#L106-L151) (`createKey`)
  - [BidarApiKeyLogin.php](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Authentication/BidarApiKeyLogin.php#L90-L107) (`login`)
- **Root Cause**:
  - `createKey()` allows creating a `BidarUserApiKey` for `system`, `portal`, or `api` users (checking only `isActive`), and silently treats invalid non-array/non-string `allowedIpList` types (e.g. an integer or JSON object) as `[]` (unrestricted IP access) instead of throwing `BadRequest`.
  - `BidarApiKeyLogin` checks `REMOTE_ADDR` directly (ignoring EspoCRM's `ipAddressServerParam` and CIDR ranges) and does not reject `User::isApi()` on personal keys.
- **TDD Remediation Plan**:
  1. **Failing test first**: In `BidarApiKeyServiceTest`, test `createKey()` with a `system` or `portal` target user and with `allowedIpList => 123`, asserting `BadRequest` is thrown in both cases.
  2. **Fix**: Reject `system`/`portal`/`api` target users in `createKey()`, and throw `BadRequest` if `allowedIpList` is provided with a type other than `array` or `string`.

