# Datepicker (Flatpickr + optional Jalali)

WPDev datepickers are **Flatpickr** inputs (vendored
[`flatpickr-wrap`](https://github.com/abolfathi-al/flatpickr-wrap)), initialized by
`wpdev_initialize_datepickers()` in
`@framework/modules/core/assets/js/functions/functions-core.js`.

Selectors: `.wpdev-datepicker` **or** any element with the `wpdev-datepicker` attribute.

Do **not** hand-write `<input type="date">` on WPDev admin screens. Use the
field attrs below so Flatpickr, format, time toggle, and Jalali stay consistent.

## Required `html_attr`

| Attr | Purpose |
|------|---------|
| `wpdev-datepicker` => `'true'` | Marks the input for Flatpickr init |
| `data-format` | Flatpickr `dateFormat` for the **real** input (Gregorian tokens, e.g. `Y-m-d`, `Y-m-d H:i:S`) |
| `data-allow-time` | `'true'` / `'false'` — Flatpickr `enableTime` (defaults to **on** when omitted) |

## Optional `html_attr`

| Attr | Purpose |
|------|---------|
| `data-locale` | Override locale for this field: `fa` / `fa-IR` (Jalali UI) or `default` (Gregorian UI) |
| `data-alt-format` | Visible Jalali format when Jalali is on (default `Y/m/d` or `Y/m/d H:i:S`) |

## Jalali (Persian / Shamsi) calendar

Framework support uses **flatpickr-wrap** + Persian `fa` locale + `jalaali-js` for parsing.

### Behaviour

| Layer | Format |
|-------|--------|
| Calendar UI | Jalali months/days when locale is `fa` / `fa-IR` |
| Visible field (`altInput`) | Jalali (`data-alt-format`) |
| Real `<input>` value (submitted / PHP) | **Always Gregorian** (`data-format`) |

Backend sanitizers that expect `Y-m-d` keep working. Do **not** submit Jalali years to PHP date queries.

### How locale is chosen

1. Per-field `data-locale` if set
2. Else `wpdev_settings.datepicker_locale` (from PHP)
3. Else `default`

PHP default: Jalali (`fa`) when **any** of these is Persian (`fa`, `fa_IR`, `fa_AF`, `fa-IR`, …):

- `determine_locale()`
- site `get_locale()`
- `get_user_locale()`

So a site with language **فارسی** gets Shamsi calendars even if the admin
user profile language is English.

Override globally:

```php
add_filter( 'wpdev_datepicker_locale', function( $locale, $wp_locale ) {
	return 'fa'; // force Jalali UI site-wide
}, 10, 2 );
```

`Scripts::is_persian_wp_locale( $locale )` matches `fa` / `fa_*` / `fa-*`.

Force Gregorian on one field even on `fa_IR` admin:

```php
'html_attr' => array(
	'wpdev-datepicker' => 'true',
	'data-format'      => 'Y-m-d',
	'data-allow-time'  => 'false',
	'data-locale'      => 'default',
),
```

Force Jalali on one field for non-fa locales:

```php
'data-locale' => 'fa',
```

### Assets

| Handle | File |
|--------|------|
| `wpdev-flatpicker` | `lib/flatpicker.js` (flatpickr-wrap) |
| `wpdev-flatpicker-fa` | `lib/flatpickr-l10n/fa.js` |
| `wpdev-jalaali` | `lib/jalaali.js` (jalaali-js for altInput parse) |

These are dependencies of `wpdev-functions` / list-table scripts.

## Pattern A — edit-page timestamps (`text-edit`)

Use on `Edit_Admin_Page` widgets when the value is shown as relative time and
opened with an edit control (Vue `data-wpdev-app`). Gold standard:
`@examples/memberships/src/admin/class-membership-edit-admin-page.php` (Expires at / Last Renewed at / …).

```php
$field = array(
	'title'         => __( 'Expires at', 'textdomain' ),
	'type'          => 'text-edit',
	'date'          => true,
	'edit'          => true,
	'display_value' => $value,
	'value'         => $value, // Gregorian datetime string
	'placeholder'   => '2020-04-04 12:00:00',
	'html_attr'     => array(
		'wpdev-datepicker' => 'true',
		'data-format'      => 'Y-m-d H:i:S',
		'data-allow-time'  => 'true',
	),
);
```

`text-edit` / `text-display` are **admin-pages view templates** (not separate
registry types). Prefer them only when you want display + pencil edit UX.

Framework timestamps widget (`add_info_widget`) uses the same `html_attr`
contract on created/modified fields.

## Pattern B — always-visible date input (`text`)

Use for filter bars, settings, and any form where the picker must be visible
immediately (no click-to-edit):

```php
$field = array(
	'title'       => __( 'From date', 'textdomain' ),
	'type'        => 'text',
	'placeholder' => '2024-01-01',
	'value'       => $ymd, // Gregorian Y-m-d
	'html_attr'   => array(
		'wpdev-datepicker' => 'true',
		'data-format'      => 'Y-m-d',
		'data-allow-time'  => 'false',
		'required'         => 'required',
	),
);
```

Date-only filters that sanitize with `/^\d{4}-\d{2}-\d{2}$/` **must** use
`data-format => Y-m-d` and `data-allow-time => false`. On Jalali UI the user
sees Shamsi in `altInput`, but the submitted name still posts Gregorian.

> [!IMPORTANT]
> **Initial Field Value:** The initial HTML `value` attribute for a `wpdev-datepicker` input **must always be formatted in Gregorian** (e.g. via `wpdev_format_gregorian_datetime($timestamp, 'Y-m-d H:i')` or `(new DateTimeImmutable('@' . $timestamp))->setTimezone(wp_timezone())->format(...)`).
> **NEVER** use `wp_date()` or `date_i18n()` to format the initial `value` attribute, because Persian calendar plugins (`wp-parsidate`, `persian-woocommerce`) filter those functions and emit Jalali date strings (e.g. `1405-06-10 10:00`). Flatpickr parses the raw input in Gregorian; polluting the raw input with a Jalali year causes Flatpickr and PHP sanitizers to treat the date as year 1405 AD, corrupting database records and resetting times to `23:59:59`.

## Init lifecycle

Init runs inside `wpdev_on_load()` → `wpdev_initialize_datepickers()`.

That hook fires from:
1. `wpdev-admin` (`document.ready`), and/or
2. each Vue app `mounted()` in `vue-apps.js`, and/or
3. `vue-apps.js` once on `DOMContentLoaded` when **zero** `[data-wpdev-app]` exist

List pages with Pattern B filters often have **no** Vue roots. After
`Scripts::ensure_defaults_registered()`, enqueue `wpdev-admin` (List/Edit admin
pages do this) so datepickers still init without a Vue mount.

After Ajax / wubox HTML injects new inputs, call
`wpdev_initialize_datepickers()` again (already-initialized nodes are skipped).

## Anti-patterns

| Don't | Do |
|-------|----|
| Native `<input type="date">` | Flatpickr via `wpdev-datepicker` attrs |
| Omit `data-format` | Always set Gregorian format explicitly |
| Format initial `value` with `wp_date()` or `date_i18n()` | Use `wpdev_format_gregorian_datetime()` / `DateTimeImmutable` (pure Gregorian) |
| Expect Jalali years in `$_GET` / DB | Keep Gregorian storage; Jalali is UI-only |
| Replace Flatpickr with Vue-only Persian pickers | Use framework Flatpickr + `data-locale` |
| Use `text-edit` on a GET filter bar | Use Pattern B (`type => text`) |
| `data-allow-time => true` when backend expects `Y-m-d` only | Match format to sanitizer |
| Rely on Vue mount alone on list/filter pages | Ensure `wpdev-admin` is enqueued (or zero-app `wpdev_on_load` fallback) |
