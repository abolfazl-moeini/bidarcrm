# Cycle 2 Pass 1 Code Review: extensions/bidar-iran/

Conducted an exhaustive, read-only Pass 1 Principal/L8 code review across all 44 source, metadata, i18n, and unit-test files in [extensions/bidar-iran](file:///Users/moeini/Dev/didar/extensions/bidar-iran).

**Executive Summary:** While unit tests cover several happy paths, the extension currently has **multiple production-breaking EspoCRM integration defects, security gaps, and data-corruption bugs**:
- `POST /BidarVoip/webhook` has a broken container DI fallback (`$this->entityManager` instead of `$em`), queries the wrong Opportunity column (`stageProbability!=` vs `stage!=`), loads the entire `Contact` and `Opportunity` tables into memory on every call, fails to match landlines, and leaks unlinked deals when `contactId` is empty.
- `POST /BidarSms/send` lacks any EspoCRM ACL check (allowing any authenticated user to burn SMS credits) and will throw a fatal `Error: Cannot use object of type stdClass as array` on real JSON campaign payloads because `Request::getParsedBody()` decodes JSON objects into `stdClass`.
- `JalaliHelper::toJalaliDate` corrupts explicit timezone offsets (and `BidarIranAuditTest::testExplicitOffsetIsHonored` asserts the wrong date), while `toJalaliDateTime` and `diffForHumans` omit UTC fallback and calendar validation.
- `KavenegarSender` silently reports success on HTTP 200 non-JSON/empty responses and retains unmasked API keys in wrapped exception chains.

---

## 1. Jalali Date/Time & Leap Years

### `JAL-01` (`Blocker`) — `toJalaliDate` truncates explicit timezone offsets and shifts dates by a day; test suite asserts the buggy date
- **Location:** [JalaliHelper.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/JalaliHelper.php#L43-L50), [BidarIranAuditTest.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/tests/Unit/BidarIranAuditTest.php#L29-L32)
- **Root Cause:** `substr($gregorianDate, 0, 19)` strips trailing timezone designators (`Z`, `+03:30`, `-05:00`) and fractional seconds (`.123456Z`), then forces `new \DateTimeZone('UTC')` before converting to `$tzObj` (`Asia/Tehran`). For inputs already carrying `+03:30`, the offset is applied twice.
- **Failing Scenario:** `JalaliHelper::toJalaliDate('2026-11-22T23:30:00+03:30')` represents `2026-11-22 20:00:00 UTC` = `2026-11-22 23:30:00 Asia/Tehran` = **`1405/09/01`**. Truncating `+03:30` turns it into `2026-11-23 03:00:00 Asia/Tehran` = **`1405/09/02`**. `BidarIranAuditTest::testExplicitOffsetIsHonored` explicitly asserts `'1405/09/02'`, locking in the bug. Also `'2026-11-22T23:30:00.123-05:00'` loses both fractional seconds and `-05:00`.
- **Fix:** Parse date-only strings (`^\d{4}-\d{1,2}-\d{1,2}$`) directly in `$tzObj`, and parse datetime strings with `new \DateTimeImmutable($gregorianDate, new \DateTimeZone('UTC'))` (without `substr`) so PHP honors embedded offsets (`Z`, `+03:30`, `-05:00`) while still defaulting offset-less EspoCRM UTC timestamps to `'UTC'`. Update `BidarIranAuditTest::testExplicitOffsetIsHonored` to assert `'1405/09/01'`.

### `JAL-02` (`Major`) — `toJalaliDateTime` and `diffForHumans` omit `'UTC'` fallback and silently roll over invalid calendar dates
- **Location:** [JalaliHelper.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/JalaliHelper.php#L60-L86), [JalaliHelper.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/JalaliHelper.php#L222-L243), [JalaliHelperTest.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/tests/Unit/JalaliHelperTest.php#L43-L50)
- **Root Cause:**
  1. Both methods call `new \DateTimeImmutable($gregorianDateTime)` without a second `new \DateTimeZone('UTC')` argument. When PHP's `date_default_timezone_get()` is non-UTC (e.g. `Asia/Tehran` or `America/Los_Angeles`), naive EspoCRM DB timestamps (`'2026-11-22 12:00:00'`) are interpreted in server local time and then shifted again to `$tzObj`. (`JalaliHelperTest::testToJalaliDateTimeConvertsCorrectly` masked this by passing `'UTC'` as `$tz`).
  2. Neither method validates `checkdate()` or rejects relative keywords (`'now'`, `'tomorrow'`). PHP's `DateTimeImmutable` silently rolls over `'2026-02-30 12:00:00'` to `'2026-03-02 12:00:00'`.
- **Failing Scenario:** With `date_default_timezone_set('Asia/Tehran')`, `JalaliHelper::toJalaliDateTime('2026-11-22 12:00:00', 'Y/m/d H:i', 'Asia/Tehran')` returns `'1405/09/01 12:00'` instead of `'1405/09/01 15:30'`. Calling `toJalaliDateTime('2026-02-30 12:00:00')` returns `'1404/12/11 15:30'` instead of `''`.
- **Fix:** Extract a shared private helper `parseGregorianDateTime(string $value, \DateTimeZone $targetTz, bool $dateOnlyDefaultsToTargetTz)` that enforces a strict `Y-m-d` / `Y-m-d[T ]H:i(:s)(.u)?(Z|[+-]\d{2}:?\d{2})?` pattern, calls `checkdate()`, and passes `new \DateTimeZone('UTC')` for datetimes.

### `JAL-03` (`Major`) — `getJalaliQuarterRange` silently clamps out-of-range quarters
- **Location:** [JalaliHelper.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/JalaliHelper.php#L207)
- **Root Cause:** `$q = max(1, min(4, $quarter));` coerces `0`, `-5`, or `99` into Q1 or Q4 instead of failing loudly, inconsistent with `getJalaliMonthRange` (lines 140-145) which throws `\InvalidArgumentException`.
- **Failing Scenario:** `JalaliHelper::getJalaliQuarterRange(0, 1405)` or `getJalaliQuarterRange(5, 1405)` silently returns Q1 or Q4 date ranges, corrupting financial/CRM reports.
- **Fix:** Guard `if ($quarter < 1 || $quarter > 4) { throw new \InvalidArgumentException(...); }`.

### `JAL-04` (`Minor`) — Broad `catch (\Throwable)` masks programming errors and invalid timezone strings; 33-year vs astronomical leap-year & historical DST considerations
- **Location:** [JalaliHelper.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/JalaliHelper.php#L22-L26), [JalaliHelper.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/JalaliHelper.php#L55-L57), [JalaliHelper.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/JalaliHelper.php#L112), [JalaliHelper.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/JalaliHelper.php#L147)
- **Root Cause:**
  1. `catch (\Throwable)` in `toJalaliDate`, `toJalaliDateTime`, `toGregorianDate`, `diffForHumans` swallows `\Error` (e.g., `TypeError`, missing autoloaded `Morilog\Jalali` class) and invalid `$tz` names (e.g. `'Tehran'` silently becomes `'Asia/Tehran'`).
  2. `morilog/jalali` ^3.5 uses the 33-year algorithmic cycle (`$y % 33` in `{1, 5, 9, 13, 17, 22, 26, 30}`): `1403` (rem `17`) and `1408` (rem `22`) are leap, `1404` (rem `18`) and `1409` (rem `23`) are non-leap, which matches the Iranian astronomical calendar for 1403–1409 (unlike the 2820-year Birashk algorithm which got 1403/1404 wrong), though distant future/historical centuries (>1472 or <1244 SH) can diverge by 1 day from astronomical equinoxes.
  3. Historical `Asia/Tehran` DST (prior to 2023 abolition, e.g., `1387–1401`) causes 1-hour shifts inside Q1/Q2 (`+04:30` vs `+03:30`) and `00:00:00` on Farvardin 2 in legacy DST years (`1387–1401`) was a nonexistent wall-clock time (skipped to `01:00:00`). `getJalaliMonthRange` starts on Farvardin 1 (not 2), so month/quarter boundaries remain valid, though `toJalaliDateTime` on historical UTC timestamps relies on up-to-date `tzdata`.
- **Fix:** Narrow catches to `\DateMalformedStringException|\DateInvalidTimeZoneException|\InvalidArgumentException|\DomainException` (or `\Exception`) rather than `\Throwable` so `\Error` surfaces; consider throwing `\InvalidArgumentException` on invalid `$tz` instead of silently substituting `'Asia/Tehran'`.

---

## 2. Phone Normalization

### `PHN-01` (`Major`) — `IranPhoneNormalizer` rejects all Iranian landlines, breaking VoIP caller ID for office/landline callers
- **Location:** [IranPhoneNormalizer.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/IranPhoneNormalizer.php#L27-L33), [VoipLookupService.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Services/VoipLookupService.php#L36-L47)
- **Root Cause:** `toLocal()` only matches mobile numbers (`9\d{9}`). All Iranian geographic landlines (`0[1-8]\d{9}`, e.g., Tehran `02188776655`, Isfahan `03133334444`, or `+982188776655`) return `null`.
- **Failing Scenario:** In `VoipLookupService::lookup('02188776655', $contacts, $deals)`, both `$normalized` and `$cNormalized` evaluate to `null`, so `if ($cNormalized !== null && ...)` never matches any landline contact. Conversely, `KavenegarSender` must still reject landlines for SMS delivery.
- **Fix:** Add landline support (`0[1-8]\d{9}` / `+98[1-8]\d{9}`) to `toLocal()` / `toE164()` (or add dedicated `toLocalMobile()` / `isMobile()` for `KavenegarSender`) so VoIP lookup handles both mobiles and landlines while SMS dispatch enforces mobile-only receptors.

### `PHN-02` (`Major`) — Double-prefix trunk zero (`+9809...`, `009809...`, `+98 (0) 912...`) is rejected
- **Location:** [IranPhoneNormalizer.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/IranPhoneNormalizer.php#L27-L33)
- **Root Cause:** The regex `^(?:\+98|0098|98)?(9\d{9})$` does not permit an optional `0` between the country code and the subscriber prefix.
- **Failing Scenario:** `(new IranPhoneNormalizer())->toE164('+98 (0) 912 345 6789')` or `'009809123456789'` cleans to `'+9809123456789'` / `'009809123456789'` and returns `null`.
- **Fix:** Allow an optional trunk `0` after explicit country code (`^(?:\+98|0098|98)0?(9\d{9}|[1-8]\d{9})$`).

### `PHN-03` (`Minor`) — Arbitrary non-digit garbage and Unicode bidi/C1 control characters are silently stripped and accepted
- **Location:** [IranPhoneNormalizer.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/IranPhoneNormalizer.php#L21-L25)
- **Root Cause:** Line 21 only rejects ASCII control characters `[\x00-\x1f\x7f]`, then line 25 runs `preg_replace('/[^\d+]/', '', ...)` which deletes all letters, symbols, Unicode C1 controls (`\u{0080}-\u{009F}`), and bidi overrides (`\u{202E}`).
- **Failing Scenario:** `(new IranPhoneNormalizer())->toLocal("user:alice@09123456789\u{202E}")` returns `'09123456789'`.
- **Fix:** Reject any input containing disallowed characters (allow only digits, `+`, spaces, `-`, `(`, `)`, `.` and optional `tel:` prefix or strict structural validation before stripping separators), and reject Unicode control/format chars (`\p{C}` except optional harmless trimming whitespace).

---

## 3. National ID / Company National ID / Postal Code / Sheba Validation

### `VAL-01` (`Minor`) — ASCII `\s` stripping without `/u` accepts embedded newlines/tabs while rejecting NBSP
- **Location:** [IranValidators.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/IranValidators.php#L12), [IranValidators.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/IranValidators.php#L37), [IranValidators.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/IranValidators.php#L65), [IranValidators.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/IranValidators.php#L82)
- **Root Cause:** `preg_replace('/[\s\-]/', '', $code)` lacks the `/u` flag and strips `\n`, `\r`, `\t` anywhere in the string while leaving `\u{00A0}` (NBSP) and `\u{200C}` (ZWNJ) untouched.
- **Failing Scenario:** `IranValidators::isValidNationalCode("00845\n75948")` returns `true` (control char injected), whereas `"00845\u{00A0}75948"` returns `false`.
- **Fix:** Reject ASCII/Unicode control characters (`preg_match('/[\x00-\x1F\x7F]/', $val)`), then strip only spaces/NBSP/hyphens (`/[ \-\x{00A0}\x{200C}]+/u`) after trimming.

### `VAL-02` (`Major`) — `isValidSheba` accepts invalid ISO 7064 check digits (`00`, `01`, `99`) and all-zero bank codes
- **Location:** [IranValidators.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/IranValidators.php#L84-L99)
- **Root Cause:** Under ISO 13616 / ISO 7064 Mod 97-10, check digits are computed as `98 - (N mod 97)`, so valid check digits are strictly in `02..98`. Checking only `$remainder === 1` allows `00`, `01`, and `99` when the BBAN yields `1 mod 97` with those digits, and does not check for non-zero BBAN / valid Iranian bank code structure.
- **Failing Scenario:** `IranValidators::isValidSheba('IR000000000000000000000009')`, `'IR010000000000000000000088'`, and `'IR990000000000000000000070'` all return `true`.
- **Fix:** Enforce `$checkInt = (int) $checkDigits; if ($checkInt < 2 || $checkInt > 98) { return false; }` and reject all-zero BBAN (`substr($iban, 4) === str_repeat('0', 22)` or `substr($iban, 4, 3) === '000'`).

### `VAL-03` (`Minor`) — `isValidPostalCode` permits degenerate trailing digits (`1000000000`)
- **Location:** [IranValidators.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/IranValidators.php#L67-L76)
- **Root Cause:** Only checks `^[13-9][0-9]{9}$` and that the first 5 digits aren't all identical (preserving `BUG-08` fix allowing `0`/`2` in positions 2..5). However, degenerate codes like `'1000000000'` or `'1222222222'` pass.
- **Failing Scenario:** `IranValidators::isValidPostalCode('1000000000')` returns `true`.
- **Fix:** Also reject codes where the last 5 digits are all identical (`'00000'`) or the full 10-digit code has `< 2` unique digits / 9 repeated trailing digits, while keeping `BUG-08` (`0`/`2` in positions 2..5) intact.

---

## 4. CSV Injection & UTF-8 BOM

### `CSV-01` (`Major`) — Formula injection filter misses `\t`-prefixed commands without `=+\-@`, `;`/`|` delimiters, and zero-width/BOM bypasses
- **Location:** [PersianCsvExporter.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/PersianCsvExporter.php#L9), [PersianCsvExporter.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/PersianCsvExporter.php#L27-L29), [PersianCsvExporter.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/PersianCsvExporter.php#L73-L75)
- **Root Cause:** `/^\s*[=+\-@]/u` does not match:
  1. Leading `\t` or `\r` when not followed by `=+\-@` (OWASP CSV injection classifies `\t` and `\r` themselves as active trigger prefixes, e.g., `"\tcmd|'/C calc'!A0"`).
  2. Leading zero-width/format characters (`\u{FEFF}`, `\u{200B}`, `\u{200C}`, `\u{200E}`, `\u{200F}`) before `=+\-@` (PCRE `\s` does NOT match them!).
  3. Leading `;` or `|` (e.g., `";=1+1"`, `"|=1+1"` in semicolon-delimited Excel locales / DDE).
  Also `FORMULA_PREFIXES` on line 9 is dead code.
- **Failing Scenario:** `PersianCsvExporter::export(['h'], [["\u{FEFF}=1+1"], ["\tcmd"], ["|=1+1"]])` outputs all three payloads unescaped without a leading `'`.
- **Fix:** Use a unified helper `sanitizeFormulaCell(string $cell)` checking `/^[\s\p{Cf}]*(?:[=+\-@;|]|\t|\r)/u` (or specifically guarding leading `[\t\r]` directly plus `[=+\-@;|]` after optional `[\s\p{Cf}]*`), and remove the unused `FORMULA_PREFIXES` constant.

### `CSV-02` (`Major`) — `orderedRow` column alignment breaks on associative `$headers` and partial key overlap
- **Location:** [PersianCsvExporter.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/PersianCsvExporter.php#L42-L58)
- **Root Cause:** `array_intersect($headers, $rowKeys)` compares header *values* (labels) with row *keys*:
  1. If `$headers = ['name' => 'نام', 'date' => 'تاریخ']` (mapping keys to Persian labels) and `$row = ['date' => '2026-11-22', 'name' => 'علی']`, `$matchingKeys` is empty, so `$orderedRow = $row` outputs columns in swapped order (`1405/09/01,علی` under `نام,تاریخ`)!
  2. If there is partial overlap (e.g. `$headers = ['نام', 'date']`, `$row = ['name' => 'علی', 'date' => '2026-11-22']`), `$matchingKeys` is non-empty (`['date']`), and `$row['نام']` and `$row[0]` are both missing, so `'علی'` is **silently dropped and replaced with `''`**!
  3. When `$matchingKeys` is empty and `$row` has fewer/more columns than `$headers`, the CSV row width doesn't match the header width.
- **Failing Scenario:** `PersianCsvExporter::export(['name' => 'نام', 'date' => 'تاریخ'], [['date' => '2026-11-22', 'name' => 'علی']], ['date'])` outputs `"نام,تاریخ\n1405/09/01,علی\n"`.
- **Fix:** Support associative `$headers` (`key => label`) explicitly: if `$headers` is a list of strings and `$row` is associative without matching keys, map positionally padded/truncated to `count($headers)`; if `$headers` has string keys (`!array_is_list($headers)`), look up `$row[$hKey]` first, then `$row[$hLabel]`; never drop positional values on partial overlap without a deterministic key map.

### `CSV-03` (`Major`) — Non-scalar cell values crash `(string)` cast; date columns truncate datetimes and erase invalid text
- **Location:** [PersianCsvExporter.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/PersianCsvExporter.php#L34), [PersianCsvExporter.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/PersianCsvExporter.php#L62-L81)
- **Root Cause:**
  1. Line 69 casts `(string) $val` unconditionally. Passing an `array` (EspoCRM `multiEnum`) triggers an `Array to string conversion` warning (fatal under PHPUnit), and passing a non-stringable `object` throws `\Error`. `false` casts to `''`.
  2. Line 67 calls `JalaliHelper::toJalaliDate($val)` for `$dateColumns`, stripping time from datetime strings (`'2026-11-22 14:30:00'` -> `'1405/09/01'`) and returning `''` if a cell contains non-date text like `'N/A'`.
  3. Lines 34 & 81 pass `'\\'` as `$escape` to `fputcsv`, which is non-RFC-4180 (can produce unescaped trailing `\"` ambiguities in Excel).
- **Failing Scenario:** `PersianCsvExporter::export(['tags'], [[['a', 'b']]])` fails with `Array to string conversion`. `export(['createdAt'], [['2026-11-22 14:30:00']], ['createdAt'])` drops `17:00` time.
- **Fix:** Explicitly handle `bool` (`'true'`/`'false'` or `'1'`/`'0'`), `array` (`implode(', ', ...)` or `json_encode`), `Stringable`/`DateTimeInterface`, and fallback gracefully; in date columns, use `toJalaliDateTime` when time is present and preserve original `$val` if Jalali conversion returns `''`; use `$escape = ''` (RFC 4180) in `fputcsv`.

---

## 5. VoIP Webhook Security, Replay, Auth, and Lookup

### `VOIP-01` (`Blocker`) — `PostVoipWebhook` checks `$this->entityManager` instead of `$em`, breaking Container DI completely
- **Location:** [PostVoipWebhook.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Api/PostVoipWebhook.php#L40-L43), [PostVoipWebhook.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Api/PostVoipWebhook.php#L69-L95)
- **Root Cause:** Lines 40-43 resolve `$em` from `$this->container->get('entityManager')` when `$this->entityManager === null`. However, lines 69, 70, and 81 check and dereference `$this->entityManager` instead of `$em`. Additionally, `PostVoipWebhook::__construct(?VoipLookupService $service = null, ...)` puts a service with a required scalar constructor arg (`string $webhookSecret`) first, which EspoCRM's `InjectableFactory` cannot autowire without explicit binding.
- **Failing Scenario:** When constructed with `new PostVoipWebhook(null, null, $container)`, authentication reads `$secret` via `$em` (line 47), passes, and then line 69 (`if ($this->entityManager !== null)`) evaluates to `false`, returning `found: false` for every caller in the CRM.
- **Fix:** Use `$em` on lines 69, 70, and 81, and ensure `PostVoipWebhook` constructor order/defaults work cleanly with EspoCRM `InjectableFactory` (e.g. inject `EntityManager` / `Config` directly or provide a factory).

### `VOIP-02` (`Blocker`) — Opportunity query uses `'stageProbability!='` instead of `'stage!='`
- **Location:** [PostVoipWebhook.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Api/PostVoipWebhook.php#L81-L85)
- **Root Cause:** Queries `'stageProbability!=' => ['Closed Won', 'Closed Lost']`. `stageProbability` is a numeric probability field (`0..100`, and in standard EspoCRM often non-storable/derived), whereas `'Closed Won'` and `'Closed Lost'` are values of the `stage` enum field.
- **Failing Scenario:** Closed Won and Closed Lost deals are returned as open deals (or a SQL error/type mismatch occurs on `stageProbability` against string literals).
- **Fix:** Change the filter key to `'stage!=' => ['Closed Won', 'Closed Lost']` and scope it to the matched contact (`'contactId' => $matchedContactId`).

### `VOIP-03` (`Blocker`) — Full-table scans of `Contact` and `Opportunity` on every webhook request (OOM / DoS) and missed secondary phones
- **Location:** [PostVoipWebhook.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Api/PostVoipWebhook.php#L70-L95)
- **Root Cause:** Calls `getRDBRepository('Contact')->find()` and `getRDBRepository('Opportunity')->find()` with no `contactId`/phone filter, no `select()`, and no `limit()`, hydrating the entire CRM database into PHP arrays on every incoming phone call. Moreover, line 75 only reads primary `$c->get('phoneNumber') ?? $c->get('phone')`, missing contacts whose matching number is a secondary number in EspoCRM's `phoneNumberData` / `PhoneNumber` repository.
- **Failing Scenario:** With 50k contacts / 20k opportunities, a single webhook call (or burst) exhausts PHP `memory_limit` / execution time. Calling from a contact's second phone number returns `found: false`.
- **Fix:** Normalize `$rawPhone` to candidate variants (`+98...`, `0...`, raw) and query `Contact` via `PhoneNumber` / `entity_phone_number` (`limit(1)` / `select(['id', 'name', 'accountId', 'accountName'])`) in SQL, then query `Opportunity` filtered by `['contactId' => $contactId, 'stage!=' => ['Closed Won', 'Closed Lost']]` with `limit(20)`.

### `VOIP-04` (`Major`) — `VoipLookupService::lookup` leaks unlinked deals when `contactId` is missing/empty
- **Location:** [VoipLookupService.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Services/VoipLookupService.php#L59-L64)
- **Root Cause:** `$contactId = $matchedContact['id'] ?? '';` followed by `if (($deal['contactId'] ?? '') === $contactId)`. If `$matchedContact['id']` is missing/`null`/`''`, it matches every deal whose `contactId` is `null` or `''`.
- **Failing Scenario:** A matched contact without `'id'` returns all unassociated deals (`'contactId' => null` or `''`). Also on failed lookup (line 52), `'normalizedPhone' => $normalized ?? $rawPhone` reflects unvalidated `$rawPhone` back in JSON.
- **Fix:** Require `is_string($contactId) && $contactId !== ''` before matching deals; return `null` (or sanitized string) for `normalizedPhone` when invalid.

### `VOIP-05` (`Major`) — Public `noAuth: true` VoIP webhook lacks replay/HMAC protection, leaks PII via query params, ignores `enabled` flag, and crashes on non-string `phone`
- **Location:** [routes.json](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Resources/routes.json#L2-L7), [PostVoipWebhook.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Api/PostVoipWebhook.php#L48-L65), [BidarVoip.json](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Resources/metadata/integrations/BidarVoip.json)
- **Root Cause:**
  1. Relies solely on a static shared secret (`X-Bidar-Voip-Secret` / `X-Voip-Token`) with no `X-Timestamp` freshness window, HMAC-SHA256 body signature, nonce replay cache, or IP allowlist.
  2. Line 49 does not check `$integration->get('enabled')` — disabled integration still processes webhooks.
  3. Line 64 reads `$request->getQueryParam('phone')`, exposing caller PII in web server/proxy access logs, and blindly casts `(string) ($body['phone'] ?? ...)` without `is_string()` or length validation (array payload triggers `Array to string conversion` error).
- **Failing Scenario:** `POST /BidarVoip/webhook` with `{"phone": ["09123456789"]}` crashes with a PHP error instead of `400 Bad Request`; replaying a captured request hours later still returns CRM customer/deal PII.
- **Fix:** Check `$integration->get('enabled')`, add optional/required HMAC-SHA256 + timestamp (`±300s`) + replay nonce check (and `allowedIps` in `BidarVoip.json`), remove query-param `phone` fallback, validate `is_string($rawPhone)` with non-empty & max-length bounds (`400 Bad Request`).

---

## 6. SMS Provider Error Handling & Campaign Service

### `SMS-01` (`Blocker`) — `PostSendSms` has no ACL/permission check (any authenticated user can send paid SMS campaigns)
- **Location:** [PostSendSms.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Api/PostSendSms.php#L45-L99), [routes.json](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Resources/routes.json#L8-L12)
- **Root Cause:** `/BidarSms/send` requires EspoCRM authentication (`noAuth` is not set), but `PostSendSms::process()` never injects `Acl` or `User` and never checks `$this->acl->check('BidarSmsMessage', 'create')` (or `BidarSmsTemplate` read access / `Contact`/`Opportunity` access).
- **Failing Scenario:** A portal user or restricted read-only employee with an active session token posts to `POST /api/v1/BidarSms/send` with 10,000 recipients and dispatches paid SMS through Kavenegar.
- **Fix:** Inject `Espo\Core\Acl` (and `Espo\Entities\User` if needed) into `PostSendSms` and enforce `if (!$acl->check('BidarSmsMessage', 'create')) { throw new Forbidden(); }`, plus verify `BidarSmsTemplate` read ACL when `templateId` is used.

### `SMS-02` (`Blocker`) — `PostSendSms` crashes with fatal `Error` on real EspoCRM JSON campaign payloads (`stdClass` elements) and lacks input validation
- **Location:** [PostSendSms.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Api/PostSendSms.php#L48-L96), [SmsCampaignService.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Services/SmsCampaignService.php#L150-L152)
- **Root Cause:**
  1. In EspoCRM, `Request::getParsedBody()` returns nested `\stdClass` objects (from `json_decode($raw, false)`). `(array) $request->getParsedBody()` only casts the top level, leaving `$body['recipients']` as `list<\stdClass>`. `SmsCampaignService::sendCampaign` accesses `$recipient['phoneNumber']` -> **fatal `Error: Cannot use object of type stdClass as array`**. (`SmsCampaignServiceTest` passed PHP arrays inside `(object)`, masking this).
  2. Non-string `templateId`, `phone`, `contactId`, `opportunityId` trigger `(string)` cast warnings/errors; scalar `$body['variables']` is silently cast to `[0 => ...]` instead of throwing `BadRequest`; non-array or empty `$body['recipients']` falls through to Single SMS mode; missing/inactive `templateId` throws a generic missing-body `400` instead of `404` / explicit template error.
- **Failing Scenario:** Real HTTP `POST /api/v1/BidarSms/send` with `{"message":"Hi {contactName}","recipients":[{"phone":"09123456789","contactName":"Ali"}]}` crashes with HTTP 500 `Cannot use object of type stdClass as array`.
- **Fix:** Recursively normalize `stdClass` items in `$recipients` / `$variables` to associative arrays (or validate and reject malformed items with `BadRequest`), validate scalar types for `templateId`/`phone`/`contactId`/`opportunityId`, validate `is_array($variables)` / `is_object`, and explicitly handle `$recipients` when present-but-empty or non-array.

### `SMS-03` (`Major`) — `KavenegarSender` silently returns `true` on HTTP 200 non-JSON/empty responses and leaks unmasked API key in wrapped exception chains
- **Location:** [KavenegarSender.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Sms/KavenegarSender.php#L32-L41), [KavenegarSender.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Sms/KavenegarSender.php#L60-L133)
- **Root Cause:**
  1. Lines 85-95: If Kavenegar/proxy returns HTTP `200` with `""`, an HTML error/login page, malformed JSON, or JSON missing `return.status`, `sendDirect()` skips the inner `if` and returns `true` (falsely marking failed messages as `'sent'`).
  2. Line 106: On non-Kavenegar exceptions (like cURL errors containing the URL `https://api.kavenegar.com/v1/{apiKey}/...`), `throw new RuntimeException('Kavenegar SMS dispatch failed: connection error', 0, $e)` attaches the **unmasked** `$e` as `$previous`, leaking the API key if logs serialize the exception chain (`(string) $ex`).
  3. Line 75: Sends `'sender' => ''` when `senderLine` is `null`/`''` instead of omitting the `'sender'` parameter.
  4. Lines 33-37: Reads `Integration` `'Kavenegar'` without checking `$integration->get('enabled')`, and places `?Closure $httpClient` before `?EntityManager $entityManager` in constructor params (risking EspoCRM `InjectableFactory` resolution).
  5. Lines 46-58 & 60: No empty/whitespace-only or max-length validation on `$message`; `send(Sms $sms)` aborts remaining recipients on the first failure; `defaultHttpClient()` calls `curl_close($ch)` (deprecated in PHP 8.5), doesn't check `curl_init() === false`, and omits `CURLOPT_CONNECTTIMEOUT` / `CURLOPT_PROTOCOLS => CURLPROTO_HTTPS`.
- **Failing Scenario:** Proxy returns `200 OK` with `<html>502 Gateway</html>` -> `sendDirect()` returns `true`. cURL timeout on `https://api.kavenegar.com/v1/MY_KEY/...` -> `$e->getPrevious()->getMessage()` contains `MY_KEY`.
- **Fix:** Require valid JSON (`JSON_THROW_ON_ERROR`) with integer `return.status === 200`; scrub `$this->apiKey` from any `previous` exception message (or omit raw `$e` as `$previous` when message contains key); omit `'sender'` when empty; reject empty `$message`; check `$integration->get('enabled')`; remove `curl_close($ch)`.

### `SMS-04` (`Major`) — `SmsCampaignService` ignores `isActive`, overwrites `$defaultVariables`, skips phone normalization, and swallows DB save errors
- **Location:** [SmsCampaignService.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Services/SmsCampaignService.php#L34-L60), [SmsCampaignService.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Services/SmsCampaignService.php#L74-L195)
- **Root Cause:**
  1. `getTemplateBody()` (lines 48-60) does not check `$template->get('isActive')` and returns `''` instead of `null` when body is empty.
  2. `sendCampaign()` (lines 165-169) unconditionally merges `'contactName' => (string) ($recipient['contactName'] ?? $recipient['name'] ?? '')` (and `accountName`, `dealName`) on top of `$defaultVariables`, wiping out defaults like `$defaultVariables['accountName']` whenever a recipient omits them!
  3. `renderTemplate()` (lines 38-39) casts non-scalar `$value` via `(string)` (crashing on arrays/objects) and maps empty `''`/`'{}'` keys to `'{}'`.
  4. `sendSms()` (lines 94-112) logs raw unnormalized `$phoneNumber` (which can exceed `maxLength: 32` in `BidarSmsMessage.json`), discards Kavenegar's `entries[0].messageid` (`providerMessageId`), and silently catches `saveEntity` failures without recording a `logError` or logging via PSR-3 logger.
- **Failing Scenario:** `sendCampaign([['phone' => '09121111111']], 'شرکت {accountName}', ['accountName' => 'بیدار'])` renders `'شرکت '` instead of `'شرکت بیدار'`. Inactive `BidarSmsTemplate` (`isActive: false`) still sends.
- **Fix:** Enforce `$template->get('isActive') !== false` in `getTemplateBody()`; only set recipient overrides for `contactName`/`accountName`/`dealName` when non-empty/present; normalize `$phoneNumber` before saving; ignore non-scalar/empty keys in `renderTemplate()`; capture `providerMessageId` and surface/log DB persistence errors.

---

## 7. Persian Text Normalizer & Hook

### `TXT-01` (`Major`) — `PersianTextNormalizer` strips ezafe from `ۀ`, fails to clean single NBSP / bidi / zero-width junk, and lacks diacritic/presentation-form normalization
- **Location:** [PersianTextNormalizer.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/PersianTextNormalizer.php#L25-L49), [PersianTextNormalizerTest.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/tests/Unit/PersianTextNormalizerTest.php#L36-L41)
- **Root Cause:**
  1. Line 37: `str_replace("\u{06C0}", 'ه', $text)` turns `ۀ` (`خانۀ بزرگ`) into bare `ه` (`خانه بزرگ`), erasing the Persian ezafe marker instead of converting to `هٔ` (`\u{0647}\u{0654}`) — note `PersianTextNormalizerTest::testNormalizesHehYehAndRemovesTatweel` currently encodes `'خانه بزرگ'`.
  2. Line 46-48: `/[^\S\r\n]{2,}/u` + PHP `trim()` fails to normalize a *single* `\u{00A0}` (NBSP) or `\t` to `' '`, leaves leading/trailing `\u{00A0}`, and does not strip zero-width/bidi junk (`\u{200B}`, `\u{FEFF}`, `\u{200E}`, `\u{200F}`, `\u{202A}-\u{202E}`) or collapse repeated ZWNJs (`\u{200C}{2,}`), while valid single ZWNJ (`\u{200C}`) must be preserved.
  3. Does not normalize Arabic `ة` (`\u{0629}`), `أ`/`إ`/`ؤ`/`ئ` or decomposed `ا`+`\u{0653}` (`آ`), Arabic tashkeel (`\u{064B}-\u{0652}`), or Arabic Presentation Forms (`\u{FB50}-\u{FDFF}`, `\u{FE70}-\u{FEFF}` common in Persian PDF copy-paste).
  4. Line 28: `@iconv('UTF-8', 'UTF-8//IGNORE', $input)` returns `false` (cast to `''`, wiping the string) if iconv encounters a platform failure.
- **Failing Scenario:** `PersianTextNormalizer::normalizeCharacters("\u{FEFF}علی\u{00A0}کریمی\u{200F}")` retains `\u{FEFF}`, `\u{00A0}`, and `\u{200F}`. `normalizeCharacters("خانۀ بزرگ")` loses the ezafe `ٔ`.
- **Fix:** Strip bidi/BOM/zero-width-space junk while preserving ZWNJ `\u{200C}` (collapsing `\u{200C}{2,}` -> `\u{200C}` and stripping `\u{200C}` adjacent to spaces/boundaries), normalize `[\p{Zs}\t]+` (including single `\u{00A0}`) to `' '`, strip tashkeel (`\u{064B}-\u{0652}`, `\u{0670}` — keeping `\u{0654}` if `ۀ` -> `هٔ`), convert `\u{06C0}` -> `"\u{0647}\u{0654}"` (updating test if policy confirmed), and guard `iconv` failure with `mb_scrub` fallback.

### `TXT-02` (`Major`) — `NormalizePersianInput` omits `BidarSmsTemplate`/`iranCity`, dirties unchanged fields, and collides with EspoCRM `Person` `name` composition
- **Location:** [NormalizePersianInput.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Hooks/Common/NormalizePersianInput.php#L17-L34)
- **Root Cause:**
  1. `ALLOWED_ENTITIES` omits `BidarSmsTemplate` (and `BidarSmsMessage`, `Note`, `Case`), and `TEXT_FIELDS` omits `iranCity`, `title`, `subject`.
  2. `TEXT_FIELDS` includes `accountName` (a read-only `link` foreign attribute in EspoCRM) and `name` on `Contact`/`Lead` (`Person` entities where EspoCRM computes `name` from `firstName` + `lastName`).
  3. Line 30 calls `$entity->set($field, $normalized)` even when `$normalized === $val`, marking unmodified attributes as changed in ORM dirty tracking, and checks `$entity->has($field)` on untouched fields during partial updates.
- **Failing Scenario:** Saving a `BidarSmsTemplate` with Arabic `ي`/`ك` or Persian digits does not normalize its `name` or `body`; saving an `Account` with `iranCity: 'تهران   بزرگ'` is not normalized; partial PATCH on `Account` dirties `name` and `description` unnecessarily.
- **Fix:** Add `BidarSmsTemplate` to `ALLOWED_ENTITIES` and `iranCity`, `body`, `title`, `subject` to `TEXT_FIELDS`; skip `name` when `firstName`/`lastName` exist or normalize consistently before `Person` hook; only call `$entity->set($field, $normalized)` when `$normalized !== $val`.

---

## 8. Metadata & i18n

### `META-01` (`Major`) — Sensitive credentials (`apiKey`, `webhookSecret`) declared as plaintext `varchar` instead of `password`
- **Location:** [BidarVoip.json](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Resources/metadata/integrations/BidarVoip.json#L3-L6), [Kavenegar.json](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Resources/metadata/integrations/Kavenegar.json#L3-L6)
- **Root Cause:** Both `webhookSecret` and `apiKey` use `"type": "varchar"`, exposing secrets in plaintext in EspoCRM Admin UI and `GET /api/v1/Integration/*` responses.
- **Fix:** Change field `"type"` to `"password"` (or `"varchar"` with explicit protection if EspoCRM integration view requires, preferring `"password"`), and add `allowedIps` / `hmacSecret` fields to `BidarVoip.json`.

### `META-02` (`Major`) — `Account` (`nationalId`) and `Contact` (`nationalCode`) lack normalization/validation hooks and `maxLength` conflicts with formatted input
- **Location:** [Account.json](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Resources/metadata/entityDefs/Account.json#L3-L10), [Contact.json](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Resources/metadata/entityDefs/Contact.json#L3-L6)
- **Root Cause:** `nationalId` (`maxLength: 11`) and `nationalCode` (`maxLength: 10`) have tight DB/API length limits, yet neither `NormalizePersianInput` nor a dedicated `BeforeSave` hook strips hyphens/spaces/Persian digits or invokes `IranValidators::isValidCompanyNationalId()` / `isValidNationalCode()`.
- **Failing Scenario:** Submitting `nationalCode: "008-4575948"` (11 chars) or `"۰۰۸۴۵۷۵۹۴۸"` fails EspoCRM's `maxLength: 10` validation or saves invalid/unvalidated IDs into the database.
- **Fix:** Add a `BeforeSave` normalization + validation hook (or EspoCRM custom validator) for `Account.nationalId` and `Contact.nationalCode` using `IranValidators`, and ensure incoming API input is normalized prior to `maxLength` validation (or via custom field type).

### `META-03` (`Minor`) — Missing `fa_IR` translations for `BidarSmsTemplate`, `BidarSmsMessage`, and `Integration` (`Kavenegar`, `BidarVoip`), plus `BidarSmsMessage` metadata/asset gaps
- **Location:** [Global.json](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Resources/i18n/fa_IR/Global.json), [BidarSmsMessage.json](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Resources/metadata/entityDefs/BidarSmsMessage.json#L10-L36), [client.json](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Resources/metadata/app/client.json), [fields/date.json](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Resources/metadata/fields/date.json)
- **Root Cause:**
  1. `Global.json` is missing `scopeNames` and `scopeNamesPlural` entries for `BidarSmsTemplate` (which has `"tab": true`) and `BidarSmsMessage`.
  2. `Resources/i18n/fa_IR/Integration.json` does not exist (`Kavenegar`, `BidarVoip`, `apiKey`, `senderLine`, `webhookSecret` are untranslated).
  3. `BidarSmsMessage.json` manually declares `"contactId"` and `"opportunityId"` as `"type": "varchar"` alongside `"contact": {"type": "link"}` and `"opportunity": {"type": "link"}`, which can clash with EspoCRM's auto-generated `belongsTo` link fields (and lacks `"foreign"` inverse links or `"index": true` on `phoneNumber`/`status`).
  4. `client.json` and `fields/*.json` reference `client/custom/modules/bidar-iran/...` and `bidar-iran:views/fields/...` assets that are not present inside `extensions/bidar-iran/`.
- **Fix:** Add `BidarSmsTemplate`/`BidarSmsMessage` to `Global.json`, create `Resources/i18n/fa_IR/Integration.json`, verify `BidarSmsMessage.json` `belongsTo` definitions against EspoCRM 10.1 ORM schema builder (remove redundant raw `varchar` `*Id` definitions if auto-generated by `link`, add `index: true` on `phoneNumber`), and verify client asset packaging in the extension build.

---

## Concrete TDD Remediation Plan

Execute strictly Red → Green per file in `extensions/bidar-iran/`:

### 1. [JalaliHelper.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/JalaliHelper.php) & [JalaliHelperTest.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/tests/Unit/JalaliHelperTest.php) / [BidarIranAuditTest.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/tests/Unit/BidarIranAuditTest.php)
- **Red Tests:**
  - Fix `BidarIranAuditTest::testExplicitOffsetIsHonored` to assert `'1405/09/01'` for `'2026-11-22T23:30:00+03:30'` and add `'2026-11-22T22:00:00.123-05:00'` → `'1405/09/02'`.
  - Add `testToJalaliDateTimeDefaultsNaiveInputToUtcRegardlessOfServerTimezone` (set `date_default_timezone_set('Asia/Tehran')`, pass `'2026-11-22 12:00:00'`, assert `'1405/09/01 15:30'`).
  - Add `testToJalaliDateTimeAndDiffForHumansRejectImpossibleDatesAndRelativeStrings` (`'2026-02-30 12:00:00'`, `'now'` → `''`).
  - Add `testGetJalaliQuarterRangeRejectsInvalidQuarter` (`0`, `5` → expect `\InvalidArgumentException`).
- **Green Fix:** Unified strict parser preserving offsets + UTC default + `checkdate()`, throw `\InvalidArgumentException` on invalid `$quarter` / `$tz`, narrow `catch` blocks.

### 2. [IranPhoneNormalizer.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/IranPhoneNormalizer.php) & [IranPhoneNormalizerTest.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/tests/Unit/IranPhoneNormalizerTest.php)
- **Red Tests:**
  - `testNormalizesLandlinesToLocalAndE164`: `'02188776655'` ↔ `'+982188776655'`, `'031-33334444'` → `'+983133334444'`.
  - `testNormalizesDoublePrefixTrunkZero`: `'+9809123456789'`, `'009809123456789'`, `'+98 (0) 912-345-6789'` → `'+989123456789'`.
  - `testRejectsGarbageLettersAndUnicodeBidiControls`: `"abc09123456789xyz"`, `"09123456789\u{202E}"` → `null`.
  - `testToLocalMobileRejectsLandlines`: `'02188776655'` → `null` for SMS mobile helper.
- **Green Fix:** Add landline support + optional trunk `0` after `98`, add `toLocalMobile()` for SMS, reject disallowed chars and `\p{C}`.

### 3. [IranValidators.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/IranValidators.php) & [IranValidatorsTest.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/tests/Unit/IranValidatorsTest.php)
- **Red Tests:**
  - `testRejectsControlCharsAndAcceptsNbsp`: `"00845\n75948"` → `false`, `"00845\u{00A0}75948"` → `true`.
  - `testShebaRejectsInvalidCheckDigits00_01_99AndZeroBankCode`: `'IR000000000000000000000009'`, `'IR010000000000000000000088'`, `'IR990000000000000000000070'` → `false`.
  - `testPostalCodeRejectsTrailingRepetitiveZeros`: `'1000000000'` → `false` (keep `BUG-08` tests passing).
- **Green Fix:** Reject control chars before `/[ \-\x{00A0}\x{200C}]+/u` normalization, enforce `$checkInt >= 2 && $checkInt <= 98` + non-zero bank code in `isValidSheba`, reject all-zero last-5 in `isValidPostalCode`.

### 4. [PersianCsvExporter.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/PersianCsvExporter.php) & [PersianCsvExporterTest.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/tests/Unit/PersianCsvExporterTest.php)
- **Red Tests:**
  - `testBlocksZeroWidthPrefixedAndTabOnlyAndDelimiterFormulas`: `"\u{FEFF}=1+1"`, `"\u{200B}=1+1"`, `"\tcmd"`, `";=1+1"`, `"|=1+1"`.
  - `testAssociativeHeadersMapAndOrderRowsWithoutDroppingColumns`: `['name' => 'نام', 'date' => 'تاریخ']` with `[['date' => '2026-11-22', 'name' => 'علی']]`.
  - `testHandlesNonScalarValuesAndDatetimeColumns`: array `['a', 'b']`, boolean `false`, datetime `'2026-11-22 12:00:00'`, non-date `'N/A'` in date column.
- **Green Fix:** Updated formula regex, clean header-to-row alignment, safe scalar formatting, datetime preservation, `$escape = ''` in `fputcsv`.

### 5. [PostVoipWebhook.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Api/PostVoipWebhook.php), [VoipLookupService.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Services/VoipLookupService.php), [VoipWebhookServiceTest.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/tests/Unit/VoipWebhookServiceTest.php)
- **Red Tests:**
  - `testPostVoipWebhookResolvesEntityManagerFromContainerAndQueriesSqlFiltered`: mock `Container` with `EntityManager` (`$this->entityManager === null`), assert `'stage!=' => ['Closed Won', 'Closed Lost']` and `contactId`-scoped query instead of full-table `find()`.
  - `testPostVoipWebhookRejectsArrayPhoneAndIgnoresQueryParamPhone`: `{"phone": ["0912..."]}` → `BadRequest`.
  - `testLookupMatchesLandlineAndDoesNotLeakDealsWithEmptyContactId`: landline `'02188776655'` matches; contact without `id` does not match `['contactId' => '']` deal.
  - `testHmacAndReplayProtectionRejectsStaleTimestamp`: expired timestamp / bad HMAC → `Forbidden`.
- **Green Fix:** Use `$em` consistently, SQL-level phone/contact & `stage!=` queries, non-empty `contactId` guard, landline matching, HMAC/timestamp/replay verification, `enabled` check.

### 6. [KavenegarSender.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Sms/KavenegarSender.php), [SmsCampaignService.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Services/SmsCampaignService.php), [PostSendSms.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Api/PostSendSms.php), [KavenegarSenderTest.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/tests/Unit/KavenegarSenderTest.php), [SmsCampaignServiceTest.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/tests/Unit/SmsCampaignServiceTest.php)
- **Red Tests:**
  - `KavenegarSenderTest`: HTTP 200 with `''` or `'<html>error</html>'` or `{}` throws `RuntimeException`; wrapped cURL error with key in message scrubs `$e->getPrevious()`; empty `senderLine` omits `'sender'`; empty `$message` throws; disabled integration throws.
  - `SmsCampaignServiceTest`: inactive `BidarSmsTemplate` returns `null`; `sendCampaign` preserves `$defaultVariables['accountName']` when recipient omits it; non-scalar template variable does not crash; `sendSms` normalizes phone number.
  - `PostSendSms` tests: unauthorized user without `BidarSmsMessage` create ACL throws `Forbidden`; `stdClass` items inside `$request->getParsedBody()->recipients` succeed end-to-end; scalar `variables` or array `phone`/`templateId` throws `BadRequest`.
- **Green Fix:** Strict JSON `return.status === 200` check, key-scrubbed exception chains, omit empty `sender`, check `Integration->get('enabled')`, enforce ACL in `PostSendSms`, recursively convert `stdClass` recipients/variables, fix `sendCampaign` default variable merge & `getTemplateBody` active check.

### 7. [PersianTextNormalizer.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Support/PersianTextNormalizer.php), [NormalizePersianInput.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Hooks/Common/NormalizePersianInput.php), [PersianTextNormalizerTest.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/tests/Unit/PersianTextNormalizerTest.php)
- **Red Tests:**
  - `normalizeCharacters` converts `\u{06C0}` → `"ه\u{0654}"` (after confirming ezafe policy), collapses single `\u{00A0}`/`\t` to `' '`, strips `\u{FEFF}`, `\u{200B}`, `\u{200E}`, `\u{200F}`, `\u{202E}` while preserving `\u{200C}` inside `می‌شود`.
  - `NormalizePersianInput` normalizes `BidarSmsTemplate` and `Account.iranCity`, and does not call `$entity->set()` when already normalized.
- **Green Fix:** Implement updated normalizer pipeline, expand entity/field lists, guard `$normalized !== $val`.

### 8. Metadata & i18n ([Resources/**](file:///Users/moeini/Dev/didar/extensions/bidar-iran/Resources)) & [IranMetadataTest.php](file:///Users/moeini/Dev/didar/extensions/bidar-iran/tests/Unit/IranMetadataTest.php)
- **Red Tests:** Assert `Kavenegar.json` & `BidarVoip.json` secret fields use `"password"`, `Global.json` includes `BidarSmsTemplate`/`BidarSmsMessage`, `Integration.json` exists for `fa_IR`, and `BidarSmsMessage.json` has valid `belongsTo` schema without conflicting standalone `varchar` `*Id` fields.
- **Green Fix:** Update JSON metadata and `fa_IR` translations accordingly.
