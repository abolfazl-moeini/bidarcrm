# Fields widgets

Register in `Edit_Admin_Page::register_widgets()`. Call `parent::register_widgets()` first (Timestamps + Delete).

Trait: `@framework/modules/metabox-builder/src/admin/trait-edit-page-widgets.php`.

## Minimal main-content widget

Optional deeper reading (install separate repo only if needed):
```bash
cd "{PLUGINS}"
git submodule add https://github.com/abolfazl-moeini/wpdev-examples.git wpdev-examples
```

Optional source (if examples installed): `@examples/products/src/admin/class-product-edit-admin-page.php:235-250`

```php
public function register_widgets() {
    parent::register_widgets();

    $this->add_fields_widget( 'description', array(
        'title'    => __( 'Description', 'wpdev' ),
        'position' => 'normal',
        'fields'   => array(
            'description' => array(
                'type'        => 'textarea',
                'title'       => __( 'Product Description', 'wpdev' ),
                'placeholder' => __( 'Tell your customers what this product is about.', 'wpdev' ),
                'value'       => $this->get_object()->get_description(),
            ),
        ),
    ) );
}
```

Rich multi-widget edit pages: `@examples/customers/src/admin/class-customer-edit-admin-page.php`.

## Rules

- Main content uses `add_fields_widget` (or `add_tabs_widget` when ≥2 secondary groups — see [tabs-and-advanced.md](tabs-and-advanced.md)).
- Pair with `add_save_widget` for the sidebar ([save-and-sidebar.md](save-and-sidebar.md)).

## Rich text (`wp_editor`) and Media Embeds in widgets

When adding rich text descriptions or video embed fields in edit page widgets:

```php
$this->add_fields_widget( 'curriculum', array(
    'title'    => __( 'Curriculum & Video', 'wpdev' ),
    'position' => 'normal',
    'fields'   => array(
        'intro_video' => array(
            'type'        => 'embed',
            'title'       => __( 'Preview Video', 'wpdev' ),
            'placeholder' => __( 'Paste Aparat, YouTube, or iframe embed code', 'wpdev' ),
            'value'       => $this->get_object()->get_intro_video(),
        ),
        'syllabus'    => array(
            'type'        => 'wp_editor',
            'title'       => __( 'Detailed Syllabus', 'wpdev' ),
            'value'       => $this->get_object()->get_syllabus(),
            'args'        => array(
                'textarea_rows' => 6,
                'media_buttons' => true, // default is true; wp_enqueue_media() is called automatically
            ),
        ),
    ),
) );
```

- **Media Buttons:** `wp_editor` fields automatically call `wp_enqueue_media()` and default `media_buttons => true` so content creators can insert images and attachments.
- **Embeds:** Use `type => 'embed'` for video embeds (Aparat scripts are converted to responsive iframes before script stripping; safe iframes and videos are preserved).

## Multi-Select and Checkbox Controls (`multiselect` / `multi_checkbox`)

For taxonomy terms or multi-item selections:

```php
'industry_tags' => array(
    'type'           => 'multiselect', // or 'multi_checkbox'
    'title'          => __( 'Industries', 'wpdev' ),
    'style'          => 'checkbox',    // Renders clean WP checkboxes instead of iOS toggle switches
    'options'        => $industry_options,
    'value'          => $selected_industry_ids,
    'exact_items'    => 4,             // Requires exactly N items to be selected
    'min_items'      => 1,             // Minimum allowed selections
    'max_items'      => 4,             // Maximum allowed selections
    'disable_on_max' => true,          // Automatically disables remaining unchecked boxes once limit is reached
    'quick_add'      => array(         // Inline taxonomy term creation via native wubox modal
        'label'      => __( '+ Quick Add Industry', 'wpdev' ),
        'form'       => 'wpdev_quick_add_term',
        'taxonomy'   => 'project_industry',
        'target'     => 'input[name="industry_tags[]"]',
    ),
),
```

- **Validation:** Form submit automatically intercepts and verifies `exact_items` bounds, warning the user and switching to the corresponding tab without disruptive alerts.
- **Quick Add (`wubox`):** Opens a lightweight modal and automatically appends the created term as a selected option in real-time upon response.

## Interactive Icon Selection (`icon-picker` / `icon_picker`)

For selecting icons (Dashicons, FontAwesome, Lucide, custom SVG vector geometry, or Media Library files):

```php
$this->add_fields_widget( 'identity', array(
    'title'    => __( 'Brand & Identity', 'wpdev' ),
    'position' => 'normal',
    'fields'   => array(
        'badge_icon' => array(
            'type'        => 'icon-picker', // or 'icon_picker'
            'title'       => __( 'Badge Icon', 'wpdev' ),
            'description' => __( 'Select from registered icon packs, upload an SVG, or paste raw vector code.', 'wpdev' ),
            'value'       => $this->get_object()->get_badge_icon(),
        ),
    ),
) );
```

- **Interactive Modal (`wubox` + Vue):** Launches the native `wubox` modal with client-side fuzzy search, library tabs, and category filters.
- **Zero Raw HTML Persistence:** Persists a structured data array (`library`, `name`, `class`, `attachment_id`, `url`, `view_box`, `path_data`) without raw `<svg>` or HTML tags in the database.
- **Render Helper:** Render anywhere via `wpdev_render_icon( $icon_data, array( 'class' => 'my-badge', 'width' => 20 ) )`.


