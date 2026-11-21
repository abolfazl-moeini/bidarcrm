# WPDev Admin Panel Screenshot Catalog (33 Gold Standards)

This document provides the authoritative mapping of all 33 gold-standard screenshot patterns from:
`/Users/moeini/Dev/multisite/panel-screenshots/`
into the 7 canonical UX design families of the WPDev framework.

---

## Complete Alphabetical Catalog (1 – 33)

| # | Screenshot Filename | UX Family | WPDev PHP Class / API | Visual & Behavioral Pattern |
|---|---|---|---|---|
| **1** | `add-note-metaboxes-when-it-helps-user.jpg` | **6. Logs & Safety UX** | `Edit_Admin_Page::add_tabs_widget()`, `wpdev_register_ajax_handler()` | Vertical tabbed metabox with internal notes timeline. Each note displays author avatar, relative timestamp, text bubble, and delete action. Footer includes "Add new Note" button and "Clear Notes" link. |
| **2** | `display-useful-info-in-first-column-of-tables-like-userinfo-entity-info-product-info-etc....jpg` | **1. List UX** | `Base_List_Table::column_default()`, `Base_List_Table::column_cb()` | Composite primary table column. Renders user avatar + bold display name + muted email in a single cell, with human-readable relative dates («۲ ماه پیش») and bulk-action checkbox. |
| **3** | `group-fields-that-perform-related-tasks-together-in-a-single-section-separated-by-a-heading..jpg` | **7. Dashboard & Settings UX** | `wpdev_register_settings_section()`, `add_fields_widget()` | Semantic field grouping in settings. Features bold section titles, explanatory italicized subtext, media upload buttons, and clean horizontal rule separators. |
| **4** | `must-use-special-field-to-choose-a-page.jpg` | **5. Smart Fields UX** | `field-builder/setup.php` (`page_select`), Dashicon `external` | Custom page picker dropdown with an external link icon button (`↗`). Allows administrators to select a page and immediately open it in a new browser tab to inspect contents. |
| **5** | `setting-with-ads-sidebar.jpg` | **7. Dashboard & Settings UX** | `Top_Level_Admin_Page`, `wpdev-styling/admin-layout.css` | 3-Column Settings Layout: Left promo/upsell card + Center active settings form with toggle switches and shaded save footer + Right vertical tab list with instant search input. |
| **6** | `sometimes-use-dashboard-and-visualization.jpg` | **7. Dashboard & Settings UX** | `Top_Level_Admin_Page`, `wpdev_register_dashboard_widget()` | Top-level executive KPI dashboard. Features date-range dropdown filter (`Last 7 days`, `Month to date`), horizontal view tabs, multi-column metric cards, and a revenue breakdown table. |
| **7** | `sometimes-use-logs-or-events-metabox-in-edit-post-is-useful.jpg` | **6. Logs & Safety UX** | `Edit_Admin_Page::add_widget()`, collapsible metabox | Audit trail metabox ("Events") showing entity lifecycle transitions with collapsible header and styled empty-state container when no events exist. |
| **8** | `sometimes-use-logs-or-events-metabox-in-edit-post-is-useful2.jpg` | **6. Logs & Safety UX** | `Edit_Admin_Page::add_widget()`, AJAX logger | Dark monospace terminal console metabox ("Domain Test Log"). Displays UTC timestamps, real-time command output, and an AJAX "Refresh Logs" button. |
| **9** | `standard-edit-post-metabox.jpg` | **2. Edit UX** | `Edit_Admin_Page::add_tabs_widget()` | Primary edit page tabbed container. Vertical icon-badged navigation tabs on the right («عمومی», «Up & Downgrades», «Taxes») and field configuration on the left with slug tooltips and role selects. |
| **10** | `standard-side-metabox-in-edit-post.jpg` | **5. Smart Fields UX** | `Edit_Admin_Page::add_widget()`, pricing field | Sidebar recurring billing metabox. Combines recurring toggle switch, amount input, currency select, interval select, and dynamic real-time human sentence calculation. |
| **11** | `standard-side-metabox-in-edit-post2.jpg` | **3. Sidebar UX** | `Edit_Admin_Page::add_save_widget()`, status widget | Modular sidebar layout: Card 1 has "Save Product" primary button in shaded footer; Card 2 has "Active" status toggle switch; Card 3 has "Product Image" media uploader. |
| **12** | `standard-side-metabox-in-edit-post3.jpg` | **3. Sidebar UX** | `Edit_Admin_Page::add_widget()`, Danger Zone | Card 1: Timestamps widget (Created At & Last Modified At with human relative dates). Card 2: Danger Zone widget («حذف») with irreversible warning and outline delete button. |
| **13** | `standard-side-metabox-in-edit-post4.jpg` | **3. Sidebar UX** | `Edit_Admin_Page::add_save_widget()` | Dedicated entity sidebar for Domains: Lifecycle stage dropdown ("Checking DNS"), target site select, "Active" toggle switch, and primary "Save Domain" button. |
| **14** | `standard-table-with-some-badges-and-extra-styles.jpg` | **1. List UX** | `Base_List_Table`, `.wpdev-badge` | "Broadcasts" list table: top filter views («All», «Emails», «Notices»), search box, semantic pastel badges (Email blue, Notice yellow), target tags, and hover row actions. |
| **15** | `standard-table-with-some-badges-and-extra-styles2.jpg` | **1. List UX** | `Base_List_Table`, `.wpdev-badge-success` | Financial ledger table ("Payments"): green pill status badge ("Completed"), customer avatar cell, monospace reference ID, and formatted currency columns. |
| **16** | `standard-table.jpg` | **1. List UX** | `Base_List_Table` | Catalog list table ("Products"): filter tabs, setup fee column, recurring interval column, gray monospace slug badge, and product tier pills. |
| **17** | `use-ajax-action-for-heavy-works.jpg` | **6. Logs & Safety UX** | `Edit_Admin_Page::add_widget()`, pre-flight alert | Pre-flight validation alert box (light red background with error explanation) preventing accidental execution of heavy AJAX operations until prerequisites are met. |
| **18** | `use-conditional-fields-when-its-help-user.jpg` | **5. Smart Fields UX** | `add_fields_widget()`, conditional logic | Conditional field logic (inactive state): Toggle switch "SETUP FEE DISCOUNT" is OFF; dependent fields remain hidden to keep UI clean. |
| **19** | `use-conditional-fields-when-its-help-user2.jpg` | **5. Smart Fields UX** | `add_fields_widget()`, conditional logic | Conditional field logic (active state): Toggle switch switched ON, instantly revealing numeric discount input and unit dropdown (`% Percentage`). |
| **20** | `use-multiple-tabs-for-better-ux.jpg` | **4. Modal & Wizard UX** | `wpdev_register_form()`, wubox multi-tab | Multi-tab modal form for complex sub-items ("ADD LINE ITEM"). Header features horizontal tabs: "TAX INFO" \| "ADDITIONAL INFO" \| "نوع", with title, description, and save footer. |
| **21** | `use-popup-to-add-new-entity-with-wizard-step-2.jpg` | **4. Modal & Wizard UX** | `wpdev_register_form()`, wizard engine | Step 2 of creation wizard ("ADD BROADCAST"). Features autocomplete customer search, target product search, message color selector, "← Back", and "→ Next Step" button. |
| **22** | `use-popup-to-add-new-entity-with-wizard.jpg` | **4. Modal & Wizard UX** | `wpdev_register_form()`, visual card select | Step 1 of creation wizard ("ADD BROADCAST"). Large interactive card options ("ایمیل" vs "MESSAGE") with icon and green checkmark badge on selected card. |
| **23** | `use-popup-to-add-new-entity.jpg` | **4. Modal & Wizard UX** | `wpdev_register_form()`, wubox single-entity | Quick-add modal launched from list table "Add Domain +". Dimmed backdrop with tabs ("REGISTER NEW" \| "ADD EXISTING DOMAIN"), inputs, dropdowns, and toggle switch. |
| **24** | `use-preview-help-image-when-sometimes.jpg` | **5. Smart Fields UX** | `add_fields_widget()`, preview badge | Contextual preview trigger attached directly to field label: `[PREVIEW] HIDE UI TOURS` badge with photo icon, accompanied by detailed helper explanation. |
| **25** | `use-repeater-when-it-needed.jpg` | **5. Smart Fields UX** | `add_fields_widget()`, repeater field type | Multi-item repeater row: "POST TYPE LABEL" input + "POST TYPE SLUG" input with delete icon (`×`) on the left, and "+ ADD POST TYPE" action button below. |
| **26** | `use-setup-wizard-when-the-plugin-has-a-lot-of-initialization-code..jpg` | **4. Modal & Wizard UX** | `wpdev_create_tour()`, Onboarding Wizard | Full-page onboarding setup wizard: right sidebar shows installation steps progress («خوش آمدید», Pre-install Checks, License, Installation, Ready) and left container shows welcome card. |
| **27** | `use-special-std-or-side-metabox-for-better-ux.jpg` | **3. Sidebar UX** | `Edit_Admin_Page::add_widget()`, user card | Entity identity card: circular identicon avatar, username `pg_demo_3`, email, quick-action buttons (`→ Switch To`, `→ Visit Profile`), user role select, and verification select. |
| **28** | `use-special-type-of-table-view-when-it-helps.jpg` | **1. List UX** | `Base_List_Table::single_row_grid()`, view modes | Alternate Card / Grid view mode for List Tables: Top-right view switcher toggles between Table and Grid. Renders responsive site cards with badges, URLs, and checkboxes. |
| **29** | `use-summery-metabox-in-edit-post-when-its-helpful.jpg` | **2. Edit UX** | `Edit_Admin_Page::add_list_table_widget()` | Embedded relational sub-table inside edit page ("Domain URL"). Displays live child DNS records (TTL, IP/Target, Type, Host) with network IP footer. |
| **30** | `use-summery-metabox-in-edit-post-when-its-helpful2.jpg` | **2. Edit UX** | `Edit_Admin_Page::add_widget()`, KPI strip | Single-row "At a Glance" KPI strip at the top of an Edit page: Total amount ($0), Reference ID (`3ON82J8MK1`) with copy action, and Payment Status pill badge ("Completed"). |
| **31** | `use-top-side-metabox-for-some-important-fields-like-slug-or-id.jpg` | **3. Sidebar UX** | `Edit_Admin_Page::add_save_widget()` | High-priority identity side metabox: Top card hosts generated entity slug/hash (`6a75c719e0177`) directly coupled with the primary "Save [Entity]" button. |
| **32** | `user-must-confirm-dangerous-action.jpg` | **3. Sidebar UX** | `Edit_Admin_Page::add_widget()`, Danger Zone | Sidebar Danger Zone trigger card: Displays irreversible action warning message and outline-styled destructive action button ("Delete Payment"). |
| **33** | `user-must-confirm-dangerous-action2.jpg` | **6. Logs & Safety UX** | `wpdev_register_form()`, safe confirmation | Two-step destructive confirmation modal: Displays "CONFIRM DELETION - This action cannot be undone" with a safety toggle switch. Delete button is DISABLED until toggle is flipped. |

---

## Pattern Summary by Frequency

1. **Sidebar UX (Family 3):** 6 patterns (Modular Save, Status Toggles, Identity Card, Slugs, Danger Zone).
2. **Logs & Safety UX (Family 6):** 5 patterns (Notes Timeline, Dark Terminal, Danger Confirmation Modal, Pre-flight Alerts).
3. **Smart Fields UX (Family 5):** 5 patterns (Conditional Logic Toggles, Repeaters, Page Pickers, Recurring Pricing, Label Previews).
4. **Modal & Wizard UX (Family 4):** 5 patterns (wubox Quick Add, Multi-Tab Popups, Visual Step Wizards, Onboarding Setup).
5. **List UX (Family 1):** 4 patterns (Rich First Column, Status Badges, Grid/Card View Switcher, Hover Row Actions).
6. **Dashboard & Settings UX (Family 7):** 4 patterns (KPI Cards, Date Range Filters, 3-Column Settings Layout, Section Grouping).
7. **Edit UX (Family 2):** 4 patterns (Vertical Icon Tabs, "At a Glance" Strip, Embedded Relational Tables).
