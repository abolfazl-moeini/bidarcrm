# Cycle 3 Remediation Plan 02 — Iran Localization Extension (`extensions/bidar-iran/`)

```yaml
Scope (Allowed Files):
  - extensions/bidar-iran/**
Forbidden Changes:
  - Anything outside extensions/bidar-iran/
  - extensions/bidar-iran/manifest.json version field (must remain 1.0.4)
Prerequisites: None
Estimated Context Size: Small (5 atomic tasks, ~16 KB across 6 files)
Recommended Model Tier: Weak / Fast (Flash, GLM-5.3-Flash, hy4-flash, Haiku)
```

## Global Execution Rules

1. **Read ONLY** the files listed in each task's `Targets`.
2. **Never edit** files outside `extensions/bidar-iran/`.
3. **Strict TDD:** Step 1 (add/run failing RED test) -> Step 2 (apply exact minimal fix) -> Step 3 (run PHPUnit verify command -> confirm GREEN).
4. **Never change** `extensions/bidar-iran/manifest.json` version (`1.0.4`).
5. **Escalate immediately** if any `Stop / Escalate If` condition occurs.

---

## T2.1 [P1] `PostSendSms`: Fail-Closed ACL, Max Batch Limit (`MAX_RECIPIENTS = 100`), & Linked Record Read Access Check

- **Severity:** `P1` (Major — Security & DoS Protection)
- **Targets:**
  - `extensions/bidar-iran/Api/PostSendSms.php` (lines 18-105)
  - `extensions/bidar-iran/tests/Unit/SmsCampaignServiceTest.php` (or dedicated `PostSendSms` tests in `extensions/bidar-iran/tests/Unit/`)
- **Root Cause:**
  1. Line 42 checks `if ($acl !== null && !$acl->check(...))`, which silently skips authorization when `$this->entityManager !== null` and `$acl === null` in runtime DI failures.
  2. `recipients` array has no upper bound, allowing unbounded synchronous Kavenegar HTTP calls in a single request.
  3. Any user with `BidarSmsMessage:create` can attach an arbitrary `contactId` or `opportunityId` they cannot read.

### Step 1 — RED Test
Add unit tests checking:
1. Constructing `PostSendSms(service: ..., entityManager: $mockEm, container: null, acl: null)` and calling `process($request)` throws `Espo\Core\Exceptions\Forbidden`.
2. Submitting `recipients` with 101 items throws `Espo\Core\Exceptions\BadRequest` mentioning `100`.
3. Passing `contactId` (or `opportunityId`) where `$acl->checkEntityRead($contact)` returns `false` throws `Forbidden` before `sendSms()` runs.
Run: `./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-iran/tests/Unit/` -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
In `extensions/bidar-iran/Api/PostSendSms.php`:
1. Add constant: `public const int MAX_RECIPIENTS = 100;`
2. After resolving `$acl` (line 41):
   - Resolve `$em = $this->entityManager ?? ($this->container !== null && $this->container->has('entityManager') ? $this->container->get('entityManager') : null);`
   - If `($this->container !== null || $em !== null) && $acl === null`, throw `new Forbidden('Access denied to send SMS.');`
   - Update any existing unit test in `extensions/bidar-iran/tests/Unit/` that passed `$em` without `$acl` to pass an explicit mock `$acl` returning `true`.
3. Right after line 56 (`$recipients` list validation):
   ```php
   if (is_array($recipients) && count($recipients) > self::MAX_RECIPIENTS) {
       throw new BadRequest(sprintf('Campaign cannot exceed %d recipients per request.', self::MAX_RECIPIENTS));
   }
   ```
4. Before sending (single send AND per-recipient in campaign), extract a private helper `assertEntityReadable(?Acl $acl, ?EntityManager $em, string $entityType, ?string $id): void`:
   ```php
   if ($id === null || $acl === null || $em === null) {
       return;
   }
   $entity = $em->getEntityById($entityType, $id);
   if ($entity !== null && !$acl->checkEntityRead($entity)) {
       throw new Forbidden("Access denied to linked {$entityType}.");
   }
   ```

### Step 3 — Verify GREEN
Run: `./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-iran/tests`
Expected: `OK`, 0 failures.

### Stop / Escalate If
- `Acl::checkEntityRead` does not exist on mocked `Acl` doubles in existing tests (`method_exists($acl, 'checkEntityRead')` guard handles thin stubs cleanly without breaking existing mocks).

---

## T2.2 [P1] `SmsCampaignService`: Honor `recipient` Phone Key & Defensive Trim Inside `sendSms()`

- **Severity:** `P1` (Major — Contract Inconsistency)
- **Targets:**
  - `extensions/bidar-iran/Services/SmsCampaignService.php` (lines 77-111, 163-165)
  - `extensions/bidar-iran/tests/Unit/SmsCampaignServiceTest.php`
- **Root Cause:** `PostSendSms` validates `['phone', 'phoneNumber', 'recipient']` on campaign recipients, whereas `SmsCampaignService::sendCampaign()` line 163 only checks `$recipient['phoneNumber'] ?? $recipient['phone'] ?? ''`, causing recipients with `'recipient'` key to silently fail with `'Missing phone number'`. Also `sendSms()` itself does not trim `$phoneNumber`, `$contactId`, or `$opportunityId` when called directly by internal PHP callers.

### Step 1 — RED Test
In `extensions/bidar-iran/tests/Unit/SmsCampaignServiceTest.php`:
1. Call `sendCampaign([['recipient' => '09121234567', 'contactId' => '   ']], 'سلام')` -> expect `sent === 1`, `failed === 0`, and saved record `contactId === null`.
2. Call `sendSms(' 09121234567 ', 'سلام', '  ', '')` -> expect trimmed `'09121234567'` and `contactId`/`opportunityId` NOT set to whitespace strings.
Run: `./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-iran/tests/Unit/SmsCampaignServiceTest.php` -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
In `extensions/bidar-iran/Services/SmsCampaignService.php`:
1. In `sendSms()` (lines 83-112):
   ```php
   $phoneNumber = trim($phoneNumber);
   $contactId = $contactId !== null && trim($contactId) !== '' ? trim($contactId) : null;
   $opportunityId = $opportunityId !== null && trim($opportunityId) !== '' ? trim($opportunityId) : null;
   ```
2. In `sendCampaign()` line 163-165:
   ```php
   $phoneValue = $recipient['phoneNumber'] ?? $recipient['phone'] ?? $recipient['recipient'] ?? '';
   $phone = is_string($phoneValue) ? trim($phoneValue) : '';
   ```
3. Also clean up any unused variable `$captured = [];` around `SmsCampaignServiceTest.php:457` if present.

### Step 3 — Verify GREEN
Run: `./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-iran/tests/Unit/SmsCampaignServiceTest.php`
Expected: `OK`, 0 failures.

### Stop / Escalate If
- Any existing test expects `'recipient'` key in `sendCampaign()` to fail as missing phone.

---

## T2.3 [P1] `KavenegarSender`: URL-Encode API Key in Endpoint & Scrub Encoded Key in Exceptions

- **Severity:** `P1` (Major — URL Injection & Secret Leak)
- **Targets:**
  - `extensions/bidar-iran/Sms/KavenegarSender.php` (lines 57, 73)
  - `extensions/bidar-iran/tests/Unit/SmsCampaignServiceTest.php` (or Kavenegar test file)
- **Root Cause:** Line 57 interpolates `$this->apiKey` directly into the HTTPS path without `rawurlencode()`, allowing reserved characters (`/`, `?`, `#`) in a pasted key to alter the URL path/query; and if encoded in error logs, line 73 only scrubs `$this->apiKey`, not its URL-encoded form.

### Step 1 — RED Test
Add a test constructing `KavenegarSender('abc/123?x=1', ...)` with a mock `$httpClient` throwing `RuntimeException("Failed calling https://api.kavenegar.com/v1/abc%2F123%3Fx%3D1/sms/send.json")`:
1. Assert `$httpClient` receives `abc%2F123%3Fx%3D1` in `$url`.
2. Assert thrown `RuntimeException` message contains `'***'` and does NOT contain `'abc/123'` or `'abc%2F123'`.
Run targeted test -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
In `extensions/bidar-iran/Sms/KavenegarSender.php`:
- Line 57:
  ```php
  $encodedKey = rawurlencode($this->apiKey);
  $url = "https://api.kavenegar.com/v1/{$encodedKey}/sms/send.json";
  ```
- Line 73:
  ```php
  $detail = str_replace([$this->apiKey, $encodedKey], '***', $e->getMessage());
  ```

### Step 3 — Verify GREEN
Run: `./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-iran/tests`
Expected: `OK`, 0 failures.

### Stop / Escalate If
- None.

---

## T2.4 [P1] `PostVoipWebhook`: Case-Insensitive HMAC Hex & CIDR Subnet Support in `allowedIps`

- **Severity:** `P1` (Major — Interoperability)
- **Targets:**
  - `extensions/bidar-iran/Api/PostVoipWebhook.php` (lines 39-59)
  - `extensions/bidar-iran/tests/Unit/` (`Voip` / `BidarIranAuditTest.php`)
- **Root Cause:**
  1. Line 56 strips `sha256=` but preserves uppercase hex (`SHA256=ABCD...`), causing `hash_equals($expected, $provided)` to fail for PBXs that emit uppercase hex HMAC digests.
  2. Lines 41-46 use strict string `in_array($remoteIp, $allowed, true)`, breaking standard CIDR ranges (e.g. `192.168.10.0/24`) entered by admins in Integration `allowedIps`.

### Step 1 — RED Test
Add unit tests for `PostVoipWebhook`:
1. `X-Bidar-Voip-Signature: sha256=` + `strtoupper(hash_hmac(...))` succeeds (HTTP 200).
2. `allowedIps: '10.20.0.0/16'` allows `REMOTE_ADDR = '10.20.30.40'` and rejects `'10.21.0.1'` (`Forbidden`).
Run targeted tests -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
In `extensions/bidar-iran/Api/PostVoipWebhook.php`:
1. Line 56:
   ```php
   $provided = strtolower(trim(preg_replace('/^sha256=/i', '', trim($signature)) ?? ''));
   ```
2. Extract private helper `ipMatchesAllowlist(string $remoteIp, array $allowed): bool`:
   - Loop `$entry` in `$allowed`:
     - If `$entry === $remoteIp` -> return `true`.
     - If `str_contains($entry, '/')`: split `[$subnet, $prefixRaw]`, convert both `$subnet` and `$remoteIp` via `inet_pton()`, verify matching address family (`strlen($ipBin) === strlen($netBin)`), validate prefix `0 <= $prefix <= strlen($ipBin) * 8`, and compare full bytes + masked remainder byte. Return `true` on match.
   - Replace `in_array($remoteIp, $allowed, true)` on line 43 with `$this->ipMatchesAllowlist($remoteIp, $allowed)`.

### Step 3 — Verify GREEN
Run: `./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-iran/tests`
Expected: `OK`, 0 failures.

### Stop / Escalate If
- None.

---

## T2.5 [P2] `PersianCsvExporter` `\n` Prefix Guard & `JalaliHelper::toGregorianDate` Arabic-Indic Digits

- **Severity:** `P2` (Minor)
- **Targets:**
  - `extensions/bidar-iran/Support/PersianCsvExporter.php` (lines 81-87)
  - `extensions/bidar-iran/Support/JalaliHelper.php` (line 79)
  - `extensions/bidar-iran/tests/Unit/PersianCsvExporterTest.php`
  - `extensions/bidar-iran/tests/Unit/JalaliHelperTest.php`
- **Root Cause:**
  1. `PersianCsvExporter::protect()` lines 83-85 check `"\t"` and `"\r"` prefixes explicitly before `\p{Cf}` regex, but omit leading `"\n"` (unlike `BidarExportAction::sanitizeCsvCell()`). Wait: `\s` matches `\n`, EXCEPT if `"\n=1+1"` is passed where `\n` triggers `\s` match cleanly, whereas `"\nhello"` doesn't need escaping — wait: let's make sure BOTH `"\n=1+1"` AND raw `"\n..."` match `BidarExportAction` or guard `"\n="` cleanly! Specifically check `protect("\n=1+1")`: `/^[\s\p{Cf}]*[=+\-@;|]/u` DOES match `"\n=1+1"` (`'\\n=1+1'`). Wait — what about `protect("\nhello")`? Unlike `"\t"`/`"\r"`, `"\n"` inside multiline CSV cells shouldn't get prefixed with `'` unless followed by formula char OR to match `BidarExportAction`. Check `PersianCsvExporterTest` first! Wait: if `PersianCsvExporterTest` tests formula injection, let's check both `"\r=1"`, `"\n=1"`, `"\xE2\x80\x8B=1"`. And in `JalaliHelper::toGregorianDate()` line 79, Morilog's `CalendarUtils::convertNumbers($str, true)` already converts Arabic-Indic OR misses some variants (`PersianTextNormalizer::toEnglishDigits` handles both Persian `۰-۹` and Arabic-Indic `٠-٩` uniformly!).

### Step 1 — RED Test
1. In `JalaliHelperTest.php`, assert `JalaliHelper::toGregorianDate('١٤٠٥/٠١/٠١') === '2026-03-21'`.
2. In `PersianCsvExporterTest.php`, verify `"\n=1+1"`, `"\t=1+1"`, `"\r=1+1"`, and `"\u{200B}=1+1"` are all formula-escaped (`'`).
Run: `./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-iran/tests/Unit/JalaliHelperTest.php extensions/bidar-iran/tests/Unit/PersianCsvExporterTest.php` -> observe current behavior (RED if any case fails).

### Step 2 — Minimal Fix
1. In `extensions/bidar-iran/Support/JalaliHelper.php` line 79:
   ```php
   $clean = CalendarUtils::convertNumbers(PersianTextNormalizer::toEnglishDigits(trim($jalaliDate)), true);
   ```
2. In `extensions/bidar-iran/Support/PersianCsvExporter.php` lines 83-86: keep `"\t"`, `"\r"` and ensure `/^[\s\p{Cf}]*[=+\-@;|]/u` handles `"\n=..."` safely (do NOT blindly prefix non-formula multiline text starting with `\n` with `'` unless `PersianCsvExporterTest` requires it).

### Step 3 — Verify GREEN & Final Verification
Run full Section 2 verification:
`./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-iran/tests && ./vendor/bin/phpunit -c extensions/phpunit.xml --filter BidarExport`
Expected: `OK`, 0 failures, 0 warnings, 0 skipped. Confirm `extensions/bidar-iran/manifest.json` remains `"version": "1.0.4"`.

### Stop / Escalate If
- Any existing `JalaliHelperTest` or `PersianCsvExporterTest` assertion breaks under the change.
