---
name: wpdev-list-ux
description: >-
  Production-quality WPDev list pages and list tables: empty states with Create
  CTA, ajax views/tabs, colored badge columns, custom row actions. Use when
  building List_Admin_Page, Base_List_Table, add_new wiring, status/type filters,
  empty state, column badges, or row action links. Open after wpdev-panel-builder
  Phase 0–2. Write to host plugin; optional gold standards from @examples/.
---

# WPDev List UX

Opened by `wpdev-panel-builder` after UX analysis. Implements **always-on** list quality; custom row-action modals need user confirmation (then also open `wpdev-modal-forms`).

## Paths

See [SHARED-PATHS.md](../SHARED-PATHS.md). Write to `@host`. `@examples` is optional (separate repo). Use inlined snippets in `references/` first.

## References (read the matching recipe)

| Pattern | File |
|---------|------|
| Empty state + Create CTA | [references/empty-states.md](references/empty-states.md) |
| Bulk confirm modal + page context | [references/bulk-modal-context.md](references/bulk-modal-context.md) |
| Views/tabs + ajax filtering | [references/views-and-ajax-tabs.md](references/views-and-ajax-tabs.md) |
| Declarative table config + row actions helper | [references/declarative-table-config.md](references/declarative-table-config.md) |
| Custom / non-BerlinDB data sources | [references/declarative-table-config.md](references/declarative-table-config.md#custom-data-sources-no-berlindb-query_class) |
| List / grid modes + `single_row_grid()` | [references/list-grid-modes.md](references/list-grid-modes.md) |
| Colored type/status badges | [references/column-badges.md](references/column-badges.md) |
| Row action links (list side) | [references/row-actions-ajax.md](references/row-actions-ajax.md) |
| List page shell (site vs network, header buttons) | [references/list-page-shell.md](references/list-page-shell.md) |

## Optional deeper reading

Install only if you want to open demo files:

```bash
cd "{PLUGINS}"
git submodule add https://github.com/abolfazl-moeini/wpdev-examples.git wpdev-examples
```

Then (optional):

- Empty state: `@examples/products/src/tables/class-product-list-table.php`
- Views + badges: `@examples/sites/src/tables/class-site-list-table.php`
- Status badges: `@examples/memberships/src/tables/class-membership-list-table.php`
- Row actions: `@examples/webhooks/src/tables/class-webhook-list-table.php`

## Checklist before leaving list UX

- [ ] Constructor sets `singular`, `plural`, `'ajax' => true` when using views
- [ ] `add_new` URL + classes match confirmed create flow (`''` = full page, `'wubox'` = modal)
- [ ] Empty state works with zero items (`context === 'page'`)
- [ ] Badge columns use escaped markup + Enum color map
- [ ] Views use `declarative_filter_views()` / `declarative_table_config()` unless custom query logic required
- [ ] Any `get_filters()` override returns an array (`array()` when empty)
- [ ] Non-BerlinDB tables (no `$query_class`): override `_get_items()` + columns; override `get_bulk_actions()` (`protected` like WP core, or `public`) when Delete/Activate do not apply
- [ ] List table declares `protected $access = 'my_plugin.items.view'` (evaluated via Two-Gate `wpdev_can()` on AJAX refresh), or site-admin tables override `user_can_ajax_refresh()` if using legacy capabilities
- [ ] Grid mode only if requested: set `$modes` and implement `single_row_grid()` in host
