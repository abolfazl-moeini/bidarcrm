# Cycle 2 Remediation Plan — Section 2 (`extensions/bidar-iran/`)

**Status:** Finalized (Post-Pass 1 `agy-review` + Pass 2 `qoder-review` Audit)  
**Scope:** Strictly `extensions/bidar-iran/` (leave `manifest.json` version at `1.0.4`)  
**Verification Gate:** `./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-iran/tests` (strict TDD: Red → Green)

---

## 1. Finalized Findings & Remediation Specifications

### P0 — Blockers

1. **`VOIP-01` — `PostVoipWebhook` Container DI Bug & `InjectableFactory` Autowiring**
   - **Files:** `extensions/bidar-iran/Api/PostVoipWebhook.php:22-95`, `extensions/bidar-iran/Services/VoipLookupService.php:13-16`
   - **Defects:**
     - `PostVoipWebhook::process()` resolves `$em` from `$this->container->get('entityManager')` when `$this->entityManager === null`, but lines 69, 70, and 81 check and dereference `$this->entityManager` instead of `$em`.
     - `VoipLookupService::__construct(string $webhookSecret, ...)` has a required scalar parameter with no default, while `PostVoipWebhook::__construct(?VoipLookupService $service = null, ...)` puts `$service` first (risking `InjectableFactory` issues if bound/resolved).
   - **Fix:**
     - Give `VoipLookupService::__construct(string $webhookSecret = '', ?IranPhoneNormalizer $normalizer = null)` a safe empty default (failing closed on `authenticate()`).
     - In `PostVoipWebhook`, consistently use `$em` resolved via `resolveEntityManager()` for integration loading, Contact lookup, and Opportunity lookup.

2. **`VOIP-02` — `PostVoipWebhook` Opportunity Query Uses Wrong Field (`stageProbability!=` vs `stage!=`)**
   - **File:** `extensions/bidar-iran/Api/PostVoipWebhook.php:81-85`
   - **Defect:** Queries `'stageProbability!=' => ['Closed Won', 'Closed Lost']`. `stageProbability` is numeric (`0..100`), whereas `'Closed Won'` and `'Closed Lost'` belong to `stage`.
   - **Fix:** Query `'stage!=' => ['Closed Won', 'Closed Lost']` scoped by `'contactId' => $matchedContactId` and `limit(20)`.

3. **`VOIP-03` — `PostVoipWebhook` Full-Table Scan of `Contact` & `Opportunity` + Missed Secondary Phones**
   - **File:** `extensions/bidar-iran/Api/PostVoipWebhook.php:70-95`
   - **Defect:** Unfiltered `find()` loads the entire `Contact` and `Opportunity` tables into memory on every webhook call, and only checks primary `phoneNumber`.
   - **Fix:**
     - Build phone lookup candidates (`toE164`, `toLocal`, trimmed raw) via `IranPhoneNormalizer`.
     - Query `Contact` at SQL level using `select(['id', 'name', 'phoneNumber', 'accountId', 'accountName'])`, `where(['phoneNumber' => $candidates])`, `limit(1)` (guarding mocked repositories where fluent `select()`/`limit()` might return `null` by falling back safely). Also check `PhoneNumber` / `entity_phone_number` if primary lookup misses and `PhoneNumber` repository exists in `$em`.
     - Query `Opportunity` only after a contact match, filtered by `['contactId' => $matchedContactId, 'stage!=' => ['Closed Won', 'Closed Lost']]` with `select(['id', 'name', 'amount', 'amountConverted', 'stage', 'contactId'])` and `limit(20)`.

4. **`SMS-01` — `PostSendSms` Missing EspoCRM ACL Check**
   - **File:** `extensions/bidar-iran/Api/PostSendSms.php:22-99`
   - **Defect:** Authenticated users without permission can send paid SMS campaigns via `POST /BidarSms/send`.
   - **Fix:** Inject optional `?Acl $acl = null` at the end of `PostSendSms::__construct(...)` (also resolving from `$this->container->get('acl')` if null). When `$acl !== null`, enforce `$acl->check('BidarSmsMessage', 'create')` (else `Forbidden`) and, if `templateId !== ''`, enforce `$acl->check('BidarSmsTemplate', 'read')` (else `Forbidden`).

5. **`SMS-02` — `PostSendSms` Fatal Error on JSON `stdClass` Payloads & Weak Validation**
   - **Files:** `extensions/bidar-iran/Api/PostSendSms.php:48-96`, `extensions/bidar-iran/Services/SmsCampaignService.php:150-178`
   - **Defect:** EspoCRM `Request::getParsedBody()` decodes JSON objects into nested `\stdClass` instances. `(array) $request->getParsedBody()` leaves `recipients` items and `variables` as `\stdClass`, causing a fatal `Error: Cannot use object of type stdClass as array` in `sendCampaign()`. Non-string scalar fields or invalid `variables`/`recipients` shapes are silently cast.
   - **Fix:**
     - Recursively convert `\stdClass` structures in `PostSendSms` (and normalize `array|object` elements defensively in `SmsCampaignService::sendCampaign()`).
     - Validate `variables` (if present and non-null) is an object/associative array (else `BadRequest`).
     - Validate `recipients` (if present and non-null) is a list/array of objects/arrays (reject non-array/scalar `recipients` or explicit empty `recipients` without single phone appropriately; reject non-array/object items inside `recipients` with `BadRequest`).
     - Validate `templateId`, `phone`/`phoneNumber`/`recipient`, `contactId`, `opportunityId` are strings (or null) when present (else `BadRequest`).
     - When `templateId !== ''` and `$message === ''`, throw `BadRequest` with explicit message if template is missing or inactive.

6. **`JAL-01` — `JalaliHelper::toJalaliDate` Corrupts Explicit Timezone Offsets & Faulty Audit Test**
   - **Files:** `extensions/bidar-iran/Support/JalaliHelper.php:31-51`, `extensions/bidar-iran/tests/Unit/BidarIranAuditTest.php:29-32`
   - **Defect:** `substr($gregorianDate, 0, 19)` strips explicit offsets (`+03:30`, `Z`, `-05:00`) and fractional seconds, then forces `UTC` before shifting to `$tzObj` (`Asia/Tehran`), double-applying `+03:30`. Also `strlen > 10` breaks single-digit month/day datetimes (`'2026-1-5T23:30:00+03:30'`) and ignores trailing garbage. `BidarIranAuditTest::testExplicitOffsetIsHonored` asserts `'1405/09/02'` (buggy) instead of `'1405/09/01'`.
   - **Fix:** Implement unified anchored parser `parseGregorianInput(string $value, \DateTimeZone $targetTz)`:
     - Date-only `^(\d{4})-(\d{1,2})-(\d{1,2})$` → validate `checkdate()`, construct in `$targetTz` at `00:00:00`.
     - DateTime `^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?$` → validate `checkdate()`, `H <= 23`, `i <= 59`, `s <= 59` (rejecting `24:00:00`), construct `new \DateTimeImmutable($value, new \DateTimeZone('UTC'))` (honoring embedded offset/`Z`, defaulting naive DB timestamps to `UTC`), and `setTimezone($targetTz)`.
     - Update `BidarIranAuditTest::testExplicitOffsetIsHonored` to assert `'1405/09/01'` for `'2026-11-22T23:30:00+03:30'` and `'1405/09/02'` for `'2026-11-22T22:00:00-05:00'`.

---

### P1 — Majors

7. **`JAL-02` & `JAL-03` — `toJalaliDateTime`, `diffForHumans`, and `getJalaliQuarterRange`**
   - **File:** `extensions/bidar-iran/Support/JalaliHelper.php:60-86, 207, 222-243`
   - **Fixes:**
     - Route `toJalaliDateTime` and `diffForHumans` through `parseGregorianInput()` so naive DB timestamps default to `UTC`, date-only strings resolve in `$tzObj`, and invalid calendar dates/times (`2026-02-30`, `24:00:00`, `'now'`) return `''`.
     - In `getJalaliQuarterRange`, throw `\InvalidArgumentException` if `$quarter < 1 || $quarter > 4`.
     - Narrow `catch` blocks to `\Exception` (avoiding swallowing `\Error`), keeping invalid `$tz` safe fallback to `Asia/Tehran` where expected.

8. **`PHN-01` & `PHN-02` & `PHN-03` — `IranPhoneNormalizer` Landlines, Trunk Zero, Control/Garbage Rejection**
   - **File:** `extensions/bidar-iran/Support/IranPhoneNormalizer.php:19-46`
   - **Fixes:**
     - Reject `/\p{C}/u` (ASCII + Unicode control/bidi format chars) and reject any char outside `[0-9۰-۹٠-٩+\-\s().]` (with `+` allowed only at start after trimming).
     - Normalize mobile (`^(?:(?:\+98|0098|98)0?|0)?(9\d{9})$` → `'0' . $m[1]`) and Iranian geographic landlines (`^(?:(?:\+98|0098|98)0?|0)([1-8]\d{9})$` → `'0' . $m[1]`), rejecting bare 10-digit non-mobile numbers like `'2188776655'` and short service codes like `'110'`/`'1500'`.
     - Add `toLocalMobile(string $phone): ?string` (returns `09\d{9}` only, `null` for landlines) and use it in `KavenegarSender`.

9. **`VAL-01` & `VAL-02` & `VAL-03` — `IranValidators` Edge Cases**
   - **File:** `extensions/bidar-iran/Support/IranValidators.php:9-100`
   - **Fixes:**
     - Reject control/format chars `/[\x00-\x1F\x7F\p{Cc}\p{Cf}]/u` excluding `\u{200C}`, then strip `[ \-\x{00A0}\x{200C}]+/u`.
     - In `isValidSheba`: enforce `2 <= (int) $checkDigits <= 98` (ISO 7064) and reject all-zero bank code (`substr($iban, 4, 3) === '000'`) / all-zero BBAN.
     - In `isValidPostalCode`: preserve `BUG-08` (`0`/`2` in positions 2..5), reject `'00000'` trailing 5 digits (`1000000000`) and `< 2` unique digits across all 10 digits, while keeping valid unit suffixes like `'1485622222'`.

10. **`CSV-01` & `CSV-02` & `CSV-03` — `PersianCsvExporter` Injection, Alignment, Non-Scalars, Datetimes**
    - **File:** `extensions/bidar-iran/Support/PersianCsvExporter.php:9-91`
    - **Fixes:**
      - Formula guard: do not double-prefix cells already starting with `'`; prefix `'` if cell starts with `\t` or `\r` directly, or matches `/^[\s\p{Cf}]*[=+\-@;|]/u`. Remove dead `FORMULA_PREFIXES`.
      - Header/row alignment:
        - If `$headers` is associative (`!array_is_list($headers)`), use header labels in CSV header row and map each row by `$row[$hKey]` -> `$row[$hLabel]` -> `$row[$colIndex]` -> `''`.
        - If `$headers` is a list, match `$row` keys only when `$row` is associative and shares keys with `$headers` (without dropping values unexpectedly), otherwise align positionally padded/truncated cleanly or preserve list rows.
      - Safely stringify `bool` (`'true'`/`'false'`), `array` (recursive `implode(', ', ...)` or JSON), `\DateTimeInterface`, `\Stringable`, and scalars.
      - Date columns: if string has time part (`strlen > 10` or matches time), use `JalaliHelper::toJalaliDateTime`, otherwise `JalaliHelper::toJalaliDate`; if Jalali conversion returns `''`, preserve original `$val` string (don't erase `'N/A'`).
      - Pass `escape: ''` to `fputcsv` (RFC 4180, PHP 8.5 clean). Keep full compatibility with `BidarExportAction`.

11. **`VOIP-04` & `VOIP-05` — `VoipLookupService` Empty `contactId` Leak & Webhook Hardening**
    - **Files:** `extensions/bidar-iran/Services/VoipLookupService.php:20-72`, `extensions/bidar-iran/Api/PostVoipWebhook.php:45-99`, `extensions/bidar-iran/Resources/metadata/integrations/BidarVoip.json`
    - **Fixes:**
      - In `VoipLookupService::lookup()`: require `is_string($contactId) && $contactId !== ''` (or non-empty scalar string) before matching deals; return `normalizedPhone: $normalized` (`null` if unnormalizable) on `found: false`.
      - In `PostVoipWebhook::process()`:
        - Check `$integration->get('enabled') !== false` when Integration entity is loaded (if `false`, throw `Forbidden`).
        - Support opt-in HMAC-SHA256 + timestamp replay verification (`X-Bidar-Voip-Timestamp` within ±300s + `X-Bidar-Voip-Signature` HMAC-SHA256 over `"{$timestamp}.{$rawBody}"`): required if `hmacSecret` is configured on Integration, and validated whenever signature/timestamp headers are present, while preserving `X-Bidar-Voip-Secret` / `X-Voip-Token` backward compatibility for `VoipWebhookServiceTest`.
        - Check `allowedIps` when configured on `BidarVoip` Integration.
        - Read caller phone strictly from parsed body (`phone`, `caller`, `caller_id`), remove query-param `phone` leakage, validate `is_string($rawPhone)` and length <= 32 (throw `BadRequest` on non-string or missing/oversized).

12. **`SMS-03` — `KavenegarSender` JSON Validation, Key Scrubbing, `enabled`, PHP 8.5 cURL**
    - **File:** `extensions/bidar-iran/Sms/KavenegarSender.php:25-133`
    - **Fixes:**
      - Preserve constructor parameter order (`?string $apiKey, ?string $senderLine, ?Closure $httpClient, ?IranPhoneNormalizer $normalizer, ?EntityManager $entityManager`).
      - Check `$integration->get('enabled') !== false` when loading Integration `'Kavenegar'` (if disabled, clear `$apiKey` or mark disabled and throw `RuntimeException`).
      - Validate non-empty trimmed `$message` and mobile receptor via `$this->normalizer->toLocalMobile($phone)`.
      - Omit `'sender'` from `$params` when `$this->senderLine` is null or `''`.
      - Require valid JSON object (`json_decode($rawBody, true, 512, JSON_THROW_ON_ERROR)`) with `isset($decoded['return']['status']) && (int) $decoded['return']['status'] === 200`. Store `$lastProviderMessageId` from `entries[0]['messageid']` if present.
      - Never attach an unmasked exception containing `$this->apiKey` as `$previous` (create a sanitized `RuntimeException` with `$this->apiKey` masked as `***` instead of leaking `$e` in `$previous`).
      - In `defaultHttpClient()`: check `curl_init($url) === false`, set `CURLOPT_CONNECTTIMEOUT => 5` & `CURLOPT_PROTOCOLS => CURLPROTO_HTTPS`, and remove deprecated `curl_close($ch)` (PHP 8.5).

13. **`SMS-04` — `SmsCampaignService` `isActive`, `$defaultVariables`, Normalization, Persistence**
    - **File:** `extensions/bidar-iran/Services/SmsCampaignService.php:34-195`
    - **Fixes:**
      - `getTemplateBody()`: return `null` if `$template->get('isActive') === false` or trimmed body is `''`.
      - `renderTemplate()`: ignore empty keys and non-scalar/non-`Stringable` values instead of crashing.
      - `sendCampaign()`: accept `array|object` items (converting `stdClass`), validate phone is string/missing, and only override `contactName`, `accountName`, `dealName` over `$defaultVariables` when present and non-empty in `$recipient`.
      - `sendSms()`: normalize `$phoneNumber` via `IranPhoneNormalizer::toLocal()` when valid (else trimmed & capped to 32 chars for logging), capture `providerMessageId` only when non-empty (keeping `SmsCampaignServiceTest` mock `exactly(5)`/`exactly(3)` intact!), and return `logError` if `saveEntity` throws (still returning dispatch outcome).

14. **`TXT-01` & `TXT-02` — `PersianTextNormalizer` & `NormalizePersianInput`**
    - **Files:** `extensions/bidar-iran/Support/PersianTextNormalizer.php:25-49`, `extensions/bidar-iran/Hooks/Common/NormalizePersianInput.php:17-34`
    - **Fixes:**
      - `PersianTextNormalizer`: guard `@iconv` with `mb_scrub` fallback; keep `\u{06C0}` → `ه` (matching `PersianTextNormalizerTest`); normalize `ة` (`\u{0629}`) → `ه`? Wait: keep Arabic Yeh/Keheh/Heh-Yeh/Tatweel rules and strip `\u{FEFF}`, `\u{200B}`, bidi markers (`\u{200E}-\u{200F}`, `\u{202A}-\u{202E}`, `\u{2066}-\u{2069}`), tashkeel (`\u{064B}-\u{0652}`, `\u{0670}`), collapse `\u{200C}{2,}` → `\u{200C}` (strip `\u{200C}` at word/space boundaries while keeping inside `می‌شود`), and collapse `[\p{Zs}\t]+` (including single `\u{00A0}`) to `' '`.
      - `NormalizePersianInput`: add `BidarSmsTemplate` to `ALLOWED_ENTITIES`, add `iranCity`, `body`, `title`, `subject` to `TEXT_FIELDS`, remove read-only `accountName`, only call `$entity->set()` when `$normalized !== $val`, and add safe digit/whitespace normalization for `Account.nationalId` and `Contact.nationalCode` without rejecting legacy saves.

### P2 — Minors & Metadata

15. **`META-01` & `META-03` — Metadata Credentials, Indexes, & `fa_IR` Translations**
    - **Files:** `Resources/metadata/integrations/BidarVoip.json`, `Kavenegar.json`, `Resources/metadata/entityDefs/BidarSmsMessage.json`, `Resources/i18n/fa_IR/Global.json`, `Resources/i18n/fa_IR/Integration.json`
    - **Fixes:**
      - Change `webhookSecret` (`BidarVoip.json`) and `apiKey` (`Kavenegar.json`) `"type"` to `"password"`; add optional `hmacSecret` (`password`) and `allowedIps` (`varchar`) to `BidarVoip.json`.
      - Keep `contactId` and `opportunityId` in `BidarSmsMessage.json` (required by `SmsCampaignServiceTest`), and add `"index": true` to `phoneNumber` and `status`.
      - Add `BidarSmsTemplate` and `BidarSmsMessage` to `Global.json` (`scopeNames` / `scopeNamesPlural`), and create `Resources/i18n/fa_IR/Integration.json`.
