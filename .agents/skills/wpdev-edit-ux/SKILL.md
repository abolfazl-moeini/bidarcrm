---
name: wpdev-edit-ux
description: >-
  Production-quality WPDev edit pages: fields widgets, Save sidebar, Advanced
  Options tabs, embedded list tables. Use when building Edit_Admin_Page,
  add_fields_widget, add_tabs_widget, add_save_widget, add_list_table_widget,
  or edit metabox layout. Open after wpdev-panel-builder Phase 0–2. Write to
  host plugin; optional gold standards from @examples/ when installed.
---

# WPDev Edit UX

Opened by `wpdev-panel-builder` for edit-page quality. Implements **always-on** Save widget + main fields; Advanced Options tabs when ≥2 secondary field groups.

## Paths

See [SHARED-PATHS.md](../SHARED-PATHS.md). Write to `@host`. Prefer inlined snippets in `references/`. `@examples` is optional.

## References

| Pattern | File |
|---------|------|
| Main fields widget | [references/fields-widgets.md](references/fields-widgets.md) |
| Datepicker (Flatpickr + Jalali) | [references/datepicker.md](references/datepicker.md) |
| Save sidebar | [references/save-and-sidebar.md](references/save-and-sidebar.md) |
| Advanced Options tabs | [references/tabs-and-advanced.md](references/tabs-and-advanced.md) |
| Embedded list table widget | [references/embedded-list-tables.md](references/embedded-list-tables.md) |
| Repeater fields | [references/repeater-fields.md](references/repeater-fields.md) |
| `handle_save()` validation + JSON merge | [references/handle-save-validation.md](references/handle-save-validation.md) |
| Admin notices (typed + buttons) | [../wpdev-panel-builder/references/admin-notices.md](../wpdev-panel-builder/references/admin-notices.md) |
| Custom edit page assets | [references/custom-edit-assets.md](references/custom-edit-assets.md) |
| User profile & user-edit sections | [references/user-profile-sections.md](references/user-profile-sections.md) |
| Field type index (shared) | [../wpdev-panel-builder/references/field-type-index.md](../wpdev-panel-builder/references/field-type-index.md) |

## Optional deeper reading

```bash
cd "{PLUGINS}"
git submodule add https://github.com/abolfazl-moeini/wpdev-examples.git wpdev-examples
```

Then (optional):

- Tabs + Save: `@examples/discount-codes/src/admin/class-discount-code-edit-admin-page.php`
- Rich widgets: `@examples/customers/src/admin/class-customer-edit-admin-page.php`
- Parent defaults: `@framework/modules/admin-page-builder/src/admin/class-edit-admin-page.php:234-248`

## Checklist

- [ ] `parent::register_widgets()` called first (Timestamps + Delete)
- [ ] Main content via `add_fields_widget` or `add_tabs_widget`
- [ ] `add_save_widget` for sidebar Save metabox
- [ ] `add_tabs_widget` only when ≥2 secondary field groups
- [ ] Tabbed/field widgets on a **native CPT** screen wrap the **entire** `add_tabs_widget` HTML in `.wpdev-styling` (inner Form wrap is not enough — see anti-patterns **#75** / **#76** and `docs/css/README.md`).
- [ ] Do **not** add new Tailwind-style utilities; use BEM/component classes from `admin.css` / `admin-layout.css` (e.g. `.wpdev-stack`, `.wpdev-toolbar`, `.wpdev-inline`, `.wpdev-panel-footer`). PHP views may still emit `wpdev-pad-*` / `wpdev-mar-*` / `wpdev-type-*` / `wpdev-surface-*`; those only work via aliases in `admin-layout.css`.
- [ ] `$parent = 'none'`, `$highlight_menu_slug` = list page id
- [ ] `get_title()` / menu-label methods are registration-safe: no unconditional `get_object()` or redirect
- [ ] Field types verified against [field-type-index.md](../wpdev-panel-builder/references/field-type-index.md)
- [ ] Complex saves: validate + notices; JSON string assembly; merge-on-save for sectioned config
- [ ] Line-item / sub-entity modal forms on edit pages return in-memory `send` payloads (never save parent to MySQL or return `redirect_url` prematurely; see `wpdev-modal-forms` and anti-pattern **#105**)
- [ ] Host assets via `plugins_url` / `plugin_dir_path`, never `wpdev_path()`
