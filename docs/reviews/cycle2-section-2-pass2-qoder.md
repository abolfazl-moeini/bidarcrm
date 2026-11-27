### Verdict: **Approve with Amendments**

`docs/reviews/cycle2-section-2-plan.md` accurately captures the major P0/P1 defects in [extensions/bidar-iran](file:///Users/moeini/Dev/didar/extensions/bidar-iran) (current baseline: `73 tests, 303 assertions` passing on PHP `8.5.11` under [extensions/phpunit.xml](file:///Users/moeini/Dev/didar/extensions/phpunit.xml)). A few adjustments are required before Stage 3 TDD execution to avoid breaking existing unit tests, EspoCRM 10.1 DI/ORM behavior, and CRM data imports.

---

### 1. Confirmed Blockers & Majors

- **P0 Blockers (All Confirmed):**
  - `VOIP-01`: [PostVoipWebhook.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Api/PostVoipWebhook.php#L40-L95) resolves `$em` from `$this->container` on lines 40–43 but checks/uses `$this->entityManager` on lines 69, 70, and 81.
  - `VOIP-02`: [PostVoipWebhook.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Api/PostVoipWebhook.php#L81-L85) queries `'stageProbability!=' => ['Closed Won', 'Closed Lost']` instead of `'stage!='`.
  - `VOIP-03`: [PostVoipWebhook.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Api/PostVoipWebhook.php#L70-L95) runs unfiltered `find()` on `Contact` and `Opportunity` and misses secondary numbers.
  - `SMS-01`: [PostSendSms.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Api/PostSendSms.php#L45-L99) has no EspoCRM `Acl` check (`BidarSmsMessage` `create` / `BidarSmsTemplate` `read`).
  - `SMS-02`: [PostSendSms.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Api/PostSendSms.php#L48-L96) only casts top-level `$body` via `(array)`, leaving nested `recipients` elements as `\stdClass` and causing a fatal `Cannot use object of type stdClass as array` in [SmsCampaignService.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Services/SmsCampaignService.php#L150-L152).
  - `JAL-01`: [JalaliHelper.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/JalaliHelper.php#L43-L50) strips offsets via `substr($gregorianDate, 0, 19)` and [BidarIranAuditTest.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/tests/Unit/BidarIranAuditTest.php#L29-L32) asserts the buggy `'1405/09/02'` for `'2026-11-22T23:30:00+03:30'` (should be `'1405/09/01'`).
- **P1 Majors (Confirmed):**
  - `JAL-02` / `JAL-03`: `toJalaliDateTime` and `diffForHumans` omit `UTC` fallback and `checkdate()`; `getJalaliQuarterRange` clamps invalid quarters instead of throwing `\InvalidArgumentException`.
  - `PHN-01` / `PHN-02` / `PHN-03`: Landlines (`0[1-8]\d{9}`), double-prefix trunk `0` (`+9809...`), and Unicode control/garbage rejection, paired with `toLocalMobile()` for [KavenegarSender.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Sms/KavenegarSender.php#L66).
  - `CSV-01` / `CSV-02` / `CSV-03`: Zero-width/tab/delimiter formula bypasses, associative `$headers` alignment, non-scalar cell crashes, datetime truncation in `$dateColumns` (directly affecting [BidarExportAction.php](file:///Users/moeini/Dev/didar/extensions/bidar-sales/Api/BidarExportAction.php#L117-L196)), and RFC 4180 `$escape = ''` in `fputcsv`.
  - `VOIP-04` / `VOIP-05`: Empty `contactId` leak in [VoipLookupService.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Services/VoipLookupService.php#L59-L64), missing `enabled` check, array `phone` crash, and optional HMAC/timestamp replay protection.
  - `SMS-03` / `SMS-04`: Empty/HTML HTTP 200 false success, unmasked `$e` in `$previous` exception chain, `curl_close()` deprecation in PHP 8.5, `isActive` check, and `$defaultVariables` overwrite in `sendCampaign()`.
  - `TXT-01` / `TXT-02`: Single NBSP/bidi/tashkeel cleanup, `BidarSmsTemplate` / `iranCity` coverage, removing `accountName`, and dirty-tracking guard (`$normalized !== $val`).
  - `META-01`: Using `"type": "password"` for secrets in [BidarVoip.json](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Resources/metadata/integrations/BidarVoip.json) and [Kavenegar.json](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Resources/metadata/integrations/Kavenegar.json) matches EspoCRM 10.1 core conventions (confirmed in [GoogleReCaptcha.json](file:///Users/moeini/Dev/didar/engine/application/Espo/Resources/metadata/integrations/GoogleReCaptcha.json#L8-L11)).

---

### 2. False Positives & Risks in the Plan (Safe Adjustments)

1. **`META-02` — `BeforeSave` Strict Rejection on `Account.nationalId` / `Contact.nationalCode` (High Breaking Risk):**
   - **Risk:** Adding a `BeforeSave` hook that throws on invalid `nationalCode` / `nationalId` will break legacy CRM imports, partial record saves, and tests that use placeholder IDs (neither field is `required` in [Account.json](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Resources/metadata/entityDefs/Account.json#L3-L6) or [Contact.json](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Resources/metadata/entityDefs/Contact.json#L3-L6)).
   - **Adjustment:** In `BeforeSave`, **normalize only** (convert Persian/Arabic digits to English and strip spaces/hyphens when non-empty) so formatted inputs like `"008-4575948"` fit `maxLength`, and keep `IranValidators` as an explicit validator rather than a hard save blocker.

2. **`SMS-04` — `providerMessageId` Logging Breaks `SmsCampaignServiceTest` Mock Expectations:**
   - **Risk:** [SmsCampaignServiceTest.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/tests/Unit/SmsCampaignServiceTest.php#L113-L128) asserts `$smsEntity->expects($this->exactly(5))->method('set')` on success (and `exactly(3)` on failure at [line 154](file:///Users/moeini/Dev/didar/extensions/bidar-iran/tests/Unit/SmsCampaignServiceTest.php#L154)). Unconditionally calling `$smsRecord->set('providerMessageId', ...)` will fail that test.
   - **Adjustment:** Keep `sendDirect(): bool` unchanged for existing callers/mocks, and only call `$smsRecord->set('providerMessageId', ...)` when a non-empty provider message ID is actually returned (e.g. via an optional `sendDirectWithMeta()` or last-message-id getter when `sendDirect()` isn't mocked).

3. **`META-03` — Removing `contactId` / `opportunityId` from `BidarSmsMessage.json`:**
   - **Risk:** [SmsCampaignServiceTest.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/tests/Unit/SmsCampaignServiceTest.php#L62-L63) explicitly asserts `arrayHasKey('contactId', $msgFields)` and `arrayHasKey('opportunityId', $msgFields)`.
   - **Adjustment:** Keep `contactId` and `opportunityId` in [BidarSmsMessage.json](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Resources/metadata/entityDefs/BidarSmsMessage.json#L19-L32) and only add `"index": true` to `phoneNumber` and `status`.

4. **`TXT-01` — `ۀ` (`\u{06C0}`) Normalization Policy:**
   - **Risk:** Converting `\u{06C0}` to `هٔ` (`\u{0647}\u{0654}`) breaks [PersianTextNormalizerTest.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/tests/Unit/PersianTextNormalizerTest.php#L40) (`'خانه بزرگ'`).
   - **Adjustment:** Keep `\u{06C0}` → `ه` as currently tested; it is also better for CRM search/deduplication where users omit hamza.

5. **`VAL-03` — Postal Code Last-5-Digit Check:**
   - **Risk:** Rejecting *all* identical last-5-digit suffixes (e.g., `1485622222`) can cause false positives on valid building/unit suffixes, whereas `'00000'` suffix (`1000000000`) and `< 2` unique digits overall are definitively invalid.
   - **Adjustment:** Reject `'00000'` suffix and `< 2` unique digits in `isValidPostalCode()`, preserving `BUG-08`.

6. **`VAL-01` — `\p{C}` Rejection vs `\u{200C}` (ZWNJ) Stripping:**
   - **Adjustment:** `\u{200C}` falls under Unicode `\p{Cf}` (`\p{C}`). Explicitly exclude `\u{200C}` from the control-character rejection regex if `normalizeValidatorInput()` strips ZWNJ.

7. **Backward Compatibility with `apps/web` (`SmsModal.tsx` & `SettingsPage.tsx`) and `VoipWebhookServiceTest`:**
   - [SmsModal.tsx](file:///Users/moeini/Dev/didar/apps/web/src/components/common/SmsModal.tsx#L127-L132) sends `{ phone, recipient, message, templateId }` (where `message` is already populated). Ensure `PostSendSms` only requires `BidarSmsTemplate` read ACL when `templateId` is non-empty (already safe since `SmsModal` fetches `/BidarSmsTemplate`) and only fetches `getTemplateBody($templateId)` when `$message === ''`.
   - [VoipWebhookServiceTest.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/tests/Unit/VoipWebhookServiceTest.php#L90-L105) sends only `X-Bidar-Voip-Secret` without `getBodyContents()` stubbed. Keep HMAC/timestamp verification opt-in (required only when `hmacSecret` is configured or `X-Bidar-Voip-Signature` / `X-Bidar-Voip-Timestamp` headers are sent).

---

### 3. Missed Bugs / Edge Cases

1. **`VoipLookupService` / `PostVoipWebhook` EspoCRM `InjectableFactory` DI Failure (Blocker):**
   - [PostVoipWebhook::__construct](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Api/PostVoipWebhook.php#L22-L26) has `?VoipLookupService $service = null` as its first parameter, and [VoipLookupService::__construct](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Services/VoipLookupService.php#L13-L16) requires `string $webhookSecret` with **no default**. In EspoCRM `InjectableFactory`, autowiring `PostVoipWebhook` will attempt to instantiate `VoipLookupService` and fail on the missing `$webhookSecret`.
   - **Fix:** Give `VoipLookupService::__construct(string $webhookSecret = '', ...)` a default empty string (or inject `EntityManager`/`Container` first and instantiate `VoipLookupService` internally).
2. **`PostVoipWebhook` Mocked `EntityManager` / `RDBRepository` Testability:**
   - Chaining `->select([...])->where([...])->limit(1)->find()` on `RDBRepository` in `PostVoipWebhook` must be paired with fluent `returnSelf()` mocks in unit tests (or guarded if a mock repository returns `null` on unstubbed `select()`/`limit()`).
3. **`JalaliHelper` `24:00:00` / Invalid Time & Date-Only in `toJalaliDateTime`:**
   - Strict datetime regex must bound `H` to `00–23`, `i` to `00–59`, `s` to `00–59` (rejecting `24:00:00` / `25:00:00`), and `toJalaliDateTime` / `diffForHumans` should handle date-only `Y-m-d` inputs consistently in `$tzObj`.
4. **`IranPhoneNormalizer` Unintended 10-Digit Landline Match:**
   - If the regex uses `^(?:\+98|0098|98)?0?(9\d{9}|[1-8]\d{9})$`, 10-digit numbers without `0` or `+98` (e.g., `2188776655` or a 10-digit postal code) will match as landlines. Require `0` when no country code is present for landlines (`^(?:(?:\+98|0098|98)0?|0)([1-8]\d{9}|9\d{9})$`, or keep bare `9\d{9}` only for mobile if needed).
5. **`KavenegarSender` Constructor Parameter Order:**
   - Do **not** reorder `KavenegarSender::__construct(?string $apiKey, ?string $senderLine, ?Closure $httpClient, ...)` because [KavenegarSenderTest.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/tests/Unit/KavenegarSenderTest.php#L55) passes `$fakeHttp` as the 3rd positional argument.
6. **`SmsCampaignService::getTemplateBody()` `isActive` Mock Compatibility:**
   - Check `$template->get('isActive') === false` (strict `false`) rather than `!(bool) $template->get('isActive')` so unit-test mocks that don't stub `isActive` (returning `null`) don't unexpectedly fail.

---

### 4. Additional Required TDD Test Cases

- `JalaliHelperTest`:
  - Reject `24:00:00` and `2026-11-22 25:00:00` (`''`).
  - Single-digit month/day with time and offset (`'2026-1-5T23:30:00+03:30'` → `'1404/10/15'`).
  - `toJalaliDateTime('2026-11-22')` date-only input in `Asia/Tehran` → `'1405/09/01 00:00'`.
- `IranPhoneNormalizerTest`:
  - Reject 10-digit non-mobile without leading `0` or country code (e.g. `'2188776655'` → `null`) and short service numbers (`'110'`, `'1500'` → `null`).
- `IranValidatorsTest`:
  - `isValidPostalCode('1485622222')` → `true` (valid non-zero suffix) vs `'1000000000'` → `false`.
- `PersianCsvExporterTest`:
  - `BidarExportAction` contract: `list<string>` headers + `list<list<mixed>>` rows with mixed date (`'2026-11-22'`) and datetime (`'2026-11-22 14:30:00'`) in `$dateColumns`, verifying `'1405/09/01'` and `'1405/09/01 18:00'` and `escape: ''` (no `\"` artifacts, no PHP 8.5 warnings).
  - Verify `"'=1+1"` (already neutralized) is not double-prefixed.
- `VoipWebhookServiceTest`:
  - `InjectableFactory` / `new VoipLookupService()` with default empty secret (fails closed on `authenticate()`).
  - `PostVoipWebhook` with mocked `Container` + `EntityManager` verifying `select`/`where`/`limit` on `Contact` and `'stage!=' => ['Closed Won', 'Closed Lost']` on `Opportunity`, plus short/non-Iranian caller ID `'101'` returning `200` with `found: false`.
- `PostSendSms` / `SmsCampaignServiceTest`:
  - `Acl` denial (`Forbidden`) when `$acl->check('BidarSmsMessage', 'create')` returns `false`, and when `templateId` is provided without `BidarSmsTemplate` `read`.
  - Real `stdClass` nested `recipients` (`[(object) ['phone' => '09121110000', 'contactName' => 'علی']]`) and `variables` (`(object) ['accountName' => 'بیدار']`).
  - `getTemplateBody()` returns `null` when `isActive === false`.
