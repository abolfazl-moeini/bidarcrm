# User Profile & User Edit Sections

Register custom profile sections and field groups on native WordPress user profile screens (`profile.php`, `user-edit.php`, `user-new.php`) via the `user-profile-builder` module.

Public API: `wpdev_register_user_section()`, `wpdev_unregister_user_section()`, `wpdev_get_user_sections()`.

## When to use

- Adding custom profile fields (e.g., social links, billing details, author preferences, vendor profiles) to WordPress users.
- Managing user metadata saved into `wp_usermeta`.
- Enforcing role-based or capability-based visibility on user profile sections.

> [!CAUTION]
> **Anti-Pattern Warning (PREC-2026-0006-4583):**
> Never use `user-profile-builder` or `wp_usermeta` to store domain CPT attributes (such as professors, courses, webinars, or products). CPT data belongs strictly in the CPT's postmeta and its dedicated edit screens/metaboxes. Use `user-profile-builder` exclusively for authentic user account data.

## Standard Registration Pattern

Register on `wpdev_load` or `init`:

```php
add_action( 'wpdev_load', function () {
    wpdev_register_user_section( 'vendor_details', array(
        'title'       => __( 'Vendor Information', 'my-plugin' ),
        'description' => __( 'Manage vendor store name, contact and payment credentials.', 'my-plugin' ),
        'capability'  => 'edit_user', // Gate 1: capability check
        'roles'       => array( 'vendor', 'administrator' ), // Optional role filter
        'priority'    => 20, // Lower numbers render higher
        'fields'      => array(
            'store_name' => array(
                'type'        => 'text',
                'title'       => __( 'Store Name', 'my-plugin' ),
                'description' => __( 'Public name of your vendor store.', 'my-plugin' ),
            ),
            'support_phone' => array(
                'type'        => 'text',
                'title'       => __( 'Support Phone', 'my-plugin' ),
            ),
            'website_url' => array(
                'type'        => 'url',
                'title'       => __( 'Store Website', 'my-plugin' ),
                'sanitize'    => 'esc_url_raw',
            ),
        ),
    ) );
} );
```

## Hard Architectural Invariants

### 1. Zero `<form>` Tag Emission
WordPress core wraps `profile.php` and `user-edit.php` inside a global `<form id="your-profile">`.
- **Rule:** Never emit `<form>` tags. `user-profile-builder` outputs section headers and `table.form-table` rows within the existing native WordPress form.

### 2. Two-Gate Defense Model
- **Gate 1 (Capability Check):** Checks `current_user_can( $config['capability'] ?? 'edit_user', $user_id )`.
- **Gate 2 (Scoped Nonce):** Outputs a hidden section-specific nonce (`wpdev_user_profile_nonce_{id}`) and verifies it on `personal_options_update` and `edit_user_profile_update`.

### 3. Role-Based Visibility
If `'roles' => array( 'author', 'editor' )` is defined in the config:
- If editing an existing user (`profile.php` / `user-edit.php`), the user must have at least one matching role.
- If creating a new user (`user-new.php`), the section appears if the current administrator has the required capability.

### 4. Hydration & Sanitization
Field values are hydrated via `get_user_meta( $user_id, $field_id, true )`.
On submission, values are sanitized according to the field configuration in `field-builder` before saving to `wp_usermeta`. Custom `render_callback` and `save_callback` can be provided for advanced flows.
