# Row actions (list table side)

Custom non-CRUD row actions need user confirmation before implementation. Full ajax + result modal: `wpdev-modal-forms/references/custom-action-modal.md`.

## Row action markup

Optional deeper reading (install separate repo only if needed):
```bash
cd "{PLUGINS}"
git submodule add https://github.com/abolfazl-moeini/wpdev-examples.git wpdev-examples
```

Optional source (if examples installed): `@examples/webhooks/src/tables/class-webhook-list-table.php:66-73`

```php
$actions['test'] = sprintf(
    '<a id="action_button" data-title="%1$s" data-page="list" data-action="wpdev_send_test_event" data-event="%2$s" data-object="%3$s" data-url="%4$s" href="">%5$s</a>',
    esc_attr( $item->get_name() ),
    esc_attr( $item->get_event() ),
    esc_attr( $item->get_id() ),
    esc_url( $item->get_webhook_url() ),
    __( 'Send Test', 'wpdev' )
);
```

## Rules

- Row action link carries `data-action` matching a `wpdev_register_ajax_handler()` id.
- Pass entity payload via `data-*` attributes.
- JS handler lives in host plugin assets (see modal-forms skill) — never bare `admin-ajax.php` wiring.
- If user already named the action ("add Send Test button"), treat as pre-confirmed in Phase 2.