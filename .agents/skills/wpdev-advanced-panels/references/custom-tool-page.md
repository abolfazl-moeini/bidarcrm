# Custom tool page (non-CRUD)

Use when the admin surface is a **utility / job / export-import** page — not a model-backed list + edit CRUD pair.

Paths: [SHARED-PATHS.md](../../SHARED-PATHS.md). Write into `@host`.

Related: [advanced-capabilities-and-settings.md](advanced-capabilities-and-settings.md) · modal lifecycle [form-register-handler.md](../../wpdev-modal-forms/references/form-register-handler.md) · host bootstrap [consumer-plugin-layout.md](../../wpdev-panel-builder/references/consumer-plugin-layout.md).

## When to choose this shape

| Choose tool page | Choose List + Edit instead |
|------------------|----------------------------|
| Export / import / backup / one-shot jobs | Entity has list URL + edit URL + table rows |
| Manual tabs (export \| import \| history) | Status/type views on a BerlinDB-backed table |
| Optional modal to start a job | Modal “create new entity” → edit page |

Do **not** force `List_Admin_Page` when there is no list table lifecycle.

## Class contract

Extend `\WPDevFramework\Admin_Pages\Base_Admin_Page` only (never copy/vendor a local base).

Required methods:

| Method | Role |
|--------|------|
| `output()` | Render the whole body (`display()` only calls this + lifecycle hooks) |
| `get_title()` | Page `<h1>` / wrap title |
| `get_menu_title()` | Menu label |

Optional: `register_forms()` (base constructor already hooks `wpdev_register_forms`), `init()`, `register_scripts()`.

`Base_Admin_Page::display()` does **not** wrap your body automatically. Own the wrap in `output()` (or render a known template yourself).

The example below assumes the user has confirmed the export action in Phase 2.
If no modal action was requested or confirmed, remove `register_forms()`,
`register_scripts()`, the modal callbacks, `wubox` classes, and form URLs; keep
the page and tab rendering.

```php
namespace My_Plugin\Admin;

use WPDevFramework\Admin_Pages\Base_Admin_Page;

class Exporter_Admin_Page extends Base_Admin_Page {

	protected $id = 'my-plugin-exporter';

	protected $type = 'submenu';

	protected $parent = 'wpdev'; // or WPDEV_BRAND_MENU_SLUG / brand slug

	// Network SaaS default. Site-only host: array( 'admin_menu' => 'my_plugin_read_export' ).
	protected $supported_panels = array(
		'network_admin_menu' => 'my_plugin_read_export', // page/read cap
	);

	public function get_title() {
		return __( 'Exporter', 'my-plugin' );
	}

	public function get_menu_title() {
		return __( 'Exporter', 'my-plugin' );
	}

	public function register_forms() {
		// Only if Phase 2 confirmed (or the user already named this action).
		wpdev_register_form( 'my_plugin_export_site', array(
			'render'     => array( $this, 'render_export_modal' ),
			'handler'    => array( $this, 'handle_export_modal' ),
			'capability' => $this->export_capability(),
		) );
	}

	public function register_scripts() {
		if ( function_exists( 'add_wubox' ) ) {
			add_wubox();
		}
	}

	public function output() {
		$labels = array(
			'export'  => __( 'Export', 'my-plugin' ),
			'import'  => __( 'Import', 'my-plugin' ),
			'history' => __( 'History', 'my-plugin' ),
		);
		$allowed = array_keys( $labels );
		$tab     = sanitize_key( (string) wpdev_request( 'tab', 'export' ) );
		if ( ! in_array( $tab, $allowed, true ) ) {
			$tab = 'export';
		}

		$base = wpdev_network_admin_url( $this->id );
		$tabs = array();
		foreach ( $labels as $slug => $label ) {
			$tabs[] = array(
				'slug'    => $slug,
				'label'   => $label,
				'url'     => add_query_arg( 'tab', $slug, $base ),
				'current' => ( $tab === $slug ),
			);
		}

		echo '<div id="wpdev-wrap" class="wrap wpdev-styling">';
		echo '<h1 class="wp-heading-inline">' . esc_html( $this->get_title() ) . '</h1>';
		echo '<hr class="wp-header-end">';

		if ( function_exists( 'wpdev_render_tab_navigation' ) ) {
			wpdev_render_tab_navigation( $tabs );
		}

		echo '<div class="wpdev-tool-page-body">';
		$this->render_tab( $tab );
		echo '</div></div>';
	}

	protected function render_tab( $tab ) {
		if ( 'history' === $tab && $this->history_is_empty() ) {
			$empty_args = array(
				'message'      => __( 'No exports yet.', 'my-plugin' ),
				'sub_message'  => __( 'Start an export to see history here.', 'my-plugin' ),
				'link_label'   => '',
				'link_url'     => '',
				'link_classes' => '',
			);
			if ( $this->can_export() ) {
				$empty_args['link_label']   = __( 'Export a site', 'my-plugin' );
				$empty_args['link_url']     = wpdev_get_form_url( 'my_plugin_export_site' );
				$empty_args['link_classes'] = 'wubox button button-primary';
			}
			echo wpdev_render_empty_state( $empty_args ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted helper HTML
			return;
		}

		if ( 'export' === $tab ) {
			if ( $this->can_export() ) {
				printf(
					'<p><a class="button button-primary wubox" href="%s">%s</a></p>',
					esc_url( wpdev_get_form_url( 'my_plugin_export_site' ) ),
					esc_html__( 'Export site', 'my-plugin' )
				);
			} else {
				echo '<p>' . esc_html__( 'You do not have permission to start an export.', 'my-plugin' ) . '</p>';
			}
		}

		// … import / history markup …
	}

	protected function history_is_empty() {
		return empty( $this->get_history_items() );
	}

	protected function get_history_items() {
		// Replace this fixture with the host plugin's history query.
		return array();
	}

	protected function export_capability() {
		return 'my_plugin_export';
	}

	protected function current_export_capability() {
		$capability = $this->export_capability();
		if ( function_exists( 'wpdev_admin_capability_for' ) ) {
			$capability = wpdev_admin_capability_for( $capability );
		}
		return $capability;
	}

	protected function can_export() {
		return current_user_can( $this->current_export_capability() );
	}

	public function render_export_modal() {
		$fields = array(
			'site_id' => array(
				'type'  => 'text',
				'title' => __( 'Site ID', 'my-plugin' ),
			),
			'submit' => array(
				'type'  => 'submit',
				'title' => __( 'Start export', 'my-plugin' ),
			),
		);

		$form = new \WPDevFramework\UI\Form(
			'my_plugin_export_site',
			$fields,
			array(
				'views'   => 'admin-pages/fields',
				'classes' => 'wpdev-modal-form',
			)
		);
		$form->render();
	}

	public function handle_export_modal() {
		if ( ! $this->can_export() ) {
			wp_send_json_error( new \WP_Error( 'forbidden', __( 'Not allowed.', 'my-plugin' ) ), 403 );
		}

		$site_id = absint( wpdev_request( 'site_id', 0 ) );
		$site    = false;
		if ( $site_id && function_exists( 'get_site' ) ) {
			$site = get_site( $site_id );
		} elseif ( $site_id && ! is_multisite() && 1 === $site_id ) {
			// Single-site has no multisite site object; model blog 1 locally.
			$site = (object) array( 'blog_id' => 1 );
		}
		if ( ! $site ) {
			wp_send_json_error( new \WP_Error( 'invalid_site', __( 'Choose a valid site.', 'my-plugin' ) ), 400 );
		}

		if ( ! $this->can_export_site( $site ) ) {
			wp_send_json_error( new \WP_Error( 'forbidden_site', __( 'You cannot export this site.', 'my-plugin' ) ), 403 );
		}

		// Enqueue/run the export job here.
		wp_send_json_success();
	}

	protected function can_export_site( $site ) {
		// Replace this with the host's tenant/site ownership policy if the
		// export capability is not granted per site. Fail closed if the
		// site-scoped WordPress capability helper is unavailable.
		return function_exists( 'current_user_can_for_blog' )
			&& current_user_can_for_blog( (int) $site->blog_id, $this->export_capability() );
	}
}
```

### Tabs

- Helper: `wpdev_render_tab_navigation( array $tabs, array $options = array() )` → **`void`** (echoes markup). Soft-dep: check `function_exists` if the host might load before `tab-navigation`.
- Each tab needs: `slug`, `label`, `url`, `current` (optional: `disabled`, `badge`).
- Active tab: allow-list + `sanitize_key( wpdev_request( 'tab', $default ) )`.
- Labels: use translated strings — do not `ucfirst( $slug )` in production UI.

Source: `@framework/modules/tab-navigation/src/functions/tab-navigation.php`.

### Empty state (tool page ≠ list table)

- Tool tabs: `echo wpdev_render_empty_state( $args )` — helper **returns** HTML.
- Supported keys: `message`, `sub_message`, `link_label`, `link_url`, `link_classes`, `link_icon`, `display_background_image`.
- The template echoes `message`, `sub_message`, and `link_label` as markup; pass
  trusted, translated/escaped values only. Validate or allow-list user-derived
  URLs before passing `link_url` (the template attribute-escapes it, but does
  not validate its destination).
- List tables use declarative `empty_state` / constructor args — see [empty-states.md](../../wpdev-list-ux/references/empty-states.md). Do not invent a local empty-state clone.

Source: `@framework/modules/core/src/functions/markup-helpers.php`.

### Modal action (Phase 2 gate)

Implement only after orchestrator Phase 2 confirmation (or the user already named the action).

| Piece | API |
|-------|-----|
| Register | `wpdev_register_form( $id, array( 'render', 'handler', 'capability' ) )` on `wpdev_register_forms` |
| Open URL | `wpdev_get_form_url( $id, $args )` or `wpdev_modal_open( $id, $args )` |
| Anchor class | `wubox` |
| Enqueue | `add_wubox()` |
| Handler | `current_user_can` again + validate + `wp_send_json_success` / `wp_send_json_error` |

`wpdev_get_form_url()` builds a URL even if the form is **not** registered — registration + capability still required or the user sees “Form not available”.
`Form_Manager` verifies the form nonce before invoking the handler. Keep the
handler behind the form transport and do not expose an alternate route that
bypasses that nonce check.
The page/read capability does not imply the action capability; gate action
links as well as the form and handler.

Full lifecycle: [form-register-handler.md](../../wpdev-modal-forms/references/form-register-handler.md).

## Registration

Call `wpdev_register_module_admin_pages()` from host `setup.php` on `wpdev_load` **before** `wpdev_admin_pages` runs — never from inside an already-firing `wpdev_admin_pages` callback.

```php
add_action( 'wpdev_load', static function () {
	wpdev_register_module_admin_pages( 'my-plugin-exporter', array(
		\My_Plugin\Admin\Exporter_Admin_Page::class,
	) );
} );
```

Late-boot: if the page constructs after `wpdev_register_forms`, call an idempotent `register_forms()` / `register()` directly (same pattern as modal-forms). Prefer [consumer-plugin-layout.md](../../wpdev-panel-builder/references/consumer-plugin-layout.md) setup-unfinished fallback only as a safety net.

## Runtime smoke (examples/playground absent)

```text
Tool page smoke
- [ ] Page appears under intended parent (wpdev / brand) with correct panel + capability
- [ ] ?tab= switches content; active tab marked current
- [ ] Empty history tab shows framework empty-state; CTA appears only when the export action is confirmed and the user has its capability
- [ ] If an action modal was confirmed: authenticated modal opens the registered form (not “Form not available”)
- [ ] If an action modal was confirmed: unauthorized user is denied (form capability / page capability)
- [ ] If export access is site-scoped: a user authorized on site A is denied for site B
- [ ] If an action modal was confirmed: wubox script is enqueued on the tool page
- [ ] No require of @examples or @playground paths
```

## Anti-patterns (framework-native)

| Never | Do instead |
|-------|------------|
| `List_Admin_Page` for a job UI with no table entity | This recipe |
| Local / vendored `Base_Admin_Page` copy | Extend framework class |
| Local empty-state HTML clone | `wpdev_render_empty_state()` |
| Soft-run dual UI when framework missing as the primary path | Require WPDev; soft-dep notice only |
