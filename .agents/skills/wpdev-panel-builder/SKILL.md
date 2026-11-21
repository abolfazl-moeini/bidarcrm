---
name: wpdev-panel-builder
description: >-
  Orchestrator for production-grade WPDev admin panels in the user's host plugin
  (not wpdev-examples). Enforces wpdev-admin-design language and the 7 canonical UX families,
  UX analysis, propose-and-wait for optional UX (modal create, tour, onboarding flow, custom action modals),
  then routes to specialist skills. Covers CRUD domains, list/edit pages, tables, metaboxes,
  settings, dashboard widgets, menus, ajax, empty states, badges, tours, and
  routes non-CRUD tool pages / advanced caps to wpdev-advanced-panels.
  Optional gold standards from @examples/ when that separate repo is installed.
  Use when building wpdev-powered admin UI, multisite panels, List_Admin_Page,
  Edit_Admin_Page, or wpdev_register_* APIs.
---

# WPDev Panel Builder (orchestrator)

**Always read this skill first.** Route to specialists only after Phases 0–2 below.

## Before you code

1. Read [INSTALL-AND-DISTRIBUTE.md](../INSTALL-AND-DISTRIBUTE.md) — pick **one** install mode:
   - **Standalone:** git submodule/clone of `wpdev-core` into `{PLUGINS}/wpdev`, then activate
   - **Library embed:** nest slim tree under `{HOST}/includes/framework/` with `WPDEV_LIBRARY_MODE` — full recipe in [consumer-plugin-layout.md](references/consumer-plugin-layout.md) § Library embed (and INSTALL § Library embed). Drop `Requires Plugins: wpdev`; host owns activation hooks; do not ship `addons/` in .org host zips. Prefer not activating a sibling `{PLUGINS}/wpdev` (double-load is soft-fail + admin notice, not fatal).
   - if using a standalone skill pack, resolve `{WPDEV}` on the target site (nested path is fine in library mode)
2. Read [SHARED-PATHS.md](../SHARED-PATHS.md)
3. Confirm `function_exists( 'wpdev_services' )` is true in the target WordPress site
4. Confirm write target is the **host plugin**, not `wpdev-examples` or `wpdev-playground`
5. Runtime compatibility: ensure the deployed `wpdev-core` zip includes fixes for:
   - PHP 7.4 compatibility in `settings-panel-builder` helpers (avoid nullsafe `?->` usage in framework helpers)
   - Linux case-sensitive autoload paths for core `Contracts/Services/Traits` directories (prevents missing-interface fatals like `Component_Registry_Contract not found`)

## Path legend

Full rules: [SHARED-PATHS.md](../SHARED-PATHS.md) · install: [INSTALL-AND-DISTRIBUTE.md](../INSTALL-AND-DISTRIBUTE.md)

| Alias | Resolves to | Use |
|-------|-------------|-----|
| `@framework` | Installed `wpdev` plugin root (`wpdev-core`) = `{WPDEV}` | APIs, base classes |
| `@examples` | Optional `{PLUGINS}/wpdev-examples` (separate repo) | Gold-standard demos — **never** default write target |
| `@playground` | Optional `{PLUGINS}/wpdev-playground` (separate repo) | Local playground only — never required |
| `@host` | `{HOST}` — the consumer plugin | **Write target** |
| `@skill` | Directory of this `SKILL.md` | Skill-relative refs |

**Standalone skill pack:** do **not** assume the skill-dir parent is the framework. Detect the active `wpdev` plugin or ask for `{WPDEV}`.

**Write target:** the **host plugin**. See [consumer-plugin-layout.md](references/consumer-plugin-layout.md).

`@examples` / `@playground` are optional. Prefer inlined snippets in `references/`. If a path starts with `@examples/`, install that separate repo as a submodule only when you want to open the file:

```bash
cd "{PLUGINS}"
git submodule add https://github.com/abolfazl-moeini/wpdev-examples.git wpdev-examples
```

## STOP rules (hard gates)

- **NEVER** guess a `wpdev_*` signature — [finding-apis.md](references/finding-apis.md) → manifest → `API_DOC.md` → source
- **NEVER** default write output to `@examples/` unless the user explicitly asks to extend `wpdev-examples`
- **NEVER** document or build playground (`wpdev-pg-*`) panels — out of scope
- **NEVER** add PHP under `inc/` or create `modules/wpdev-*`
- **NEVER** `require` non-API files from `modules/*/src/`
- **NEVER** call `wpdev_register_wizard()` — it does not exist (see specialist `wpdev-onboarding-ux`)
- **NEVER** implement modal-create, tour, onboarding flow, or custom action modals without **explicit user confirmation**
- **ALWAYS** bootstrap host features per [consumer-plugin-layout.md](references/consumer-plugin-layout.md)
- **ALWAYS** check `wpdev_module_is_loaded()` (or `function_exists()` / `class_exists()` for non-module helpers) before cross-domain calls — never invent soft-dep helpers
- **ALWAYS** put that check around the **registration** too when a route/page/schema dereferences the optional class — a fatal on `rest_api_init` / `admin_menu` breaks unrelated screens
- **NEVER** pass `__( 'Settings', 'host-domain' )` (or any host-domain `__()`) into `wpdev_register_plugin_settings_link()` from `plugins_loaded` — leave `$label` empty or register on `init` (WP 6.7 JIT notice; see anti-pattern #36)
- **NEVER** hardcode `manage_options` or `manage_network` as access gates for domain features, customer records, exports, or financial actions — register granular permissions via `wpdev_register_permission()` and bind with `'access' => '...'`
- **ALWAYS** enforce the Two-Gate Defense-in-Depth model: Gate 1 (WP base capability) AND Gate 2 (AccessManager domain policy). Never attempt to bypass a missing capability with an AccessManager custom rule or Super Admin role

## Mandatory workflow (STOP-gated)

Full detail: [workflow.md](references/workflow.md). Summary:

### Phase 0 — Classify + confirm write target

| Request | Specialist(s) | Write target |
|---------|---------------|--------------|
| Domain list/edit/CRUD | `wpdev-list-ux`, `wpdev-edit-ux`, (+ `wpdev-modal-forms` if confirmed) | Host plugin |
| User profile / edit-user sections (`profile.php`, `user-edit.php`) | `wpdev-edit-ux` (`user-profile-sections`) | Host plugin |
| Non-CRUD tool / utility page (export, import, jobs, tabbed tools) | `wpdev-advanced-panels` (+ `wpdev-modal-forms` if action modal confirmed) | Host plugin |
| Advanced caps / hidden edit / addon-style settings flag | `wpdev-advanced-panels` (+ `wpdev-settings-dashboard` for settings chrome) | Host plugin |
| Settings section only | `wpdev-settings-dashboard` | Host plugin |
| Dashboard widget / top-level shell | `wpdev-settings-dashboard` | Host plugin |
| Tour (after confirmation) | `wpdev-onboarding-ux` | Host plugin |
| Wizard-like onboarding (after confirmation) | `wpdev-onboarding-ux` | Host plugin |

Read recipes from inlined `references/` and `@framework/`. Optionally open `@examples/` when installed. Write into the host plugin.

### Phase 1 — UX analysis & Design Language (no code yet)

1. **MANDATORY Visual Design Language:** Before writing any code, consult `wpdev-admin-design` (`../wpdev-admin-design/SKILL.md`). You MUST map all requested screen elements to the **7 canonical UX design families** (Rich Cells, Pastel Badges, List/Grid Switcher, At-a-Glance KPI Strip, Icon Vertical Tabs, Modular Identity/Save Sidebars, Safety Modals with Toggle Lock, Terminal Logs, and Smart Conditionals).
2. Fill the checklist in [workflow.md](references/workflow.md) § Phase 1 in chat before writing code.

### Phase 2 — Propose optional UX and wait

Present recommendations using the template in [workflow.md](references/workflow.md) § Phase 2. Block on user confirmation for: modal-create vs full-page create, tour, onboarding flow, custom action modals (including tool-page job actions; unless the user already named the action).

**Always-on (no ask):** empty state; a Create/primary CTA only when that
action is already requested or part of the existing panel contract; badge
columns for type/status; production shell quality.

### Phase 3 — Scaffold

**CRUD domain:**

1. Host-plugin bootstrap (`Module_Loader::register` + `setup.php` + `mark_loaded`) — [consumer-plugin-layout.md](references/consumer-plugin-layout.md)
2. Model / DB table / Schema / manager — [model-db-manager.md](references/model-db-manager.md) (**same `$prefix` on Table, Query, Schema**; late hosts use direct `new My_Table()`)
3. List + edit admin pages — [admin-pages.md](references/admin-pages.md)
4. List table class (declare `protected $access = '...'` for Two-Gate refresh/action security)
5. Register permissions (`wpdev_register_permission`), access policies (`wpdev_register_access_policy`), pages, views, and ajax via `wpdev_register_*` facades with canonical `'access' => '...'` bindings — [api-cookbook.md](references/api-cookbook.md)

**Non-CRUD tool / utility page** (Phase 0 → advanced-panels): host bootstrap + extend `Base_Admin_Page` only — **skip** model/DB/list-table scaffold. Recipe: [custom-tool-page.md](../wpdev-advanced-panels/references/custom-tool-page.md).

### Phase 4 — Apply UX recipes (specialists, in order)

1. `wpdev-list-ux` — empty state, views/tabs, badges, row actions (CRUD lists)
2. `wpdev-advanced-panels` — non-CRUD tool page / advanced caps / addon settings when classified in Phase 0
3. `wpdev-modal-forms` — only if modal-create or action modal confirmed
4. `wpdev-edit-ux` — metaboxes, save, advanced tabs
5. `wpdev-onboarding-ux` — only if tour/onboarding confirmed
6. `wpdev-settings-dashboard` — if settings/dashboard scope

### Phase 5 — Quality gate

Pass every item in [workflow.md](references/workflow.md) § Quality gate (including re-verification of sources and always-on UX items) before claiming done.

## Specialist routing

| Skill | Open when |
|-------|-----------|
| [wpdev-list-ux](../wpdev-list-ux/SKILL.md) | List table, empty state, views/tabs, badges, row actions |
| [wpdev-edit-ux](../wpdev-edit-ux/SKILL.md) | Edit page, metabox, save widget, advanced options tabs |
| [wpdev-modal-forms](../wpdev-modal-forms/SKILL.md) | Modal create, wubox, ajax action result modal |
| [wpdev-onboarding-ux](../wpdev-onboarding-ux/SKILL.md) | Tour, guide, setup wizard constraint, onboarding |
| [wpdev-settings-dashboard](../wpdev-settings-dashboard/SKILL.md) | Settings sections, dashboard widgets, top-level shell |
| [wpdev-advanced-panels](../wpdev-advanced-panels/SKILL.md) | Non-CRUD tool page, addon settings flag, custom caps, hidden-edit routing |

## Gold-standard map

Production URL → recipe → source: [gold-standards.md](references/gold-standards.md). Optional deeper reading when examples are installed: [examples-map.md](references/examples-map.md).

## Essential lifecycle snippet

```php
// Host plugin: plugins_loaded priority 6 (after wpdev core pri 5)
\WPDevFramework\Core\Module_Loader::register( 'my-shop-products', array(
    'path'         => __DIR__ . '/includes/products',
    'dependencies' => array( 'core', 'admin-page-builder', 'table-builder', 'metabox-builder', 'field-builder' ),
) );
require_once __DIR__ . '/includes/products/setup.php';
\WPDevFramework\Core\Module_Loader::mark_loaded( 'my-shop-products' );
```

Inside `setup.php` (on `wpdev_load`):

```php
wpdev_register_module_admin_pages( 'my-shop-products', array( My_List_Admin_Page::class, My_Edit_Admin_Page::class ) );

// Late host plugins: construct the table directly (safe default). See model-db-manager.md.
$table = new My_Entities_Table();
if ( ! $table->exists() && $table->is_upgradeable() ) {
    $table->install();
}

// Early / examples-style timing may also use:
// wpdev_register_table( 'my_entity_table', My_Entities_Table::class );

wpdev_boot_module_manager( 'my-shop-products', My_Entity_Manager::class, __DIR__ . '/src/managers/class-my-entity-manager.php' );
```

List UI: `List_Admin_Page::table()` → `return new My_List_Table();` (not `wpdev_register_list_table()` for domain CRUD). For `'ajax' => true` tables, also early-register ids with `Ajax::register_list_table()` on module boot — see `wpdev-list-ux` (views/ajax traps).

## Orchestrator references

| File | Purpose |
|------|---------|
| [workflow.md](references/workflow.md) | Phases 0–5, Phase 0b incremental path, propose template, quality gate |
| [gold-standards.md](references/gold-standards.md) | URL → recipe map |
| [consumer-plugin-layout.md](references/consumer-plugin-layout.md) | Host-plugin bootstrap + folder layout + setup-unfinished fallback |
| [examples-map.md](references/examples-map.md) | Optional example index |
| [api-cookbook.md](references/api-cookbook.md) | Framework `wpdev_register_*` signatures |
| [api-cookbook-domain.md](references/api-cookbook-domain.md) | Domain-facing APIs + soft deps (`wpdev_module_is_loaded`) |
| [field-type-index.md](references/field-type-index.md) | Live field types from field-builder |
| [finding-apis.md](references/finding-apis.md) | Verify unknown signatures |
| [model-db-manager.md](references/model-db-manager.md) | DB / model / manager skeleton |
| [admin-pages.md](references/admin-pages.md) | List_Admin_Page / Edit_Admin_Page + site vs network |
| [admin-notices.md](references/admin-notices.md) | Typed admin notices + action buttons (`wpdev_add_admin_notice`) |
| [example-types.md](references/example-types.md) | Non-CRUD example shapes (checkout, dashboard, settings-only, tool pages, etc.) |
| [anti-patterns.md](references/anti-patterns.md) | Common mistakes |

Advanced non-CRUD specialist: [wpdev-advanced-panels/SKILL.md](../wpdev-advanced-panels/SKILL.md).
