# Activation & shared package FQCNs

## Why single-plugin unit suites miss this

WordPress activates a plugin with {@see plugin_sandbox_scrape()} / `activate_plugin()`:

1. **All already-active plugins** have finished loading (composer autoloaders ran).
2. `plugins_loaded` has **already fired**.
3. WP then `include_once`s the plugin being activated and runs activation hooks.

So activation is **not** the same boot order as a normal request where this plugin loads early with peers.

If this host and another plugin both ship overlapping FQCNs (e.g. `WPDev\Support\Assets` from `packages/framework`), **whichever autoload wins first keeps the class**. On activation, that winner is often the **older** copy already loaded by a sibling. Calling a method that exists only on *your* newer copy:

```text
Call to undefined method WPDev\Support\Assets::register_vendor_scripts()
```

…fatals inside the late-boot / activation include path and WordPress reports “Plugin could not be activated because it triggered a fatal error.”

Classic workaround users discover: early `return` in the main file → Activate → remove `return`. That skips the late fatal during scrape; the next full load may use a different order or never hits the same line.

A **default unit suite** usually:

- Boots **only this plugin** (`BOOTSTRAP_FILE` / active plugins list).
- Loads **this** plugin’s Autoload first → your `Assets` (with the new method) wins.
- Never co-loads an older duplicate FQCN.
- Rarely exercises `plugin_sandbox_scrape` after peers have already constructed their class map.

So the bug is **environment / activation-order**, not “logic when alone.”

## What to test

| Layer | Goal |
|-------|------|
| Unit | Guard that talks to shared FQCNs: `method_exists( $class, 'newMethod' )` before call; inject a **legacy fixture class** without the method |
| Unit | Happy path still calls the method when present (recording / spy fixture) |
| Optional | `activate_plugin()` in a suite that also activates a sibling plugin shipping the older package (heavier; Docker multi-plugin) |

Prefer extracting bootstrap wiring into a small `src/…` class (e.g. `AssetsBootstrap::wire( $immediate, $assets_class = null )`) so tests can pass a fixture FQCN without trying to redeclare `WPDev\Support\Assets`.

## Production pattern

```php
$assets = \WPDev\Support\Assets::class;
if ( class_exists( $assets ) && method_exists( $assets, 'set_plugin_dir' ) ) {
	$assets::set_plugin_dir( $dir, $url );
}
if ( ! class_exists( $assets ) || ! method_exists( $assets, 'register_vendor_scripts' ) ) {
	return; // Older co-installed copy — skip; do not fatal on activation.
}
$assets::register_vendor_scripts();
```

Rules of thumb:

- `class_exists` is **not** enough for evolving shared APIs.
- Guard **every** newer method on shared FQCNs used from late-boot / activation paths.
- Never assume your plugin’s `vendor/` / `packages/framework` copy is the one loaded.
- Document “first load wins” next to library-embed / shared-framework notes.

## HTTP 503 / timeout on first Activate

Same root cause class (activation include after `plugins_loaded`), different symptom:

1. `activate_plugin()` calls `plugin_sandbox_scrape()` which `include_once`s the plugin with `WP_SANDBOX_SCRAPING`.
2. Host + embedded framework see `did_action( 'plugins_loaded' )` and **synchronously** run `Module_Loader::load_all()`, Action Scheduler schema, `wpdev()` singleton, module `boot_all()`, etc.
3. Constrained hosts hit PHP-FPM / reverse-proxy limits → **HTTP 503**; WordPress never reaches `update_option( 'active_plugins' )`.
4. Early `return` at top of main file during Activate, then remove it: plugin becomes active with almost no work; the **next** request boots normally and is fast. Second Activate after Deactivate also works because one-time schema is already warm.

**Mitigation:** if `WP_SANDBOX_SCRAPING`, register only cheap `register_activation_hook` work (options + small DDL) and `return` **before** `require` of the embedded framework. Full boot on the following authenticated request.

Example: host `ActivationBootstrap` in `wpdev-woocommerce`.


## Minimal test sketch

```php
/**
 * @test
 */
public function itShouldNotFatalWhenLoadedAssetsMissRegisterVendorScriptsDuringLateBoot(): void {
	AssetsBootstrap::wire( true, LegacyAssetsWithoutVendorScripts::class );
	$this->assertSame(
		WPDEV_WOOCOMMERCE_PLUGIN_DIR,
		LegacyAssetsWithoutVendorScripts::$last_dir,
		'set_plugin_dir must still run when present on the loaded Assets class'
	);
}
```

Fixture: same `set_plugin_dir` signature, **no** `register_vendor_scripts`. If the guard is removed, PHPUnit dies with the same undefined-method Error as production activation.
