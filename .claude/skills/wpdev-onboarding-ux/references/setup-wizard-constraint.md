# Setup wizard constraint (read before any wizard-like flow)

**CRITICAL:** `Setup_Wizard_Admin_Page` is the dedicated network installer/setup wizard (`wpdev-setup`) in `@examples/system/`. For custom multi-step flows in host plugins, use `wpdev_register_wizard()` or `wpdev_create_tour()`.

## Verified facts

1. **`wpdev_register_wizard()`** is the supported builder facade for declarative or custom wizards (boots on `wpdev_admin_pages`).
2. `admin.php?page=wpdev-setup` is a **single, dedicated network-setup wizard** — `Setup_Wizard_Admin_Page` in `@examples/system/`. Not meant to be duplicated per domain.
3. For custom wizards, use `wpdev_register_wizard()` with declarative `'sections'` or subclass `Wizard_Admin_Page`. **Never** subclass `Setup_Wizard_Admin_Page` for domain features.

## Framework setup state is installer state — not a host lifecycle gate

`WPDevFramework\Requirements::run_setup()` reads the network option
`wpdev_setup_finished`. That flag tracks whether the **installer wizard /
database steps** finished. As of WPDev 2.9.1, a missing/false flag does **not**
block `wpdev_load`, `wpdev_admin_pages`, or `wpdev_register_forms` — host menus,
modals, and Ajax must work before setup completes.

Do not make a host plugin set `wpdev_setup_finished` just to unlock UI. Finish
the fixed WPDev setup wizard (or run `Core_Installer`) when custom tables /
migrations are actually required. For diagnostics:

```php
WPDevFramework\Requirements::met();       // PHP / WP hard requirements
WPDevFramework\Requirements::run_setup(); // installer finished?
wpdev()->is_loaded();                    // runtime lifecycle ran
did_action( 'wpdev_admin_pages' );
did_action( 'wpdev_register_forms' );
```

The public API being present (`function_exists( 'wpdev_register_table' )`) only
proves that framework files loaded; it does not prove that installer tables exist.

## Network setup extension only

The supported extension point for **that** wizard:

```php
add_filter( 'wpdev_setup_wizard', function ( $sections, $is_migration, $page ) {
    // append or modify sections
    return $sections;
}, 10, 3 );
```

Source: `@examples/system/src/admin/class-setup-wizard-admin-page.php`.

**Never** subclass `Setup_Wizard_Admin_Page` for a domain feature.

## Wizard_Admin_Page base class (framework builder primitive)

`Wizard_Admin_Page` in `@framework/modules/admin-page-builder/src/admin/class-wizard-admin-page.php` extends `Base_Admin_Page`.

**Executor MUST (before writing any subclass):**

1. Read `@framework/modules/admin-page-builder/src/admin/class-wizard-admin-page.php` **in full**.
2. Confirm `get_sections()` is the only abstract method and `process_save()` remains `final`.
3. Verify no collision with existing page `$id` values (wpdev-setup, wpdev-settings, etc.).
4. Confirm the pattern is safe for an independent host-plugin page (unique `$id`, own URL, own capability).

Current verified facts (as of 2026-07-03; re-verify on changes):

- Only **one** abstract method: `get_sections()` (`:418`)
- `process_save()` is `final` (`:106-123`) — section handlers run via `$section['handler']` or `default_handler`
- Section URL slug defaults to `step` (`$section_slug`); navigation clickability via `$clickable_navigation`
- Multiple framework consumers already use unique `$id` values without colliding:
  - `Setup_Wizard_Admin_Page` → `wpdev-setup` (`modules/wizard/`)
  - `Settings_Admin_Page` → `wpdev-settings` (`modules/admin-setting-page/`)
  - `Migration_Alert_Admin_Page` → `wpdev-migration-alert` (`modules/admin-custom-page/`)
- A host-plugin subclass with its **own** `$id`, URL, and capability is architecturally safe (pages register by id)

### Preferred approaches for domain onboarding (propose these first)

When the user wants guided / multi-step domain UX, prefer:

1. `wpdev_create_tour()` — short guided intro ([tours.md](tours.md))
2. `add_tabs_widget` on `Edit_Admin_Page` — multi-section config without wizard chrome
3. `wpdev_setup_wizard` filter — **only** for genuine network/first-run setup steps

### Preferred ordering (restate for weak agents)

1. **`wpdev_create_tour()`** first — lightweight guided help ([tours.md](tours.md)).
2. **`add_tabs_widget`** on `Edit_Admin_Page` — multi-section config without wizard chrome.
3. **Domain multi-step page** — subclass `Wizard_Admin_Page` with a **unique `$id`** (only if user still needs full wizard chrome).
4. **`wpdev_setup_wizard` filter** — **only** for genuine network/first-run setup steps on the fixed `wpdev-setup` page.

### If user insists on a domain multi-step full-page wizard

**Only after the MUST verification steps above**, and only after Phase 2 user confirmation.

> **STOP — unique `$id` required**
>
> - **Never** call `wpdev_register_wizard()` — nonexistent.
> - **Never** subclass `Setup_Wizard_Admin_Page` for domain features.
> - Domain multi-step onboarding = subclass `Wizard_Admin_Page` with a **unique `$id`** (example: `wpdev-ls-setup`, `my-plugin-setup`).
> - Read `Wizard_Admin_Page` **fully** before subclassing (`process_save()` is **final**; use section `handler`s).
> - Collision with `wpdev-setup` / `wpdev-settings` is a hard fail.

Minimal pattern (verify `$id` is unique before shipping):

```php
class My_Domain_Wizard_Admin_Page extends \WPDevFramework\Admin_Pages\Wizard_Admin_Page {

    // STOP: unique $id — never reuse wpdev-setup
    protected $id = 'my-domain-wizard'; // e.g. wpdev-ls-setup for a host plugin
    protected $clickable_navigation = true;

    public function get_sections() {
        return array(
            'intro' => array(
                'title'  => __( 'Welcome', 'my-plugin' ),
                'fields' => array( /* ... */ ),
            ),
            'config' => array(
                'title'  => __( 'Configure', 'my-plugin' ),
                'fields' => array( /* ... */ ),
                // optional: 'handler' => array( $this, 'save_config_step' ),
            ),
        );
    }
}
```

Register via `wpdev_register_module_admin_pages()` like any other admin page. Still requires Phase 2 user confirmation.
