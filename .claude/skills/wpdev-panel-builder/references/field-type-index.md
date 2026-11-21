# Field type quick index

**Source of truth (regenerate at patch time):** `@framework/modules/field-builder/setup.php`

**STOP:** Do not invent types. If a type is not registered in `setup.php`, it is not available.

Generated from live registry (field-builder `setup.php`):

| Group | Types |
|-------|-------|
| Input | `text`, `textarea`, `number`, `email`, `url`, `password`, `hidden`, `header`, `html`, `embed` |
| Choice | `select`, `multiselect`, `select2`, `radio`, `checkbox`, `multi_checkbox`, `toggle` |
| Upload | `upload`, `image`, `file`, `icon` |
| Advanced | `code-editor`, `color`, `color-picker`, `date`, `datetime`, `wp_editor`, `repeater`, `group`, `icon-picker`, `icon_picker` |
| Model / action | `model`, `ajax_button` |

## Notes

| Type | Use when |
|------|----------|
| `color-picker` | Settings / edit chrome (`admin-pages/fields`) — Vue + `wpColorPicker` |
| `color` | Same sanitize (`sanitize_hex_color`); template aliases to `color-picker` in admin-pages views |
| `icon-picker` / `icon_picker` | Interactive icon selection modal (`wubox` + Vue). Supports fuzzy search across icon names and semantic tags, two-tier categorization (by library and by subject), custom SVG code pasting with geometric extraction, and WordPress Media Library (`wp.media`) uploads. Stores a normalized data array (`library`, `name`, `class`, `attachment_id`, `url`, `view_box`, `path_data`) ensuring zero raw HTML in DB. Render with `wpdev_render_icon()`. |
| `url` / `upload` / `image` / `file` | Built-in sanitize is string `esc_url_raw`. `Field_Type_Registry::sanitize()` passes **only** `$value` to string callables; Closures still receive `( $value, $field )`. Do not work around fatals by downgrading `url` → `text` in host plugins. |
| `embed` | Video embed markup (Aparat, YouTube, Vimeo, HTML5 video). Sanitize is `wpdev_sanitize_embed_html()`, which safely converts Aparat `<script>` snippets into responsive 16:9 `<iframe>` elements before stripping unsafe scripts and `on*` event handlers. Template aliases to `textarea` view. |
| `wp_editor` | Rich-text WYSIWYG editor. Automatically enqueues `wp_enqueue_media()` and defaults `'media_buttons' => true` so content creators can insert images and files. Filterable via `wpdev_field_wp_editor_settings` and `wpdev_editor_media_buttons`. |

## When to open deeper recipes

| Type | Recipe |
|------|--------|
| `repeater` | `wpdev-edit-ux/references/repeater-fields.md` |
| Datepicker (`text` / `text-edit` + `wpdev-datepicker`, optional Jalali via `data-locale`/`fa`) | `wpdev-edit-ux/references/datepicker.md` |
| Settings fields | `wpdev-settings-dashboard/references/settings-sections.md` |
| General edit widgets | `wpdev-edit-ux/references/fields-widgets.md` |

## Custom types

Hosts may register extra types via `wpdev_register_field_type()` / `Field_Type_Registry::register()` — verify the facade signature in the API cookbook / source before use. Custom types are host-owned; do not assume they exist in core.
