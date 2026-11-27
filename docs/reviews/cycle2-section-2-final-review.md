# Cycle 2 Final Post-Implementation Code Review — Section 2 (`extensions/bidar-iran/`)

**Overall Verdict:** **APPROVED** (0 Blockers, 0 Majors, 0 Minors across both `agy-review` and `qoder-review`)  
**Manifest Version:** `1.0.4` (unchanged in [manifest.json](file:///Users/moeini/Dev/didar/extensions/bidar-iran/manifest.json))  
**Test Verification (PHP 8.5.11, PHPUnit 11.5.58):**
- `./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-iran/tests` → **`OK (113 tests, 503 assertions)`**
- `./vendor/bin/phpunit -c extensions/phpunit.xml --filter BidarExport` → **`OK (5 tests, 28 assertions)`**

---

## 1. Stage 4 Review Iteration & Resolved Final Catch

During the initial Stage 4 pass, `agy-review` identified 1 EspoCRM ORM Blocker and 2 Majors in `PostVoipWebhook` / `VoipLookupService` (plus 2 Minors), all of which were fixed and re-verified under TDD:
1. **ORM `limit()` Argument Order (`VOIP-02` / `VOIP-03`):** EspoCRM `RDBRepository::limit(?int $offset = null, ?int $limit = null)` takes `($offset, $limit)`. Updated `PostVoipWebhook::applyQueryParts()` to call `->limit(0, $limit)` (`limit(0, 1)` for `Contact`, `limit(0, 20)` for `PhoneNumber`, `EntityPhoneNumber`, and `Opportunity`).
2. **Secondary Phone Resolution:** Added `matchedPhone` propagation in `PostVoipWebhook` + `VoipLookupService::lookup()` (stripped before returning JSON) and corrected the secondary fallback to query `PhoneNumber` → `EntityPhoneNumber` (`entityType`, `entityId`, `phoneNumberId`).
3. **Partial Query Preservation:** Wrapped `select()`, `where()`, and `limit()` independently in `PostVoipWebhook::applyQueryParts()` so a `\TypeError` on `limit()` never drops prior `select()` or `where()` state.
4. **Blank Foreign IDs:** Normalized blank `contactId` / `opportunityId` to `null` in both `PostSendSms::process()` and `SmsCampaignService::sendCampaign()`.

---

## 2. `agy-review` Final Report (`APPROVED`)

- **Verdict:** `APPROVED`
- **Remaining Blockers:** None
- **Remaining Majors:** None
- **Remaining Minors:** None (two non-blocking observations noted: defensive trim inside `SmsCampaignService::sendSms()` directly and an unused `$captured = [];` variable in `SmsCampaignServiceTest.php:457`).
- **Verified Items:**
  - `RDBRepository::limit(0, 1)` / `limit(0, 20)` across all queries in [PostVoipWebhook.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Api/PostVoipWebhook.php#L77-L197)
  - Secondary phone matching (`matchedPhone`) & `PhoneNumber` / `EntityPhoneNumber` fallback in [PostVoipWebhook.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Api/PostVoipWebhook.php#L87-L147) and [VoipLookupService.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Services/VoipLookupService.php#L40-L56)
  - `applyQueryParts()` `\TypeError` preservation in [PostVoipWebhook.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Api/PostVoipWebhook.php#L168-L200)
  - Blank `contactId`/`opportunityId` normalization in [PostSendSms.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Api/PostSendSms.php#L98-L103) and [SmsCampaignService.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Services/SmsCampaignService.php#L190-L195)
  - Full unit test coverage (`113 tests, 503 assertions`).

---

## 3. `qoder-review` (`HungerG`) Final Report (`APPROVED`)

- **Verdict:** `APPROVED`
- **Remaining Blockers:** None
- **Remaining Majors:** None
- **Remaining Minors:** None
- **Verified Items:**
  - **`VOIP-01..05`:** Container DI `$em` resolution, `VoipLookupService` fail-closed empty-secret default, `stage!=` Opportunity filter with `contactId` scope, `applyQueryParts()` with `limit(0, 1)` / `limit(0, 20)`, `EntityPhoneNumber`/`PhoneNumber` secondary lookup with `matchedPhone`, `enabled` / `allowedIps` / HMAC-SHA256 + ±300s replay, body-only phone validation, empty `contactId` deal leak fix.
  - **`SMS-01..04` / `KavenegarSender`:** `PostSendSms` ACL checks (`BidarSmsMessage:create`, `BidarSmsTemplate:read`), recursive `stdClass` conversion & strict payload validation, `KavenegarSender` `enabled` check + JSON `return.status === 200` + key-scrubbed exceptions + `toLocalMobile()` + PHP 8.5-safe cURL (no `curl_close`), `SmsCampaignService` `isActive`, `$defaultVariables`, `providerMessageId`, `logError`.
  - **`JAL-01..03`:** Strictly anchored `parseGregorianInput()` preserving `+03:30`/`Z`/`-05:00` and rejecting invalid dates/times and trailing garbage across `toJalaliDate`, `toJalaliDateTime`, `diffForHumans` (with UTC fallback); `getJalaliQuarterRange()` throwing `\InvalidArgumentException`; catches narrowed to `\Exception`.
  - **`PHN-01..03` / `VAL-01..03`:** Landline `0[1-8]\d{9}` and double-prefix trunk `0` normalization, `toLocalMobile()`, control/bidi/garbage rejection; `IranValidators` NBSP/control-char handling, Sheba `02..98` + zero-BBAN check, postal code `'00000'` suffix rejection while preserving `BUG-08`.
  - **`CSV-01..03` / `TXT-01..02` / `META-01..03`:** Formula guard, associative header alignment, non-scalar/DateTime handling, RFC 4180 `escape: ''` compatible with `BidarExportAction`; Persian text/ZWNJ normalization & hook coverage; `password` integration fields, `BidarSmsMessage` indexes, `fa_IR` i18n, and `manifest.json` at `1.0.4`.
