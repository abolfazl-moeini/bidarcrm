# Admin Design Review Checklist (Link 1)

Detailed audit checklist and evaluation rules for Link 1 (`admin-design-review`) of `/harness-review`.
Cross-references the canonical standards defined in `wpdev-admin-design`.

---

## 1. Zero-React & Native PHP Invariant (P1)
- [ ] Are admin screens (`admin.php?page=*`) rendered purely via server-side PHP (`Edit_Admin_Page`, `List_Admin_Page`, `Top_Level_Admin_Page`)?
- [ ] Is there **zero** React, Gutenberg block, or Polaris Stack bundling in classic admin screens?
- [ ] Are interactive widgets using native framework CSS (`admin.css`, `admin-layout.css`) and `wubox` modal assets?

## 2. Two-Gate Defense-in-Depth (P1)
- [ ] Is **Gate 1** (WordPress base capability) checked via `current_user_can()`?
- [ ] Is **Gate 2** (AccessManager domain policy) declared via `'access' => 'domain.feature.action'` on forms, ajax, and list tables?
- [ ] Are coarse admin capabilities (`manage_options`, `manage_network`) avoided for domain business features?

## 3. List UX / Table Verification (P1 / P2)
- [ ] Does the primary column combine avatar/identicon, bold title, muted subtext (email/slug), and relative dates?
- [ ] Are status values formatted with rounded pastel pill badges (`.wpdev-badge`, `.wpdev-badge-success`, `.wpdev-badge-warning`, `.wpdev-badge-danger`)?
- [ ] For visual entities (Sites, Products, Templates), is the Grid/Card view switcher (`single_row_grid()`) provided?
- [ ] Are hover row actions properly attached to the primary entity cell?
- [ ] Is there an empty state displayed when the table contains zero items?

## 4. Edit UX / Form Verification (P2)
- [ ] Are complex edit screens organized with vertical icon-badged navigation tabs (`add_tabs_widget()`)?
- [ ] Is there an "At a Glance" top KPI strip summarizing critical metrics (Total, Ref ID with copy button, Status pill)?
- [ ] Are child relational records rendered as embedded sub-tables (`add_list_table_widget()`) rather than forcing external navigation?

## 5. Sidebar & Action Card Verification (P2)
- [ ] Is the primary Save button placed in a dedicated sidebar card with a shaded background footer?
- [ ] Is the entity status (Active/Inactive) placed in an adjacent modular toggle switch card?
- [ ] Do customer/user records include an Identity Card with avatar and quick-action buttons (`→ Switch To`, `→ Visit Profile`)?
- [ ] Is destructive deletion isolated in a dedicated Danger Zone sidebar card with an outline-styled button?

## 6. Modal & Wizard UX Verification (P1 / P2)
- [ ] Do quick-creation and sub-entity actions open a dimmed-backdrop wubox modal (`wpdev_register_form()`) without full-page reloads?
- [ ] In multi-step creation wizards, does Step 1 use large clickable choice cards with icons and green checkmark badges?
- [ ] In full-page onboarding tours, is the vertical step progress sidebar rendered on the right (or left in LTR) with an illustrated welcome card?

## 7. Smart Fields Verification (P2 / P3)
- [ ] Do dependent fields use instant toggle switches that reveal inputs inline without full-page reloads?
- [ ] Do repeatable items use the standard repeater field structure with label, slug, delete button (`×`), and add button (`+`)?
- [ ] Do page picker dropdowns provide an adjacent external jump icon (`↗`) to view the selected page in a new browser tab?
- [ ] Do recurring pricing inputs include a real-time human calculation sentence?

## 8. Logs & Destruction Safety Verification (P1 / P2)
- [ ] In the delete confirmation modal, is there a **MANDATORY safety toggle switch** (`Confirm Deletion`) that keeps the final delete button disabled until toggled ON?
- [ ] For real-time operations, is output rendered in a dark monospace terminal console with an AJAX Refresh button?
- [ ] Do heavy asynchronous operations display an inline pre-flight validation alert box before allowing execution?

## 9. WordPress Security & Escaping (P1)
- [ ] Are all rendered values strictly late-escaped (`esc_html()`, `esc_attr()`, `esc_url()`)?
- [ ] Are nonces verified on all AJAX and form submission endpoints?

## 10. Canonical WPDev Admin Anti-Patterns Audit (P1 / P2)
*Mandatory audit against `plugins/wpdev/skills/wpdev-panel-builder/references/anti-patterns.md`:*
- [ ] **Lifecycle & Translations:** Are all `__()` calls deferred until `init` or later (zero gettext calls inside `wpdev_load`, option schemas, or model boot to prevent WP 6.7 JIT notices)?
- [ ] **Styling Wrapper:** On custom CPT and WooCommerce edit screens, is the full metabox/tabs HTML wrapped in `<div class="wpdev-styling">`?
- [ ] **CSS Utility Classes:** Are layout classes using valid CSS aliases (`wpdev-p-*`, `wpdev-m-*`) from `admin-layout.css` (not unmapped shorthand)?
- [ ] **Deletion Modal Context:** Does the delete modal read the `confirm` POST field (not `confirmed` only), and are label click events unblocked?
- [ ] **Vue Metabox Escaping:** Are Vue metabox and tab templates output without raw `wp_kses_post()` that strips `v-show` / `v-cloak` / `v-on`?
- [ ] **AJAX Nonce & Buffer:** Do AJAX handlers send `nonce: window.wpdev_ajax.nonce`, include error callbacks, clean output buffers with `ob_clean()`, and suppress PHP notices before `wp_send_json_*`?
- [ ] **WooCommerce Date Protection:** Is `_sale_price_dates_*` protected from raw `$_POST` overwrites during `woocommerce_process_product_meta`?
- [ ] **Persian Datepicker Guard:** Are dates formatted in pure Gregorian before feeding Flatpickr/datepickers to avoid Jalali parsing corruptions?
- [ ] **Granular Capabilities:** Are coarse permissions (`manage_options`, `manage_network`) replaced with domain-scoped capabilities and Two-Gate access?
- [ ] **Multi-Plugin Independence:** Are all shared functions guarded with `function_exists()`, framework closure ordered first in `autoload.files`, and `Base_Admin_Page` eagerly loaded?
- [ ] **WAF & Wordfence HTML Compatibility (P1):** When fields accept raw HTML or embed snippets (e.g. Aparat/YouTube iframe embed codes in product metaboxes or demo tabs), are they protected against Wordfence / WAF blocking? Raw HTML must NOT be submitted directly in standard unencoded POST fields (must normalize to media URLs/IDs or use client-side Base64 transport encoding decoded before `wp_kses()` sanitization) to prevent Wordfence false-positive 403 Forbidden blocks on form submission (#116).

