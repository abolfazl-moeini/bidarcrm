# دستور بازبینی خصمانه و موشکافانه اسکیل `wpdev-admin-design` (Single-Shot Adversarial Review Prompt)

> **راهنمای استفاده:**
> کل محتوای این فایل (از کادر زیر تا انتهای سند) را کپی کرده و به عنوان یک پرامپت مستقل (Single-Shot) به یک هوش مصنوعی ارشد (مانند Claude 3.7 Sonnet، GPT-4o، o3، یا Gemini 2.5 Pro) ارسال کنید. این سند کاملاً خودکفا (Self-Contained) است و تمام کدهای پیاده‌سازی‌شده و زمینه‌های لازم را در خود دارد.

---

```markdown
# SYSTEM ROLE & REVIEW MANDATE: PRINCIPAL WORDPRESS ARCHITECT & UX CRITIC

You are an elite Principal Software Architect (Staff/L8), Senior WordPress Core Contributor, and Principal UX Engineer.
You have been hired to perform an independent, skeptical, and rigorous code and architecture review of a newly developed design language skill: `wpdev-admin-design`.

## CONTEXT & BACKGROUND

1. **Framework & Ecosystem:**
   - The team builds enterprise-grade WordPress plugins using a custom modular framework called `wpdev` (located at `{PLUGINS}/wpdev`).
   - The framework provides robust abstractions for backend panels: `Edit_Admin_Page`, `List_Admin_Page`, `Top_Level_Admin_Page`, `Base_List_Table`, `wpdev_register_form()` (for modal dialogs), `wubox` popup assets, and centralized styling (`admin.css`, `admin-layout.css`).
   - Security follows a strict **Two-Gate Defense-in-Depth Model**: Gate 1 = WordPress capability (`WP_User::has_cap()`), Gate 2 = AccessManager domain policy (`WPDev\Access\UserAccess` via `'access' => 'domain.action'`).

2. **Core Mandate & Human Decision:**
   - **Pure PHP Native Admin:** The team explicitly banned React, Gutenberg blocks, and Polaris Stack for classic backend admin screens (`admin.php?page=*`). All screens must render via native PHP using the framework's widgets and CSS to guarantee zero frontend build bloat.
   - **Origin:** The design standards were reverse-engineered and extracted from 33 gold-standard production screenshots from a reference plugin (`wpdev-examples`) to ensure visual and architectural uniformity across all plugins.
   - **Auto-Activation:** The skill was directly wired into the master orchestrator (`wpdev-panel-builder`) so that AI pair-programming agents automatically adopt this design language whenever building or modifying admin panels without requiring manual prompting from the developer.

---

## YOUR STRICT INSTRUCTIONS (READ CAREFULLY)

1. **REPORT ISSUES ONLY — DO NOT APPLY ANY CHANGES OR GENERATE HUGE REWRITES.**
   - Your job is an audit. Identify design flaws, contract mismatches, security risks, edge cases, and operational weaknesses.
   - Present findings categorized strictly by severity:
     - **P1 (Critical / Security / Contract Breakers):** Severe bugs, XSS/CSRF vectors, missing capability/access checks, fatal PHP incompatibilities, or broken framework abstractions.
     - **P2 (Important Architectural Flaws & Missing Edge Cases):** Broken UX assumptions, unhandled empty/error states, race conditions in AJAX/modals, accessibility/i18n oversights, or fragile auto-activation rules.
     - **P3 (Minor Polish & Consistency):** Code style, naming, minor documentation gaps.
2. **BE RUTHLESSLY SKEPTICAL:**
   - Do not flatter or praise. Assume the implementer missed critical details.
   - Check every PHP code snippet in `recipes-php.md` line by line for WordPress best practices (escaping, sanitization, nonce handling, type safety, PHP 7.4+ vs 8.x compatibility).
   - Evaluate whether the 7 design families truly cover all 33 screenshots without gaps.
   - Scrutinize whether the auto-activation mechanism in `wpdev-panel-builder/SKILL.md` is robust or easily bypassed by AI agents.

---

## AUDIT CHECKLIST & ATTACK VECTORS

Please scrutinize the attached files against these specific attack vectors:

1. **Security & Escaping (WordPress Standards):**
   - In `recipes-php.md`, are outputs properly late-escaped (`esc_html`, `esc_url`, `esc_attr`)?
   - Are there XSS vulnerabilities in the composite primary cell (`column_customer`), status badges, or custom HTML snippets?
   - Does the destructive deletion modal properly enforce nonces and Two-Gate access permissions?
2. **Framework Contract & PHP Accuracy:**
   - Are the method signatures in `recipes-php.md` compatible with standard WordPress / WPDev patterns? (e.g., `Base_List_Table`, `Edit_Admin_Page::add_widget()`, `add_tabs_widget()`, `add_fields_widget()`, `add_save_widget()`).
   - Are typed properties and return types safe across PHP 7.4 and 8.x?
3. **UX Completeness & Edge Cases:**
   - What happens when a user has no email or Gravatar fails?
   - What happens when a table has 0 records? Does it degrade gracefully with an empty state?
   - In the "Safe Deletion Modal", the toggle switch unlocks the delete button via plain JavaScript (`document.getElementById`). What happens if the DOM element ID changes or if multiple modals exist on the same page?
4. **Screenshot Catalog Faithfulness:**
   - Does `screenshot-catalog.md` correctly categorize and account for all 33 screenshots? Are any critical interaction patterns misrepresented?
5. **AI Auto-Activation Feasibility:**
   - Does wiring `wpdev-admin-design` into `wpdev-panel-builder` Phase 1 actually guarantee that an LLM agent will read and follow it? What edge cases could cause an LLM to hallucinate or skip this standard?

---

## ATTACHED IMPLEMENTATION FILES FOR REVIEW

Below is the complete, exact source code of the files that were implemented and modified.

================================================================================
FILE 1: wpdev/skills/wpdev-admin-design/SKILL.md
================================================================================
```markdown
---
name: wpdev-admin-design
description: >-
  MANDATORY visual design language and UI/UX component catalog for ALL WordPress admin
  panels, list tables, edit screens, settings pages, modals, wizards, and sidebars built with WPDev.
  Use automatically whenever designing, building, restyling, or reviewing admin interfaces,
  List_Admin_Page, Edit_Admin_Page, Top_Level_Admin_Page, metaboxes, or wubox forms in WPDev plugins.
  Enforces the 7 canonical UX families extracted from 33 gold-standard patterns: Rich Cells & Badges,
  List/Grid Card Modes, At-a-Glance KPI Strips, Embedded Sub-Tables, Modular Save & Identity Sidebars,
  Visual Step Wizards, Smart Conditional Toggles, Terminal Logs, and Destructive Confirmation Toggles.
---

# WPDev Admin Panel Design Language & UX Catalog

**MANDATORY Visual & Interaction Standard for all WPDev Admin Interfaces.**

This skill establishes the definitive visual design language, interaction paradigms, and layout architecture for all WordPress plugins built with the `wpdev` framework (`packages/framework`, `admin-page-builder`, etc.). It guarantees visual consistency across all products without introducing frontend build bloat.

---

## 1. Core Principles (Non-Negotiable)

1. **100% Pure PHP Native (Zero-React Bloat):**
   - Classic admin interfaces (`admin.php?page=*`) MUST be rendered server-side in PHP using native `wpdev` abstractions (`Edit_Admin_Page`, `List_Admin_Page`, `Top_Level_Admin_Page`).
   - Do NOT inject React, Polaris Stack, or heavy JavaScript SPAs into standard admin pages. All reactive micro-interactions (toggles, modals, repeaters, search autocompletes) are powered by native `wpdev` assets (`admin.css`, `admin-layout.css`, `wubox`).
2. **Two-Gate Access Defense:**
   - Every view, action, and modal trigger must satisfy both **Gate 1** (WordPress capability check via `current_user_can()`) and **Gate 2** (AccessManager domain rule via `'access' => 'plugin.domain.action'`).
3. **Progressive Disclosure & Human-Readable Context:**
   - Prefer clean summaries, relative human dates («۲ ماه پیش» or "2 days ago"), copyable monospace identifiers, and status pill badges over raw database IDs or unformatted text.
4. **Destructive Action Safety:**
   - Irreversible actions (Delete, Purge, Reset) MUST NEVER execute on a single raw click. They require a dedicated Danger Zone card followed by a modal containing a **mandatory safety toggle switch** before the delete button unlocks.

---

## 2. The 7 Canonical UX Design Families

Every screen in a WPDev plugin is composed of elements from these 7 design families:

WPDev Admin Design Language
├── 1. List UX (Tables & Card Views)
│   ├── Rich Composite Cells (Avatar + User/Entity Info + Relative Dates)
│   ├── Semantic Pastel Badges (Status Pills & Type Tags)
│   └── View Mode Switcher (Tabular List vs Grid/Card Mode)
│
├── 2. Edit UX (Tabbed Forms & Metrics)
│   ├── Icon Vertical Tabs with Subtext
│   ├── At-a-Glance Top KPI Metric Strip
│   └── Embedded Relational Sub-Tables
│
├── 3. Sidebar UX (Identity & Modular Actions)
│   ├── User Identity / Profile Impersonation Card
│   ├── Modular Save, Active Toggle & Unique Token Cards
│   └── Two-Step Danger Zone Card
│
├── 4. Modal & Wizard UX (Popups & Onboarding)
│   ├── Quick-Add Single & Multi-Tab Modals (wubox)
│   ├── Visual Step Wizard with Choice Cards
│   └── Full-Page Onboarding Tour Sidebar
│
├── 5. Smart Fields UX (Adaptive Forms)
│   ├── Instant Conditional Toggle Logic
│   ├── Dynamic Repeater Rows (Label + Slug + Action)
│   ├── Entity / Page Picker with Popout Jump Icon
│   └── Dynamic Recurring Price Calculator Field
│
├── 6. Logs & Safety UX (Telemetry & Protection)
│   ├── User / Entity Notes Timeline
│   ├── Dark Monospace Terminal Console with Live Ajax
│   ├── Safe Deletion Modal with Mandatory Toggle Unlock
│   └── Heavy Action Pre-Flight Warning Box
│
└── 7. Dashboard & Settings UX (Analytics & Shell)
    ├── KPI Metric Cards with Date-Range Selectors
    └── 3-Column Settings Layout with Promo/Notice Sidebar

---

### Family 1: List UX (Tables & Card Views)
- **Rich Composite First Column:** Avatar + bold title + muted subtext (email/slug) + relative human date. Hover actions appear below.
- **Semantic Pastel Badges:** Green (Completed/Active), Blue (Email/Primary), Yellow (Pending/Notice), Red (Inactive/Failed), Gray (Monospace IDs).
- **View Mode Switcher:** Tabular list vs Grid card switcher with preview thumbnails, tags, and bulk-action checkboxes.

### Family 2: Edit UX (Tabbed Forms & Metrics)
- **Icon Vertical Tabs (`add_tabs_widget`):** Vertical icon navigation with active elevation.
- **"At a Glance" Top KPI Strip:** Single-row metric card at top of edit page (Total Amount, Reference ID with copy button, Status badge).
- **Embedded Sub-Tables (`add_list_table_widget`):** Child relation tables embedded directly in the edit page.

### Family 3: Sidebar UX (Identity & Modular Actions)
- **User Identity Card:** Avatar, username, email, `→ Switch To` (impersonation), `→ Visit Profile`, user role & verification dropdowns.
- **Modular Save & Status Widgets:** Dedicated Save button card in shaded footer, adjacent Active/Inactive toggle switch card, top unique slug/token card.
- **Danger Zone Card:** Bottom sidebar card with irreversible action warning and outline delete button.

### Family 4: Modal & Wizard UX (Popups & Onboarding)
- **Quick-Add Modals (`wpdev_register_form` / wubox):** Backdrop modal keeping users in context. Horizontal tabs when fields exceed 5 inputs.
- **Visual Step Wizard:** Step 1 has large clickable choice cards with icons and green checkmark badges; Step 2 has autocomplete targets and action footer.
- **Onboarding Setup Wizard (`wpdev_create_tour`):** Full-screen onboarding with vertical step navigation on right and welcome card on left.

### Family 5: Smart Fields UX (Adaptive Forms)
- **Instant Conditional Toggles:** Toggle switches that dynamically reveal dependent inputs inline without reload.
- **Dynamic Repeaters:** 1-to-N key-value inputs with add/remove rows.
- **Page / Entity Picker:** Dropdowns accompanied by popout icon button (`↗`) for opening target in new tab.
- **Recurring Price Calculator:** Composite price input with dynamic human calculation sentence.

### Family 6: Logs & Safety UX (Telemetry & Protection)
- **Notes & Event Timeline:** Chronological internal notes feed with avatars and timestamps.
- **Dark Monospace Terminal Console:** Real-time log viewer with monospace font and Ajax refresh button.
- **Fail-Safe Deletion Modal:** Mandatory safety toggle switch required before delete button unlocks.
- **Pre-Flight Alerts:** Warning boxes before heavy asynchronous operations.

### Family 7: Dashboard & Settings UX (Analytics & Shell)
- **Top-Level KPI Dashboard (`Top_Level_Admin_Page`):** Multi-column metric cards with date range selectors and breakdown tables.
- **3-Column Settings Layout:** Left promo card + Center settings tabs with toggles + Right vertical tab list with instant search.

---

## 3. Integration with WPDev Skills
This skill is the Visual Standard Authority for `wpdev-panel-builder`, `wpdev-list-ux`, `wpdev-edit-ux`, `wpdev-modal-forms`, and `wpdev-settings-dashboard`.
```

================================================================================
FILE 2: wpdev/skills/wpdev-admin-design/references/screenshot-catalog.md
================================================================================
```markdown
# WPDev Admin Panel Screenshot Catalog (33 Gold Standards)

Maps all 33 gold-standard screenshot patterns from `/Users/moeini/Dev/multisite/panel-screenshots/` into the 7 canonical UX design families:

| # | Screenshot Filename | UX Family | WPDev PHP Class / API | Visual & Behavioral Pattern |
|---|---|---|---|---|
| 1 | `add-note-metaboxes-when-it-helps-user.jpg` | 6. Logs & Safety UX | `Edit_Admin_Page::add_tabs_widget()`, `wpdev_register_ajax_handler()` | Tabbed notes timeline with avatar, relative date, delete action, add/clear buttons. |
| 2 | `display-useful-info-in-first-column-of-tables-like-userinfo-entity-info-product-info-etc....jpg` | 1. List UX | `Base_List_Table::column_default()`, `column_cb()` | Composite primary cell: avatar + bold name + email + relative dates («۲ ماه پیش») + checkbox. |
| 3 | `group-fields-that-perform-related-tasks-together-in-a-single-section-separated-by-a-heading..jpg` | 7. Dashboard & Settings UX | `wpdev_register_settings_section()`, `add_fields_widget()` | Section grouping with bold headers, explanatory subtext, media buttons, divider lines. |
| 4 | `must-use-special-field-to-choose-a-page.jpg` | 5. Smart Fields UX | `page_select`, Dashicon `external` | Custom page picker dropdown with popout jump icon (↗). |
| 5 | `setting-with-ads-sidebar.jpg` | 7. Dashboard & Settings UX | `Top_Level_Admin_Page`, `admin-layout.css` | 3-Column settings: Promo sidebar + active tab settings + vertical nav menu with search filter. |
| 6 | `sometimes-use-dashboard-and-visualization.jpg` | 7. Dashboard & Settings UX | `Top_Level_Admin_Page`, `wpdev_register_dashboard_widget()` | Top-level KPI dashboard: date-range filter, metric cards, revenue breakdown table. |
| 7 | `sometimes-use-logs-or-events-metabox-in-edit-post-is-useful.jpg` | 6. Logs & Safety UX | `Edit_Admin_Page::add_widget()`, collapsible | Collapsible audit log metabox with styled empty state. |
| 8 | `sometimes-use-logs-or-events-metabox-in-edit-post-is-useful2.jpg` | 6. Logs & Safety UX | `Edit_Admin_Page::add_widget()`, AJAX logger | Monospace dark terminal console metabox with UTC timestamps and Refresh Logs AJAX button. |
| 9 | `standard-edit-post-metabox.jpg` | 2. Edit UX | `Edit_Admin_Page::add_tabs_widget()` | Primary edit page: vertical icon-badged tabs on right, field config with tooltips on left. |
| 10 | `standard-side-metabox-in-edit-post.jpg` | 5. Smart Fields UX | `Edit_Admin_Page::add_widget()` | Sidebar recurring pricing: toggle, interval, currency, dynamic human calculation sentence. |
| 11 | `standard-side-metabox-in-edit-post2.jpg` | 3. Sidebar UX | `Edit_Admin_Page::add_save_widget()`, status widget | Modular sidebar: Save button in shaded footer + Active toggle card + Product image card. |
| 12 | `standard-side-metabox-in-edit-post3.jpg` | 3. Sidebar UX | `Edit_Admin_Page::add_widget()`, Danger Zone | Timestamps card with relative dates + Danger Zone card with irreversible warning and delete button. |
| 13 | `standard-side-metabox-in-edit-post4.jpg` | 3. Sidebar UX | `Edit_Admin_Page::add_save_widget()` | Domain sidebar: Stage select, site select, active toggle, primary save button. |
| 14 | `standard-table-with-some-badges-and-extra-styles.jpg` | 1. List UX | `Base_List_Table`, `.wpdev-badge` | Broadcasts table: filter views, pastel badges (Email blue, Notice yellow), hover actions. |
| 15 | `standard-table-with-some-badges-and-extra-styles2.jpg` | 1. List UX | `Base_List_Table`, `.wpdev-badge-success` | Financial table: green status badge ("Completed"), customer avatar cell, monospace IDs. |
| 16 | `standard-table.jpg` | 1. List UX | `Base_List_Table` | Catalog table: filter tabs, setup fee, recurring interval, slug badge, plan badges. |
| 17 | `use-ajax-action-for-heavy-works.jpg` | 6. Logs & Safety UX | `Edit_Admin_Page::add_widget()`, alert box | Pre-flight validation alert box (red notice) preventing heavy action execution. |
| 18 | `use-conditional-fields-when-its-help-user.jpg` | 5. Smart Fields UX | `add_fields_widget()`, conditionals | Conditional logic (inactive): Toggle OFF; dependent fields hidden. |
| 19 | `use-conditional-fields-when-its-help-user2.jpg` | 5. Smart Fields UX | `add_fields_widget()`, conditionals | Conditional logic (active): Toggle ON, revealing discount amount input and unit dropdown. |
| 20 | `use-multiple-tabs-for-better-ux.jpg` | 4. Modal & Wizard UX | `wpdev_register_form()`, wubox multi-tab | Multi-tab modal: Horizontal tabs (Tax info, Additional info, Type) with title and save footer. |
| 21 | `use-popup-to-add-new-entity-with-wizard-step-2.jpg` | 4. Modal & Wizard UX | `wpdev_register_form()`, wizard | Creation wizard Step 2: Customer autocomplete search, product search, message color, Back/Next. |
| 22 | `use-popup-to-add-new-entity-with-wizard.jpg` | 4. Modal & Wizard UX | `wpdev_register_form()`, choice cards | Creation wizard Step 1: Clickable choice cards (Email vs Message) with green checkmark. |
| 23 | `use-popup-to-add-new-entity.jpg` | 4. Modal & Wizard UX | `wpdev_register_form()`, wubox modal | Quick-add modal: Dimmed backdrop, tabs (Register new vs Add existing), inputs, toggles. |
| 24 | `use-preview-help-image-when-sometimes.jpg` | 5. Smart Fields UX | `add_fields_widget()`, preview badge | Preview badge on field label (`[PREVIEW] HIDE UI TOURS`) with explanatory subtext. |
| 25 | `use-repeater-when-it-needed.jpg` | 5. Smart Fields UX | `add_fields_widget()`, repeater | Repeater row: Post type label + slug inputs + delete '×' + Add Post Type button. |
| 26 | `use-setup-wizard-when-the-plugin-has-a-lot-of-initialization-code..jpg` | 4. Modal & Wizard UX | `wpdev_create_tour()`, Onboarding | Full-page onboarding wizard: Vertical step navigation on right + welcome container on left. |
| 27 | `use-special-std-or-side-metabox-for-better-ux.jpg` | 3. Sidebar UX | `Edit_Admin_Page::add_widget()`, user card | User Identity card: Avatar, username, email, `→ Switch To` button, `→ Visit Profile` button. |
| 28 | `use-special-type-of-table-view-when-it-helps.jpg` | 1. List UX | `Base_List_Table::single_row_grid()` | Card/Grid view mode switcher: Table vs Grid toggle, site cards with badges and manage buttons. |
| 29 | `use-summery-metabox-in-edit-post-when-its-helpful.jpg` | 2. Edit UX | `Edit_Admin_Page::add_list_table_widget()` | Embedded relational sub-table: Child DNS records table inside domain edit screen. |
| 30 | `use-summery-metabox-in-edit-post-when-its-helpful2.jpg` | 2. Edit UX | `Edit_Admin_Page::add_widget()`, KPI strip | Single-row "At a Glance" KPI strip: Total amount, reference ID with copy, status badge. |
| 31 | `use-top-side-metabox-for-some-important-fields-like-slug-or-id.jpg` | 3. Sidebar UX | `Edit_Admin_Page::add_save_widget()` | Top sidebar identity: Entity slug/token hash input coupled with primary save button. |
| 32 | `user-must-confirm-dangerous-action.jpg` | 3. Sidebar UX | `Edit_Admin_Page::add_widget()`, Danger Zone | Sidebar Danger Zone: Irreversible warning message + outline-styled delete button. |
| 33 | `user-must-confirm-dangerous-action2.jpg` | 6. Logs & Safety UX | `wpdev_register_form()`, safe confirmation | Destructive confirmation modal: Mandatory safety toggle switch before delete button unlocks. |
```

================================================================================
FILE 3: wpdev/skills/wpdev-admin-design/references/recipes-php.md
================================================================================
```php
<?php
declare(strict_types=1);

namespace Norvan\MyPlugin\Admin;

use WPDev\Admin\Base_List_Table;
use WPDev\Admin\Edit_Admin_Page;
use WPDev\Admin\Top_Level_Admin_Page;

/**
 * 1. List UX: Rich Composite Cells & Status Badges
 */
class Customer_List_Table extends Base_List_Table {

    public function get_columns(): array {
        return [
            'cb'       => '<input type="checkbox" />',
            'customer' => __( 'Customer', 'my-plugin' ),
            'status'   => __( 'Status', 'my-plugin' ),
            'plan'     => __( 'Plan', 'my-plugin' ),
            'created'  => __( 'Created', 'my-plugin' ),
        ];
    }

    public function column_customer( array $item ): string {
        $avatar = get_avatar( $item['email'], 36, '', '', [ 'class' => 'wpdev-avatar-rounded' ] );
        $name   = esc_html( $item['name'] );
        $email  = esc_html( $item['email'] );
        $edit_url = admin_url( 'admin.php?page=my-plugin-customers&action=edit&id=' . (int) $item['id'] );

        $actions = [
            'edit'   => sprintf( '<a href="%s">%s</a>', esc_url( $edit_url ), __( 'Edit', 'my-plugin' ) ),
            'delete' => sprintf(
                '<a href="#" class="wpdev-danger-action" data-wubox="delete-customer-modal" data-id="%d">%s</a>',
                (int) $item['id'],
                __( 'Delete', 'my-plugin' )
            ),
        ];

        return sprintf(
            '<div class="wpdev-cell-composite">
                <div class="wpdev-cell-media">%s</div>
                <div class="wpdev-cell-content">
                    <strong><a href="%s" class="row-title">%s</a></strong>
                    <span class="wpdev-cell-subtext">%s</span>
                    %s
                </div>
            </div>',
            $avatar,
            esc_url( $edit_url ),
            $name,
            $email,
            $this->row_actions( $actions )
        );
    }

    public function column_status( array $item ): string {
        $status = $item['status'] ?? 'pending';
        $badges = [
            'active'    => [ 'label' => __( 'Active', 'my-plugin' ), 'class' => 'wpdev-badge-success' ],
            'pending'   => [ 'label' => __( 'Pending', 'my-plugin' ), 'class' => 'wpdev-badge-warning' ],
            'cancelled' => [ 'label' => __( 'Cancelled', 'my-plugin' ), 'class' => 'wpdev-badge-danger' ],
        ];

        $badge = $badges[ $status ] ?? [ 'label' => esc_html( $status ), 'class' => 'wpdev-badge-secondary' ];
        return sprintf( '<span class="wpdev-badge %s">%s</span>', esc_attr( $badge['class'] ), esc_html( $badge['label'] ) );
    }

    public function single_row_grid( array $item ): void {
        $edit_url = admin_url( 'admin.php?page=my-plugin-customers&action=edit&id=' . (int) $item['id'] );
        ?>
        <div class="wpdev-grid-card">
            <div class="wpdev-grid-card-header">
                <span class="wpdev-badge wpdev-badge-primary"><?php esc_html_e( 'MAIN SITE', 'my-plugin' ); ?></span>
                <input type="checkbox" name="bulk_ids[]" value="<?php echo (int) $item['id']; ?>" />
            </div>
            <div class="wpdev-grid-card-body">
                <div class="wpdev-grid-thumbnail"><?php echo get_avatar( $item['email'], 64 ); ?></div>
                <h4 class="wpdev-grid-card-title"><?php echo esc_html( $item['name'] ); ?></h4>
                <p class="wpdev-grid-card-subtitle"><?php echo esc_html( $item['email'] ); ?></p>
            </div>
            <div class="wpdev-grid-card-footer">
                <a href="<?php echo esc_url( $edit_url ); ?>" class="button button-primary"><?php esc_html_e( 'Manage', 'my-plugin' ); ?></a>
            </div>
        </div>
        <?php
    }
}

/**
 * 2. Edit UX: Vertical Icon Tabs, "At a Glance" Strip & Sub-Tables
 */
class Edit_Order_Page extends Edit_Admin_Page {

    public function init_widgets(): void {
        $this->add_widget( 'at_a_glance', __( 'At a Glance', 'my-plugin' ), [
            'context'  => 'top',
            'priority' => 'high',
            'callback' => [ $this, 'render_at_a_glance' ],
        ] );

        $this->add_tabs_widget( 'order_tabs', __( 'Order Details', 'my-plugin' ), [
            'general' => [
                'label' => __( 'General', 'my-plugin' ),
                'icon'  => 'dashicons-admin-generic',
                'view'  => [ $this, 'render_tab_general' ],
            ],
            'billing' => [
                'label' => __( 'Billing & Taxes', 'my-plugin' ),
                'icon'  => 'dashicons-money-alt',
                'view'  => [ $this, 'render_tab_billing' ],
            ],
        ] );

        $this->add_list_table_widget( 'line_items', __( 'Order Line Items', 'my-plugin' ), [
            'table_class' => Order_Line_Items_Table::class,
            'context'     => 'normal',
        ] );
    }

    public function render_at_a_glance(): void {
        $ref_id   = 'ORD-98234-X';
        $total    = '$299.00';
        $status   = 'Completed';
        ?>
        <div class="wpdev-at-a-glance-strip">
            <div class="wpdev-glance-metric">
                <span class="wpdev-glance-label"><?php esc_html_e( 'Total Amount', 'my-plugin' ); ?></span>
                <strong class="wpdev-glance-val"><?php echo esc_html( $total ); ?></strong>
            </div>
            <div class="wpdev-glance-metric">
                <span class="wpdev-glance-label"><?php esc_html_e( 'Reference ID', 'my-plugin' ); ?></span>
                <code class="wpdev-monospace-id"><?php echo esc_html( $ref_id ); ?></code>
                <button type="button" class="wpdev-copy-btn" data-clipboard-text="<?php echo esc_attr( $ref_id ); ?>" title="Copy">📋</button>
            </div>
            <div class="wpdev-glance-metric">
                <span class="wpdev-glance-label"><?php esc_html_e( 'Status', 'my-plugin' ); ?></span>
                <span class="wpdev-badge wpdev-badge-success"><?php echo esc_html( $status ); ?></span>
            </div>
        </div>
        <?php
    }
}

/**
 * 3. Modal UX: Safe Deletion Modal with Mandatory Toggle Unlock
 */
wpdev_register_form( 'confirm-delete-modal', [
    'title'       => __( 'CONFIRM DELETION', 'my-plugin' ),
    'access'      => 'my_plugin.entity.delete',
    'modal_width' => 450,
    'render'      => function() {
        ?>
        <div class="wpdev-safe-delete-modal">
            <div class="wpdev-toggle-row">
                <label class="wpdev-switch">
                    <input type="checkbox" id="wpdev-delete-unlock-toggle" />
                    <span class="wpdev-slider"></span>
                </label>
                <div class="wpdev-toggle-text">
                    <strong><?php esc_html_e( 'CONFIRM DELETION', 'my-plugin' ); ?></strong>
                    <p class="description"><?php esc_html_e( 'This action cannot be undone.', 'my-plugin' ); ?></p>
                </div>
            </div>
            <div class="wpdev-modal-footer">
                <button type="submit" id="wpdev-final-delete-btn" class="button button-danger" disabled>
                    <?php esc_html_e( 'Delete Permanently', 'my-plugin' ); ?>
                </button>
            </div>
        </div>
        <script>
        document.getElementById('wpdev-delete-unlock-toggle')?.addEventListener('change', function(e) {
            const btn = document.getElementById('wpdev-final-delete-btn');
            if (btn) btn.disabled = !e.target.checked;
        });
        </script>
        <?php
    }
] );
```

================================================================================
FILE 4: WIRING DIFF IN wpdev/skills/wpdev-panel-builder/SKILL.md
================================================================================
```diff
--- a/skills/wpdev-panel-builder/SKILL.md
+++ b/skills/wpdev-panel-builder/SKILL.md
@@ -2,9 +2,9 @@
 name: wpdev-panel-builder
 description: >-
   Orchestrator for production-grade WPDev admin panels in the user's host plugin
-  (not wpdev-examples). Enforces UX analysis, propose-and-wait for optional UX
-  (modal create, tour, onboarding flow, custom action modals), then routes to
-  specialist skills. Covers CRUD domains, list/edit pages, tables, metaboxes,
+  (not wpdev-examples). Enforces wpdev-admin-design language and the 7 canonical UX families,
+  UX analysis, propose-and-wait for optional UX (modal create, tour, onboarding flow, custom action modals),
+  then routes to specialist skills. Covers CRUD domains, list/edit pages, tables, metaboxes,
   settings, dashboard widgets, menus, ajax, empty states, badges, tours, and
   routes non-CRUD tool pages / advanced caps to wpdev-advanced-panels.
   Optional gold standards from @examples/ when that separate repo is installed.
@@ -88,9 +88,10 @@
 Read recipes from inlined `references/` and `@framework/`. Optionally open `@examples/` when installed. Write into the host plugin.
 
-### Phase 1 — UX analysis (no code yet)
-
-Fill the checklist in [workflow.md](references/workflow.md) § Phase 1 in chat before writing code.
+### Phase 1 — UX analysis & Design Language (no code yet)
+
+1. **MANDATORY Visual Design Language:** Before writing any code, consult `wpdev-admin-design` (`../wpdev-admin-design/SKILL.md`). You MUST map all requested screen elements to the **7 canonical UX design families** (Rich Cells, Pastel Badges, List/Grid Switcher, At-a-Glance KPI Strip, Icon Vertical Tabs, Modular Identity/Save Sidebars, Safety Modals with Toggle Lock, Terminal Logs, and Smart Conditionals).
+2. Fill the checklist in [workflow.md](references/workflow.md) § Phase 1 in chat before writing code.
```
```
