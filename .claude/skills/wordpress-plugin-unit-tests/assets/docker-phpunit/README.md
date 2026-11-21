# Docker PHPUnit assets

Copy this folder to a working directory outside your plugin repository:

```bash
cp -r assets/docker-phpunit ~/wp-plugin-phpunit-env
cd ~/wp-plugin-phpunit-env
cp env.example .env
# edit .env — set PLUGIN_ROOT, WORDPRESS_DEVELOP_ROOT, and PLUGIN_MAIN_FILE
chmod +x run-phpunit.sh teardown.sh
./run-phpunit.sh
```

Always run the scripts **from this directory** — `run-phpunit.sh` starts Docker Compose here and mounts this folder into the PHP container.

For WooCommerce tests, also set `WOOCOMMERCE_ROOT` to a WooCommerce checkout and activate `woocommerce/woocommerce.php` through the plugin's `tests/plugins-list.php`.

See [docs/docker-phpunit.md](../../docs/docker-phpunit.md) for the full guide.

## Files

| File | Purpose |
|------|---------|
| `env.example` | Template for required paths and credentials |
| `docker-compose.yml` | `php` + `db` services |
| `wp-tests-config.php.template` | Rendered config for the test database |
| `run-phpunit.sh` | Start stack, copy test lib, run PHPUnit |
| `teardown.sh` | `docker compose down -v` + cleanup |

## Generated (gitignored in consumer projects)

- `.env`
- `wp-tests-config.php`
