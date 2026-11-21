# Colored column badges

**Convention:** neutral badge shell + per-value color class from model method, driven by Enum `classes()` map (`wpdev-bg-{color}-{shade}` + `wpdev-text-{color}-{shade}`).

## List table column

Optional deeper reading (install separate repo only if needed):
```bash
cd "{PLUGINS}"
git submodule add https://github.com/abolfazl-moeini/wpdev-examples.git wpdev-examples
```

Optional source (if examples installed): `@examples/sites/src/tables/class-site-list-table.php:236-243`

```php
public function column_type( $item ) {
    $label = $item->get_type_label();
    $class = $item->get_type_class();
    return sprintf(
        "<span class='wpdev-bg-gray-200 wpdev-py-1 wpdev-px-2 wpdev-leading-none wpdev-rounded-sm wpdev-text-xs wpdev-font-mono %s'>%s</span>",
        esc_attr( $class ),
        esc_html( $label )
    );
}
```

## Enum color map

Optional source (if examples installed): `@examples/sites/src/Database/sites/class-site-type.php:42-51`

```php
protected function classes() {
    return array(
        self::REGULAR        => 'wpdev-bg-gray-700 wpdev-text-gray-200',
        self::SITE_TEMPLATE  => 'wpdev-bg-yellow-200 wpdev-text-yellow-700',
        self::CUSTOMER_OWNED => 'wpdev-bg-green-200 wpdev-text-green-700',
        self::PENDING        => 'wpdev-bg-purple-200 wpdev-text-purple-700',
    );
}
```

## Status column (Memberships)

Optional source (if examples installed): `@examples/memberships/src/tables/class-membership-list-table.php:100-109` + `.../class-membership-status.php:42-51`

```php
public function column_status( $item ) {
    $label = $item->get_status_label();
    $class = $item->get_status_class();
    return sprintf(
        "<span class='wpdev-bg-gray-200 wpdev-text-gray-700 wpdev-leading-none wpdev-py-1 wpdev-px-2 wpdev-rounded-sm wpdev-text-xs wpdev-font-mono %s'>%s</span>",
        esc_attr( $class ),
        esc_html( $label )
    );
}
```

```php
// In the status Enum:
protected function classes() {
    return array(
        self::ACTIVE    => 'wpdev-bg-green-200 wpdev-text-green-700',
        self::PENDING   => 'wpdev-bg-gray-200 wpdev-text-gray-700',
        self::EXPIRED   => 'wpdev-bg-yellow-200 wpdev-text-yellow-700',
        self::CANCELLED => 'wpdev-bg-red-200 wpdev-text-red-700',
    );
}
```

## Rules

- Always `esc_attr()` / `esc_html()` in new code (legacy examples sometimes omit — do not copy that).
- Badge columns are **always-on** when type/status columns exist — no user confirmation needed.