# Mandatory agent workflow

Sequential STOP-gated flow. Do not skip phases. Do not write optional UX without Phase 2 confirmation.

## Phase 0 — Classify request + confirm write target

| User wants | Specialist path | Write target |
|------------|-----------------|--------------|
| Domain list/edit/table (CRUD-ish) | list-ux + edit-ux (+ modal-forms if confirmed) | Host plugin |
| User profile / edit-user sections (`profile.php`, `user-edit.php`) | edit-ux (user-profile-sections) | Host plugin |
| Non-CRUD tool / utility page (export, import, jobs, tabbed tools) | advanced-panels (+ modal-forms if action modal confirmed) | Host plugin |
| Advanced caps / hidden edit / addon-style settings | advanced-panels (+ settings-dashboard for chrome) | Host plugin |
| Settings section only | settings-dashboard | Host plugin |
| Dashboard KPI/widget only | settings-dashboard | Host plugin |
| Tour | onboarding-ux (only after proposal accepted) | Host plugin |
| Wizard-like onboarding | onboarding-ux (§6.8 constraint) | Host plugin, or `wpdev_setup_wizard` filter if network setup |

Always: use inlined `references/` + `@framework/` (read-only). Optionally read `@examples/` when that separate repo is installed. Write into the host plugin unless the user explicitly asks to extend `wpdev-examples/{slug}/`.

## Phase 0b — Incremental improvement (existing host panels)

When the host **already has** list + edit pages and the user asks for a **focused** improvement (segment UX, theme picker, reset action, badge polish, one new field group):

1. **Skip** full greenfield UX proposal and re-scaffolding (do **not** recreate `List_Admin_Page` / `Edit_Admin_Page` shells).
2. Still verify every `wpdev_*` signature against `{WPDEV}` PHP before use.
3. Still respect host bootstrap constraints ([consumer-plugin-layout.md](consumer-plugin-layout.md) — unfinished-setup fallback if relevant).
4. Do **not** add modal create, tour, onboarding flow, or dashboard widgets unless the user requested them.
5. Prefer surgical edits to existing host classes (`Edit_Admin_Page`, `List_Admin_Page`, table class, host assets).

```text
Incremental path checklist
- [ ] Confirmed existing list/edit (or settings) classes in host plugin
- [ ] Scoped change only (no full re-scaffold)
- [ ] Optional UX (modal/tour/dashboard) only if user asked
- [ ] Signatures verified; host asset URLs use host plugin helpers
```

## Phase 1 — UX analysis (no code yet)

Fill this checklist in chat:

```text
UX Analysis
- [ ] Panel shape: classic CRUD list+edit | non-CRUD tool page | settings-only | dashboard — routes specialists
- [ ] Entity singular/plural labels (CRUD) or tool job labels (export/import/…)
- [ ] Create / primary action: modal | full edit page | tool-page action | both — MUST ASK if optional
- [ ] List views/tabs needed? (status/type filters) — CRUD; tool pages use tab-navigation
- [ ] Columns needing badges/colors? (type, status, active) — CRUD
- [ ] Empty state message + CTA only for an existing/requested action (list vs wpdev_render_empty_state on tools)
- [ ] Custom row actions or tool-page actions needing ajax/modal? — MUST ASK unless already requested
- [ ] Edit metaboxes: main fields, Advanced Options tabs, Save sidebar — CRUD
- [ ] Domain caps & access control: declare permissions in catalog (`wpdev_register_permission`), Two-Gate defense (WP cap + AccessManager policy), bind `'access' => '...'` on tables, forms, and handlers instead of bare `manage_options`?
- [ ] Tour guide? (complex editor / multi-step UI) — MUST ASK
- [ ] Onboarding/"wizard-like" flow? — MUST ASK (see setup-wizard-constraint.md)
- [ ] Soft deps on other domains/plugins?
```

## Phase 2 — Propose optional UX and wait

```text
Recommended UX for {Entity}:
1. Create: {modal|edit page} — because …
2. List: {views…} + badge columns for …
3. Empty state: "You don't have any {Plural} yet." + a CTA only if the
   action is already requested or part of the existing panel contract
4. Tour: {yes/no} — because …
5. Onboarding flow: {yes/no} — because … (tabs/tour unless genuinely network setup)

Which items do you want? I will not implement optional items (modal create /
tour / onboarding flow / custom action modals, including tool-page job actions)
until you confirm.
```

**Always-on (no ask):** empty state; a Create/primary CTA only when that
action is already requested or part of the existing panel contract; badge
styling when type/status columns exist; production list/edit shell quality.

**Must ask (blocking):** modal-create vs full-page create; tour; onboarding/wizard-like flow; custom action modal, including tool-page job actions (unless the user's original request already named the specific action).

## Phase 3 — Scaffold

**If Phase 0 classified a non-CRUD tool page:** host bootstrap + `Base_Admin_Page` only ([custom-tool-page.md](../../wpdev-advanced-panels/references/custom-tool-page.md)). Skip steps 2–4 below.

**CRUD domain:**

1. Host-plugin bootstrap per [consumer-plugin-layout.md](consumer-plugin-layout.md)
2. Model / DB table / manager / query — [model-db-manager.md](model-db-manager.md) (override `$prefix`; late hosts use direct construction)
3. List + edit admin pages — [admin-pages.md](admin-pages.md)
4. List table class
5. Register pages, views, ajax handlers via `wpdev_register_*` facades

### Menu + tabs (when needed)

Top-level or child menus:

```php
wpdev_on_load( static function () {
    wpdev_register_menu_top( 'my-plugin', array(
        'title'      => __( 'My Plugin', 'wpdev' ),
        'capability' => 'manage_options',
        'callback'   => 'my_plugin_render_dashboard',
    ) );
} );
```

List views/tabs: see `wpdev-list-ux/references/views-and-ajax-tabs.md`.

## Phase 4 — Apply UX recipes (in order)

1. `wpdev-list-ux` — empty state, views/tabs, badges, row actions (CRUD lists)
2. `wpdev-advanced-panels` — non-CRUD tool page / advanced caps / addon settings when classified in Phase 0
3. `wpdev-modal-forms` — only if modal-create or action modal confirmed
4. `wpdev-edit-ux` — metaboxes, save, advanced
5. `wpdev-onboarding-ux` — only if tour/onboarding confirmed
6. `wpdev-settings-dashboard` — if applicable

## Phase 5 — Quality gate

Pass **every applicable** item before claiming done. Re-verify `wpdev_*` signatures against current `@framework` (and optional `@examples` if installed). **CRUD-only items** (list table, badges, edit Save widget) do not apply to pure tool pages.

```text
Production UX gate
- [ ] Output is in the host plugin, bootstrapped per consumer-plugin-layout.md — not wpdev-examples/ unless explicitly requested
- [ ] Host plugin registers its module via Module_Loader::register() + own setup.php + mark_loaded(), loaded after wpdev pri 5
- [ ] Host plugin uses its OWN autoloading and its OWN asset URL helpers (not wpdev_path()/wpdev_url())
- [ ] Host DB table overrides $prefix + $name; late hosts use direct construction + install() when needed (not register-only) — CRUD only
- [ ] List table has singular/plural + add_new — CRUD only
- [ ] Empty state: list tables use declarative/constructor empty_state; tool pages use echo wpdev_render_empty_state()
- [ ] Create / job action flow matches what the user confirmed (modal → wubox + wpdev_get_form_url, full edit page, or tool-page action)
- [ ] Views/tabs only if user confirmed or already specified; prefer declarative_filter_views() unless custom query logic needed — CRUD lists
- [ ] Tool pages: Base_Admin_Page + wpdev_render_tab_navigation + advanced-panels recipe (not List_Admin_Page)
- [ ] Type/status columns use the badge markup pattern (escaped) with a per-value Enum color map (always-on) — CRUD only
- [ ] Edit page has Save widget + main fields widget; Advanced Options tabs only when ≥2 secondary field groups — CRUD only
- [ ] Custom row actions use wpdev_register_ajax_handler() + wp_send_json*, never ad-hoc admin-ajax.php wiring
- [ ] Tour only if the user explicitly accepted the proposal; step attachTo selectors are real, not invented
- [ ] Onboarding/"wizard-like" flow, if requested, follows the setup-wizard-constraint.md (no invented wpdev_register_wizard())
- [ ] No signature guessing anywhere — every wpdev_* call verified against manifest/API_DOC/source
- [ ] Fine-grained permissions registered in catalog (`wpdev_register_permission()`) with explicit owner, capability, scope, and risk
- [ ] List table declares `protected $access = '...'` to bind AJAX refresh and table actions to the Two-Gate Access Service
- [ ] Modal forms and AJAX handlers bind to `'access' => '...'` and enforce Two-Gate Defense (Gate 1 WP capability && Gate 2 AccessManager policy)
- [ ] Capabilities on $supported_panels match the actual actions guarded; form/action caps separate when needed
- [ ] Custom caps granted for the target context (not assumed translated); only manage_network / manage_network_plugins map on single-site
- [ ] Cross-domain/cross-plugin soft dependencies checked via `wpdev_module_is_loaded()` (or `function_exists()` / `class_exists()` for non-module helpers); host modules call `mark_loaded()` after bootstrap
- [ ] No Titan/CPT hand-built admin shell and no core-screen hijack recipes
```
