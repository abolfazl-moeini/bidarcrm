# Section 3 Pass 2 Plan Re-Review (Qoder HungerG)

**Verdict:** `APPROVE WITH REVISIONS`

The remediation plan in [cycle2-section-3-plan.md](file:///Users/moeini/Dev/didar/docs/reviews/cycle2-section-3-plan.md) addresses all 5 Blockers, 5 Majors, 3 Minors, and test gaps from [cycle2-section-3-pass1-agy.md](file:///Users/moeini/Dev/didar/docs/reviews/cycle2-section-3-pass1-agy.md). Five targeted adjustments are needed before implementation to prevent a `DOMContentLoaded` timing bug on `#login`, a dark-mode contrast gap on record band avatars, a mobile modal regression, a subtle stream date alignment issue, and an idempotency test failure in `ApplyWhitelabelTest`.

---

## Evaluation by Area

### 1. Task 1 — RTL Side-Navbar Docking, Guards & `appearance.js`
- **`bidar-rtl.css` & `light.css` alignment:** Wrapping side-navbar docking in `@media screen and (min-width: 768px)`, scoping selectors to `html[dir="rtl"] body[data-navbar="side"]` / `body[data-direction="rtl"][data-navbar="side"]` and `.has-navbar`, removing the `#main` double-offset in favor of EspoCRM's single-container `.content` / `#content` padding model, and removing the duplicate `padding-right: var(--navbar-width)` on `#navbar .navbar-right` directly resolve Blocker #1. Explicitly resetting `body:not(.has-navbar) > footer { margin-left: 0; margin-right: 0; }` and mirroring sidebar submenus (`li.tab-group > .dropdown-menu`, `li.more > .dropdown-menu`) and `.minimizer` / `.group-caret` matches `build/release/client/css/espo/light.css`.
- **`BidarThemeMetadataTest.php`:** Updating `testRtlSidebarDoesNotRequireDataNavbarAttribute()` to assert scoped `body[data-navbar="side"]`, `.has-navbar`, `@media screen and (min-width: 768px)`, and no `#main` / duplicate `padding-right` rules is required and consistent.
- **Revision needed in `appearance.js`:**
  - Aligning the RTL regex to `/^(fa|ar|he|ur)(?:[-_]|$)/i` matches [page-a11y.js](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/src/handlers/page-a11y.js#L26).
  - However, checking `!document.getElementById('login')` in `ensureLayoutDefaults()` will **not** prevent `dataset.navbar = 'side'` from being set on `#login`: `appearance.js` runs in `<head>` and schedules `ensureLayoutDefaults()` on `DOMContentLoaded`, before EspoCRM's Backbone router mounts `#login` into the DOM.
  - **Adjustment:** Gate `document.body.dataset.navbar = 'side'` on `document.body.classList.contains('has-navbar')` (in addition to `!document.body.dataset.navbar && !document.getElementById('login')`), so unauthenticated/login pages without `.has-navbar` never receive `data-navbar="side"`.

### 2. Task 2 — Light-Mode Topbar & Dark-Mode Token Completeness
- **Light-mode topbar (`--bidar-topbar-bg`):** Moving `--bidar-topbar-bg` in [bidar-tokens.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-tokens.css#L117) to `rgba(248, 250, 252, 0.92)` aligns with `--navbar-bg: #eef5f9` in [bidar-espo-vars.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-espo-vars.css#L161) and restores >= 4.5:1 contrast for `--bidar-n-500` (`#656b7c`), `--bidar-text` (`#0f172a`), and `body[data-navbar="top"]` (`--bidar-sidebar-text`: `#334155`). Setting `background: transparent` on `body.bidar-band-page #navbar .navbar-right` in [bidar-detail.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-detail.css#L38) and switching `.global-search-button` in [bidar-shell.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-shell.css#L226) to `var(--bidar-text-muted)` resolves Blocker #3.
- **Dark-mode token completeness:** Redefining `--bidar-text`, `--bidar-text-secondary`, `--bidar-text-muted`, `--bidar-hover`, `--bidar-border`, `--bidar-border-strong`, `--bidar-signature` (`#2dd4bf`), and `--bidar-signature-gradient` in [bidar-dark.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-dark.css), and deriving `--bidar-brand-text`, `--bidar-brand-mark`, `--bidar-band-avatar-bg`, `--bidar-band-primary-*`, `--bidar-band-focus`, and `--bidar-focus-outline` from `--bidar-brand*` / `--bidar-on-brand` in `bidar-tokens.css`, ensures [bidar-espo-vars.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-espo-vars.css) and `bidar-detail.css` inherit dark values cleanly.
- **Revision needed in `bidar-tokens.css`:**
  - Also bind `--bidar-band-avatar-text: var(--bidar-on-brand)` (currently hardcoded `#ffffff` at [bidar-tokens.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-tokens.css#L127), which yields ~2.86:1 contrast on dark-mode `--bidar-brand: #8f93ff`) and `--bidar-sidebar-focus: var(--bidar-brand-ring)` (currently `var(--primary)` at [bidar-tokens.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-tokens.css#L148)).
- **Undefined variables, import order & fonts:** Replacing `--bidar-primary`, `--bidar-border-light`, `--bidar-border-hover`, `--bidar-text-sm`, and hardcoded `#ffffff` in `bidar-data.css` and `bidar-overlays.css`, moving `bidar-rtl.css` before `bidar-dark.css` in [bidar.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar.css#L18-L20), deduplicating `#main > .list-container > .list::before`, syncing `?v=1.1.0` across `bidar-brut.css`, `bidar-monochrome.css`, and all 6 `bidar-iframe*.css` files, and preserving monospace editors in `bidar-fonts.css` (while keeping `code,`, `pre,`, `.ace_editor`, `monospace !important` for `testMonospaceFontPreservation()`) are all sound.

### 3. Task 3 — `bidar-login.css`, `Bidar.json` Dark Logo, `bidar-detail.css` RTL & `[class*="badge"]`
- **`bidar-login.css`:** Overriding `#login .logo-container` with `width: auto; max-width: 100%; height: auto;` resolves `light.css`'s `181px × 43px` clipping.
  - **Minor adjustment:** Prefer `html:not([dir="ltr"]) body:has(#login)` and `html:not([dir="ltr"]) #login` over `:where(html:not([dir="ltr"]) *)` — it is simpler, avoids `:where(... *)` descendant matching, and still satisfies `BidarThemeMetadataTest::testLoginPageHasDirectRtlAndCenteredLogo()`.
- **`Bidar.json` `bidarDark.logo`:** Adding `"logo": "client/custom/modules/bidar-theme/img/bidar-logo-dark.svg"` in `bidarDark` and widening the filter selector in `bidar-dark.css` / `bidar-shell.css` while excluding `bidar-logo-dark.svg` resolves the invisible dark-mode logo.
- **`bidar-detail.css` & `bidar-rtl.css` RTL mirroring:**
  - Replacing `.bidar-content-card` with `.bidar-main, .bidar-content-column` in `bidar-rtl.css` fixes Split/Classic column ordering and resizer placement.
  - Logical property conversions (`inset-inline-*`, `margin-inline-*`, `padding-inline-*`, `border-inline-*`, `text-align: start`) for inline header buttons, `.detail-button-container .dropdown-menu`, `.bidar-person`, `.bidar-pipeline-off`, inspector `.cell` / `.inline-edit-link`, `.bidar-tabbar`, card corner `::before` accents, stream timeline rail/actions, `.bidar-collapse` (`rotate(90deg)` in RTL), `bidar-shell.css`, `bidar-data.css`, and `bidar-controls.css` are complete.
  - **Two adjustments:**
    1. In [bidar-detail.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-detail.css#L1241-L1248), also convert `.stream-date-container` `text-align: right` to `text-align: end` and `.reactions-container` `margin-left: 0` to `margin-inline-start: 0` so dates align against the timeline rail in RTL.
    2. In `bidar-rtl.css`, wrap the left-docked side-panel modal rule (`.modal:not(.dialog-confirm):not(.dialog-centered) > .modal-dialog`) inside `@media (min-width: 768px)` to match [bidar-overlays.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-overlays.css#L92-L104).
- **`[class*="badge"]` scoping:** Replacing `[class*="badge"]` with explicit `.badge, .label, .bidar-badge, .number-badge, td[data-name="status"] > .field > span, td[data-name="stage"] > .field > span` in [bidar-data.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-data.css#L242-L251) (and updating `testBadgesHaveNoWrapInDataCss()`) prevents leakage into `#navbar .notifications-badge-container`.

### 4. Task 4 — `AfterInstall.php`, `Preferences.json` i18n & `manifest.json`
- [AfterInstall.php](file:///Users/moeini/Dev/didar/extensions/bidar-theme/scripts/AfterInstall.php): Tracking `$changed` and calling `$configWriter->save()` when `$changed` is true, plus removing unused `use Espo\ORM\EntityManager;`, fixes Blocker #5.
- Adding `extensions/bidar-theme/Resources/i18n/{fa_IR,en_US}/Preferences.json`, unifying `themes.Bidar` to `"بیدار (پیش‌فرض RTL)"` (matching `BidarThemeMetadataTest::testWhiteLabelApplierPatchesInstaller()`), and changing Currency's icon in [adminPanel.json](file:///Users/moeini/Dev/didar/extensions/bidar-brand/Resources/metadata/app/adminPanel.json#L34) to `fas fa-coins` are all clean.
- Both [bidar-theme/manifest.json](file:///Users/moeini/Dev/didar/extensions/bidar-theme/manifest.json) and [bidar-brand/manifest.json](file:///Users/moeini/Dev/didar/extensions/bidar-brand/manifest.json) remain untouched at `1.0.4`.

### 5. Task 5 — `scripts/apply-whitelabel.php`, `ApplyWhitelabelTest.php` & `build-release.sh`
- `preg_replace_callback()`, `htmlspecialchars(..., ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')` + `http`/`https` URL validation, balanced multi-line `[ ... ]` handling in `replaceOrInsertConfigParam()`, strict `json_last_error() === JSON_ERROR_NONE && is_array()` checks on `install.json`, `class_exists(...)` + `while (ob_get_level() > 0) { ob_end_clean(); }` in `seedDemoData.php`, and `/<html\b([^>]*)>/i` in `index.tpl` are all solid and compatible with [build-release.sh](file:///Users/moeini/Dev/didar/scripts/build-release.sh#L213-L215).
- **Two adjustments required:**
  1. **Idempotent return values vs `ApplyWhitelabelTest::testApplyWhitelabelIsIdempotent()`:** [ApplyWhitelabelTest.php](file:///Users/moeini/Dev/didar/extensions/bidar-brand/tests/ApplyWhitelabelTest.php#L223-L227) asserts `$this->assertTrue($secondRun['mainHtml'])`, `$this->assertTrue($secondRun['siteFooter'])`, and `$this->assertTrue($secondRun['aboutTemplate'])` on the second run. When guarding writes with `if ($newContent !== $content)` to skip redundant disk I/O, keep returning `true` when the file exists and already matches the patched output.
  2. **Resolve `favicon.ico` handling:** [ApplyWhitelabelTest.php](file:///Users/moeini/Dev/didar/extensions/bidar-brand/tests/ApplyWhitelabelTest.php#L207-L212) does **not** assert `favicon.ico`, and `assets/brand/` contains only `bidar-favicon.svg` (no `.ico` file). Update `copyBrandAssets()` to copy `favicon.ico` only if `$assets['faviconIco']` is configured and exists on disk — never copy `bidar-favicon.svg` to `favicon.ico`.

### 6. `client/custom/modules/bidar-theme/lib/module-bidar-theme.js` Rebuild Check
- **No rebuild needed.** None of the files under `client/custom/modules/bidar-theme/src/` are modified in the plan. `client/custom/modules/bidar-theme/js/appearance.js` is a standalone pre-stylesheet script loaded directly via `client.json` (`scriptList`) and is not bundled into `lib/module-bidar-theme.js`.

---

## Exact Plan Adjustments Needed

1. **Task 1 (`appearance.js`):** Require `document.body.classList.contains('has-navbar')` before setting `document.body.dataset.navbar = 'side'` (since `#login` is mounted asynchronously after `DOMContentLoaded`).
2. **Task 2 (`bidar-tokens.css`):** Also set `--bidar-band-avatar-text: var(--bidar-on-brand)` and `--bidar-sidebar-focus: var(--bidar-brand-ring)`.
3. **Task 3 (`bidar-login.css`, `bidar-detail.css`, `bidar-rtl.css`):**
   - Use `html:not([dir="ltr"]) body:has(#login)` / `html:not([dir="ltr"]) #login` in `bidar-login.css`.
   - Convert `.stream-date-container` `text-align: right` -> `text-align: end` and `.reactions-container` `margin-left: 0` -> `margin-inline-start: 0` in `bidar-detail.css`.
   - Wrap the RTL left-docked side-panel modal rule in `bidar-rtl.css` in `@media (min-width: 768px)`.
4. **Task 5 (`scripts/apply-whitelabel.php`):**
   - Skip `file_put_contents()` when `$newContent === $content`, but continue returning `true` for already-patched files so `ApplyWhitelabelTest::testApplyWhitelabelIsIdempotent()` passes.
   - Copy `favicon.ico` only when `$assets['faviconIco']` is set and exists; remove the `copy($faviconSvgSrc, $targetImgDir . '/favicon.ico')` fallback.

