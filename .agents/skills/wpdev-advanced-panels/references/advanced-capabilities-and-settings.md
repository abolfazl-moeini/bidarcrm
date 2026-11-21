# Advanced capabilities + addon-style settings

Paths: [SHARED-PATHS.md](../../SHARED-PATHS.md). Write into `@host`.

Do **not** re-document hidden-edit shells or basic settings registration — link and extend.

## Capability boundaries & Two-Gate Defense-in-Depth Model

Do **not** force one coarse capability for every surface. Align each boundary with the real UI action and apply the **Two-Gate Defense-in-Depth Model**:
- **Gate 1 (Native WordPress Capability):** Role-based capability checked via `$supported_panels`, `current_user_can()`, and `wpdev_admin_capability_for()`.
- **Gate 2 (AccessManager Domain Policy):** Fine-grained domain policy checked via `wpdev_can( $access )`, `wpdev_require_access( $access )`, or `'access'` surface bindings.

| Boundary | Where it lives | Gate 1 (WP Cap) | Gate 2 (Domain Policy) |
|----------|----------------|-----------------|------------------------|
| Read / list | `$supported_panels` on list or tool page; `$access` on table | `my_plugin_read_agents` | `my_plugin.agents.view` via `protected $access = 'my_plugin.agents.view';` |
| Edit | `$supported_panels` on edit page; `handle_save()` | `my_plugin_edit_agents` | `my_plugin.agents.edit` via `wpdev_require_access( 'my_plugin.agents.edit' )` |
| Action (create / modal) | `wpdev_register_form( …, 'access' => … )` | `my_plugin_add_agents` | `my_plugin.agents.create` via `'access' => 'my_plugin.agents.create'` |
| Background / Ajax | `wpdev_register_ajax_handler( …, 'access' => … )` | `current_user_can` | `wpdev_can( $access )` |

The page properties belong inside the relevant admin-page class. Domain permissions and policies belong on the `wpdev_load` hook.

```php
// 1. Declare domain permissions and policies on wpdev_load
use WPDev\Access\UserAccess;
use WPDev\Access\BluePrint\BluePrint;
use WPDevFramework\List_Tables\Base_List_Table;

class AgentAccess extends UserAccess {
	public const VIEW   = 'my_plugin.agents.view';
	public const CREATE = 'my_plugin.agents.create';

	protected function describe( BluePrint $bp ): void {
		$bp->describe( self::VIEW )
			->any( 'my_plugin_read_agents' );

		$bp->describe( self::CREATE )
			->all( 'my_plugin_add_agents' )
			->custom( function () {
				// Contextual domain rule (must return strict boolean)
				return true;
			} );
	}
}

add_action( 'wpdev_load', function() {
	// Register permissions in the catalog (owner + capability required for protected permissions)
	wpdev_register_permission( 'my_plugin.agents.view', array(
		'owner'       => 'my-plugin',
		'capability'  => 'my_plugin_read_agents',
		'scope'       => 'site',
		'risk'        => 'read',
		'label'       => __( 'View Agents', 'my-plugin' ),
		'description' => __( 'Allows viewing the agents directory and list.', 'my-plugin' ),
		'policy'      => 'my_plugin_agents',
	) );

	wpdev_register_permission( 'my_plugin.agents.create', array(
		'owner'       => 'my-plugin',
		'capability'  => 'my_plugin_add_agents',
		'scope'       => 'site',
		'risk'        => 'write',
		'label'       => __( 'Create Agents', 'my-plugin' ),
		'description' => __( 'Allows creating new agent records.', 'my-plugin' ),
		'policy'      => 'my_plugin_agents',
	) );

	// Register AccessManager policy qualifier
	wpdev_register_access_policy( 'my_plugin_agents', array(
		'owner'     => 'my-plugin',
		'qualifier' => new AgentAccess(),
	) );
} );

// 2. List / tool page
protected $supported_panels = array(
	'admin_menu' => 'my_plugin_read_agents',
);

// 3. List Table with Gate 2 binding
class My_Agent_List_Table extends Base_List_Table {
	protected $access = 'my_plugin.agents.view'; // Two-Gate check for ajax refresh
}

// 4. Modal / form with Two-Gate binding
wpdev_register_form( 'add_new_agent', array(
	'render'  => array( $this, 'render_add' ),
	'handler' => array( $this, 'handle_add' ),
	'access'  => 'my_plugin.agents.create', // Two-Gate access ID
) );
```

Handler must re-check access:
```php
public function handle_add() {
	if ( function_exists( 'wpdev_require_access' ) ) {
		wpdev_require_access( 'my_plugin.agents.create' );
	}
	// ... perform mutation ...
}
```

Cross-link: [admin-pages.md](../../wpdev-panel-builder/references/admin-pages.md) · [form-register-handler.md](../../wpdev-modal-forms/references/form-register-handler.md).

### Built-in translation vs custom caps

`Form_Manager::security_checks()` passes the form capability through `wpdev_admin_capability_for()` (`@framework/modules/core/src/functions/context.php`).

On **single-site** (non-network context), **only** these built-ins map:

| Requested | Becomes |
|-----------|---------|
| `manage_network` | `manage_options` |
| `manage_network_plugins` | `activate_plugins` |

**Custom** capabilities (`my_plugin_export`, `wpdev_read_*`, …) are **not** rewritten. Register and grant them for the context you target (`admin_menu` vs `network_admin_menu`). Host owns role assignment via normal WordPress APIs (`add_cap`, role editors, etc.). Do **not** copy a full Support Agents permission / `map_meta_cap` engine.

`$supported_panels` still goes through `wpdev_translate_supported_panels()` on single-site (network panel → site panel). Prefer declaring the panel you actually need.

### Section and Page Capability Cascading (Automatic Field Inheritance)

`wpdev_register_settings_section( …, array( 'capability' => … ) )` automatically cascades its `capability` down to all fields registered in that section that do not declare an explicit capability override.

- **Field Visibility**: In `Settings_Admin_Page::default_view()`, fields without an explicit capability are visible if the user has either the section capability (`$section['capability']`), the owning page capability (`$supported_panels['admin_menu']`), or site administration privileges (`manage_options` / `wpdev_edit_settings`).
- **Field Persistence**: In `Settings_Save::resolve()`, fields without an explicit capability are saved if the user has the section capability, current page capability, or administration privileges.
- **Explicit Least-Privilege Overrides**: If a field explicitly specifies a custom capability (e.g. `'capability' => 'manage_options'` for sensitive API keys, webhooks, or billing configurations), that capability is strictly enforced — users with only the section or page capability cannot view or save that sensitive field. Full administrators (`manage_options`) retain superset access to view and manage all fields.

## Hidden edit (link only)

Already documented — do not rewrite:

- `$parent = 'none'`
- `$highlight_menu_slug` = list page id

See [admin-pages.md](../../wpdev-panel-builder/references/admin-pages.md) § Edit_Admin_Page and § Menu pattern. Edit-ux checklist: [wpdev-edit-ux/SKILL.md](../../wpdev-edit-ux/SKILL.md).

Registration-time titles must stay side-effect free (no redirecting `get_object()` from `get_title()`).

## Addon-style settings on the shared shell

Host plugins can register a section on `admin.php?page=wpdev-settings` (same facades as core).

```php
function my_plugin_register_settings() {
	static $scheduled = false;
	static $registered = false;

	if ( ! did_action( 'init' ) ) {
		if ( ! $scheduled ) {
			add_action( 'init', 'my_plugin_register_settings', 5 );
			$scheduled = true;
		}
		return;
	}

	if ( $registered ) {
		return;
	}
	$registered = true;

	wpdev_register_settings_section( 'my-plugin-tools', array(
		'title' => __( 'My Plugin Tools', 'my-plugin' ),
		'desc'  => __( 'Exporter and related options', 'my-plugin' ),
		'icon'  => 'dashicons-wpdev-download',
		'order' => 120,
		'addon' => true, // presentation only — see below
	) );

	wpdev_register_settings_field( 'my-plugin-tools', 'replace_export_ui', array(
		'title'   => __( 'Enable export UI', 'my-plugin' ),
		'type'    => 'toggle',
		'default' => 1,
		// Omit capability: the default manage_network maps to manage_options on single-site.
	) );
}
add_action( 'wpdev_settings_register_default_sections', 'my_plugin_register_settings', 20 );
add_action( 'wpdev_load', 'my_plugin_register_settings', 30 );
```

### `addon => true` (presentation flag)

- **What it does today:** settings left-nav (`views/base/settings.php`) collects sections with truthy `addon` and renders them under an **Add-ons** group heading.
- **What it is not:** a validated first-class schema key, a security flag, or a substitute for field/page capability.
- Registry `add_section()` defaults document `icon`, `order`, `capability` — arbitrary attributes (including `addon`) are preserved and consumed by the renderer.
- Re-verify against the installed framework version before relying on the grouping UI.

For the full architectural guide on building companion add-on plugins (like `wpdev-netfallback`) and bundled addons, see [addon-development.md](addon-development.md).

Full settings chrome / host-owned Settings page / i18n timing: [settings-sections.md](../../wpdev-settings-dashboard/references/settings-sections.md).

## Delete modal reuse (brief)

Before inventing a custom delete modal:

1. Prefer built-in `delete_modal`.
2. Map authorization with `wpdev_delete_modal_capability` (default `wpdev_delete_{$model}s` is phantom).
3. Resolve the object with `wpdev_get_{model}()` **or** `wpdev_delete_form_get_object_{$model}`.
4. Object resolution ≠ authorization — the built-in getter or object filter
   supplies the object, while the capability filter supplies authorization.

Details: [form-register-handler.md](../../wpdev-modal-forms/references/form-register-handler.md) · [form-not-available.md](../../wpdev-modal-forms/references/form-not-available.md) §3b.

## Out of scope

- Full role matrices / `map_meta_cap` engines from hand-written addons
- Titan / Paradox settings UIs
- Core WP screen replacement (`plugins.php` + `exit`)
