# Non-CRUD example types

Optional deeper reading (install separate repo only if needed):
```bash
cd "{PLUGINS}"
git submodule add https://github.com/abolfazl-moeini/wpdev-examples.git wpdev-examples
```

Not every `@examples/*` module is list/edit CRUD. Pick the right shape first. **Read** from `@examples/`; **write** into the host plugin.

## Type map

| Type | @examples | Shape | Specialist |
|------|-----------|-------|------------|
| Classic CRUD | `products`, `customers`, `sites`, `domains`, … | setup + list/edit + tables + model/DB + manager | orchestrator + list-ux + edit-ux |
| Custom tool / utility page | n/a (host-first; Exporter-shaped) | `Base_Admin_Page` + tabs + empty state + optional modal | **advanced-panels** (+ modal-forms if confirmed) |
| Checkout flows | `checkout`, `gateways` | CRUD + managers + field templates | api-cookbook-domain |
| Customer panel | `customer-panel` | Page classes + UI elements | orchestrator |
| Dashboard marker | `dashboard` | Top-level shell | settings-dashboard |
| Settings defaults | `admin-setting-page-defaults` | Hook sections into shared settings page | settings-dashboard (+ advanced-panels for `addon` flag) |
| Widget bundle | `admin-custom-page-dashboard-widgets` | `wpdev_register_dashboard_widget` on `wpdev_load` | settings-dashboard |
| Utility/system (mixed) | `system`, `addons`, `platform`, `emails` | Mixed pages, tooling | **advanced-panels** for tool pages; orchestrator otherwise |
| Metabox sample | `metabox-post-type` | CPT + edit widgets | edit-ux |
| Admin bar shortcuts | `waas-admin-bar-shortcuts` | Domain admin bar nodes | orchestrator |

## Decision rules

1. Table-backed entity with list/edit URLs → orchestrator Phase 3 + `wpdev-list-ux` + `wpdev-edit-ux`
2. Non-CRUD tool (export/import/jobs/tabbed utility) → `wpdev-advanced-panels` [custom-tool-page.md](../../wpdev-advanced-panels/references/custom-tool-page.md)
3. Account-facing dashboard → `@examples/customer-panel/`
4. KPI blocks → `wpdev-settings-dashboard`
5. Settings tabs only → `wpdev-settings-dashboard` (addon grouping → advanced-panels)
6. Checkout/payment → [api-cookbook-domain.md](api-cookbook-domain.md)

## Checkout (`@examples/checkout/`)

Beyond CRUD:

- `wpdev_register_module_views( 'wpdev-checkout' )`
- Multiple `wpdev_boot_module_manager()` calls
- Element singletons on `wpdev_load`
- Public functions: `gateway`, `checkout-form`, `checkout`
- Tour pattern → `wpdev-onboarding-ux`
- Form editor Vue contract: template `modules/admin-page-builder/views/base/checkout-forms/steps.php` must keep `#wpdev-checkout-editor-app` / `#wpdev-checkout-preview` in sync with `@examples/checkout/assets/js/checkout-forms-editor.js` (see anti-patterns §25–26)

## Customer panel (`@examples/customer-panel/`)

- Admin pages under `Customer_Panel\*`
- UI elements on `wpdev_load`
- Not a CRUD gold standard — read for UI composition patterns only
