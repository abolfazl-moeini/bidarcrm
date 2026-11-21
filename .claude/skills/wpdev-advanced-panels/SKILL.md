---
name: wpdev-advanced-panels
description: >-
  Advanced WPDev admin patterns for host plugins: non-CRUD custom tool pages
  (tabs + empty state + optional modal actions), addon-style settings sections
  (`addon => true` presentation flag), custom read/edit/action capabilities, and
  hidden edit routing. Open from wpdev-panel-builder when the request is a
  utility/tool page or advanced capability/settings work — not classic list/edit
  CRUD. Write to host plugin. Modal actions still require Phase 2 confirmation
  unless the user named the action.
---

# WPDev Advanced Panels

Specialist for **non-CRUD / advanced** host panels. Do **not** duplicate list/edit/settings recipes — link to those specialists.

## Before you code

1. Read [../wpdev-panel-builder/SKILL.md](../wpdev-panel-builder/SKILL.md) Phases 0–2 (classification + optional UX gates).
2. Read [../SHARED-PATHS.md](../SHARED-PATHS.md) — write target is `@host`.
3. Confirm `function_exists( 'wpdev_services' )` — host panels assume the framework is present.

## When to open this skill

| Request | Use this skill |
|---------|----------------|
| Export / import / backup / job tool page (no model list+edit) | Yes → [custom-tool-page.md](references/custom-tool-page.md) |
| Add-on plugin or bundled addon creation (lifecycle, settings, fallback) | Yes → [addon-development.md](references/addon-development.md) |
| Host settings section under shared `wpdev-settings` Add-ons group | Yes → [advanced-capabilities-and-settings.md](references/advanced-capabilities-and-settings.md) |
| Domain read vs edit vs action capabilities, hidden edit highlight | Yes → same reference |
| Classic list + edit CRUD | **No** — `wpdev-list-ux` + `wpdev-edit-ux` |
| Settings-only / dashboard widgets only | Prefer `wpdev-settings-dashboard`; use this skill only for addon-flag / advanced caps |

## References

| Pattern | File |
|---------|------|
| Add-on architecture (companion plugins & bundled addons) | [references/addon-development.md](references/addon-development.md) |
| Non-CRUD tool page (tabs, empty state, modal action) | [references/custom-tool-page.md](references/custom-tool-page.md) |
| Caps boundaries, hidden edit, addon settings flag | [references/advanced-capabilities-and-settings.md](references/advanced-capabilities-and-settings.md) |

## Link out (do not rewrite)

| Need | Specialist |
|------|------------|
| List empty-state / badges / row actions | [wpdev-list-ux](../wpdev-list-ux/SKILL.md) |
| Edit metaboxes / save / tabs widgets | [wpdev-edit-ux](../wpdev-edit-ux/SKILL.md) |
| Modal register / Form not available / stuck Loading | [wpdev-modal-forms](../wpdev-modal-forms/SKILL.md) |
| Settings sections / host Settings page / brand menu | [wpdev-settings-dashboard](../wpdev-settings-dashboard/SKILL.md) |
| List + Edit shells / registration | [admin-pages.md](../wpdev-panel-builder/references/admin-pages.md) |
| Host bootstrap | [consumer-plugin-layout.md](../wpdev-panel-builder/references/consumer-plugin-layout.md) |

## Hard rules

- **NEVER** invent Titan/Paradox settings panels, CPT + raw `WP_List_Table` CRUD, or core-screen hijack (`plugins.php` + `exit`) as recipes.
- **NEVER** vendor/fork `Base_Admin_Page` — extend `\WPDevFramework\Admin_Pages\Base_Admin_Page`.
- **NEVER** implement a modal action without Phase 2 confirmation unless the user already named that action.
- **ALWAYS** verify `wpdev_*` signatures against `@framework` source (manifest can be stale).
- **ALWAYS** use `wpdev_*` names in new code (legacy `wu_*` only in rename notes).
- Soft deps: `wpdev_module_is_loaded()` / `function_exists()` / `class_exists()` — never invent `wpdev_example_is_loaded()`.

## Checklist before done

```text
Advanced panels gate
- [ ] Routed from panel-builder Phase 0 as tool/utility or advanced caps/settings
- [ ] Tool page extends framework Base_Admin_Page (no vendored base)
- [ ] Tabs via wpdev_render_tab_navigation; empty state via echo wpdev_render_empty_state()
- [ ] Modal action only if confirmed; capability + handler re-check + late form registration safe
- [ ] Two-Gate Defense applied: Gate 1 WP capability + Gate 2 domain policy (wpdev_can / wpdev_register_permission)
- [ ] Caps: separate read / edit / action where needed; custom caps not assumed translated
- [ ] addon => true only for Add-ons nav grouping (not security)
- [ ] Hidden edit: $parent = 'none' + $highlight_menu_slug (link admin-pages; do not re-doc)
- [ ] Works with examples/playground absent
```
