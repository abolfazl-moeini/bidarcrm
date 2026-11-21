# Advanced Options tabs

Use `add_tabs_widget` when ≥2 secondary field groups. URL `?options={tab_slug}` selects the active tab.

Optional deeper reading (install separate repo only if needed):
```bash
cd "{PLUGINS}"
git submodule add https://github.com/abolfazl-moeini/wpdev-examples.git wpdev-examples
```

Optional source (if examples installed): `@examples/discount-codes/src/admin/class-discount-code-edit-admin-page.php:223-227`

```php
$this->add_tabs_widget( 'options', array(
    'title'    => __( 'Advanced Options', 'wpdev' ),
    'position' => 'normal',
    'sections' => apply_filters( 'my_entity_options_sections', $options, $this->get_object() ),
) );
```

One tab entry (`?options=time`):

Optional source (if examples installed): `@examples/discount-codes/src/admin/class-discount-code-edit-admin-page.php:135-142`

```php
'time' => array(
    'title' => __( 'Start & Expiration Dates', 'wpdev' ),
    'desc'  => __( 'Define a start and end date...', 'wpdev' ),
    'icon'  => 'dashicons-wpdev-calendar',
    'state' => array( /* fields */ ),
),
```

## Rules

- Label the tabs widget "Advanced Options" or a domain-specific equivalent.
- Do not cram everything into one `add_fields_widget` when multiple secondary groups exist.
- Propose tabs in Phase 1 when edit page has ≥2 logical field groups.
- Never wrap tab widget HTML in `wp_kses_post()` — it strips Vue `v-*` attributes and leaves the metabox stuck on “Loading…”. Prefer `add_tabs_widget` (framework echo path) or echo template output raw; see [ajax-stuck-loading.md](../../wpdev-modal-forms/references/ajax-stuck-loading.md) §4.
