---
name: wpdev-settings-dashboard
description: >-
  WPDev settings sections (wpdev-settings shell), dashboard KPI widgets, and
  production top-level admin page quality. Use when building wpdev_register_settings_
  section, wpdev_register_dashboard_widget, Top_Level_Admin_Page shell,
  shared brand top-level (WPDEV_BRAND_MENU_SLUG / wpdev_ensure_brand_menu),
  or admin.php?page=wpdev-style dashboard. Open from wpdev-panel-builder when
  scope is settings-only or dashboard widgets. Write to host plugin.
---

# WPDev Settings & Dashboard

For non-CRUD shells: settings sections, dashboard widgets, top-level page quality.

## Paths

See [SHARED-PATHS.md](../SHARED-PATHS.md). Write to `@host`. Prefer inlined snippets in `references/`. `@examples` is optional.

## References

| Pattern | File |
|---------|------|
| Settings sections + fields | [references/settings-sections.md](references/settings-sections.md) |
| Dashboard widgets + host-owned dash page | [references/dashboard-widgets.md](references/dashboard-widgets.md) |
| Top-level page shell | [references/custom-top-level.md](references/custom-top-level.md) |
| Shared brand menu + plugins.php Settings link | [references/custom-top-level.md](references/custom-top-level.md) § Shared brand |
| Brand parent 404 / orphan `admin_page_*` hooks | [references/custom-top-level.md](references/custom-top-level.md) § Brand parent link resiliency |
| Field type index (shared) | [../wpdev-panel-builder/references/field-type-index.md](../wpdev-panel-builder/references/field-type-index.md) |
| Addon-style section flag / advanced caps | [../wpdev-advanced-panels/references/advanced-capabilities-and-settings.md](../wpdev-advanced-panels/references/advanced-capabilities-and-settings.md) |
| Addon architecture & development guide | [../wpdev-advanced-panels/references/addon-development.md](../wpdev-advanced-panels/references/addon-development.md) |

## Optional deeper reading

```bash
cd "{PLUGINS}"
git submodule add https://github.com/abolfazl-moeini/wpdev-examples.git wpdev-examples
```

Then (optional):

- Settings: `@examples/admin-setting-page-defaults/src/sections/`
- Dashboard shell: `@examples/dashboard/src/admin/class-top-level-admin-page.php`
- Widgets: `@examples/admin-custom-page-dashboard-widgets/src/register-dashboard-statistics-widgets.php`

## Hard rules

- **NEVER** call host-domain `__( … )` while registering settings / settings links on `plugins_loaded` or `wpdev_load` — defer to `init`, or leave `wpdev_register_plugin_settings_link()` `$label` empty (WP 6.7 JIT)
- Prefer recipes in [custom-top-level.md](references/custom-top-level.md) and [settings-sections.md](references/settings-sections.md) § WP 6.7+ i18n timing
- Custom `default_view()` without Form `data-on-load` must call `remove_block_ui()` from Vue `mounted()` (or rely on the settings.php no-`[data-on-load]` fallback) — see [settings-sections.md](references/settings-sections.md) § Custom `default_view()`
