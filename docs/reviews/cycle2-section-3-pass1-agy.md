# Section 3 Pass 1 Code Review

Scope reviewed (read-only): `extensions/bidar-theme/`, `extensions/bidar-brand/`, `client/custom/modules/bidar-theme/`, and `scripts/apply-whitelabel.php`, cross-checked against `build/release/client/css/espo/light.css` (EspoCRM 10.1.4 base styles).

---

## Blocker

### 1. Double-offset on `#content` + `#main`, unguarded sidebar docking in RTL (breaks `/`, `#login`, `top` navbar, mobile, and topbar width)
- **Files & Lines:**
  - [bidar-rtl.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-rtl.css#L229-L324)
  - [appearance.js](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/js/appearance.js#L70-L81)
  - [BidarThemeMetadataTest.php](file:///Users/moeini/Dev/didar/extensions/bidar-theme/tests/BidarThemeMetadataTest.php#L220-L236)
- **Root Cause:**
  1. **Double right margin (`#content` AND `#main`):** In EspoCRM's DOM, `#main` is nested inside `#content` (`#content > #main` in [light.css](file:///Users/moeini/Dev/didar/build/release/client/css/espo/light.css)). [bidar-rtl.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-rtl.css#L244-L270) applies `margin-right: var(--navbar-width) !important` (and `var(--navbar-minimized-width) !important` when `.minimized`) to **both** `#content` and `#main`, shifting `#main` left by **2 × `--navbar-width`**.
  2. **Missing `.has-navbar` and `body[data-navbar="side"]` guards:** The first selectors in each rule block (`html[dir="rtl"] #navbar > .navbar`, `html[dir="rtl"] #content`, `html[dir="rtl"] #main`, `html[dir="rtl"] #navbar .navbar-right`, `html[dir="rtl"] body > footer`) omit `body[data-navbar="side"]` and `.has-navbar`. Because [appearance.js](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/js/appearance.js#L74-L80) sets `root.dir = 'rtl'` and `document.body.dataset.navbar = 'side'` globally:
     - On `#login` (where `body` lacks `.has-navbar`), `#content`, `#main`, and `footer` are pushed left by `var(--navbar-width)` (twice for `#main`), shifting the login card and footer off-center.
     - In `body[data-navbar="top"]` mode, `#navbar .navbar`, `#navbar .navbar-right`, `#content`, `#main`, and `footer` still receive side-navbar offsets and `width: calc(100vw - var(--navbar-width)) !important`.
  3. **Missing `@media screen and (min-width: 768px)` guard:** Unlike [light.css](file:///Users/moeini/Dev/didar/build/release/client/css/espo/light.css) (which wraps all side-navbar offsets and `#navbar .navbar-right` positioning in `@media screen and (min-width: 768px)`), [bidar-rtl.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-rtl.css#L229-L324) applies them unconditionally, breaking mobile (`<= 767px`) layouts.
  4. **Squeezed `#navbar .navbar-right`:** [bidar-rtl.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-rtl.css#L273-L297) sets **both** `width: calc(100vw - var(--navbar-width)) !important`, `margin-right: var(--navbar-width) !important`, **and** `padding-right: var(--navbar-width) !important` (in `light.css`, `padding-left: var(--navbar-width)` was only used because `width` remained `100vw`). Combined, this creates an extra `--navbar-width`-wide dead zone inside the top bar.
- **Remediation:**
  1. Wrap all side-navbar RTL docking rules in `@media screen and (min-width: 768px)`.
  2. Scope every selector strictly to `html[dir="rtl"] body[data-navbar="side"]` (and `.has-navbar` for content offset), removing the unscoped `html[dir="rtl"] #content`, `html[dir="rtl"] #main`, `html[dir="rtl"] #navbar .navbar-right`, and `html[dir="rtl"] body > footer` selectors.
  3. Match EspoCRM's single-container offset model: offset only `.has-navbar > .content` / `#content` (using `padding-right: calc(var(--navbar-width) + var(--container-padding))` and `margin-right: auto`), **not** `#main`.
  4. On `#navbar .navbar-right`, when `width: calc(100vw - var(--navbar-width))` and `margin-right: var(--navbar-width)` are set, set `padding-right: 0; padding-left: 0;` (same for `.minimized` with `--navbar-minimized-width`).
  5. Update `testRtlSidebarDoesNotRequireDataNavbarAttribute()` in [BidarThemeMetadataTest.php](file:///Users/moeini/Dev/didar/extensions/bidar-theme/tests/BidarThemeMetadataTest.php#L220-L236) to verify scoped `.has-navbar` / `body[data-navbar="side"]` / `@media (min-width: 768px)` rules instead of asserting the buggy unscoped `#main` / `#content` selectors.

### 2. Dark mode leaves core surface/text/border tokens at light-mode values (`#0f172a` text on `#1e293b` background)
- **Files & Lines:**
  - [bidar-tokens.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-tokens.css#L44-L46), [L75-L84](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-tokens.css#L75-L84), [L125-L130](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-tokens.css#L125-L130)
  - [bidar-dark.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-dark.css#L11-L66)
  - [bidar-espo-vars.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-espo-vars.css#L42-L44), [L81](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-espo-vars.css#L81), [L156](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-espo-vars.css#L156), [L182-L185](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-espo-vars.css#L182-L185), [L200-L202](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-espo-vars.css#L200-L202)
- **Root Cause:**
  In [bidar-tokens.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-tokens.css#L75-L84), semantic tokens are bound to literal light hex values rather than `--bidar-n-*` / `--bidar-brand`:
  - `--bidar-border: var(--border)` (`#E2E8F0`)
  - `--bidar-border-strong: var(--border-strong)` (`#CBD5E1`)
  - `--bidar-hover: #f1f5f9`
  - `--bidar-text: #0f172a`
  - `--bidar-text-secondary: #475569`
  - `--bidar-text-muted: #64748b`
  - `--bidar-brand-text: var(--primary)` (`#0F766E`) and `--bidar-brand-mark: var(--primary)` (`#0F766E`)
  - `--bidar-signature: #0F766E`
  - `--bidar-band-avatar-bg`, `--bidar-band-primary-bg`, `--bidar-band-primary-hover`, `--bidar-band-focus`, `--bidar-focus-outline` all reference `var(--primary)` (`#0F766E`) and `--bidar-band-primary-text: #ffffff`.

  [bidar-dark.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-dark.css#L15-L66) redefines `--bidar-n-0..900`, `--bidar-canvas`, `--bidar-surface`, `--bidar-surface-sunken`, `--bidar-border-input`, `--bidar-text-faint`, and `--bidar-brand`, **but omits all of the tokens above**. As a result, in dark mode:
  1. `--text-color` (`var(--bidar-text)`) renders **`#0f172a` (near-black) text on `#1e293b` (`--bidar-surface`) and `#090d16` (`--bidar-canvas`)**.
  2. `--bidar-hover` stays `#f1f5f9` (blinding white hover flash on dark buttons, dropdowns, topbar links, and collapse controls).
  3. `--bidar-border` and `--bidar-border-strong` remain bright `#E2E8F0` / `#CBD5E1` around every card, modal, panel, and table.
  4. `--bidar-brand-text` and `--bidar-brand-mark` remain `#0F766E` (dark teal on `#1e293b` / `#252a55`, ~2.1–2.5:1 contrast).
  5. `--bidar-signature` remains `#0F766E` while [bidar-dark.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-dark.css#L38) sets `--bidar-on-signature: #07131a` (~3.7:1 contrast, failing WCAG AA for pipeline stage chips/toggles in [bidar-detail.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-detail.css#L335-L450)).
- **Remediation:**
  1. In [bidar-tokens.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-tokens.css), derive `--bidar-brand-text: var(--bidar-brand)`, `--bidar-brand-mark: var(--bidar-brand)`, `--bidar-band-avatar-bg: var(--bidar-brand)`, `--bidar-band-primary-bg: var(--bidar-brand)`, `--bidar-band-primary-hover: var(--bidar-brand-hover)`, `--bidar-band-primary-text: var(--bidar-on-brand)`, `--bidar-band-focus: var(--bidar-brand-ring)`, and `--bidar-focus-outline: 2px solid var(--bidar-brand-ring)`.
  2. In [bidar-dark.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-dark.css), explicitly redefine `--bidar-text: #eceef7` (`var(--bidar-n-900)`), `--bidar-text-secondary: #c9cde0`, `--bidar-text-muted: #9298b5`, `--bidar-hover: #2a2e4d`, `--bidar-border: #2a2e4d`, `--bidar-border-strong: #454b6c`, and set `--bidar-signature: #00b6ed` (or `#2dd4bf`) to provide high contrast with `--bidar-on-signature: #07131a`.

### 3. Light-mode topbar (`#111827`) has broken icon/link/hover contrast against light-mode foreground tokens
- **Files & Lines:**
  - [bidar-tokens.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-tokens.css#L7), [L117](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-tokens.css#L117)
  - [bidar-shell.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-shell.css#L166-L194), [L222-L239](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-shell.css#L222-L239)
  - [bidar-espo-vars.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-espo-vars.css#L161-L166)
  - [bidar-detail.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-detail.css#L38-L50)
- **Root Cause:**
  [bidar-tokens.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-tokens.css#L7) defines `--shell-topbar: #111827` (near-black) and `--bidar-topbar-bg: var(--shell-topbar)`, contradicting `--navbar-bg: #eef5f9` in [bidar-espo-vars.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-espo-vars.css#L161). In light mode:
  - [bidar-shell.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-shell.css#L186) colors topbar icons with `--bidar-n-500` (`#656b7c` on `#111827` ≈ 3.3:1 contrast) and hover/open states with `--bidar-hover` (`#f1f5f9` bright flash) + `--bidar-text` (`#0f172a`).
  - On `body.bidar-band-page`, [bidar-detail.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-detail.css#L38-L50) applies `--bidar-band-muted` (`#475569`) to `#navbar .navbar-right > li > a` while `background: var(--bidar-topbar-bg)` (`#111827`) from `bidar-shell.css` remains active — resulting in `#475569` icons on `#111827` (~2.1:1 contrast, nearly invisible).
  - In `body[data-navbar="top"]`, [bidar-shell.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-shell.css#L230-L235) paints `#navbar .navbar` with `#111827` while EspoCRM's navbar links still use `--navbar-inverse-link-color` / `--bidar-sidebar-text` (`#334155`, ~1.5:1 contrast on `#111827`).
  - Inside the search bar, [bidar-shell.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-shell.css#L226) colors `.global-search-button` with `--bidar-text-faint` (`#94a3b8` on `#ffffff` `--input-bg` ≈ 2.56:1 contrast).
- **Remediation:**
  1. Either set `--bidar-topbar-bg` in light mode to a light translucent/solid surface matching the light sidebar (e.g., `rgba(248, 250, 252, 0.9)` / `#ffffff`, consistent with `--navbar-bg: #eef5f9`), OR introduce dedicated `--bidar-topbar-text` / `--bidar-topbar-hover` tokens if a dark topbar is desired in light mode.
  2. On `body.bidar-band-page #navbar .navbar-right` in [bidar-detail.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-detail.css#L38), set `background: transparent` so the top bar sits over the record band gradient as intended.
  3. Change `.global-search-button` color in [bidar-shell.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-shell.css#L226) from `--bidar-text-faint` to `--bidar-text-muted` (or `--bidar-text-secondary`).

### 4. Split record layout column ordering in RTL is reversed and breaks the column resizer
- **Files & Lines:**
  - [bidar-rtl.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-rtl.css#L20-L48)
  - [detail.tpl](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/res/templates/record/detail.tpl#L55-L86)
  - [detail-content.tpl](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/res/templates/record/detail-content.tpl#L55-L89)
  - [detail-classic.tpl](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/res/templates/record/detail-classic.tpl#L55-L87)
- **Root Cause:**
  [bidar-rtl.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-rtl.css#L33-L39) targets `.bidar-record-grid > .bidar-content-card` for flex `order: 3` (split) and `order: 1` (classic). However, `.bidar-content-card` is **never** a direct child of `.bidar-record-grid`:
  - [detail.tpl](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/res/templates/record/detail.tpl#L82) has `<section class="bidar-main">` as the direct child.
  - [detail-content.tpl](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/res/templates/record/detail-content.tpl#L71) and [detail-classic.tpl](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/res/templates/record/detail-classic.tpl#L56) have `<div class="left bidar-content-column">` as the direct child (wrapping `.bidar-content-card`).
  Because `.bidar-main` and `.bidar-content-column` retain default `order: 0`, in **Split layout** (`order: 0 < 1 < 2`) they render **first (on the right)**, followed by `.bidar-inspector` (`order: 1`) in the middle, and `.bidar-resizer` (`order: 2`) on the far left — swapping the columns and detaching the drag handle from between them.
- **Remediation:**
  Replace `.bidar-content-card` with `.bidar-main, .bidar-content-column` in [bidar-rtl.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-rtl.css#L33-L48) (or remove the redundant `order` overrides where `direction: rtl` flex flow already orders DOM children right-to-left: inspector -> resizer -> main in split, content-column -> resizer -> inspector in classic).

### 5. `AfterInstall::run()` never persists config changes (`$configWriter->save()` missing)
- **Files & Lines:** [AfterInstall.php](file:///Users/moeini/Dev/didar/extensions/bidar-theme/scripts/AfterInstall.php#L14-L27)
- **Root Cause:** `ConfigWriter::set('theme', ...)` and `ConfigWriter::set('bidarLayout', ...)` only stage changes in memory; `save()` is never called, so installing the `BidarTheme` extension silently fails to set the default theme or `bidarLayout` in `data/config.php`.
- **Remediation:** Track whether any value was updated and call `$configWriter->save();` before `run()` returns. Also remove the unused `use Espo\ORM\EntityManager;` on [line 7](file:///Users/moeini/Dev/didar/extensions/bidar-theme/scripts/AfterInstall.php#L7).

---

## Major

### 6. Un-mirrored LTR layout, coordinates, and icons across `bidar-detail.css`, `bidar-shell.css`, `bidar-data.css`, `bidar-controls.css`, and `bidar-overlays.css`
- **Files & Lines & Root Causes:**
  1. **Record band action buttons & header buttons ([bidar-detail.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-detail.css#L153-L189), [L252-L263](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-detail.css#L252-L263)):**
     - `#main.bidar-band-inline-actions > .page-header .header-buttons` uses `right: calc(...)` (L171), placing Follow/header buttons on the **right** over the entity name `.bidar-identity-name` instead of on the **left** beside `.detail-button-container`.
     - `.detail-button-container:not(.stick-sub)` uses `margin-left` (L187) instead of `margin-inline-end` / `margin-right` in RTL.
     - `.bidar-band .detail-button-container .dropdown-menu` sets `left: auto; right: 0;` (L154-155), causing dropdowns on the left-aligned buttons in RTL to overflow past the left edge of the viewport.
     - `.bidar-person` uses `padding: 2px var(--10px) 2px 2px` (L252) and `padding-left: var(--10px)` (L262), leaving only 2px next to the text in RTL.
  2. **Pipeline chevrons & off-path links ([bidar-detail.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-detail.css#L315), [L373-L385](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-detail.css#L373-L385), [L450](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-detail.css#L450), [L504](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-detail.css#L504)):**
     - `.bidar-step-inner` `clip-path` polygons and `:first-child` / `:last-child` `border-radius` (`8px 0 0 8px` / `0 8px 8px 0`) are LTR-only; in RTL, stage arrows point **backwards (rightward)** and rounded corners sit on the inner edges.
     - `.bidar-pipeline-off` uses `margin-left: auto` (L315) instead of `margin-inline-start: auto`, and narrow-screen `.bidar-pipeline-toggle` / `.bidar-step-inner` hardcode `text-align: left` (L450, L504) instead of `text-align: start`.
  3. **Timeline rail, date column, and action button overlap ([bidar-detail.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-detail.css#L1217-L1324)):**
     - `li.list-group-item::after` places the vertical timeline rail via `left: calc(var(--bidar-stream-date-width) + var(--12px) + 11px)` (L1287), drawing the vertical line through the post content on the left instead of connecting the dots in column 2 on the right.
     - `li.list-group-item` reserves `padding: 0 var(--32px) var(--20px) 0` (L1217) and positions `.right-container, .cell-buttons` at `top: 0; right: 0` (L1298-1300), placing the action menu directly over the stream date in column 1.
     - `.panel[data-name="activities"] li.list-group-item` uses physical `border-left: 3px solid ...` and `border-radius: 0 var(--bidar-radius-md) var(--bidar-radius-md) 0` (L1322-1323).
  4. **`inline-edit-link`, tabbar collapse button, card corner accents, and accordion chevrons ([bidar-detail.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-detail.css#L922), [L946-L957](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-detail.css#L946-L957), [L984](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-detail.css#L984), [L1120-L1132](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-detail.css#L1120-L1132), [L1404](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-detail.css#L1404), [L1429-L1440](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-detail.css#L1429-L1440)):**
     - `.cell` uses `padding-right: var(--20px)` and `.inline-edit-link` uses `right: 0`, putting the edit pencil on the **label** side in RTL instead of `padding-inline-end` / `inset-inline-end: 0`.
     - `.bidar-tabbar` has `padding: 0 50px 0 var(--10px)` and `.bidar-tabbar > .bidar-collapse` has `right: var(--20px)`, overlapping the first tab on the right in RTL instead of docking at the end (`left: var(--20px)` / `inset-inline-end: var(--20px)`).
     - `.bidar-layout-classic .bidar-content-card::before` and `.bidar-record .bidar-inspector-card::before` (L1120-1132) are not mirrored to top-right in RTL (unlike `#main > .list-container > .list::before`).
     - Collapsed chevrons rotate `-90deg` (pointing right/outward in RTL instead of `+90deg` toward the label) in both [bidar-detail.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-detail.css#L1439) and [bidar-shell.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-shell.css#L115).
  5. **Shell, data table, button groups, and modal docking ([bidar-shell.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-shell.css#L13), [L61](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-shell.css#L61), [L86](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-shell.css#L86), [L204](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-shell.css#L204), [L394-L397](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-shell.css#L394-L397); [bidar-data.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-data.css#L58-L86); [bidar-controls.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-controls.css#L118), [L175](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-controls.css#L175); [bidar-overlays.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-overlays.css#L66), [L92-L104](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-overlays.css#L92-L104)):**
     - `bidar-shell.css` uses physical `padding-left`/`padding-right` on `.navbar-header`, `.tab-divider > div`, `input.global-search-input`, and `.bidar-scheme-check`.
     - `bidar-data.css` uses `border-right` on `th` (`th:last-child` removes left-side outer border only in LTR) and `padding-left` on `:not(:first-child)`.
     - `bidar-controls.css` L118 and `bidar-overlays.css` L66 use `margin-left: var(--6px)` on `.btn-group > .btn + .btn` (leaving 0px between the 1st and 2nd buttons in RTL and adding trailing left margin).
     - `bidar-overlays.css` L93-103 hardcodes right-docked modal styling (`border-left`, `border-radius: var(--bidar-radius-xl) 0 0 var(--bidar-radius-xl)`, negative X box-shadow) while `light.css` keeps `.modal-dialog { margin: 0 0 0 auto }` docked on the right (overlapping the RTL right sidebar).
- **Remediation:** Convert physical `left`/`right`, `margin-left`/`margin-right`, `padding-left`/`padding-right`, and `border-left`/`border-right` properties to CSS logical properties (`inset-inline-*`, `margin-inline-*`, `padding-inline-*`, `border-inline-*`, `text-align: start`) and add `html[dir="rtl"]` overrides for `clip-path`, `border-radius` corners, `rotate(90deg)`, card `::before` corners, and left-docked side-panel modals (`margin: 0 auto 0 0` + mirrored radii/borders/shadows).

### 7. Login logo centering clipped by `light.css` container dimensions & dark-mode logo disappears
- **Files & Lines:**
  - [bidar-login.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-login.css#L35-L48) vs [light.css](file:///Users/moeini/Dev/didar/build/release/client/css/espo/light.css) (`#login .logo-container`)
  - [bidar-dark.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-dark.css#L183-L186)
  - [bidar-shell.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-shell.css#L17-L20)
  - [Bidar.json](file:///Users/moeini/Dev/didar/extensions/bidar-theme/Resources/metadata/themes/Bidar.json#L5), [L70-L104](file:///Users/moeini/Dev/didar/extensions/bidar-theme/Resources/metadata/themes/Bidar.json#L70-L104)
  - [bidar-logo.svg](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/img/bidar-logo.svg#L1-L7) & [bidar-logo-dark.svg](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/img/bidar-logo-dark.svg#L1-L7)
- **Root Cause:**
  1. **Uncentered & clipped login logo:** EspoCRM's `light.css` sets `#login .logo-container { width: calc(var(--180px) + var(--1px)); height: var(--43px); overflow: hidden; }`. [bidar-login.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-login.css#L35-L48) does not override `width` or `height`, so `.logo-container` stays `181px` wide stuck to the right side of the panel header and `43px` tall with `overflow: hidden` — preventing true centering and clipping the `48px` logo + `16px` vertical padding.
  2. **Invisible dark-mode logo:** [Bidar.json](file:///Users/moeini/Dev/didar/extensions/bidar-theme/Resources/metadata/themes/Bidar.json#L5) sets `"logo": "client/custom/modules/bidar-theme/img/bidar-logo.svg"`, whose lower geometric loop is filled with `#0F172A` — the exact same color as `--bidar-sidebar-bg: #0f172a` in [bidar-dark.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-dark.css#L98). Yet [bidar-dark.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-dark.css#L183) (and [bidar-shell.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-shell.css#L17)) only targets `img[src*="img/logo-light.svg"]`, ignoring `bidar-logo.svg` (and white-labeled `img/logo.svg`). Meanwhile `bidar-logo-dark.svg` exists unused.
  3. **Forced RTL on LTR login:** [bidar-login.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-login.css#L5-L18), [L51-L64](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-login.css#L51-L64) force `direction: rtl; text-align: right;` unconditionally instead of respecting `html[dir="ltr"]` (only the corner accent at L84 handles `html[dir="ltr"]`).
- **Remediation:**
  1. Set `width: auto; max-width: 100%; height: auto;` on `#login .logo-container` in [bidar-login.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-login.css#L35-L39).
  2. Add `"logo": "client/custom/modules/bidar-theme/img/bidar-logo-dark.svg"` inside `bidarDark` in [Bidar.json](file:///Users/moeini/Dev/didar/extensions/bidar-theme/Resources/metadata/themes/Bidar.json#L70-L104) and/or widen the selector in [bidar-dark.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-dark.css#L183) and [bidar-shell.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-shell.css#L17) to match `img[src*="bidar-logo.svg"]` and `img[src*="img/logo.svg"]`.
  3. Gate login RTL rules with `:not(html[dir="ltr"] *)` or `html:not([dir="ltr"])`.

### 8. Undefined CSS custom properties & `?v=` cache-buster mismatches across stylesheets
- **Files & Lines:**
  - [bidar-data.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-data.css#L187), [L197](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-data.css#L197), [L217](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-data.css#L217), [L225](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-data.css#L225)
  - [bidar-overlays.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-overlays.css#L185), [L189](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-overlays.css#L189), [L204](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-overlays.css#L204), [L210](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-overlays.css#L210), [L216](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-overlays.css#L216)
  - [bidar.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar.css#L7-L20) vs [bidar-iframe.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-iframe.css#L6-L8), [bidar-iframe-dark.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-iframe-dark.css#L6), and variant stylesheets ([bidar-brut.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-brut.css#L8), [bidar-monochrome.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-monochrome.css#L8), `bidar-iframe-{brut,monochrome}*.css`)
- **Root Cause:**
  1. `--bidar-primary`, `--bidar-border-light`, `--bidar-border-hover`, and `--bidar-text-sm` are **never defined** in [bidar-tokens.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-tokens.css) or [bidar-dark.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-dark.css). In dark mode, `--bidar-border-light` falls back to `#e2e8f0` / `#f1f5f9` (white borders on dark Kanban columns and Jalali datepickers) and `--bidar-primary` falls back to `#0f766e` instead of `--bidar-brand` (`#8f93ff`).
  2. [bidar.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar.css#L7-L20) imports sub-sheets with `?v=1.1.0`, whereas [bidar-iframe.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-iframe.css#L6-L8), [bidar-iframe-dark.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-iframe-dark.css#L6), and the variant stylesheets still import `?v=0.22.2`, serving stale cached `bidar-tokens.css` / `bidar-espo-vars.css` / `bidar-fonts.css` to iframes.
- **Remediation:**
  1. Replace `--bidar-primary` with `var(--bidar-brand)`, `--bidar-border-light` with `var(--bidar-border)` (or `var(--bidar-n-100)`), `--bidar-border-hover` with `var(--bidar-border-strong)`, and `--bidar-text-sm` with `var(--13px)`. (In `bidar-overlays.css` L205/217, use `var(--bidar-on-brand)` instead of hardcoded `#ffffff`.)
  2. Synchronize all `@import` `?v=` query parameters across `bidar.css` and `bidar-iframe*.css` (or remove hardcoded `?v=` if EspoCRM already appends its cache timestamp to the top-level theme stylesheet).

### 9. Overbroad `[class*="badge"]` selector leaks into EspoCRM navbar & third-party widgets
- **Files & Lines:** [bidar-data.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-data.css#L242-L251), [BidarThemeMetadataTest.php](file:///Users/moeini/Dev/didar/extensions/bidar-theme/tests/BidarThemeMetadataTest.php#L274-L285)
- **Root Cause:** `[class*="badge"]` matches unrelated layout containers such as `#navbar .notifications-badge-container` (confirmed in [light.css](file:///Users/moeini/Dev/didar/build/release/client/css/espo/light.css)) and forces `display: inline-flex; white-space: nowrap !important;` on them, as well as on nested `span` descendants inside `td[data-name="status"]` / `td[data-name="stage"]`.
- **Remediation:** Replace `[class*="badge"]` with explicit classes (`.badge`, `.label`, `.bidar-badge`, `.number-badge`) and scope table cells to direct field spans (`td[data-name="status"] > .field > span`, `td[data-name="stage"] > .field > span`), updating `testBadgesHaveNoWrapInDataCss()` in [BidarThemeMetadataTest.php](file:///Users/moeini/Dev/didar/extensions/bidar-theme/tests/BidarThemeMetadataTest.php#L274-L285) accordingly.

### 10. `scripts/apply-whitelabel.php` safety, escaping, multi-line config, JSON validation, `ob_clean`, and `favicon.ico` defects
- **Files & Lines:** [apply-whitelabel.php](file:///Users/moeini/Dev/didar/scripts/apply-whitelabel.php#L81-L88), [L101-L108](file:///Users/moeini/Dev/didar/scripts/apply-whitelabel.php#L101-L108), [L125-L147](file:///Users/moeini/Dev/didar/scripts/apply-whitelabel.php#L125-L147), [L163-L194](file:///Users/moeini/Dev/didar/scripts/apply-whitelabel.php#L163-L194), [L228-L255](file:///Users/moeini/Dev/didar/scripts/apply-whitelabel.php#L228-L255), [L311](file:///Users/moeini/Dev/didar/scripts/apply-whitelabel.php#L311), [L345](file:///Users/moeini/Dev/didar/scripts/apply-whitelabel.php#L345), [L387](file:///Users/moeini/Dev/didar/scripts/apply-whitelabel.php#L387), [L406-L423](file:///Users/moeini/Dev/didar/scripts/apply-whitelabel.php#L406-L423), [L491](file:///Users/moeini/Dev/didar/scripts/apply-whitelabel.php#L491), [L537-L591](file:///Users/moeini/Dev/didar/scripts/apply-whitelabel.php#L537-L591), [L644-L645](file:///Users/moeini/Dev/didar/scripts/apply-whitelabel.php#L644-L645), [L710](file:///Users/moeini/Dev/didar/scripts/apply-whitelabel.php#L710), [L734-L756](file:///Users/moeini/Dev/didar/scripts/apply-whitelabel.php#L734-L756)
- **Root Causes:**
  1. **`preg_replace` backreference hazards:** L86 (`patchMainHtml`), L173 (`patchInstallerTemplates`), L710 (`patchDefaultsConfig`), and L740 (`replaceOrInsertConfigParam`) interpolate untrusted/config strings (`$copyrightFa`, `$name`, `$defaultTab`, `$valFormatted`) directly into `preg_replace()` replacement strings; `$0`/`$1`/`\1` sequences in brand values corrupt the output.
  2. **Missing HTML/attribute escaping:** L81, L106, L134–140, L163, L177, L190 interpolate `$name`, `$nameFa`, `$taglineFa`, `$copyrightFa`, `$websiteUrl`, and `$supportUrl` raw into HTML/Smarty templates without `htmlspecialchars(..., ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')` or URL scheme checks.
  3. **Multi-line array corruption in `defaults/config.php`:** `replaceOrInsertConfigParam()` (L737) matches `[^\r\n]*,`. If any array parameter (e.g. `currencyList`, `phoneNumberPreferredCountryList`) spans multiple lines in `defaults/config.php`, the regex either fails to match (inserting a duplicate key before `];`) or replaces only the first line and leaves trailing array elements dangling, causing a PHP syntax error. Additionally, `strrpos($content, '];')` (L745) and unanchored `'name' => 'My Espo'` (L710) make fragile assumptions about file formatting.
  4. **Silent `install.json` wipe on malformed JSON:** In `patchInstallerThemes()` (L406, L417), `json_decode(...) ?: []` discards all installer translations if `install.json` has invalid JSON or fails to read; `patchInstallerI18n()` (L228, L255) silently skips without error reporting.
  5. **Generated `seedDemoData.php` buffer & missing class guard:** In `patchInstallerDemoDataSeeder()` (L537, L573, L585), `ob_clean()` runs without checking `ob_get_level()` (risking a PHP notice that corrupts JSON output) and instantiates `\Espo\Modules\BidarSales\Seed\DemoDataSeeder` without `class_exists(...)`; meanwhile `install.js` (L480) uses `.always(...)` so seeding errors are silently swallowed.
  6. **Invalid `favicon.ico` binary:** `copyBrandAssets()` (L645) copies `bidar-favicon.svg` (XML text) directly to `favicon.ico`, which is served/referenced as `type="image/x-icon"`.
  7. **Unconditional `file_put_contents()`:** L108, L147, L164, L180, L193, L210, L311, L345, L387, L491, L591, L712, L801 write files even when content is unchanged (L491 writes `$installJsPath` outside both `if` blocks even when `$updated === false`), and return values of `file_get_contents`/`file_put_contents`/`copy`/`mkdir` are unchecked.
- **Remediation:**
  1. Use `preg_replace_callback()` (or escape `\` and `$` via `strtr($rep, ['\\' => '\\\\', '$' => '\\$'])`) for all `preg_replace` calls.
  2. Escape all HTML/attribute interpolations with `htmlspecialchars(..., ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')` and validate `http`/`https` schemes for URLs.
  3. Update `replaceOrInsertConfigParam()` to match balanced `[ ... ]` or nested structures (or use PHP tokenizer `token_get_all()` / `PhpParser`) rather than single-line `[^\r\n]*,`.
  4. Check `json_last_error() === JSON_ERROR_NONE` and `is_array()` before modifying `install.json` (throw `\RuntimeException` on parse failure).
  5. In generated `seedDemoData.php`, verify `class_exists(\Espo\Modules\BidarSales\Seed\DemoDataSeeder::class)` and clean output buffers via `if (ob_get_level() > 0) { ob_end_clean(); }`.
  6. Copy a real `.ico` asset (e.g. `$assets['faviconIco']`) to `favicon.ico` rather than copying the `.svg` file, and guard all writes with `if ($newContent !== $content)` + error checks.

---

## Minor

### 11. Orphaned variant stylesheets (`bidar-brut`, `bidar-monochrome`) & unused `bidar-fonts.css` monospace specificity gap
- **Files & Lines:**
  - [bidar.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar.css#L7-L20), [bidar-brut.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-brut.css#L8), [bidar-monochrome.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-monochrome.css#L8), [bidar-style-brut.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-style-brut.css), [bidar-style-monochrome.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-style-monochrome.css), `bidar-iframe-{brut,monochrome}*.css`
  - [bidar-fonts.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-fonts.css#L12-L26), [L37-L48](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-fonts.css#L37-L48)
- **Root Cause:**
  1. `bidar-style-brut.css` and `bidar-style-monochrome.css` are never `@import`ed by `bidar.css`, `bidar-brut.css`, or `bidar-monochrome.css`, and no `BidarBrut.json` / `BidarMonochrome.json` theme metadata exists in `extensions/bidar-theme/Resources/metadata/themes/`, leaving 8 CSS files dead on disk with stale `?v=0.22.2` imports.
  2. In [bidar-fonts.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-fonts.css#L12-L26), `input, button, select, textarea, .form-control` have `font-family: 'Vazirmatn' ... !important`. Specificity of `input.form-control` / `.form-control` when combined with element selectors can override single-class `.monospace` / `.formula-editor` / `.code-editor` on `<textarea class="form-control code-editor">`, and `!important` prevents `--bidar-font` overrides.
- **Remediation:** Either wire `bidar-style-*.css` and `Bidar{Brut,Monochrome}.json` properly (or remove the orphaned variant CSS files if only `Bidar` is shipped), and drop `!important` on `input, textarea, .form-control` (or raise specificity / use `:not(.monospace):not(.code-editor):not(.formula-editor)`) in `bidar-fonts.css`.

### 12. Duplicate CSS rules & `bidar-dark.css` before `bidar-rtl.css` import hazard
- **Files & Lines:**
  - [bidar-data.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-data.css#L36-L43) vs [bidar-rtl.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-rtl.css#L184-L191)
  - [bidar.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar.css#L18-L20)
  - [bidar-dark.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-dark.css#L216), [L224](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-dark.css#L224)
- **Root Cause:**
  1. `html[dir="rtl"] #main > .list-container > .list::before` is duplicated identically in both `bidar-data.css` and `bidar-rtl.css`.
  2. `bidar-rtl.css` loads after `bidar-dark.css` in `bidar.css`, so any non-scheme-qualified color/background/border shorthand in `bidar-rtl.css` (e.g., [bidar-rtl.css](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/css/bidar-rtl.css#L217-L223) with `#ffffff` / `#e2e8f0` fallbacks) competes with dark-mode rules.
  3. `bidar-dark.css` L216/224 uses stale fallback `#161930` for `--bidar-n-0` while L15 defines `--bidar-n-0: #1e293b`.
- **Remediation:** Deduplicate `#main > .list-container > .list::before`, move `bidar-rtl.css` before `bidar-dark.css` (or use pure variables without light hex fallbacks in `bidar-rtl.css`), and align the `--bidar-n-0` fallback in `bidar-dark.css`.

### 13. Metadata, i18n, and `appearance.js` consistency gaps
- **Files & Lines:**
  - [Preferences.json](file:///Users/moeini/Dev/didar/extensions/bidar-theme/Resources/metadata/entityDefs/Preferences.json#L3-L28)
  - [en_US/Global.json](file:///Users/moeini/Dev/didar/extensions/bidar-theme/Resources/i18n/en_US/Global.json#L3) & [fa_IR/Global.json](file:///Users/moeini/Dev/didar/extensions/bidar-theme/Resources/i18n/fa_IR/Global.json#L3) vs [bidar-brand fa_IR/Global.json](file:///Users/moeini/Dev/didar/extensions/bidar-brand/Resources/i18n/fa_IR/Global.json#L8)
  - [extensions/bidar-brand/Resources/metadata/app/adminPanel.json](file:///Users/moeini/Dev/didar/extensions/bidar-brand/Resources/metadata/app/adminPanel.json#L34)
  - [appearance.js](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/js/appearance.js#L74-L80)
- **Root Causes:**
  1. `Preferences.json` defines `bidarColorScheme`, `bidarDensity`, and `bidarLayout`, but `extensions/bidar-theme/Resources/i18n/{en_US,fa_IR}/Preferences.json` do not exist to label those fields.
  2. `themes.Bidar` in `fa_IR/Global.json` differs across `bidar-theme` (`"بیدار (Bidar RTL)"`), `bidar-brand` (`"بیدار"`), and `apply-whitelabel.php` (`"بیدار (پیش‌فرض RTL)"`).
  3. [appearance.js](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/js/appearance.js#L74-L80) only auto-sets `root.dir = 'rtl'` for `fa*` (omitting `ar`/`he`/`ur`, unlike [page-a11y.js](file:///Users/moeini/Dev/didar/client/custom/modules/bidar-theme/src/handlers/page-a11y.js#L26)), and forces `document.body.dataset.navbar = 'side'` before EspoCRM reads the user's `navbar` preference (causing a layout flash if a user uses `top` navbar).
  4. `adminPanel.json` L34 still uses `fas fa-euro-sign` for Currency in a predominantly IRT/IRR deployment.
- **Remediation:** Add `Preferences.json` i18n files, unify the `themes.Bidar` Persian label, align the RTL language regex between `appearance.js` and `page-a11y.js`, and only set `dataset.navbar = 'side'` when `.has-navbar` is present or not yet overridden.

---

## Suggestion

### 14. Expand test coverage in `BidarThemeMetadataTest.php` and `ApplyWhitelabelTest.php`
- **Files & Lines:**
  - [BidarThemeMetadataTest.php](file:///Users/moeini/Dev/didar/extensions/bidar-theme/tests/BidarThemeMetadataTest.php#L141-L286)
  - [ApplyWhitelabelTest.php](file:///Users/moeini/Dev/didar/extensions/bidar-brand/tests/ApplyWhitelabelTest.php#L126-L327)
- **Root Cause & Remediation:**
  1. In `BidarThemeMetadataTest.php`: add checks ensuring `AfterInstall.php` invokes `$configWriter->save()`, all `bidar-iframe*.css` `@import` `?v=` versions match `bidar.css`, `bidar-dark.css` redefines `--bidar-text`/`--bidar-border`/`--bidar-hover`/`--bidar-signature`, and `bidar-rtl.css` scopes side-navbar offsets to `body[data-navbar="side"]` + `@media (min-width: 768px)` without double-offsetting `#main`.
  2. In `ApplyWhitelabelTest.php`: add mock fixtures and assertions for `patchInstallerDemoDataSeeder()` (`step4.tpl`, `install.js`, `Utils.php`, `Installer.php`, `seedDemoData.php`), multi-line arrays in `defaults/config.php`, brand strings with `$1` / `<script>` / `&`, malformed `install.json` handling, and repeated runs verifying idempotency across all patched files.

