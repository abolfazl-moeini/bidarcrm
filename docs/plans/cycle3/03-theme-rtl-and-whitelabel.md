# Cycle 3 Remediation Plan 03 — Theme, Brand, Classic RTL & White-Label

```yaml
Scope (Allowed Files):
  - extensions/bidar-theme/**
  - extensions/bidar-brand/**
  - client/custom/modules/bidar-theme/**
  - scripts/apply-whitelabel.php
Forbidden Changes:
  - Anything outside the 4 paths above
  - manifest.json versions in bidar-theme or bidar-brand (must remain 1.0.4)
Prerequisites: None
Estimated Context Size: Very Small (3 atomic tasks, ~12 KB across 5 files)
Recommended Model Tier: Weak / Fast (Flash, GLM-5.3-Flash, hy4-flash, Haiku)
```

## Global Execution Rules

1. **Read ONLY** the files listed in each task's `Targets`.
2. **Never edit** files outside the allowed Section 3 paths.
3. **Strict TDD / Verify:** Write/verify failing check first (Step 1) -> apply exact minimal fix (Step 2) -> run verify command (Step 3).
4. **Never change** `manifest.json` versions (`1.0.4`).
5. **Escalate immediately** if any `Stop / Escalate If` condition occurs.

---

## T3.1 [P1] `appearance.js`: Observe Post-Login `.has-navbar` Transitions, Support Hyphenated Stylesheets, & Disconnect Orphaned Observer

- **Severity:** `P1` (Major — Classic SPA Login-to-Shell RTL Sidebar Bug & Observer Leak)
- **Targets:**
  - `client/custom/modules/bidar-theme/js/appearance.js` (lines 42, 70-81, 95-97, 130-142)
  - `extensions/bidar-theme/tests/BidarThemeMetadataTest.php`
- **Root Cause:**
  1. When an EspoCRM user loads `#login` first, `document.body` has `#login` and lacks `.has-navbar`. After logging in (SPA transition without full page reload), EspoCRM removes `#login` and adds `class="has-navbar"` on `document.body`, but `appearance.js` only runs `ensureLayoutDefaults()` at script load / `DOMContentLoaded` (`{once: true}`), so `body.dataset.navbar = 'side'` is never set until a manual browser refresh!
  2. `STYLESHEET` regex on line 42 (`/css\/bidar(?:-([a-z]+))?\.css/`) fails to match hyphenated style names allowed by `STYLE_PATTERN` (`^[a-z][a-z-]{0,30}$`).
  3. The fallback `MutationObserver` on `document.documentElement` with `{subtree: true}` (line 141) never disconnects if `#main-stylesheet` never appears (e.g. iframe/standalone pages).

### Step 1 — RED Test
Add assertions to `extensions/bidar-theme/tests/BidarThemeMetadataTest.php` checking `client/custom/modules/bidar-theme/js/appearance.js`:
1. Observes `document.body` `class` attribute mutations (`attributeFilter: ['class']`) to invoke `ensureLayoutDefaults`.
2. `STYLESHEET` regex supports hyphens in theme style names (`[a-z][a-z-]*`).
3. Bootstrap `#main-stylesheet` observer disconnects on window `load` if no stylesheet was attached.
Run: `./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-theme/tests/BidarThemeMetadataTest.php` -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
In `client/custom/modules/bidar-theme/js/appearance.js`:
1. Line 42:
   - Before: `const STYLESHEET = /\/bidar-theme\/css\/bidar(?:-([a-z]+))?\.css(?:[?#]|$)/;`
   - After: `const STYLESHEET = /\/bidar-theme\/css\/bidar(?:-([a-z][a-z-]*))?\.css(?:[?#]|$)/;`
2. Lines 95-97: add `watchBodyNavbar()` helper to attach a `MutationObserver` on `document.body` (`{attributes: true, attributeFilter: ['class']}`) as soon as `document.body` exists (immediately if present, else inside `DOMContentLoaded`), calling `ensureLayoutDefaults()` when `has-navbar` appears and `#login` is absent.
3. Lines 130-142: add `window.addEventListener('load', () => observer.disconnect(), {once: true});` alongside `observer.observe(...)` so the document-wide subtree observer never leaks if `#main-stylesheet` never loads.
4. Run `node --check client/custom/modules/bidar-theme/js/appearance.js`.

### Step 3 — Verify GREEN
Run: `node --check client/custom/modules/bidar-theme/js/appearance.js && ./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-theme/tests`
Expected: `OK`, 0 failures.

### Stop / Escalate If
- `appearance.js` throws any syntax error under `node --check`.

---

## T3.2 [P2] Classic Theme CSS Logical Padding & Stale Font Comment Cleanup

- **Severity:** `P2` (Minor — Minor RTL Alignment & Comment Hygiene)
- **Targets:**
  - `client/custom/modules/bidar-theme/css/bidar-record.css` (lines 13-14)
  - `client/custom/modules/bidar-theme/css/bidar-base.css` (line 2)
  - `extensions/bidar-theme/tests/BidarThemeMetadataTest.php`
- **Root Cause:** `.panel > .panel-heading` in `bidar-record.css:13-14` still uses physical `padding-left: var(--panel-padding); padding-right: var(--10px);`, which swaps visual indentation on RTL dashboard dashlets. `bidar-base.css:2` comment still says `(Lexend)` instead of `(Vazirmatn)`.

### Step 1 — RED Test
Add assertion in `BidarThemeMetadataTest.php` checking `bidar-record.css` uses `padding-inline-start: var(--panel-padding)` / `padding-inline-end: var(--10px)` on `.panel > .panel-heading` and `bidar-base.css` comment references `Vazirmatn` (not `Lexend`).
Run: `./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-theme/tests` -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
1. In `client/custom/modules/bidar-theme/css/bidar-record.css` lines 13-14:
   - Before:
     ```css
     padding-left: var(--panel-padding);
     padding-right: var(--10px);
     ```
   - After:
     ```css
     padding-inline-start: var(--panel-padding);
     padding-inline-end: var(--10px);
     ```
2. In `client/custom/modules/bidar-theme/css/bidar-base.css` line 2: replace `Lexend` in the header comment with `Vazirmatn`.

### Step 3 — Verify GREEN
Run: `./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-theme/tests`
Expected: `OK`, 0 failures.

### Stop / Escalate If
- Any existing `BidarThemeMetadataTest` asserts literal `padding-left` in `bidar-record.css`.

---

## T3.3 [P2] `apply-whitelabel.php` Dead Variable Cleanup & Custom Brand Theme Label Regression Test

- **Severity:** `P2` (Minor — White-Label Regression Protection)
- **Targets:**
  - `scripts/apply-whitelabel.php` (line 309)
  - `extensions/bidar-brand/tests/ApplyWhitelabelTest.php`
- **Root Cause:** `patchInstallerI18n()` declares unused `$supportUrl` at line 309; additionally, as flagged in Cycle 2 `qoder-review`, `ApplyWhitelabelTest.php` should explicitly assert that custom `shortName` and `themeNameEn` values appear in generated `fa_IR/install.json` and `en_US/install.json` without leaking `"بیدار"` or `"Bidar"`.

### Step 1 — RED Test
Add a test method `testPatchInstallerI18nDerivesCustomThemeLabelsWithoutBrandLeak()` in `extensions/bidar-brand/tests/ApplyWhitelabelTest.php` using custom `'shortName' => 'سرو'` and `'themeNameEn' => 'Sarv'` and asserting `fa_IR/install.json` `themes.Bidar === 'سرو (پیش‌فرض RTL)'` and `en_US/install.json` `themes.Bidar === 'Sarv (Default RTL)'` (verifying exact behavior). Also assert `scripts/apply-whitelabel.php` syntax via `php -l`.

### Step 2 — Minimal Fix
In `scripts/apply-whitelabel.php` line 309 inside `patchInstallerI18n()`: remove unused `$supportUrl = $this->validatedUrl(...);` (note: keep `$supportUrl` inside `patchInstallerTemplates()` where it IS used). Read `lines 301-380` carefully first before editing.

### Step 3 — Verify GREEN & Final Verification
Run full Section 3 verification:
`php -l scripts/apply-whitelabel.php && php -l extensions/bidar-theme/scripts/AfterInstall.php && node --check client/custom/modules/bidar-theme/js/appearance.js && ./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-brand/tests extensions/bidar-theme/tests`
Expected: `No syntax errors detected`, `OK` (all tests >= 31 passing, 0 failures). Confirm both `manifest.json` files remain `"version": "1.0.4"`.

### Stop / Escalate If
- `apply-whitelabel.php` uses `$supportUrl` elsewhere inside `patchInstallerI18n()` (read lines 301-395 to be 100% sure before removing).
