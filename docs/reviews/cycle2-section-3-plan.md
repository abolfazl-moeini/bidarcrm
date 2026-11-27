# Cycle 2 Remediation Plan — Section 3 (Bidar Theme, Brand, RTL & White-Label)

**Scope:**
- `extensions/bidar-theme/`
- `extensions/bidar-brand/`
- `client/custom/modules/bidar-theme/`
- `scripts/apply-whitelabel.php`

**Source Reviews:**
- Pass 1: [cycle2-section-3-pass1-agy.md](file:///Users/moeini/Dev/didar/docs/reviews/cycle2-section-3-pass1-agy.md)
- Pass 2: [cycle2-section-3-pass2-qoder.md](file:///Users/moeini/Dev/didar/docs/reviews/cycle2-section-3-pass2-qoder.md) (`APPROVE WITH REVISIONS` — all 5 Pass 2 adjustments incorporated below)

**Constraint:** Do NOT modify `manifest.json` versions (`1.0.4` stays unchanged). `client/custom/modules/bidar-theme/lib/module-bidar-theme.js` does not need rebuilding because no `src/` files are modified.

---

## 1. Remediation Tasks

### Task 1 (Blocker #1): Fix RTL Side-Navbar Docking, Double Offset (`#content` + `#main`), Topbar Width & Guards
- **Files:**
  - `client/custom/modules/bidar-theme/css/bidar-rtl.css`
  - `client/custom/modules/bidar-theme/js/appearance.js`
  - `extensions/bidar-theme/tests/BidarThemeMetadataTest.php`
- **Changes:**
  1. In `bidar-rtl.css`:
     - Wrap side-navbar RTL docking rules in `@media screen and (min-width: 768px)` to preserve mobile (`<= 767px`) layouts.
     - Scope all side-navbar rules strictly to `html[dir="rtl"] body[data-navbar="side"]` / `body[data-direction="rtl"][data-navbar="side"]` (removing unscoped `html[dir="rtl"] #content`, `html[dir="rtl"] #main`, `html[dir="rtl"] #navbar .navbar-right`, and `html[dir="rtl"] body > footer` that leaked onto `#login`, `body[data-navbar="top"]`, and mobile).
     - Remove `margin-right` / `padding` overrides from `#main` (since `#main` is nested inside `#content`, offsetting both caused a 2× `--navbar-width` shift). Offset only `body[data-navbar="side"].has-navbar > .content` / `#content` using EspoCRM's single-container padding model (`margin-left: auto; margin-right: auto; padding-left: var(--container-padding, 15px); padding-right: calc(var(--navbar-width) + var(--container-padding, 15px));`, and `--navbar-minimized-width` when `.minimized:not(.side-menu-opened)`).
     - Fix `#navbar .navbar-right` in RTL side-navbar mode: keep `left: 0; right: auto; margin-left: 0; margin-right: var(--navbar-width); width: calc(100vw - var(--navbar-width));` and set `padding-left: 0; padding-right: 0;` (eliminating the duplicate `--navbar-width` dead-zone padding). Handle `.minimized:not(.side-menu-opened)` with `--navbar-minimized-width` and `.minimized.side-menu-opened` with `--navbar-width`.
     - Scope `> footer` RTL margin to `.has-navbar` (`body[data-navbar="side"].has-navbar > footer`), and explicitly reset `margin-left: 0; margin-right: 0;` for `body:not(.has-navbar) > footer` so login/public footers remain centered.
     - Fix RTL sidebar submenu positioning (`li.tab-group > .dropdown-menu`, `li.more > .dropdown-menu`) to dock at `left: auto; right: var(--navbar-width)` (or `var(--navbar-minimized-width)` when `.minimized:not(.side-menu-opened)`), and mirror `.navbar-header > a.minimizer` / `.group-caret`.
  2. In `appearance.js`:
     - Align RTL language detection regex to `/^(fa|ar|he|ur)(?:[-_]|$)/i` (matching `page-a11y.js`).
     - Gate `document.body.dataset.navbar = 'side'` on `document.body.classList.contains('has-navbar')` (in addition to `!document.body.dataset.navbar && !document.getElementById('login')`) so unauthenticated/login pages mounted asynchronously after `DOMContentLoaded` never receive `data-navbar="side"`.
  3. Update `BidarThemeMetadataTest::testRtlSidebarDoesNotRequireDataNavbarAttribute()` -> verify scoped `body[data-navbar="side"]`, `.has-navbar`, `@media screen and (min-width: 768px)`, single-container `.content`/`#content` offset (no `#main` double-offset), and zero duplicate `padding-right: var(--navbar-width)` on `.navbar-right`.

---

### Task 2 (Blocker #2 & #3, Major #8, Minor #11/#12): Dark/Light Token Consistency, Topbar Contrast, Undefined Variables & Import Hygiene
- **Files:**
  - `client/custom/modules/bidar-theme/css/bidar-tokens.css`
  - `client/custom/modules/bidar-theme/css/bidar-dark.css`
  - `client/custom/modules/bidar-theme/css/bidar-shell.css`
  - `client/custom/modules/bidar-theme/css/bidar-data.css`
  - `client/custom/modules/bidar-theme/css/bidar-overlays.css`
  - `client/custom/modules/bidar-theme/css/bidar-fonts.css`
  - `client/custom/modules/bidar-theme/css/bidar.css`
  - `client/custom/modules/bidar-theme/css/bidar-brut.css`
  - `client/custom/modules/bidar-theme/css/bidar-monochrome.css`
  - `client/custom/modules/bidar-theme/css/bidar-iframe.css`
  - `client/custom/modules/bidar-theme/css/bidar-iframe-dark.css`
  - `client/custom/modules/bidar-theme/css/bidar-iframe-brut.css`
  - `client/custom/modules/bidar-theme/css/bidar-iframe-brut-dark.css`
  - `client/custom/modules/bidar-theme/css/bidar-iframe-monochrome.css`
  - `client/custom/modules/bidar-theme/css/bidar-iframe-monochrome-dark.css`
- **Changes:**
  1. **Light-mode topbar contrast (`bidar-tokens.css`, `bidar-shell.css`, `bidar-detail.css`):**
     - In `bidar-tokens.css`: align light-mode `--bidar-topbar-bg` to a light translucent surface matching the light sidebar (`rgba(248, 250, 252, 0.92)`), consistent with `--navbar-bg: #eef5f9` in `bidar-espo-vars.css` and `bidar-shell.css` ("light side menu, translucent top bar"), so `--bidar-n-500` icons, `--bidar-hover` (`#f1f5f9`), `--bidar-text` (`#0f172a`), and `body[data-navbar="top"]` links all have >= 4.5:1 contrast.
     - In `bidar-detail.css`: set `background: transparent` on `body.bidar-band-page #navbar .navbar-right` so the topbar sits cleanly over the record band gradient.
     - In `bidar-shell.css`: use `var(--bidar-text-muted)` (not `--bidar-text-faint`) on `.global-search-button` for accessible contrast.
  2. **Dark-mode semantic tokens (`bidar-tokens.css`, `bidar-dark.css`):**
     - In `bidar-tokens.css`: bind `--bidar-brand-text: var(--bidar-brand)`, `--bidar-brand-mark: var(--bidar-brand)`, `--bidar-band-avatar-bg: var(--bidar-brand)`, `--bidar-band-avatar-text: var(--bidar-on-brand)`, `--bidar-band-primary-bg: var(--bidar-brand)`, `--bidar-band-primary-hover: var(--bidar-brand-hover)`, `--bidar-band-primary-text: var(--bidar-on-brand)`, `--bidar-band-focus: var(--bidar-brand-ring)`, `--bidar-sidebar-focus: var(--bidar-brand-ring)`, and `--bidar-focus-outline: 2px solid var(--bidar-brand-ring)` so dark mode automatically inherits accessible brand/focus/avatar colors.
     - In `bidar-dark.css`: explicitly redefine `--bidar-text: #eceef7`, `--bidar-text-secondary: #c9cde0`, `--bidar-text-muted: #9298b5`, `--bidar-hover: #2a2e4d`, `--bidar-border: #2a2e4d`, `--bidar-border-strong: #454b6c`, and `--bidar-signature: #2dd4bf` (high contrast with `--bidar-on-signature: #07131a`, > 9:1) and `--bidar-signature-gradient: linear-gradient(180deg, #2dd4bf, #5ccbf5)`. Also align `--bidar-n-0` fallback in Kanban rotten rules to `#1e293b`.
  3. **Remove undefined CSS custom properties (`bidar-data.css`, `bidar-overlays.css`):**
     - Replace `var(--bidar-primary, #0f766e)` with `var(--bidar-brand)`.
     - Replace `var(--bidar-border-light, #e2e8f0)` with `var(--bidar-border)`.
     - Replace `var(--bidar-border-hover, #cbd5e1)` with `var(--bidar-border-strong)`.
     - Replace `var(--bidar-text-sm, 13px)` with `var(--13px)`.
     - In `bidar-overlays.css` (`jdp-container`), use `var(--bidar-on-brand)` on `.jdp-day.selected` and footer buttons instead of hardcoded `#ffffff`.
  4. **Import order, duplicate rules & cache-busting (`bidar.css`, `bidar-data.css`, `bidar-rtl.css`, `bidar-fonts.css`, `bidar-*.css`):**
     - Load `bidar-rtl.css` **before** `bidar-dark.css` in `bidar.css` (and remove hardcoded light hex fallbacks `#ffffff` / `#e2e8f0` in `bidar-rtl.css` Kanban rotten rule).
     - Remove the duplicate `html[dir="rtl"] #main > .list-container > .list::before` block from `bidar-data.css` (keep it cleanly in `bidar-rtl.css`).
     - Synchronize `?v=1.1.0` across all `@import` statements in `bidar-brut.css`, `bidar-monochrome.css`, and `bidar-iframe*.css`.
     - In `bidar-fonts.css`, preserve monospace editors (`textarea.code-editor`, `textarea.formula-editor`, `.form-control.monospace`, `code, pre, kbd, samp, .ace_editor, .ace_editor *`) reliably by scoping element selectors or placing monospace overrides after with `:not(.monospace):not(.code-editor):not(.formula-editor)` / higher specificity without breaking `--bidar-font`.

---

### Task 3 (Major #6 & #7 & #9): Complete RTL Mirroring Across Detail/Shell/Data/Controls/Overlays, Login Centering, Dark Logo & Scoped Badges
- **Files:**
  - `client/custom/modules/bidar-theme/css/bidar-login.css`
  - `client/custom/modules/bidar-theme/css/bidar-dark.css`
  - `client/custom/modules/bidar-theme/css/bidar-shell.css`
  - `client/custom/modules/bidar-theme/css/bidar-detail.css`
  - `client/custom/modules/bidar-theme/css/bidar-data.css`
  - `client/custom/modules/bidar-theme/css/bidar-controls.css`
  - `client/custom/modules/bidar-theme/css/bidar-overlays.css`
  - `client/custom/modules/bidar-theme/css/bidar-rtl.css`
  - `extensions/bidar-theme/Resources/metadata/themes/Bidar.json`
- **Changes:**
  1. **Login page RTL & centered logo (`bidar-login.css`):**
     - Set `width: auto; max-width: 100%; height: auto;` on `#login .logo-container` (overriding EspoCRM `light.css`'s `width: 181px; height: 43px; overflow: hidden;`) so the `48px` logo is never clipped or stuck to one side and centers cleanly.
     - Keep RTL default on `#login` / `body:has(#login)` when `html` is not explicitly `dir="ltr"` (`html:not([dir="ltr"]) body:has(#login)`, `html:not([dir="ltr"]) #login`), and explicitly restore `direction: ltr; text-align: left;` under `html[dir="ltr"]`.
  2. **Dark-mode logo visibility (`Bidar.json`, `bidar-dark.css`, `bidar-shell.css`):**
     - Add `"logo": "client/custom/modules/bidar-theme/img/bidar-logo-dark.svg"` inside `bidarDark` in `Bidar.json` AND widen the dark-mode filter selector in `bidar-dark.css` / `bidar-shell.css` to also handle `img[src*="img/logo-light.svg"]`, `img[src*="bidar-logo.svg"]`, and `img[src*="img/logo.svg"]` (excluding `bidar-logo-dark.svg`).
  3. **Fix split/classic RTL record grid ordering (`bidar-rtl.css`):**
     - Replace `.bidar-record-grid > .bidar-content-card` with `.bidar-record-grid > .bidar-main, .bidar-record-grid > .bidar-content-column` (or rely cleanly on RTL flex order so Split is `[inspector(1), resizer(2), main/content-column(3)]` from right to left and Classic is `[content-column(1), resizer(2), inspector(3)]`).
  4. **Mirror directional rules across `bidar-detail.css`, `bidar-shell.css`, `bidar-data.css`, `bidar-controls.css`, `bidar-overlays.css`, and `bidar-rtl.css`:**
     - `bidar-detail.css` / `bidar-rtl.css`:
       - Inline header buttons (`#main.bidar-band-inline-actions > .page-header .header-buttons`): use `inset-inline-end` instead of `right` and `margin-inline-start` instead of `margin-left` on `.detail-button-container:not(.stick-sub)`.
       - Dropdown menu alignment on `.bidar-band .detail-button-container .dropdown-menu`: `inset-inline-end: 0; inset-inline-start: auto;` (so in RTL it opens rightward from the left-side action bar rather than overflowing off-screen left).
       - `.bidar-person` chips: `padding-block: 2px; padding-inline: 2px var(--10px);` and `.bidar-person-empty` / `.bidar-team`: `padding-inline-start: var(--10px)`.
       - `.bidar-pipeline-off`: `margin-inline-start: auto;`. Narrow pipeline toggle & steps: `text-align: start;`.
       - RTL pipeline chevrons (`html[dir="rtl"] .bidar-step-inner`): mirror `clip-path` polygons to point leftward (`polygon(12px 0, 100% 0, calc(100% - 12px) 50%, 100% 100%, 12px 100%, 0 50%)`) and flip `:first-child` / `:last-child` radii (`0 8px 8px 0` / `8px 0 0 8px`).
       - Inspector `.cell`: `padding-inline: 0 var(--20px)` and `.inline-edit-link`: `inset-inline-end: 0; right: auto;` (with `padding-inline-end: 0` when editing).
       - `.bidar-tabbar`: `padding-block: 0; padding-inline: var(--10px) 50px;` and `.bidar-tabbar > .bidar-collapse`: `inset-inline-end: var(--20px); right: auto;`.
       - Card corner accents (`.bidar-layout-classic .bidar-content-card::before`, `.bidar-record .bidar-inspector-card::before`): mirror to top-right (`inset-inline-start: -1px; left: auto; border-inline-start: 3px solid var(--bidar-signature); border-start-start-radius: var(--bidar-radius-lg);` using logical border/radius or explicit `html[dir="rtl"]` overrides).
       - Stream timeline (`li.list-group-item`): `padding-block: 0 var(--20px); padding-inline: 0 var(--32px);`, `.stream-date-container` `text-align: end`, `.reactions-container` `margin-inline-start: 0`, timeline rail `::after` using `inset-inline-start: calc(var(--bidar-stream-date-width) + var(--12px) + 11px); left: auto;`, action buttons `.right-container, .cell-buttons` using `inset-inline-end: 0; right: auto;`, and `.panel[data-name="activities"] li.list-group-item` using `border-inline-start: 3px solid var(--bidar-brand-subtle);` and logical radii.
       - `.bidar-collapse`: `margin-inline-start: auto; margin-left: 0;` and collapsed chevron rotation `rotate(90deg)` in RTL (`bidar-detail.css` & `bidar-shell.css`).
     - `bidar-shell.css`: use logical `padding-inline-start` / `padding-inline-end` on `.navbar-header`, `.tab-divider > div`, `input.global-search-input`, `.bidar-scheme-check` (`margin-inline-start: auto; padding-inline-start: var(--20px);`).
     - `bidar-data.css`: use logical `border-inline-end` on `th` (`:last-child { border-inline-end: 0; }`) and `padding-inline-start` on `:not(:first-child)`.
     - `bidar-controls.css` & `bidar-overlays.css`: use `margin-inline-start: var(--6px)` on `.btn-group > .btn + .btn` (and `.input-group-btn:not(:first-child) > .btn.btn-text`), and in `bidar-rtl.css` (inside `@media (min-width: 768px)`) mirror EspoCRM 10 side-panel modals (`.modal:not(.dialog-confirm):not(.dialog-centered) > .modal-dialog`) to dock on the **left** (`margin: 0 auto 0 0;`) with mirrored right border/radius/shadow so they don't collide with the RTL right sidebar.
  5. **Tighten overbroad `[class*="badge"]` (`bidar-data.css`):**
     - Replace `[class*="badge"]` with explicit `.badge, .label, .bidar-badge, .number-badge, td[data-name="status"] > .field > span, td[data-name="stage"] > .field > span` so `#navbar .notifications-badge-container` and other layout wrappers are unaffected.

---

### Task 4 (Blocker #5 & Minor #13): Fix `AfterInstall.php` Persistence & Extension Metadata/i18n
- **Files:**
  - `extensions/bidar-theme/scripts/AfterInstall.php`
  - `extensions/bidar-theme/Resources/i18n/fa_IR/Preferences.json` (new)
  - `extensions/bidar-theme/Resources/i18n/en_US/Preferences.json` (new)
  - `extensions/bidar-theme/Resources/i18n/fa_IR/Global.json`
  - `extensions/bidar-brand/Resources/i18n/fa_IR/Global.json`
  - `extensions/bidar-brand/Resources/metadata/app/adminPanel.json`
- **Changes:**
  1. In `AfterInstall.php`: track `$changed = false`, call `$configWriter->save()` when `$changed` is true, and remove unused `use Espo\ORM\EntityManager;`.
  2. Add `extensions/bidar-theme/Resources/i18n/{fa_IR,en_US}/Preferences.json` for `bidarColorScheme`, `bidarDensity`, `bidarLayout` (labels + options).
  3. Unify `themes.Bidar` label across `bidar-theme` and `bidar-brand` (`"بیدار (پوسته راست‌چین)"` or `"بیدار (پیش‌فرض RTL)"` consistently, keeping existing test keys intact).
  4. Replace `fas fa-euro-sign` with `fas fa-coins` in `extensions/bidar-brand/Resources/metadata/app/adminPanel.json` for Currency.

---

### Task 5 (Major #10): Harden `scripts/apply-whitelabel.php` Safety, Escaping, Multi-Line Config & Idempotency
- **Files:**
  - `scripts/apply-whitelabel.php`
  - `extensions/bidar-brand/tests/ApplyWhitelabelTest.php`
- **Changes:**
  1. Replace `preg_replace` dynamic replacement strings in `patchMainHtml()`, `patchInstallerTemplates()`, `patchDefaultsConfig()`, and `replaceOrInsertConfigParam()` with `preg_replace_callback()` so `$0`/`$1`/`\1` in brand values cannot cause backreference corruption.
  2. Escape all HTML/attribute interpolations (`$name`, `$nameFa`, `$taglineFa`, `$copyrightFa`, `$websiteUrl`, `$supportUrl`) with `htmlspecialchars(..., ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')` and validate URL schemes (`http`/`https`).
  3. Upgrade `replaceOrInsertConfigParam()` to match and replace both single-line scalars and balanced multi-line `[ ... ]` arrays cleanly without leaving dangling elements or duplicate keys.
  4. Validate `json_decode()` with `json_last_error() === JSON_ERROR_NONE` and `is_array()` in `patchInstallerI18n()` and `patchInstallerThemes()` (throw `\RuntimeException` on malformed JSON instead of wiping translations with `?: []`).
  5. Guard all file writes with `if ($newContent !== $content)` (including `install.js` in `patchInstallerDemoDataSeeder()`) while continuing to return `true` when the file exists and already matches the patched output (preserving `ApplyWhitelabelTest::testApplyWhitelabelIsIdempotent()`), and throw `\RuntimeException` on read/write/copy/mkdir failures.
  6. In the generated `install/core/actions/seedDemoData.php`, add `class_exists(\Espo\Modules\BidarSales\Seed\DemoDataSeeder::class)` guard and safe `while (ob_get_level() > 0) { ob_end_clean(); }` before sending JSON. Also support `<html ...>` with existing attributes in `index.tpl` (`/<html\b([^>]*)>/i`) and copy `favicon.ico` only if `$assets['faviconIco']` is configured and exists on disk (never copying `bidar-favicon.svg` to `favicon.ico`).

---

### Task 6: TDD Red-Green Tests & Verification
- **Files:**
  - `extensions/bidar-theme/tests/BidarThemeMetadataTest.php`
  - `extensions/bidar-brand/tests/ApplyWhitelabelTest.php`
- **Test Cases (Red first, then Green):**
  - `BidarThemeMetadataTest`:
    - `AfterInstall.php` calls `$configWriter->save()`.
    - `bidar-rtl.css` scopes side-navbar layout to `body[data-navbar="side"]`, `.has-navbar`, `@media screen and (min-width: 768px)`, does NOT apply sidebar margin to `#main`, does NOT set `padding-right: var(--navbar-width)` alongside `width: calc(100vw - var(--navbar-width))`, and mirrors detail/stream/pipeline/modal rules.
    - `bidar-login.css` resets `#login .logo-container` `width`/`height` and respects `html[dir="ltr"]`.
    - `bidar-tokens.css` & `bidar-dark.css`: light topbar has light surface matching `--bidar-n-500`/`--bidar-text`; dark mode defines `--bidar-text`, `--bidar-border`, `--bidar-hover`, `--bidar-signature` (`#2dd4bf`); zero undefined `--bidar-primary` / `--bidar-border-light` / `--bidar-border-hover` / `--bidar-text-sm` references; all `@import` `?v=` match `1.1.0`; `Bidar.json` defines `bidarDark.logo`.
    - `bidar-data.css` does not contain `[class*="badge"]` and keeps `white-space: nowrap !important;` on explicit badge/status selectors.
    - `Preferences.json` i18n exists for `fa_IR` and `en_US`.
  - `ApplyWhitelabelTest`:
    - `patchInstallerDemoDataSeeder()` full flow + idempotency (`step4.tpl`, `install.js`, `Utils.php`, `Installer.php`, `seedDemoData.php`).
    - Multi-line array replacement in `defaults/config.php` (`currencyList`, `phoneNumberPreferredCountryList`) parses cleanly and has no duplicate keys.
    - Brand strings containing `$1`, `\1`, `&`, `"`, `<` are escaped in HTML and preserved verbatim in PHP config without backreference corruption.
    - Malformed `install.json` throws `\RuntimeException` instead of silently wiping translations.
- **Verification Commands:**
  - `php -l scripts/apply-whitelabel.php`
  - `php -l extensions/bidar-theme/scripts/AfterInstall.php`
  - `./vendor/bin/phpunit -c extensions/phpunit.xml extensions/bidar-brand/tests extensions/bidar-theme/tests`
