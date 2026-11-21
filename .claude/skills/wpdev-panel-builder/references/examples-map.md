# Examples map (optional gold standards)

**Optional.** Host panels must be buildable from inlined skill snippets alone. Install the separate examples repo only if you want to open demo files:

```bash
cd "{PLUGINS}"
git submodule add https://github.com/abolfazl-moeini/wpdev-examples.git wpdev-examples
```

Then pick the nearest `@examples/` family, **read** the pattern, **write** adapted code into the **host plugin**. API snippets: [api-cookbook.md](api-cookbook.md).

**Naming:** folder `@examples/products/` → module id `wpdev-products`. Never `@examples/wpdev-products/`.

**Exception:** demo modules `admin-setting-page-defaults`, `admin-custom-page-dashboard-widgets`, and `metabox-post-type` omit the `wpdev-` prefix — use the exact id from each `setup.php`.

## Domain examples (read-only)

| Module id | @examples path | Specialist / doc | Canonical files |
|-----------|----------------|------------------|-----------------|
| `wpdev-products` | `@examples/products/` | orchestrator + list-ux + edit-ux | `setup.php`, `src/admin/`, `src/tables/` |
| `wpdev-customers` | `@examples/customers/` | edit-ux (rich widgets) | `class-customer-edit-admin-page.php` |
| `wpdev-sites` | `@examples/sites/` | list-ux (views + badges) | `class-site-list-table.php` |
| `wpdev-domains` | `@examples/domains/` | modal-forms (modal create) | list + modal handlers |
| `wpdev-memberships` | `@examples/memberships/` | list-ux (status badges) | list table + status enum |
| `wpdev-discount-codes` | `@examples/discount-codes/` | edit-ux (tabs + save) | edit admin page |
| `wpdev-checkout` | `@examples/checkout/` | onboarding-ux (tour) | checkout form list page |
| `wpdev-gateways` | `@examples/gateways/` | api-cookbook-domain | settings sections |
| `wpdev-webhooks` | `@examples/webhooks/` | modal-forms + list-ux | row action + ajax |
| `wpdev-dashboard` | `@examples/dashboard/` | settings-dashboard | top-level shell |
| `admin-setting-page-defaults` | `@examples/admin-setting-page-defaults/` | settings-dashboard | settings sections |
| `admin-custom-page-dashboard-widgets` | `@examples/admin-custom-page-dashboard-widgets/` | settings-dashboard | dashboard widgets |
| `wpdev-payments` | `@examples/payments/` | api-cookbook-domain | invoices |
| `wpdev-events` | `@examples/events/` | api-cookbook-domain | event types |
| `wpdev-customer-panel` | `@examples/customer-panel/` | example-types | UI elements |
| `metabox-post-type` | `@examples/metabox-post-type/` | edit-ux | CPT + metabox |

Full URL map: [gold-standards.md](gold-standards.md).

## Family map

| Family | Best start | Write target |
|--------|------------|--------------|
| Domain CRUD | `@examples/products/` | Host plugin per [consumer-plugin-layout.md](consumer-plugin-layout.md) |
| Modal create | `@examples/domains/` | Host plugin |
| Rich edit | `@examples/customers/`, `@examples/discount-codes/` | Host plugin |
| Dashboard widgets | `@examples/admin-custom-page-dashboard-widgets/` | Host plugin |
| Settings only | `@examples/admin-setting-page-defaults/` | Host plugin |
| Checkout / gateways | `@examples/checkout/`, `@examples/gateways/` | Host plugin |

## Quick selection

1. DB + list + edit + manager? → `@examples/products/` + [model-db-manager.md](model-db-manager.md)
2. Rich edit widgets / tabs? → `@examples/discount-codes/` → `wpdev-edit-ux`
3. KPI cards? → `@examples/admin-custom-page-dashboard-widgets/` → `wpdev-settings-dashboard`
4. Settings tabs? → `@examples/admin-setting-page-defaults/` → `wpdev-settings-dashboard`
5. Modal create? → `@examples/domains/` → `wpdev-modal-forms` (after user confirms)
6. Checkout/payment? → [api-cookbook-domain.md](api-cookbook-domain.md)