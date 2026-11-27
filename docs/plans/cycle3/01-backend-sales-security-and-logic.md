# Cycle 3 Remediation Plan 01 — Core Sales Extension (`extensions/bidar-sales/`)

```yaml
Scope (Allowed Files):
  - extensions/bidar-sales/**
Forbidden Changes:
  - Anything outside extensions/bidar-sales/
  - extensions/bidar-sales/manifest.json version field (must remain 1.0.4)
Prerequisites: None
Estimated Context Size: Small (7 atomic tasks, ~28 KB across 9 files)
Recommended Model Tier: Weak / Fast (Flash, GLM-5.3-Flash, hy4-flash, Haiku)
```

## Global Execution Rules

1. **Read ONLY** the files listed in each task's `Targets`. Do not scan unrelated extensions or `apps/web/`.
2. **Never edit** files outside `extensions/bidar-sales/`.
3. **Strict TDD:** For every task, complete **Step 1 (RED test fails)** -> **Step 2 (minimal fix)** -> **Step 3 (GREEN test passes)** before moving to the next task.
4. **Terminology & Versioning:** Always use «کاریز» (never «خط لوله»). Never change `manifest.json` version (`1.0.4`).
5. **Escalate immediately** on any condition in `Stop / Escalate If`.

---

## T1.1 [P0] Lock Down Generic REST CRUD on `BidarUserApiKey`

- **Severity:** `P0` (Blocker — Privilege Escalation / Validation Bypass)
- **Targets:**
  - `extensions/bidar-sales/Resources/metadata/scopes/BidarUserApiKey.json` (lines 1-6)
  - `extensions/bidar-sales/Resources/metadata/entityDefs/BidarUserApiKey.json`
  - `extensions/bidar-sales/Controllers/BidarUserApiKey.php` (new file)
  - `extensions/bidar-sales/tests/Unit/BidarUserApiKeyMetadataTest.php`
- **Root Cause:** `scopes/BidarUserApiKey.json` sets `"entity": true` and `"acl": false`, and no controller overrides `Record` CRUD actions, allowing authenticated users to hit generic `/api/v1/BidarUserApiKey` endpoints to inspect records or reactivate revoked keys (`isActive`), alter `expiresAt`, or inject invalid `allowedIpList` entries bypassing `BidarApiKeyService`.

### Step 1 — RED Test
Add a test to `extensions/bidar-sales/tests/Unit/BidarUserApiKeyMetadataTest.php` verifying:
1. `isActive`, `expiresAt`, and `allowedIpList` in `Resources/metadata/entityDefs/BidarUserApiKey.json` are marked `"readOnly": true`.
2. `Resources/metadata/scopes/BidarUserApiKey.json` sets `"disabled": true` (or `Controllers\BidarUserApiKey` exists and blocks generic CRUD actions with `Espo\Core\Exceptions\Forbidden`).

```php
public function testGenericRestCrudIsBlockedAndSensitiveFieldsAreReadOnly(): void
{
    $entityDefs = json_decode(
        (string) file_get_contents(__DIR__ . '/../../Resources/metadata/entityDefs/BidarUserApiKey.json'),
        true,
        512,
        JSON_THROW_ON_ERROR
    );

    foreach (['keyHash', 'userId', 'keyPrefix', 'isActive', 'expiresAt', 'allowedIpList', 'revokedAt', 'revokedByUserId', 'lastUsedAt'] as $field) {
        $this->assertTrue(
            $entityDefs['fields'][$field]['readOnly'] ?? false,
            "Field BidarUserApiKey.{$field} must be readOnly in metadata."
        );
    }

    $this->assertTrue(class_exists(\Espo\Modules\BidarSales\Controllers\BidarUserApiKey::class));
}
```
Run: `./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-sales/tests/Unit/BidarUserApiKeyMetadataTest.php` -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
1. In `extensions/bidar-sales/Resources/metadata/entityDefs/BidarUserApiKey.json`, ensure `isActive`, `expiresAt`, and `allowedIpList` each have `"readOnly": true`.
2. In `extensions/bidar-sales/Resources/metadata/scopes/BidarUserApiKey.json`:
   - Before:
     ```json
     {
       "entity": true,
       "object": false,
       "acl": false,
       "tab": false
     }
     ```
   - After:
     ```json
     {
       "entity": true,
       "object": false,
       "acl": false,
       "tab": false,
       "disabled": true
     }
     ```
3. Create `extensions/bidar-sales/Controllers/BidarUserApiKey.php`:
   ```php
   <?php

   declare(strict_types=1);

   namespace Espo\Modules\BidarSales\Controllers;

   use Espo\Core\Api\Request;
   use Espo\Core\Controllers\Record;
   use Espo\Core\Exceptions\Forbidden;

   class BidarUserApiKey extends Record
   {
       public function getActionList(Request $request): never
       {
           throw new Forbidden('Use /BidarApiKey endpoints to list API keys.');
       }

       public function getActionRead(Request $request): never
       {
           throw new Forbidden('Use /BidarApiKey endpoints to read API keys.');
       }

       public function postActionCreate(Request $request): never
       {
           throw new Forbidden('Use POST /BidarApiKey to create API keys.');
       }

       public function putActionUpdate(Request $request): never
       {
           throw new Forbidden('Direct modification of BidarUserApiKey is forbidden.');
       }

       public function patchActionUpdate(Request $request): never
       {
           throw new Forbidden('Direct modification of BidarUserApiKey is forbidden.');
       }

       public function deleteActionDelete(Request $request): never
       {
           throw new Forbidden('Use DELETE /BidarApiKey/:id to revoke API keys.');
       }
   }
   ```
   (Verify `BidarApiKeyService` writes directly via `$this->entityManager` and is unaffected by controller/readOnly metadata.)

### Step 3 — Verify GREEN
Run:
`./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-sales/tests/Unit/BidarUserApiKeyMetadataTest.php extensions/bidar-sales/tests/Unit/BidarApiKeyServiceTest.php`
Expected: `OK`, 0 failures.

### Stop / Escalate If
- Existing `BidarUserApiKeyMetadataTest.php` explicitly asserts `"disabled"` is `false` or absent in `scopes/BidarUserApiKey.json` and fails due to conflicting contract.
- `Espo\Core\Controllers\Record` signature causes a PHP fatal inheritance error during PHPUnit.

---

## T1.2 [P1] `BidarApiKeyLogin` & `BidarApiKeyService`: UTC Timestamps, Fail-Closed Corrupt `expiresAt`, Self-User Type Guard & Idempotent Revoke

- **Severity:** `P1` (Major)
- **Targets:**
  - `extensions/bidar-sales/Authentication/BidarApiKeyLogin.php` (lines 7, 86-92, 125)
  - `extensions/bidar-sales/Services/BidarApiKeyService.php` (lines 16, 39, 70-74, 107-143, 177, 222, 242-262)
  - `extensions/bidar-sales/tests/Unit/BidarApiKeyLoginTest.php`
  - `extensions/bidar-sales/tests/Unit/BidarApiKeyServiceTest.php`
- **Root Cause:**
  1. `BidarApiKeyLogin::login()` lines 88-91 let a malformed `expiresAt` (`strtotime(...) === false`) fall through as non-expired instead of failing closed, mixes server-default timezone `strtotime()`/`date()` with EspoCRM UTC timestamps, and imports unused `DateTimeImmutable`.
  2. `BidarApiKeyService::createKey()` only checks `isSystem`/`isPortal`/`isApi` when `data['userId'] !== $currentUser->getId()`, skipping self-check; `revokeKey()` overwrites `revokedAt`/`revokedByUserId` on already-revoked keys; `listKeys()` query is unbounded; `KEY_PREFIX_LENGTH` constant is `16` while `extractPrefix()` hardcodes `12`.

### Step 1 — RED Test
Add tests to:
1. `BidarApiKeyLoginTest.php`: corrupt `expiresAt = 'not-a-valid-date'` returns `FailReason::DENIED` (not `Result::success`).
2. `BidarApiKeyServiceTest.php`:
   - Calling `createKey()` as an API/Portal/System `$currentUser` (targeting themselves) throws `Forbidden`/`BadRequest`.
   - Calling `revokeKey()` twice preserves the original `revokedAt` and `revokedByUserId` without overwriting them.

Run: `./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-sales/tests/Unit/BidarApiKeyLoginTest.php extensions/bidar-sales/tests/Unit/BidarApiKeyServiceTest.php` -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
1. In `extensions/bidar-sales/Authentication/BidarApiKeyLogin.php`:
   - Replace lines 86-92 with strict UTC parsing using `DateTimeImmutable` + `new \DateTimeZone('UTC')` (preserving numeric Unix timestamps):
     ```php
     $expiresAt = $keyRecord->get('expiresAt');
     if ($expiresAt !== null && $expiresAt !== '') {
         if (is_numeric($expiresAt)) {
             $expireTimestamp = (int) $expiresAt;
         } else {
             try {
                 $expireTimestamp = (new DateTimeImmutable((string) $expiresAt, new \DateTimeZone('UTC')))->getTimestamp();
             } catch (Throwable) {
                 return Result::fail(FailReason::DENIED);
             }
         }
         if ($expireTimestamp <= time()) {
             return Result::fail(FailReason::DENIED);
         }
     }
     ```
   - Line 125: replace `date('Y-m-d H:i:s')` with `gmdate('Y-m-d H:i:s')`.
2. In `extensions/bidar-sales/Services/BidarApiKeyService.php`:
   - Line 16 & 39: set `public const KEY_PREFIX_LENGTH = 12;` and use `substr($plainKey, 0, self::KEY_PREFIX_LENGTH) . '...'`.
   - Lines 70-74: add `->limit(0, 200)` to `listKeys()`.
   - Before line 107 in `createKey()`: validate `$currentUser` is not `isSystem()`/`isPortal()`/`isApi()` (`throw new Forbidden('System, portal, or API users cannot create personal API keys.');`).
   - Lines 134-143, 177, 222, 256: parse `expiresAt` via `new \DateTimeImmutable($data['expiresAt'], new \DateTimeZone('UTC'))` (catching `\Throwable` -> `BadRequest('Invalid expiresAt format.')`), store formatted UTC via `->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s')`, and use `gmdate('Y-m-d H:i:s')` for `createdAt`, `modifiedAt`, `revokedAt`.
   - Line 255 in `revokeKey()`: if `!(bool) $entity->get('isActive')`, return `true` early before modifying `revokedAt` or saving.

### Step 3 — Verify GREEN
Run: `./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-sales/tests/Unit/BidarApiKeyLoginTest.php extensions/bidar-sales/tests/Unit/BidarApiKeyServiceTest.php`
Expected: `OK`, 0 failures.

### Stop / Escalate If
- Any existing test mocks `expiresAt` in a non-UTC local timezone and breaks on UTC comparison; check test fixtures before changing and escalate if ambiguous.

---

## T1.3 [P1] `GetDashboardSummary`: Fail-Closed ACL Fallback, UTC `now`, Bounded Queries & Dead Code Cleanup

- **Severity:** `P1` (Major — Security Fallback Bypass & Unbounded Query)
- **Targets:**
  - `extensions/bidar-sales/Api/GetDashboardSummary.php` (lines 10, 148-153, 222-377)
  - `extensions/bidar-sales/tests/Unit/GetDashboardSummaryTest.php` (or existing dashboard API tests in `extensions/bidar-sales/tests/Unit/`)
- **Root Cause:**
  1. When `$selectBuilderFactory === null`, lines 249-250 (`if ($level === 'own' && empty($oppWhere['assignedUserId']))`) allow any `'own'`-scoped user passing `?assignedUserId=<other>` to read someone else's deals and tasks; `'team'` is unhandled; and `Call`/`Meeting` lines 354 have zero fallback ACL gating.
  2. Lines 282 & 319 use server-default timezone instead of UTC; line 377 uses default timezone instead of `Asia/Tehran` for Jalali active goal dates.
  3. Unused `use Espo\Core\Acl\Table;` (line 10) and unreachable `elseif ($acl === null ...)` (lines 148-153). `Opportunity`, `Task`, `Call`, `Meeting` queries have no `limit()`.

### Step 1 — RED Test
Add unit tests in `extensions/bidar-sales/tests/Unit/GetDashboardSummaryTest.php` (check exact test filename in `extensions/bidar-sales/tests/Unit/` first):
1. When `$selectBuilderFactory === null` and `$acl->getLevel('Opportunity', 'read') === 'own'`, passing `?assignedUserId=other-user` must throw `Forbidden` (or override `assignedUserId` to `$user->getId()` — recommend throwing `Forbidden` when `$assignedUserId !== $user->getId()`).
2. When `$selectBuilderFactory === null` and `$acl->getLevel('Call', 'read') === 'no'`, `Call` repository must NOT be queried.

Run: `./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-sales/tests/Unit/` -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
In `extensions/bidar-sales/Api/GetDashboardSummary.php`:
1. Delete unused line 10 (`use Espo\Core\Acl\Table;`) and unreachable lines 148-153 (`elseif ($acl === null ...)`).
2. Extract a private helper `resolveAclLevel(Acl $acl, string $scope): string` and in the `else` (`$selectBuilderFactory === null`) branches for `Opportunity` (lines 244-258), `Task` (lines 300-316), and `Call`/`Meeting` (lines 350-355):
   - For non-admin users:
     - `'no'` -> throw `Forbidden` for `Opportunity`, skip (`continue` / empty `[]`) for `Task`/`Call`/`Meeting`.
     - `'own'` -> if `!empty($assignedUserId) && $assignedUserId !== $user->getId()`, throw `Forbidden('Access denied to another user\'s data.')` (for Opportunity) or force `$where['assignedUserId'] = $user->getId()`; ALWAYS set `$where['assignedUserId'] = $user->getId()`.
     - `'team'` -> if team IDs available on `$user` and `$selectBuilderFactory === null`, throw `Forbidden` for `Opportunity` (cannot enforce team join without `SelectBuilderFactory`) and skip `Task`/`Call`/`Meeting`.
3. Add `->limit(0, 5000)` to `Opportunity`, `Task`, `Call`, `Meeting` queries (`->limit(0, 5000)` before `->find()`), and apply `$dateFrom`/`$dateTo` on `Call`/`Meeting` (`dateStart>=` / `dateStart<=`) when set.
4. Change lines 282 & 319 to `new DateTimeImmutable('now', new DateTimeZone('UTC'))`, and line 377 to `new DateTimeImmutable('now', new DateTimeZone('Asia/Tehran'))`.

### Step 3 — Verify GREEN
Run: `./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-sales/tests`
Expected: `OK`, 0 failures.

### Stop / Escalate If
- Existing mock repositories in `bidar-sales/tests/` do not implement `limit()` chaining cleanly (if mocked without `limit()`, check `method_exists($query, 'limit')` just like `PostVoipWebhook`).

---

## T1.4 [P1] `DashboardSummaryService`: Exclude Unteamed Activities from Team-Scoped `activitiesHeld` Goals

- **Severity:** `P1` (Major — Metric Accuracy)
- **Targets:**
  - `extensions/bidar-sales/Services/DashboardSummaryService.php` (lines 82, 313-318, 408-419)
  - `extensions/bidar-sales/tests/Unit/DashboardSummaryServiceTest.php`
- **Root Cause:** Line 315 checks `(!empty($actTeamIds) || isset($act['teamId']))` before rejecting non-matching teams, so an activity with NO team (`teamIds: []`, no `teamId`) incorrectly counts toward a `team`-scoped `activitiesHeld` goal (inconsistent with deals at line 347). Line 82 defines unused `$probability`, and `OPEN_STANDARD_STAGES` is declared mid-class.

### Step 1 — RED Test
Add a test to `DashboardSummaryServiceTest.php` passing a `team`-scoped `activitiesHeld` goal (`teamId: 'team-1'`) and a `Held` activity with `teamIds: []` (no team). Assert `currentValue === 0.0`.
Run: `./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-sales/tests/Unit/DashboardSummaryServiceTest.php` -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
In `extensions/bidar-sales/Services/DashboardSummaryService.php`:
1. Move `private const OPEN_STANDARD_STAGES = [...];` (lines 408-419) to right after `LOSS_REASON_LABELS` at top of class.
2. Delete unused line 82 (`$probability = $deal['probability'] ?? null;`).
3. Replace lines 314-317 with:
   ```php
   $actTeamIds = is_array($act['teamIds'] ?? null) ? $act['teamIds'] : [];
   if (($act['teamId'] ?? null) !== $teamId && !in_array($teamId, $actTeamIds, true)) {
       continue;
   }
   ```

### Step 3 — Verify GREEN
Run: `./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-sales/tests/Unit/DashboardSummaryServiceTest.php`
Expected: `OK`, 0 failures.

### Stop / Escalate If
- Any pre-existing test in `DashboardSummaryServiceTest.php` expects unteamed activities to match a team-scoped goal (confirm intent before altering an existing fixture).

---

## T1.5 [P1] `PipelineStageSync`: Deterministic `mappedStatus`-First Matching & Clear Stale `pipelineStageId` on Unmatched Direct `stage` Edit

- **Severity:** `P1` (Major — Kanban Column Drift)
- **Targets:**
  - `extensions/bidar-sales/Hooks/Opportunity/PipelineStageSync.php` (lines 56-89)
  - `extensions/bidar-sales/tests/Unit/PipelineStageSyncTest.php`
- **Root Cause:** When `pipelineId` is set and `stage` is edited directly (`lines 65-72`), a single loop matches `mappedStatus === $stageValue || name === $stageValue` in arbitrary DB order instead of prioritizing `mappedStatus` before `name` (unlike the `else` branch). Furthermore, if the edited `stage` matches no `PipelineStage`, the stale `pipelineStageId`/`pipelineStageName` remain intact, pinning the deal to its old Kanban column.

### Step 1 — RED Test
Add two tests to `PipelineStageSyncTest.php`:
1. With `pipelineId = 'p1'`, stage A has `name = 'Proposal', mappedStatus = 'Qualification'` and stage B (`order` higher, or later in list) has `mappedStatus = 'Proposal'`; direct edit `stage = 'Proposal'` picks stage B (`mappedStatus` match first).
2. Existing deal with `pipelineStageId = 's1'` and `pipelineStageName = 'قدیمی'`: editing `stage` directly to `'Closed Won'` when no stage matches in that pipeline clears `pipelineStageId` and `pipelineStageName` to `null`.
Run: `./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-sales/tests/Unit/PipelineStageSyncTest.php` -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
Replace lines 65-88 in `extensions/bidar-sales/Hooks/Opportunity/PipelineStageSync.php`:
```php
if (!empty($currentPipelineId)) {
    $candidates = $stageRepo->where(['pipelineId' => (string) $currentPipelineId])->find();
    foreach ($candidates as $candidate) {
        if ($candidate->get('mappedStatus') === $stageValue) {
            $stage = $candidate;
            break;
        }
    }
    if ($stage === null) {
        foreach ($candidates as $candidate) {
            if ($candidate->get('name') === $stageValue) {
                $stage = $candidate;
                break;
            }
        }
    }
} else {
    $stage = $stageRepo->where(['mappedStatus' => $stageValue])->findOne()
        ?? $stageRepo->where(['name' => $stageValue])->findOne();
}

if ($stage !== null) {
    $entity->set('pipelineStageId', $stage->getId());
    $entity->set('pipelineStageName', $stage->get('name'));
    if ($stage->get('pipelineId')) {
        $entity->set('pipelineId', $stage->get('pipelineId'));
        if ($stage->has('pipelineName')) {
            $entity->set('pipelineName', $stage->get('pipelineName'));
        }
    }
} elseif (!$isNew) {
    $entity->set('pipelineStageId', null);
    $entity->set('pipelineStageName', null);
}
```

### Step 3 — Verify GREEN
Run: `./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-sales/tests/Unit/PipelineStageSyncTest.php`
Expected: `OK`, 0 failures.

### Stop / Escalate If
- Mock `$candidates` iterator cannot be iterated twice (if single-use `Generator`, convert `$candidateList = iterator_to_array($candidates);` or store `$nameFallback` during a single loop — even cleaner!).

---

## T1.6 [P1] `RottenLoader`: Guard Null `rottenDays`, Load `stageMappedStatus` Even When `stageRottenDays` Exists, & Use UTC

- **Severity:** `P1` (Major — Closed Deals Marked Rotten)
- **Targets:**
  - `extensions/bidar-sales/FieldProcessing/Opportunity/RottenLoader.php` (lines 51-80)
  - `extensions/bidar-sales/tests/Unit/` (`RottenDealCalculatorTest.php` or `RottenLoader` tests)
- **Root Cause:**
  1. Line 60 checks `$pipelineStage->has('rottenDays')` without `!== null`, casting `null` to `0` (causing non-closed deals to immediately rot at 0 days).
  2. Line 57 skips loading `PipelineStage` whenever `stageRottenDays !== null`, even if `stageMappedStatus === null`, preventing detection of custom closed stages (`mappedStatus: 'Closed Won'/'Closed Lost'`).
  3. Line 69 uses `new DateTimeImmutable('now')` without UTC.

### Step 1 — RED Test
Add tests checking:
1. Entity with `pipelineStageId` pointing to `PipelineStage` where `rottenDays === null` (attribute present as `null`) keeps `$stageRottenDays === null` (`isRotten: false`).
2. Entity with `stageRottenDays = 5`, `stageMappedStatus = null`, and `pipelineStageId` pointing to `PipelineStage` (`mappedStatus = 'Closed Lost'`) resolves `isRotten = false`.
Run targeted PHPUnit test -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
In `extensions/bidar-sales/FieldProcessing/Opportunity/RottenLoader.php` (lines 51-69):
```php
$stageRottenDays = null;
$stageMappedStatus = $entity->has('stageMappedStatus') && $entity->get('stageMappedStatus') !== null
    ? (string) $entity->get('stageMappedStatus')
    : null;
$hasRottenDays = $entity->has('stageRottenDays') && $entity->get('stageRottenDays') !== null;
if ($hasRottenDays) {
    $stageRottenDays = (int) $entity->get('stageRottenDays');
}
if ((!$hasRottenDays || $stageMappedStatus === null) && $this->entityManager !== null && $entity->has('pipelineStageId') && !empty($entity->get('pipelineStageId'))) {
    $pipelineStage = $this->entityManager->getEntityById('PipelineStage', (string) $entity->get('pipelineStageId'));
    if ($pipelineStage !== null) {
        if (!$hasRottenDays && $pipelineStage->has('rottenDays') && $pipelineStage->get('rottenDays') !== null) {
            $stageRottenDays = (int) $pipelineStage->get('rottenDays');
        }
        if ($stageMappedStatus === null && $pipelineStage->has('mappedStatus') && $pipelineStage->get('mappedStatus') !== null) {
            $stageMappedStatus = (string) $pipelineStage->get('mappedStatus');
        }
    }
}

$now = new DateTimeImmutable('now', new \DateTimeZone('UTC'));
```

### Step 3 — Verify GREEN
Run: `./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-sales/tests`
Expected: `OK`, 0 failures.

### Stop / Escalate If
- Any existing test compares `$lastActivityAt` in local timezone against non-UTC `now` expecting local offset drift.

---

## T1.7 [P2] `BidarExportAction` Deterministic Ordering & `RecalculateOpportunityAmount` Strict Discount Validation

- **Severity:** `P2` (Minor)
- **Targets:**
  - `extensions/bidar-sales/Api/BidarExportAction.php` (lines 88-93)
  - `extensions/bidar-sales/Hooks/BidarDealItem/RecalculateOpportunityAmount.php` (lines 28-39)
  - `extensions/bidar-sales/tests/Unit/BidarExportActionTest.php`
  - `extensions/bidar-sales/tests/Unit/DealItemCalculatorTest.php`
- **Root Cause:** `BidarExportAction` caps at `10000` rows without an `order('createdAt', 'DESC')` clause, producing non-deterministic truncation. `RecalculateOpportunityAmount::calculateLineTotal()` silently clamps `discountPercent > 100` to `100` whereas `beforeSave()` rejects `> 100`.

### Step 1 — RED Test
1. In `DealItemCalculatorTest.php`, assert `RecalculateOpportunityAmount::calculateLineTotal(1, 1000, 120)` throws `\InvalidArgumentException`.
2. In `BidarExportActionTest.php`, assert the repository builder receives `order('createdAt', 'DESC')` (or verify query ordering).
Run targeted tests -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
1. In `extensions/bidar-sales/Api/BidarExportAction.php` lines 88-93, chain `->order('createdAt', 'DESC')` before `->limit(0, self::MAX_EXPORT_ROWS)`.
2. In `extensions/bidar-sales/Hooks/BidarDealItem/RecalculateOpportunityAmount.php` lines 28-35:
   ```php
   if ($quantity < 0 || $unitPrice < 0 || $discountPercent < 0 || $discountPercent > 100) {
       throw new \InvalidArgumentException('Quantity and unitPrice must be >= 0, and discountPercent must be between 0 and 100.');
   }
   ```
   Also in `recalculateOpportunityAmount()` line 132, clamp legacy DB values `max(0.0, min(100.0, $discountPercent))` before calling `calculateLineTotal()` if needed so corrupt historical DB rows don't wedge deletion/recalculation of other items.

### Step 3 — Verify GREEN & Final Verification
Run full Section 1 suite:
`./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-sales/tests`
Expected: `OK` (all tests >= 168 passing, 0 failures, 0 warnings, 0 skipped). Confirm `extensions/bidar-sales/manifest.json` remains `"version": "1.0.4"`.

### Stop / Escalate If
- Existing `DealItemCalculatorTest` explicitly tests `calculateLineTotal(..., 150) === 0.0` (if so, stop and check contract before breaking test).
