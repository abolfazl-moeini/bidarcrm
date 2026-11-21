# Repeater fields

**Verified registration:** `@framework/modules/field-builder/setup.php` registers type `repeater` (`family` => `advanced`).

## 1. Edit-page repeater shape

**Write target:** host plugin `Edit_Admin_Page` field widgets.

```php
'segments' => array(
	'type'   => 'repeater',
	'title'  => __( 'Segments', 'textdomain' ),
	'values' => $values, // array of row arrays for existing entity
	'fields' => array(
		'label'  => array(
			'type'  => 'text',
			'title' => __( 'Label', 'textdomain' ),
		),
		'weight' => array(
			'type'  => 'number',
			'title' => __( 'Weight', 'textdomain' ),
		),
	),
	// Advanced UX Options:
	'accordion'   => true,          // Collapsible accordion rows (one item open at a time)
	'add_new'     => true,          // Set to false to disable/hide 'Add new Line' button
	'sortable'    => true,          // Set to false to disable drag-and-drop sort handle
	'empty_state' => array(         // Custom empty state banner when values array is empty
		'enabled' => true,
		'message' => __( 'No items found.', 'textdomain' ),
		'icon'    => 'dashicons-info',
	),
	'badge_field' => 'sub_badge',   // Field key or sub-badge identifier rendered as pill in header
),
```

Place inside `add_fields_widget()` / `add_tabs_widget()` field maps like any other field.

**Vue mount (required for Add new Line):** Repeater’s “Add new Line” uses
`v-on:click` → `duplicate_and_clean`. The host form/widget must expose
`html_attr['data-wpdev-app']` and enqueue `wpdev-vue-apps`.
`Edit_Admin_Page::register_scripts()` already loads Vue; `Post_Edit_Admin_Page`
metaboxes must enqueue it themselves.

```php
$this->add_fields_widget( 'my_widget', array(
	'title'     => __( 'Items', 'textdomain' ),
	'html_attr' => array(
		'data-wpdev-app' => 'my_widget',
	),
	'fields'    => array(
		'rows' => array(
			'type'   => 'repeater',
			// ...
		),
	),
) );
```

**Toggle subfields:** Each toggle uses a unique `id`/`for` pair. Framework clone
renames ids after “Add new Line” so labels do not activate the first row’s
checkbox. Do not hard-code toggle ids in host CSS/JS.

Save path: sanitize/assemble repeater POST data in `handle_save()` when models need JSON strings — see [handle-save-validation.md](handle-save-validation.md).

## 2. Settings-page repeater (optional)

`Settings_Save` looks for a **single** posted key matching the field slug. The repeater view posts **column arrays** (`subfield[]`), so the parent key is usually absent.

Pattern that works:

1. Register one `repeater` field with unique subfield slugs (avoid collisions across tabs).
2. Pass `values` as an **array of row arrays** (not column-major) at registration/render time.
3. Assemble on save:

```php
add_filter( 'wpdev_pre_save_settings', static function ( $settings, $posted ) {
	if ( ! isset( $posted['slide_image'] ) || ! is_array( $posted['slide_image'] ) ) {
		return $settings;
	}
	$rows = array();
	foreach ( $posted['slide_image'] as $i => $image_id ) {
		$image_id = absint( $image_id );
		if ( ! $image_id ) {
			continue;
		}
		$rows[] = array(
			'slide_image' => $image_id,
			'slide_link'  => esc_url_raw( wp_unslash( $posted['slide_link'][ $i ] ?? '' ) ),
		);
	}
	$settings['hero_slides'] = $rows;
	return $settings;
}, 10, 2 );
```

4. For nested `image` subfields, set `img` URLs when building nested form fields (or filter `wpdev_{repeater_id}_form_fields`) so previews load.

Prefer this over fixed N slots when hosts need add/remove rows on settings tabs.

**Empty `values`:** pass `array()` only if you accept a seed blank row — the repeater view treats an empty array like “no values” and renders one blank `.field-repeater` line so “Add new Line” can clone it.

**Layout (defaults):** Nested repeater forms use `wpdev-flex wpdev-flex-wrap wpdev-gap-4` with padded full-width subfields. Prefer `stacked => true` on nested `image` fields.

**Layout pitfall:** `wrapper_classes => 'md:wpdev-w-1/2'` plus `gap` often overflows or leaves a tall sparse column. For dense cards, enqueue **host admin CSS** and use CSS Grid:

1. `display: contents` on nested Form wrappers so field `<li>`s become children of `li.field-repeater`. Flatten both `.wpdev-flex` **and** `.wpdev-row` (post-Tailwind nested forms use `wpdev-row`, not `wpdev-flex`).
2. Named areas for rich rows (image + two text columns + full-width description), e.g. `tg-r-field--image`, `--link`, `--title`, `--badge`, `--button`, `--desc`.
3. Tighten label/input margins inside `.field-repeater` only.

Keep that CSS in the host plugin (not the framework) unless you are shipping a shared design system.

## 3. Conditional per-row UI (host JS escape hatch)

Framework repeater **cannot** do rich per-row conditionals alone (e.g. show prize fields only when type = “prize”).

When needed:

1. Enqueue host JS/CSS from `register_scripts()` on the edit page — see [custom-edit-assets.md](custom-edit-assets.md).
2. Scope selectors with `admin_body_class` or page-specific wrappers.
3. Keep validation/sanitization in PHP (`handle_save()`), not only in JS.

## 4. Settings-page Vue `group` + `v-for` (different context)

`group` is also a registered field type. Some settings / emulated post-type UIs use Vue `group` + `v-for` patterns.

| Context | Prefer |
|---------|--------|
| Entity **edit** pages (`Edit_Admin_Page`) | `repeater` + `handle_save()` |
| Settings tabs needing add/remove rows | `repeater` + `wpdev_pre_save_settings` |
| Heavy custom Vue settings UIs | `group` + host Vue (optional reading) |

## Rules

- Capability: same as the edit page `$supported_panels` map (or settings field capability).
- Never invent unregistered field types; verify in `field-builder/setup.php` or [field-type-index.md](../../wpdev-panel-builder/references/field-type-index.md).
