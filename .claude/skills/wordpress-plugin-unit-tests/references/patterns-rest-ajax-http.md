# REST, Ajax, HTTP, and admin patterns

## REST API tests

Pattern is **evolving** — treat sample `RestTestCase` as reference; improvements (POST body, cleaner dispatch) are allowed.

### Plugin RestTestCase

```php
abstract class RestTestCase extends PluginBaseTestCase {
    protected $rest;

    abstract public function rest_handler_instance();
    abstract public function init();

    public function setUp(): void {
        global $wp_rest_server;
        parent::setUp();
        $this->init();
        $this->rest = $this->rest_handler_instance();
        $wp_rest_server = new \Spy_REST_Server;
        do_action( 'rest_api_init', $wp_rest_server );
    }

    /**
     * @return \WP_REST_Response|\WP_Error
     */
    protected function dispatch( array $params = [], $login = false ) {
        return rest_get_server()->dispatch( $this->request( $params, $login ) );
    }

    protected function request( array $params = [], $login = false ): \WP_REST_Request {
        $login && $this->login();
        $request = new \WP_REST_Request( $this->rest->methods(), $this->path() );
        $request->set_header( 'content-type', 'application/json' );
        $request->set_query_params( array_merge( [
            'length'   => 10,
            '_wpnonce' => wp_create_nonce( 'wp_rest' ),
        ], $params ) );
        return $request;
    }

    protected function path(): string {
        // Replace Vendor\Plugin with your production namespace ({Vendor}\{Plugin}).
        return '/' . \Vendor\Plugin\Rest\RestSetup::NAMESPACE . '/' . $this->rest->rest_end_point();
    }
}
```

### Test class

Mirror handler under a subfolder:

`src/.../Delete/DeleteRestHandler.php` → `tests/.../DeleteRestHandler/DeleteTest.php`

```php
class DeleteTest extends RestTestCase {
    public function rest_handler_instance() {
        // Replace Vendor\Plugin with your production namespace ({Vendor}\{Plugin}).
        return \Vendor\Plugin\Rest\Delete\DeleteRestHandler::instance();
    }

    public function init() {
        \Vendor\Plugin\Setup::instance()->init();
    }

    /**
     * @test
     */
    public function itShouldSoftDeleteItem() {
        $this->login( 'administrator' );
        $item_id = $this->factory()->item->create( [ 'state_id' => 'active' ] );

        $response = $this->dispatch( [ 'id' => $item_id ] )->get_data();

        $this->assertTrue( $response['success'], $response['message'] ?? 'REST delete failed' );
        // Add a plugin-specific repository/model assertion for the deleted state.
    }
}
```

- `dispatch( $params, $login = false )` — `$login = true` calls `login()` with default **subscriber**. For admin-only endpoints, call `$this->login( 'administrator' )` (or another role) before `dispatch()`. It can return `WP_Error` for routing, permission, or validation failures; check `is_wp_error()` before calling `get_data()` in those tests.
- Assert `$response['success']`, `$response['code']`, and DB/state as needed.

## Ajax tests

Always extend **`WPDevTest\TestCases\BaseAjaxTestCase`** (or plugin wrapper).

```php
class SaveActionTest extends BaseAjaxTestCase {
    public function ajax_action(): string {
        return 'my_plugin_save';
    }

    /**
     * @test
     */
    public function itShouldReturnSuccessForValidPayload() {
        $this->login( 'administrator' );
        $result = $this->request( [ 'foo' => 'bar' ] );
        $this->assertTrue( $result['success'], 'Ajax save did not succeed' );
    }
}
```

- `request( $params )` sets `$_GET`, runs `_handleAjax`, returns decoded JSON.
- Default `login()` role on Ajax base is `administrator`.

## Admin screen simulation

Admin-only code (meta boxes, list tables, `current_screen` checks) requires **`set_current_screen()` before the code under test runs** — typically in `setUp()`.

**With plugin AdminTestCase:** base `setUp()` calls `set_current_screen( 'edit' )` then `$this->init()`; override screen in `init()` if needed.

**Without AdminTestCase:** in every test class `setUp()`:

```php
public function setUp(): void {
    parent::setUp();
    set_current_screen( 'edit' );  // post list; 'post' = editor, 'dashboard', etc.
    // Replace Vendor\Plugin with your production namespace ({Vendor}\{Plugin}).
    \Vendor\Plugin\Admin\Setup::init();
}
```

Common slugs: `edit`, `post`, `dashboard`, `options-general`.

## Front-end URL simulation

```php
$post_id = $this->factory()->post->create( [ 'post_name' => 'sample-post' ] );
$this->go_to( get_permalink( $post_id ) );
// assert query, template, hooks
```

### Rewrite rules

`go_to()` sets permalink structure to `/%postname%/` and simulates the main query. If the plugin registers custom rewrite rules, boot the same `Setup::init()` (or equivalent) in `setUp()` so rules exist before `go_to()`. Call `flush_rewrite_rules()` only in tests that verify activation or rewrite registration — not in every test (slow).

## External HTTP Mocking (`WPDevTest\Http\HttpMock`)

Instead of manually attaching and removing `pre_http_request` filters, use the native `HttpMock` engine (or `HttpTestCase`):

```php
use WPDevTest\Http\HttpMock;
use WPDevTest\Http\RecordedRequest;
use WPDevTest\TestCases\HttpTestCase;

class ApiClientTest extends HttpTestCase {

    /** @test */
    public function itShouldFetchExternalData(): void {
        HttpMock::preventStrayRequests();
        HttpMock::fake([
            'https://api.example.com/data*' => HttpMock::json([ 'status' => 'success' ], 200),
        ]);

        $response = wp_remote_get( 'https://api.example.com/data?season=summer' );

        $this->assertSame( 200, wp_remote_retrieve_response_code( $response ) );
        $this->assertSame( 'success', json_decode( wp_remote_retrieve_body( $response ), true )['status'] );

        HttpMock::assertSent( function ( RecordedRequest $req ) {
            return $req->query( 'season' ) === 'summer';
        } );

        HttpMock::assertSentCount( 1 );
    }
}
```

For test cases extending other bases (e.g. WooCommerce `TestCase` or `BaseAjaxTestCase`), add `use \WPDevTest\Http\Traits\IntersectsHttp;` to enable automatic isolation and reset.

