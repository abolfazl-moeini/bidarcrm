# Gold-standard map (URL → recipe → source → skill)

**Prefer inlined specialist `references/` snippets** (skills work without examples).  
`@examples/` paths below are **optional deeper reading**. Install the separate repo only if you want those files:

```bash
cd "{PLUGINS}"
git submodule add https://github.com/abolfazl-moeini/wpdev-examples.git wpdev-examples
```

Write adapted code into the **host plugin**.

| Desired UX | Production URL | Verified gold source (optional) | Recipe | Target skill |
|------------|----------------|----------------------------------|--------|--------------|
| Production dashboard shell | `admin.php?page=wpdev` | `@examples/dashboard/src/admin/class-top-level-admin-page.php` | settings-dashboard § dashboard-widgets | settings-dashboard |
| Settings sections UI | `admin.php?page=wpdev-settings` | `@examples/admin-setting-page-defaults/src/sections/*.php` | settings-dashboard § settings-sections | settings-dashboard |
| Addon-grouped host settings | `admin.php?page=wpdev-settings` (Add-ons group) | n/a (host `addon => true`) | advanced-panels § advanced-capabilities-and-settings | advanced-panels |
| Non-CRUD tool page (tabs + empty + modal) | host tool page under `wpdev` / brand | n/a (Exporter-shaped; framework APIs only) | advanced-panels § custom-tool-page | advanced-panels |
| Empty state + Create CTA | `admin.php?page=wpdev-products` | `@examples/products/src/tables/class-product-list-table.php:35-45,268-270` | list-ux § empty-states | list-ux |
| Modal create | `admin.php?page=wpdev-domains` | `@examples/domains/...` (list + table) | modal-forms § create-modal | modal-forms |
| Views/tabs + ajax filter + colored Type | `admin.php?page=wpdev-sites` | `@examples/sites/src/tables/class-site-list-table.php` | list-ux § views, badges | list-ux |
| Colored status column | `admin.php?page=wpdev-memberships` | `@examples/memberships/src/tables/class-membership-list-table.php` | list-ux § badges | list-ux |
| Tour guide | `admin.php?page=wpdev-checkout-forms` | `@examples/checkout/src/admin/class-checkout-form-list-admin-page.php:59-87` | onboarding-ux § tours | onboarding-ux |
| Setup wizard (constraint!) | `admin.php?page=wpdev-setup` | `@framework/modules/wizard/...` (read fully before use) | onboarding-ux § setup-wizard-constraint | onboarding-ux |
| Edit metaboxes (Advanced Options, Save) | `admin.php?page=wpdev-edit-discount-code&options=time` | `@examples/discount-codes/src/admin/class-discount-code-edit-admin-page.php` | edit-ux § tabs, save | edit-ux |
| Custom row action + result modal | `admin.php?page=wpdev-webhooks` | `@examples/webhooks/` (table + manager + JS) | modal-forms + list-ux | modal-forms, list-ux |
| Cross-plugin bootstrap | n/a | `@framework/modules/core/src/class-module-loader.php` | consumer-plugin-layout | orchestrator |
| Full CRUD gold standard | — | `@examples/products/` (optional) | model-db-manager + admin-pages | orchestrator |

## How to use this table

1. Map the user's desired UX to a row above.
2. Open the target specialist skill and its cited reference file (inlined snippet first).
3. Copy the minimal recipe snippet; adapt namespaces/paths to the host plugin.
4. Re-verify every `wpdev_*` signature before shipping if the framework changed.
