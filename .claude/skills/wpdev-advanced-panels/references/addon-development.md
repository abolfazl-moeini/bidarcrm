# WPDev Add-on Architecture & Development Guide

Comprehensive guide to building, structuring, and registering **Add-ons** for the WPDev framework.

---

## 1. Executive Summary & Conceptual Models

WPDev recognizes two distinct tiers of Add-ons:

1. **Companion / Standalone Plugin Add-ons (External Addons)**:  
   Independent plugins (e.g. `wpdev-netfallback`, `wpdev-seo-addon`, `wpdev-crm-companion`) that plug directly into the shared WPDev administrative ecosystem when WPDev is active, while maintaining graceful standalone fallback behavior if WPDev is absent.
2. **Bundled / Framework Add-ons (Internal Addons)**:  
   Modular commercial or deployment-specific subsystems packaged directly inside `{WPDEV}/addons/{slug}/` (e.g., `wpdev-updater`, `wpdev-license`, `wpdev-news`, `wpdev-addons-marketplace`, `wpdev-admin-panels`). These are auto-discovered on `wpdev_modules_loaded` and can be toggled via filters or release packaging flags (`WPDEV_RELEASE_ADDONS`).

---

## 2. External Plugin Add-on Architecture (Gold Standard: `wpdev-netfallback`)

A full-fledged WPDev add-on plugin adheres to the following architecture:

```text
wp-content/plugins/wpdev-{addon-slug}/
├── wpdev-{addon-slug}.php          # Main plugin header & bootstrap
├── src/
│   ├── Common/
│   │   ├── ScopeResolver.php       # Multisite network vs single-site detection
│   │   └── Support/Caps.php        # Capability resolution
│   ├── Modules/
│   │   ├── AdminPanel/
│   │   │   ├── Module.php          # Hooks 'init' @ 20 & wpdev_load
│   │   │   ├── Settings/
│   │   │   │   └── SettingsSection.php # wpdev_register_settings_section ('addon' => true)
│   │   │   ├── Pages/              # Dedicated admin pages (Dashboard, Logs, Rules, etc.)
│   │   │   └── Forms/              # Wubox modal forms (wpdev_register_form)
│   │   └── ...
│   └── Support/
│       └── FrameworkBridge.php     # Soft-dependency check (is WPDev active?)
└── languages/                      # Gettext translation catalogs (.pot, .po, .mo)
```

### 2.1 The Addon Presentation Flag (`addon => true`)

When registering a settings section via `wpdev_register_settings_section()`, passing `'addon' => true` instructs WPDev to render that section under the dedicated **"Add-ons"** group in the settings navigation sidebar:

```php
namespace MyAddon\Modules\AdminPanel\Settings;

final class SettingsSection
{
    public function register(): void
    {
        if (!function_exists('wpdev_register_settings_section')) {
            return;
        }

        wpdev_register_settings_section('my-addon-slug', [
            'title'       => __('My Add-on Feature', 'my-addon'),
            'description' => __('Configure my add-on options.', 'my-addon'),
            'addon'       => true, // <--- Placed under "Add-ons" in left-nav
            'icon'        => 'dashicons-admin-generic',
            'order'       => 50,
            'capability'  => 'manage_options',
            'fields'      => [
                [
                    'id'          => 'enabled',
                    'title'       => __('Enable Feature', 'my-addon'),
                    'type'        => 'checkbox',
                    'default'     => true,
                    'description' => __('Activate this add-on subsystem.', 'my-addon'),
                ],
                [
                    'id'          => 'mode',
                    'title'       => __('Operational Mode', 'my-addon'),
                    'type'        => 'select',
                    'default'     => 'standard',
                    'options'     => [
                        'standard' => __('Standard', 'my-addon'),
                        'advanced' => __('Advanced', 'my-addon'),
                    ],
                ],
            ],
        ]);
    }
}
```

### 2.2 Visual Rendering Pipeline

When `'addon' => true` is set:

1. **Settings Sidebar (`views/base/settings.php`)**:  
   The view partitions sections into regular sections and add-on sections. Sections with `'addon' => true` are rendered in a distinct bottom group beneath an **"Add-ons"** section header:
   ```html
   <ul class="wpdev-pad-t-4">
     <li class="wpdev-pad-x-4 wpdev-font-bold wpdev-uppercase wpdev-type-xs wpdev-type-gray-700">
       Add-ons
     </li>
     <!-- Addon Section Links -->
   </ul>
   ```
2. **Top Admin Bar Dropdown (`Top_Admin_Nav_Menu`)**:  
   `modules/admin-custom-page/src/class-top-admin-nav-menu.php` checks each section. If `'addon' => true` is present:
   - The node parent becomes `wpdev-settings-addons` instead of `wpdev-settings`.
   - It appears organized inside the WP Admin Bar under **WPDev &rarr; Settings &rarr; Add-ons &rarr; [Add-on Title]**.
   - Generates the direct URL: `admin.php?page=wpdev-settings&tab={addon_slug}`.

### 2.3 Lifecycle & WP 6.7+ JIT i18n Rules

> [!IMPORTANT]
> **WP 6.7+ Just-In-Time Translation Invariant:**
> Never execute `__()` or register settings sections before `init`. Registering during early `plugins_loaded` or constructor boot triggers `_load_textdomain_just_in_time` notices.

**Canonical Hook Sequence:**

```php
public function boot(): void
{
    if (function_exists('add_action')) {
        // Register settings section at init priority 20
        add_action('init', [$this, 'register_settings_section'], 20);
    }

    // Register pages, permissions, and forms on WPDev lifecycle
    if (FrameworkBridge::is_framework_active()) {
        if (function_exists('did_action') && did_action('wpdev_load')) {
            $this->register_wpdev_features();
        } elseif (function_exists('wpdev_on_load')) {
            wpdev_on_load([$this, 'register_wpdev_features']);
        } else {
            $this->register_wpdev_features();
        }
    } else {
        // Fallback standalone menu when WPDev is not installed/active
        add_action('admin_menu', [$this, 'register_fallback_menu']);
    }
}
```

### 2.4 Two-Gate Defense for Add-ons

Add-ons must adhere to the Two-Gate Access Control standard:

1. **Gate 1 (WP Capability):** Standard WordPress capability (e.g. `manage_options` or network super-admin capability).
2. **Gate 2 (WPDev Permission):** Granular domain permission declared with `wpdev_register_permission()`.

```php
private function register_permissions(): void
{
    if (!function_exists('wpdev_register_permission')) {
        return;
    }

    wpdev_register_permission('my-addon.manage', [
        'owner'      => 'my-addon',
        'capability' => 'manage_options',
        'scope'      => 'site', // or 'network'
        'risk'       => 'write',
        'label'      => 'Manage My Addon Settings',
    ]);
}
```

Check access in forms and page handlers:
```php
if (function_exists('wpdev_can') && !wpdev_can('my-addon.manage')) {
    wp_die(esc_html__('Access denied.', 'my-addon'));
}
```

### 2.5 Standalone Fallback Pattern

If the user deactivates the `wpdev` core plugin, your add-on should not crash with a fatal error:

```php
final class FrameworkBridge
{
    public static function is_framework_active(): bool
    {
        return function_exists('wpdev_boot_if_needed')
            || class_exists('WPDev\Core\Container')
            || function_exists('wpdev_register_settings_section');
    }
}
```

When `FrameworkBridge::is_framework_active()` is false, register a standard WordPress submenu under `Settings` or `Tools` so the administrator can still configure critical functionality:

```php
public function register_fallback_menu(): void
{
    add_options_page(
        __('My Addon (Standalone Mode)', 'my-addon'),
        __('My Addon', 'my-addon'),
        'manage_options',
        'my-addon-fallback',
        [$this, 'render_fallback_page']
    );
}
```

---

## 3. Bundled Add-on Architecture (`{WPDEV}/addons/`)

Internal add-ons live inside the `addons/` directory of the `wpdev` plugin repository.

### 3.1 Directory Structure

```text
wpdev/addons/
├── README.md
├── {slug}/
│   ├── setup.php        # Mandatory bootstrap entry point
│   ├── src/             # Classes & business logic
│   ├── views/           # PHP view templates (optional)
│   └── assets/          # Static assets (optional)
└── _assets-archive/     # Folders starting with '_' are ignored by loader
```

### 3.2 Auto-Discovery Mechanism

In `wpdev`, bundled add-ons are discovered and loaded dynamically via `wpdev_load_bundled_addons()` hooked to `wpdev_modules_loaded`:

```php
function wpdev_load_bundled_addons(): void {
    $addons_dir = WPDEV_DIR . 'addons/';
    if ( ! is_dir( $addons_dir ) ) {
        return;
    }

    $entries = scandir( $addons_dir );
    foreach ( $entries as $entry ) {
        if ( in_array( $entry, array( '.', '..' ), true ) || 0 === strpos( $entry, '_' ) ) {
            continue; // Skip current, parent, and folders prefixed with '_'
        }

        $setup_file = $addons_dir . $entry . '/setup.php';
        if ( file_exists( $setup_file ) ) {
            /**
             * Filter whether a bundled addon should be loaded.
             *
             * @param bool   $enabled Whether to load the addon.
             * @param string $entry   Addon directory slug.
             */
            if ( apply_filters( 'wpdev_addon_enabled', true, $entry ) ) {
                require_once $setup_file;
            }
        }
    }
}
add_action( 'wpdev_modules_loaded', 'wpdev_load_bundled_addons', 10 );
```

### 3.3 Disabling a Bundled Add-on Programmatically

A host site or theme can disable specific bundled add-ons:

```php
add_filter( 'wpdev_addon_enabled', function ( bool $enabled, string $slug ): bool {
    if ( 'wpdev-news' === $slug ) {
        return false; // Disable community news feed addon
    }
    return $enabled;
}, 10, 2 );
```

### 3.4 Packaging & Release Isolation

- **WordPress.org / Slim Releases**:  
  The `.distignore` file in `wpdev` excludes the entire `addons/` folder:
  ```text
  /addons/
  /addons/*
  ```
- **Self-Hosted / Commercial Releases**:  
  When `WPDEV_RELEASE_ADDONS=1` is exported during the release build script, the `addons/` folder is retained.

---

## 4. Add-on Marketplace & Catalog Module (`wpdev-addons`)

For platforms or multi-tenant setups providing an Add-on Marketplace:

- Located in `@examples/addons/` or `wpdev-examples/addons/`.
- Registers the admin page `wpdev-addons` (`WPDevFramework\Admin_Pages\Addons_Admin_Page`) at `admin.php?page=wpdev-addons`.
- Features AJAX tab switching (`all`, `active`, `installed`, `featured`).
- Filter `wpdev_addons_admin_url` provides the destination URL for marketplace CTA buttons.

---

## 5. Implementation Checklist for Add-on Developers

When creating a new Add-on for WPDev:

- [ ] **Timing**: Register settings section on `init` priority `20` (or `wpdev_settings_register_default_sections`).
- [ ] **Grouping**: Set `'addon' => true` in `wpdev_register_settings_section()`.
- [ ] **Admin Bar**: Verify navigation appears under **Settings &rarr; Add-ons** in both the settings sidebar and the WP Admin Bar dropdown.
- [ ] **Two-Gate Defense**: Define a WordPress capability (`capability`) and register domain permissions with `wpdev_register_permission()`.
- [ ] **Soft Dependency**: Check `function_exists('wpdev_register_settings_section')` and provide a fallback menu if WPDev is deactivated.
- [ ] **i18n & WP 6.7+**: Use pure English gettext source strings in `__( '...', 'your-text-domain' )` and load translations on `init`.
- [ ] **Capability Cascading**: Rely on section capability cascading for standard fields; only declare explicit `'capability'` on sensitive keys.
