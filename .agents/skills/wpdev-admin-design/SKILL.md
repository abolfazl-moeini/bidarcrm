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

```
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
│   ├── Interactive Icon Picker with Fuzzy Search (wubox + Vue)
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
```

---

### Family 1: List UX (Tables & Card Views)

- **Rich Composite First Column:**
  - The primary entity column must combine the entity icon or user avatar, primary title/name in bold, secondary metadata (e.g. email, role, or slug) in muted text, and humanized relative dates.
  - Hover row actions (`Edit | Delete | View`) appear beneath the primary cell text.
- **Semantic Pastel Badges:**
  - Status and type values must never be plain text. Use rounded pill badges (`.wpdev-badge`):
    - *Green / Emerald:* Completed, Active, Verified, Published.
    - *Blue / Sky:* Email, Regular Site, Processing, Primary.
    - *Yellow / Amber:* Notice, Pending, Review, Checking DNS.
    - *Red / Rose:* Inactive, Failed, Blocked, Danger.
    - *Gray / Slate:* Monospace slugs, system identifiers, generic tags.
- **View Mode Switcher (List vs Grid/Card View):**
  - For visual entities (Sites, Products, Themes, Templates), provide a view toggle in the table header: Tabular list icon vs Grid card icon.
  - In Grid mode: Each item renders as a card with preview container, status badge tag at top-left, title, URL, primary action button, and select checkbox for bulk actions.

---

### Family 2: Edit UX (Tabbed Forms & Metrics)

- **Icon Vertical Tabs (`add_tabs_widget`):**
  - Place navigation tabs vertically on the right (for RTL) or left (for LTR).
  - Each tab must have a distinct Dashicon/SVG icon and clear label.
  - Active tab is visually elevated with white background and active border accent.
- **"At a Glance" Top KPI Strip:**
  - In complex entities (Orders, Invoices, Contracts, Domains), render a single-row summary card at the very top:
    - Metric 1: Total Value / Amount (bold display).
    - Metric 2: Reference / Contract ID with one-click copy icon.
    - Metric 3: Current Status pill badge.
- **Embedded Sub-Tables (`add_list_table_widget`):**
  - For parent-child relationships (e.g. Domain DNS records, Order line items, Activity logs), embed a clean child table directly within the edit screen instead of forcing navigation away.

---

### Family 3: Sidebar UX (Identity & Modular Actions)

- **User Identity & Impersonation Card:**
  - When editing a customer, user, or client record, sidebar card 1 features:
    - Centered avatar / identicon.
    - Username & email in blue accent.
    - Quick actions: `→ Switch To` (User Impersonation) and `→ Visit Profile`.
    - User ID and verification status dropdowns.
- **Modular Save & Status Widgets:**
  - Keep the primary "Save [Entity]" button in a dedicated sidebar card with shaded background footer.
  - Place "Active / Inactive" toggle switches in an adjacent modular card.
  - High-priority immutable or routing fields (e.g. Form Slug, Webhook Token, Shortcode ID) belong in the top sidebar card directly above the save action.
- **Danger Zone Card:**
  - Destructive entity deletion lives in a dedicated sidebar card at the bottom with a clear warning: *"Be careful. This action is irreversible"*.
  - Render an outline-style destructive button (`Delete [Entity]`).

---

### Family 4: Modal & Wizard UX (Popups & Onboarding)

- **Quick-Add Modals (`wpdev_register_form` / wubox):**
  - Keep users in their workflow! Adding child records or quick entities must launch a dimmed-backdrop wubox modal rather than navigating to a separate blank screen.
  - Support horizontal sub-tabs inside the modal (`General | Additional Info | Tax`) when form fields exceed 5 inputs.
- **Visual Step Wizard:**
  - For multi-branch creation flows (e.g. creating Broadcasts, Campaigns, or Automations):
    - **Step 1 (Type Selection):** Large clickable card selectors with icons and active green checkmark badges.
    - **Step 2 (Parameters):** Autocomplete search inputs for target audiences and message styling with `← Back` and `→ Next Step` navigation.
- **Onboarding Setup Wizard (`wpdev_create_tour`):**
  - Full-screen onboarding flows feature a vertical step navigation sidebar on the right and an illustrated welcome card on the left with server pre-flight checks.

---

### Family 5: Smart Fields UX (Adaptive Forms)

- **Instant Conditional Toggles:**
  - Never clutter forms with irrelevant fields. Use toggle switches that reveal dependent fields inline without full-page reloads.
  - *Example:* Enabling "Setup Fee Discount" toggle instantly exposes numeric discount amount input and unit select dropdown (`% Percentage` vs `$ Fixed`).
- **Dynamic Repeaters:**
  - For 1-to-N key-value pairs or post-type registrations, use the built-in repeater field layout: multi-column input row, remove button (`×`), and `+ Add [Item]` button.
- **Page / Entity Picker:**
  - Page dropdown selectors must include an adjacent popout icon button (`↗`) allowing administrators to view or preview the target page in a new browser tab.
- **Interactive Icon Picker (`icon-picker` / `icon_picker`):**
  - Interactive selection modal (powered by native `wubox` and reactive Vue) replacing rigid text inputs or cluttered `<select>` dropdowns.
  - Features real-time live preview box, client-side fuzzy search across icon names and semantic tags, two-tier categorization (by library and subject), custom SVG geometric extraction (paths, circles, rects), and WordPress Media Library (`wp.media`) uploads.
  - Persists structured data arrays (`library`, `name`, `class`, `attachment_id`, `view_box`, `path_data`) ensuring zero raw HTML tags in MySQL and 100% XSS defense.
  - Render with `wpdev_render_icon($icon_data, $atts)`.
- **Recurring Price Calculator:**
  - Pricing inputs must combine amount, currency, and interval unit (`Month`, `Year`), accompanied by a real-time human calculation sentence (e.g., *"The customer will be charged $299 every 1 year(s)"*).

---

### Family 6: Logs & Safety UX (Telemetry & Protection)

- **Notes & Event Timeline:**
  - Entities that undergo status transitions must provide a internal notes metabox: chronological feed with author avatar, Persian/relative timestamp, note text, and delete action.
- **Dark Monospace Terminal Console:**
  - For real-time background tasks (DNS checks, webhooks, deployment logs), render a dark console box with monospace font, UTC/local timestamps, and an Ajax "Refresh Logs" button.
- **Fail-Safe Deletion Modal (Mandatory Toggle Unlock):**
  - When clicking "Delete" in the Danger Zone, open a modal with a **mandatory safety toggle switch**:
    - Toggle: *"CONFIRM DELETION - This action cannot be undone"*.
    - The final "حذف / Delete" button remains disabled (grayed out) until the administrator explicitly flips the toggle switch to ON.
- **Pre-Flight Heavy Action Alerts:**
  - Before allowing resource-intensive asynchronous actions (e.g., site screenshots, remote backups, mass syncing), display an inline alert card validating prerequisites (e.g. public DNS accessibility).

---

### Family 7: Dashboard & Settings UX (Analytics & Shell)

- **Top-Level KPI Dashboard (`Top_Level_Admin_Page`):**
  - Top header with date range dropdown (`Last 7 days`, `Month to date`, `Year to date`).
  - Horizontal view tabs.
  - Multi-column metric cards showing key totals with positive/negative trend indicators.
  - Breakdown table listing top-performing entities.
- **3-Column Settings Layout:**
  - **Left column:** Promo, addon announcements, or documentation widget.
  - **Center column:** Active tab's settings cards with toggle switches, grouped sections, and shaded save footer.
  - **Right column:** Vertical navigation menu with built-in instant search filter for rapid setting lookup.

---

## 3. Integration with WPDev Skills

This skill is the **Visual Standard Authority** for:
- `wpdev-panel-builder`: In Phase 1, consult this skill to select which of the 7 families apply to the user's domain.
- `wpdev-list-ux`: Follows Family 1 (Rich cells, badges, view switcher).
- `wpdev-edit-ux`: Follows Family 2 & 3 (Vertical icon tabs, At-a-Glance KPI, modular sidebars, Danger Zone).
- `wpdev-modal-forms`: Follows Family 4 & 6 (wubox quick-add, step wizards, fail-safe confirmation modals).
- `wpdev-settings-dashboard`: Follows Family 7 (KPI cards, 3-column settings shell).

---

## 4. References & Tooling

- **Screenshot Catalog:** [screenshot-catalog.md](references/screenshot-catalog.md) (Complete mapping of all 33 gold-standard patterns from `/Users/moeini/Dev/multisite/panel-screenshots/`).
- **PHP Code Recipes:** [recipes-php.md](references/recipes-php.md) (Turnkey copy-paste snippets for all 7 families).
