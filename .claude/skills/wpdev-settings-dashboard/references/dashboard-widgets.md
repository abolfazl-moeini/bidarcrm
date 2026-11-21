# Dashboard widgets + host-owned dash page

## 1. Widget API

Facade: `wpdev_register_dashboard_widget( $id, $config )`  
Source: `@framework/modules/admin-widget-builder/src/functions/dashboard-widget.php`

```php
wpdev_register_dashboard_widget( 'my-mrr-growth', array(
	'tab'        => 'general',
	'title'      => __( 'Monthly Recurring Revenue Growth', 'textdomain' ),
	'capability' => 'manage_options', // host-appropriate cap
	'position'   => 'full',
	'priority'   => 'high',
	'view'       => 'dashboard-statistics/widget-mrr-growth', // or host-registered view
	'datasource' => static function () {
		return array( /* plain array for template — no HTML */ );
	},
) );
```

**Module dependency:** include `admin-widget-builder` in the host module `dependencies` when widgets are used.

## 2. Host owns the dashboard page (2.8.x+)

The top-level WPDev analytics/dashboard page is **not** something host plugins should treat as guaranteed core chrome for their product KPIs.

Hosts that need an analytics home must register their **own** admin page (typically extending `Base_Admin_Page` / list-or-custom page) using the framework `dash` template:

- Template id: `dash` → view `base/dash` (registered in `@framework/modules/admin-page-builder/setup.php`)
- Render registered widgets as metaboxes with position/priority
- See also [custom-top-level.md](custom-top-level.md) for menu icon / top-level shell quality

```php
// Conceptual: host Base_Admin_Page with $id unique to the host plugin,
// $type = 'menu' when it should be top-level, capability from $supported_panels,
// and template/view path that uses the dash shell + registered widgets.
```

Verify the concrete page subclass and template keys against current admin-page-builder source before shipping — do not invent a `wpdev_register_dashboard_page()` facade unless it exists in PHP.

## 3. Datasources

- Widget datasources must return **plain arrays**.
- Templates handle empty/loading UI — do not render HTML inside the datasource.

## Optional deeper reading only

```bash
cd "{PLUGINS}"
git submodule add https://github.com/abolfazl-moeini/wpdev-examples.git wpdev-examples
```

Optional source (if examples installed): `@examples/admin-custom-page-dashboard-widgets/src/register-dashboard-statistics-widgets.php` — **not required** for production host panels.

## Rules

- Set explicit `capability` per widget.
- Pair with `wpdev_register_widget_datasource()` when sharing callbacks across widgets.
- Require module dependency `admin-widget-builder`.
- Host-owned dash page + widgets; do not assume a global WPDev dashboard is your product home.
- Examples labeled optional only.