# Cycle 2 Code Review — Section 5: Deploy, Docker, Scripts, Installer Smoke Tests & E2E

**Scope:** `deploy/`, `docker/Dockerfile.dev`, `docker-compose.dev.yml`, `scripts/` (excluding `scripts/apply-whitelabel.php`), `tests/installer/`, `tests/ui-level/`, and `packages/e2e/`.  
**Review Mode:** Read-only audit (no files modified).

| Severity | Count | Key Risk Areas |
| :--- | :---: | :--- |
| **BLOCKER** | 7 | `Dockerfile.dev` `.htaccess` disabled; `deploy/docker-compose.yml` wrong WordPress image & missing mounts; `public-htaccess.template` breaks `/client/`; `seed-sample-data.php` exposed to web SAPI; `nginx.conf.template` arbitrary PHP execution + broken `php:9000`; `packages/e2e/Dockerfile` missing Playwright browsers; `scenarios/` fake fallback IDs masking live failures |
| **MAJOR** | 16 | Missing HTTP security headers; `build-release.sh` & `dev-setup.sh` macOS `/usr/bin/timeout` crash + unverified downloads + fragile autoload patching; `clean-install-smoke.sh` broken `php -l` `$?` check & double cleanup; `verify-zip-structure.sh` unanchored regexes; `export-static-html.mjs` broken class syntax; `run-ui-checks.mjs` hardcoded path & missing screens; E2E `waitForTimeout`, missing DB cleanup, & `context.waitForEvent('download')` 10s hang |
| **MINOR** | 8 | Subdirectory `RewriteBase /` assumptions; `APP_VERSION` `grep -o` fragility; `manifest.json` stale routes & ignored `colorThresholdDeltaE`; `monitor.config.js` port/env mismatches; `activities.spec.js` hardcoded dates; `classic-crm.spec.js` weak login assertion |
| **INFO** | 2 | 9 leftover local Python review/harvest scripts in `scripts/`; orphaned `deploy/admin-entry.php` |

---

## 1. BLOCKER Findings

### B1. `docker/Dockerfile.dev` — `AllowOverride All` never applies & literal `${APACHE_DOCUMENT_ROOT}` written to Apache configs
* **File:** [Dockerfile.dev](file:///Users/moeini/Dev/didar/docker/Dockerfile.dev#L28-L31)
* **Diagnosis:**
  1. Lines 29–30 use single-quoted `sed` expressions (`'s!/var/www/!${APACHE_DOCUMENT_ROOT}!g'`), so `${APACHE_DOCUMENT_ROOT}` is not shell-expanded and is written literally into `/etc/apache2/apache2.conf` and `/etc/apache2/sites-available/*.conf`.
  2. Line 30 rewrites `<Directory /var/www/>` before line 31 runs `sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/'`. Because `<Directory /var/www/>` no longer exists, line 31 never matches and `AllowOverride None` remains in effect, silently disabling all `.htaccess` routing and security blocks in dev.
* **Fix:** Use double-quoted `sed` (or explicitly match `/var/www/` before replacing it) and replace `AllowOverride None` with `AllowOverride All` on the updated `<Directory /var/www/html>` block, e.g.:
  ```dockerfile
  RUN sed -ri -e "s!/var/www/html!${APACHE_DOCUMENT_ROOT}!g" /etc/apache2/sites-available/*.conf \
      && sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf \
      && sed -ri -e "s!/var/www/!${APACHE_DOCUMENT_ROOT}/!g" /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf
  ```

### B2. `deploy/docker-compose.yml` — Wrong base image (`arm64v8/wordpress`), missing files, and hardcoded ARM64 platform
* **File:** [docker-compose.yml](file:///Users/moeini/Dev/didar/deploy/docker-compose.yml#L4-L73)
* **Diagnosis:**
  * Uses unpinned `arm64v8/wordpress`, `arm64v8/mysql`, and `arm64v8/phpmyadmin` with `platform: linux/arm64/v8` (lines 4–5, 26–27, 56–57), breaking x86_64/amd64 hosts and CI.
  * Mounts `./source:/var/www/html` and `./php.ini:/usr/local/etc/php/conf.d/bidar.ini:ro` (lines 14–15), neither of which exists in `deploy/` (Docker will auto-create `./php.ini` as a directory and fail).
  * Runtime `command` (lines 16–22) only checks `pdo_mysql`, omitting EspoCRM 10.1.4 required extensions (`intl`, `zip`, `gd`, `bcmath`, `mbstring`, `opcache`).
  * Uses `restart: "no"`, exposes MySQL on `3316:3306` (`0.0.0.0`), passes `-proot` on CLI in `healthcheck`, and requires pre-existing external `shared_net` (lines 6, 35, 45, 70–73).
* **Fix:** Replace with a dedicated multi-arch `php:8.3-apache` (or `espocrm/espocrm` / custom `Dockerfile`) build installing all required PHP extensions, provide a real `deploy/php.ini`, pin `mariadb:11.4` (or `mysql:8.4`), bind DB port to `127.0.0.1` or omit host exposure, parameterize credentials via `.env`, and remove the external `shared_net` requirement.

### B3. `deploy/public-htaccess.template` — Missing `/client/` pass-through & zero internal/dotfile blocking
* **File:** [public-htaccess.template](file:///Users/moeini/Dev/didar/deploy/public-htaccess.template#L11-L58)
* **Diagnosis:**
  * Designed for `DocumentRoot = public/`, where EspoCRM's `client/` directory sits one level above (`../client/`). Unlike [nginx.conf.template](file:///Users/moeini/Dev/didar/deploy/nginx.conf.template#L43-L46), `public-htaccess.template` has no `/client/` handling, so requests to `/client/css/espo/espo.css` or `/client/lib/espo.js` fail `-f`/`-d` checks (lines 52–54) and hit the SPA fallback `RewriteRule ^.*$ app/index.html [L]` (line 57), breaking `/admin` and `/install`.
  * Lacks `Options -Indexes` and dotfile/sensitive file blocking (`.git`, `.env`, `.htaccess`, `*.log`, `*.sql`).
  * `/app` without a trailing slash bypasses `^/app/` (line 47) and hits `-d` (line 53), which fails with 403 if `DirectoryIndex` is restricted.
* **Fix:** Document/enforce an Apache `Alias /client /var/www/html/client` (or symlink `public/client -> ../client` in `build-release.sh` with `Options +FollowSymLinks`), add `Options -Indexes`, block `^\.` dotfiles and sensitive extensions, and rewrite `^app(/.*)?$` cleanly to `app/index.html`.

### B4. `deploy/nginx.conf.template` — Arbitrary PHP execution in `public/app/` (and `try_files` omission), `if` pitfall, and unreachable `php:9000`
* **File:** [nginx.conf.template](file:///Users/moeini/Dev/didar/deploy/nginx.conf.template#L18-L102)
* **Diagnosis:**
  * `location ~ \.php$` (lines 80–102) has higher precedence than `location /app/`, `location /install/`, and `location /client/`, and lacks `try_files $uri =404;` (or `if (!-f $document_root$fastcgi_script_name)`). Any `.php` file (or path-info exploit like `/app/avatar.jpg/x.php` if `cgi.fix_pathinfo=1`) is passed directly to PHP-FPM.
  * `if ($arg_entryPoint != "")` at `server` scope (lines 61–63) hijacks **any** URL with `?entryPoint=...` (including `/api/v1/...` or `/app/...`) to `/index.php`.
  * `location /admin` (line 56) is an unanchored prefix match (also matches `/admin-entry.php` or `/administrator`).
  * `fastcgi_pass php:9000;` (line 82) references a non-existent `php` FPM container (both compose files use Apache `mod_php`).
  * Line 23 only blocks `/\.(git|env|ui-level)` and misses `.ht*` files (`.htaccess`, `.htpasswd`), `*.log`, `*.sql`, and subdirectory `composer.json`/`package.json` (line 28 uses `^/`).
* **Fix:** Add `try_files $fastcgi_script_name =404;` and `fastcgi_param PHP_VALUE ...` / `cgi.fix_pathinfo=0` inside `location ~ \.php$`, restrict PHP execution to explicit entrypoints (`^/(index|oauth-callback|api/v1/index|install/index)\.php$` or non-upload dirs), block `~ /\.` (except `.well-known`), change `location /admin` to `location ~ ^/admin(/|$)`, and handle `?entryPoint=` only on `location = /`.

### B5. `scripts/seed-sample-data.php` — Missing CLI-only guard allows remote HTTP execution
* **File:** [seed-sample-data.php](file:///Users/moeini/Dev/didar/scripts/seed-sample-data.php#L17-L19)
* **Diagnosis:**
  ```php
  if (php_sapi_name() !== 'cli') {
      header('Content-Type: text/plain; charset=utf-8');
  }
  ```
  Instead of rejecting web requests, it explicitly formats output for HTTP. Because neither [htaccess.template](file:///Users/moeini/Dev/didar/deploy/htaccess.template#L18) nor [nginx.conf.template](file:///Users/moeini/Dev/didar/deploy/nginx.conf.template#L18) blocks `scripts/`, exposing this file in webroot lets any unauthenticated caller overwrite EspoCRM `config.php` settings (`ConfigWriter`, lines 90–114) and seed demo records into production.
* **Fix:** Enforce a hard fail-closed CLI check immediately after `declare(strict_types=1);`:
  ```php
  if (PHP_SAPI !== 'cli') {
      http_response_code(403);
      exit("Forbidden: CLI execution only.\n");
  }
  ```

### B6. `packages/e2e/Dockerfile` — `node:22-alpine` cannot run Playwright browsers
* **File:** [Dockerfile](file:///Users/moeini/Dev/didar/packages/e2e/Dockerfile#L1-L11)
* **Diagnosis:** `packages/e2e/package.json` depends on `playwright: ^1.50.0`, yet `Dockerfile` uses `node:22-alpine` and only runs `npm ci --omit=dev` without installing Playwright browser binaries or glibc/OS dependencies. Any browser-driven test executed in this container will immediately crash.
* **Fix:** Switch base image to `mcr.microsoft.com/playwright:v1.50.0-noble` (matching the pinned Playwright version) or install `chromium` + system libs and configure `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` appropriately.

### B7. `packages/e2e/scenarios/*.js` — Hardcoded fake fallback IDs & tokens mask real failures
* **Files:**
  * [01-health-and-login.js](file:///Users/moeini/Dev/didar/packages/e2e/scenarios/01-health-and-login.js#L41) (`'simulated-token'`)
  * [03-kanban-create-and-dnd.js](file:///Users/moeini/Dev/didar/packages/e2e/scenarios/03-kanban-create-and-dnd.js#L44-L62) (`'stage-1'`, `'stage-2'`, `'deal-e2e-101'`)
  * [04-deal-detail-stream-and-rotten-reset.js](file:///Users/moeini/Dev/didar/packages/e2e/scenarios/04-deal-detail-stream-and-rotten-reset.js#L13-L51) (`'deal-e2e-101'`, `'note-e2e-201'`)
  * [05-contacts-and-accounts.js](file:///Users/moeini/Dev/didar/packages/e2e/scenarios/05-contacts-and-accounts.js#L50-L61) (`'contact-e2e-301'`)
  * [06-activities-and-jalali-calendar.js](file:///Users/moeini/Dev/didar/packages/e2e/scenarios/06-activities-and-jalali-calendar.js#L13-L48) (`'deal-e2e-101'`, `'task-e2e-401'`)
* **Diagnosis:**
  * Every scenario silently substitutes fake IDs/tokens if the server returns malformed/empty JSON, allowing downstream requests to run with bogus IDs instead of failing fast.
  * Scenario `03` ignores the dynamic `state.pipeline` fetched on lines 26–35 and hardcodes `'stage-1'`/`'stage-2'`.
  * Scenario `05` never checks the JSON payload of `GET /api/v1/Contact?maxSize=20&search=09121234567`, so an empty list passes.
  * Scenario `06` sends ISO 8601 date `'2026-11-25T10:00:00.000Z'` (`dateDue`/`dateEnd`), which EspoCRM rejects (and will soon be in the past).
* **Fix:** Remove all fallback mock IDs/tokens (`throw` immediately if `data.token` or `created.id` is missing), read stage IDs dynamically from `state.pipeline`, assert `list.some(...)` in Scenario `05`, and compute dynamic future dates in EspoCRM `YYYY-MM-DD HH:mm:ss` format.

---

## 2. MAJOR Findings

### M1. Missing Security Headers Across All Web Server Templates
* **Files:** [nginx.conf.template](file:///Users/moeini/Dev/didar/deploy/nginx.conf.template#L6-L103), [htaccess.template](file:///Users/moeini/Dev/didar/deploy/htaccess.template#L6-L9), [public-htaccess.template](file:///Users/moeini/Dev/didar/deploy/public-htaccess.template#L6-L9)
* **Diagnosis:** All three templates only strip `X-Powered-By`. None set `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, or `server_tokens off;`.
* **Fix:** Add standard security headers (`always` in Nginx/Apache so they apply to error responses too). If the Web Lead Capture `<iframe>` endpoint (`settings.spec.js` Scenario 5) must be embeddable externally, exempt only that specific route via `Content-Security-Policy: frame-ancestors *` while keeping `SAMEORIGIN` everywhere else.

### M2. `deploy/htaccess.template` — Unblocked Root Admin/CLI/Script Paths & `Options -Indexes` Missing
* **File:** [htaccess.template](file:///Users/moeini/Dev/didar/deploy/htaccess.template#L18-L19)
* **Diagnosis:** Line 18 blocks `application|data|custom|vendor|logs|engine|packages|extensions`, and line 19 blocks root-only `.git|.env|.ui-level|composer.*|package*`. It leaves `scripts/`, `config/` (`config/brand.config.json`), `tests/`, `docs/`, `build/`, `dist/`, `docker/`, `deploy/`, `bootstrap.php`, `command.php`, `cron.php`, `daemon.php`, `rebuild.php`, `upgrade.php`, and subdirectory dotfiles/backups exposed if present in the webroot. `Options -Indexes` is also missing.
* **Fix:** Add `Options -Indexes`, expand line 18 to block `(application|data|custom|vendor|logs|engine|packages|extensions|scripts|config|tests|docs|build|dist|docker|deploy|apps)/`, block `^(bootstrap|command|cron|daemon|websocket|rebuild|upgrade|clear_cache)\.php$`, and block dotfiles (`(^|/)\.`) except `.well-known`.

### M3. `docker-compose.dev.yml` — Mounts Repo Root Instead of `engine/` & Lacks `php.ini` Limits
* **Files:** [docker-compose.dev.yml](file:///Users/moeini/Dev/didar/docker-compose.dev.yml#L10-L33), [Dockerfile.dev](file:///Users/moeini/Dev/didar/docker/Dockerfile.dev#L1-L33)
* **Diagnosis:** `docker-compose.dev.yml` mounts `.:/var/www/html` (line 11), whereas `scripts/dev-setup.sh` installs EspoCRM into `engine/`. Consequently, `http://localhost:8080/` serves the repo root (exposing `.git`, `scripts`, `tests`, `config`) instead of `engine/`. `ESPO_SITE_URL` and `DATABASE_*` env vars (lines 13–17) have no effect on `php:8.3-apache`. No `php.ini` is configured in `Dockerfile.dev`, leaving PHP defaults (`memory_limit=128M`, `upload_max_filesize=2M`). MariaDB `mariadb:11` is unpinned and binds `3306:3306` to `0.0.0.0` with hardcoded `root` password.
* **Fix:** Align `APACHE_DOCUMENT_ROOT` / volume mounts (`./engine:/var/www/html` plus extension mounts if needed), add a `docker/php.ini` (`memory_limit=512M`, `upload_max_filesize=50M`, `post_max_size=50M`, `max_execution_time=180`, `opcache` settings), and pin `mariadb:11.4` bound to `127.0.0.1:3306:3306`.

### M4. `scripts/build-release.sh` & `scripts/dev-setup.sh` — `/usr/bin/timeout` Breaks on macOS & Remote Download Unverified
* **Files:** [build-release.sh](file:///Users/moeini/Dev/didar/scripts/build-release.sh#L43-L52), [dev-setup.sh](file:///Users/moeini/Dev/didar/scripts/dev-setup.sh#L36-L46)
* **Diagnosis:** Both scripts invoke `/usr/bin/timeout` (which does not exist on macOS) when downloading/unzipping `EspoCRM-${ESPO_VERSION}.zip`, failing immediately under `set -euo pipefail` when `.cache/` is cold. Downloads also lack SHA-256 checksum verification against `engine.version`.
* **Fix:** Use `curl --max-time 180` natively, resolve `command -v timeout || command -v gtimeout || true` for `unzip`, and verify the downloaded archive against a pinned `engine.sha256` file.

### M5. `scripts/build-release.sh` — Silent Fallback `index.html`, Incomplete `morilog/jalali` Bundling & Fragile `autoload.php` Patch
* **File:** [build-release.sh](file:///Users/moeini/Dev/didar/scripts/build-release.sh#L83-L231)
* **Diagnosis:**
  * Lines 170–200 silently generate a placeholder `index.html` if `apps/web/package.json` is absent instead of aborting the release build; also copies `${WEB_DIR}/dist/.` without cleaning stale build artifacts.
  * Lines 124–140 copy `vendor/beberlei/assert` without registering `Assert\\` in `vendor/morilog/autoload.php`, and bypass Composer dependency resolution (risking Carbon/Symfony conflicts with EspoCRM's bundled `vendor/`).
  * Lines 148–157 use `preg_replace` on `vendor/autoload.php` without asserting that the pattern actually matched.
  * Lines 83–85 suppress `rsync` stderr (`2>/dev/null`) and, if falling back to `cp -a`, do not delete `*.test.*` files.
  * Lines 224–230 `zip -x` does not exclude `.env*`, `*.log`, `*.bak`, `*.swp`, `phpunit.xml`, and `*node_modules*` is overly broad.
* **Fix:** Fail hard if `apps/web/package.json` or `dist/` is missing; resolve/autoload `morilog/jalali` cleanly (or run `composer` in a clean build stage); assert `preg_replace` count === 1; remove `2>/dev/null` on `rsync`; tighten `zip -x` exclusions.

### M6. `scripts/dev-setup.sh` — Host-Absolute Symlinks & Missing `engine/public/.htaccess`
* **File:** [dev-setup.sh](file:///Users/moeini/Dev/didar/scripts/dev-setup.sh#L74-L112)
* **Diagnosis:** Symlinks on lines 74–105 use absolute host paths (`${EXTENSIONS_DIR}/...`), which break inside Docker containers mounted at `/var/www/html`. Line 111 copies `deploy/htaccess.template` to `engine/.htaccess` but never copies `deploy/public-htaccess.template` to `engine/public/.htaccess`.
* **Fix:** Use relative symlinks (or Docker volume mounts) and copy `deploy/public-htaccess.template` to `engine/public/.htaccess`.

### M7. `tests/installer/clean-install-smoke.sh` — Broken `php -l` Exit-Code Check & Double Cleanup Trap
* **File:** [clean-install-smoke.sh](file:///Users/moeini/Dev/didar/tests/installer/clean-install-smoke.sh#L38-L46), [clean-install-smoke.sh](file:///Users/moeini/Dev/didar/tests/installer/clean-install-smoke.sh#L123-L130)
* **Diagnosis:**
  * Lines 123–126: `LINT_OUTPUT="$(find ... -exec php -l {} + 2>&1)" || { log_fail ... }` followed by `if [[ $? -eq 0 ... ]]`. Because the `|| { log_fail ...; }` block exits `0`, `$?` is always `0`, causing a failed `php -l` without `"Fatal error"`/`"Parse error"` text to log **both** `[FAIL]` and `[PASS]` (and `"Parse error"` to log `[FAIL]` twice).
  * Line 46: `trap cleanup EXIT INT TERM ERR` invokes `cleanup` twice when an error or signal occurs (`ERR` -> `exit` -> `EXIT`).
* **Fix:** Capture `php -l` status properly (`if LINT_OUTPUT="$(...)"; then ... else ... fi`) using `xargs -0 -n1 php -l` so every file is linted, and trap `EXIT` only (`trap cleanup EXIT`).

### M8. `tests/installer/verify-zip-structure.sh` — Unanchored `grep -qE` Patterns Allow False Passes
* **File:** [verify-zip-structure.sh](file:///Users/moeini/Dev/didar/tests/installer/verify-zip-structure.sh#L35-L89)
* **Diagnosis:** `grep -qE` runs against human-readable `unzip -l` output without anchors: `"\.htaccess"` (line 39) matches `public/.htaccess` even if root `.htaccess` is absent; `"\.git/"` (line 76) matches any substring; `FORBIDDEN_PATTERNS` omits `.env`, `*.log`, and `data/config.php`.
* **Fix:** Use `unzip -Z1 "${ZIP_FILE}"` (raw filenames, one per line) and anchor patterns (`^\.htaccess$`, `^public/\.htaccess$`, `(^|/)\.git(/|$)`, `(^|/)\.env(\.|$)`).

### M9. `scripts/export-static-html.mjs` — Broken CSS Class (`font-mono展开`) & Stale `refs/` Generation
* **File:** [export-static-html.mjs](file:///Users/moeini/Dev/didar/scripts/export-static-html.mjs#L327), [export-static-html.mjs](file:///Users/moeini/Dev/didar/scripts/export-static-html.mjs#L877-L891)
* **Diagnosis:** Line 327 has stray CJK text inside a Tailwind class (`font-mono展开`), breaking monospace styling. Lines 877–891 only write `leads.html`, `reports.html`, `settings.html` to `tests/ui-level/refs/` if they do not exist, causing UI reference files to become stale when `VIEWS` are updated.
* **Fix:** Fix `font-mono展开` -> `font-mono` and regenerate all managed reference files deterministically (or share one manifest).

### M10. `tests/ui-level/run-ui-checks.mjs` & `manifest.json` — Hardcoded Local Path, Missing Screens & Unchecked `DeltaE`
* **Files:** [run-ui-checks.mjs](file:///Users/moeini/Dev/didar/tests/ui-level/run-ui-checks.mjs#L17-L133), [manifest.json](file:///Users/moeini/Dev/didar/tests/ui-level/manifest.json#L19-L255)
* **Diagnosis:**
  * Hardcodes `/Users/moeini/Dev/ui-level/dist/cli.js` (line 17).
  * `manifest.json` hardcodes `http://localhost:5173/app/...` (with no `BASE_URL` override), omits `leads`, `reports`, and `settings` screens, and points `kanban` to `/app/deals`.
  * `run-ui-checks.mjs` never forwards `screen.colorThresholdDeltaE` into `cliArgs` (lines 123–133).
* **Fix:** Support `BASE_URL` env rewriting, add `leads`/`reports`/`settings` to `manifest.json`, pass `colorThresholdDeltaE` to the CLI, and replace `execSync` string interpolation (lines 98, 168) with `execFileSync`.

### M11. `packages/e2e/test/*.spec.js` — Pervasive `waitForTimeout` & `networkidle` Flakiness
* **Files:** All 9 `.spec.js` files in `packages/e2e/test/` (e.g., [classic-crm.spec.js](file:///Users/moeini/Dev/didar/packages/e2e/test/classic-crm.spec.js#L52-L87), [kanban-dnd.spec.js](file:///Users/moeini/Dev/didar/packages/e2e/test/kanban-dnd.spec.js#L90-L406), [deal-detail.spec.js](file:///Users/moeini/Dev/didar/packages/e2e/test/deal-detail.spec.js#L93-L447), [activities.spec.js](file:///Users/moeini/Dev/didar/packages/e2e/test/activities.spec.js#L128-L634))
* **Diagnosis:** Every spec relies on `{ waitUntil: 'networkidle' }` and dozens of fixed `page.waitForTimeout(...)` sleeps (`300ms`–`3000ms`), alongside `networkLogs.find(...)` (in `deal-detail.spec.js` lines 228, 276, 324, 377, 387, which returns the first match rather than the triggered request) instead of `Promise.all([page.waitForResponse(...), action])` and Playwright web-first assertions (`expect(locator).toBeVisible()`).
* **Fix:** Replace `waitForTimeout` and `networkLogs.find` with `waitForResponse` paired with the triggering action and Playwright auto-retrying assertions.

### M12. `packages/e2e/scenarios/*.js` & `test/*.spec.js` — Zero Database Cleanup (Pollutes Target DBs & Sends Live SMS)
* **Files:** [03-kanban-create-and-dnd.js](file:///Users/moeini/Dev/didar/packages/e2e/scenarios/03-kanban-create-and-dnd.js#L38-L63), [04-deal-detail-stream-and-rotten-reset.js](file:///Users/moeini/Dev/didar/packages/e2e/scenarios/04-deal-detail-stream-and-rotten-reset.js#L36-L45), [05-contacts-and-accounts.js](file:///Users/moeini/Dev/didar/packages/e2e/scenarios/05-contacts-and-accounts.js#L39-L43), [06-activities-and-jalali-calendar.js](file:///Users/moeini/Dev/didar/packages/e2e/scenarios/06-activities-and-jalali-calendar.js#L37-L58), and all mutating `.spec.js` files ([kanban-dnd.spec.js](file:///Users/moeini/Dev/didar/packages/e2e/test/kanban-dnd.spec.js), [deal-detail.spec.js](file:///Users/moeini/Dev/didar/packages/e2e/test/deal-detail.spec.js), [contacts-accounts.spec.js](file:///Users/moeini/Dev/didar/packages/e2e/test/contacts-accounts.spec.js), [activities.spec.js](file:///Users/moeini/Dev/didar/packages/e2e/test/activities.spec.js), [leads.spec.js](file:///Users/moeini/Dev/didar/packages/e2e/test/leads.spec.js), [settings.spec.js](file:///Users/moeini/Dev/didar/packages/e2e/test/settings.spec.js))
* **Diagnosis:** Created Opportunities, Notes, Contacts, Accounts, Tasks, Calls, Meetings, Leads (plus 1-Click Convert creating linked records), Products, Goals, and SMS Templates are never deleted in `finally` blocks, and existing records are mutated in place (cards moved/lost, checkboxes toggled). `leads.spec.js` Scenario 4 calls `POST /BidarSms/send` on a real lead phone number.
* **Fix:** Track all created entity IDs and issue `DELETE /api/v1/{Entity}/{id}` in `finally`; create dedicated disposable records before mutating/converting them; mock or guard `POST /BidarSms/send` in non-isolated environments.

### M13. `packages/e2e/test/dashboard-reports.spec.js` — Guaranteed 10-Second Timeout Hang on CSV Download
* **File:** [dashboard-reports.spec.js](file:///Users/moeini/Dev/didar/packages/e2e/test/dashboard-reports.spec.js#L458-L462)
* **Diagnosis:** `Promise.all([page.waitForEvent('download', { timeout: 10000 }).catch(() => null), context.waitForEvent('download', { timeout: 10000 }).catch(() => null), exportBtn.click()])` waits for `context.waitForEvent('download')`, but in Playwright `'download'` is emitted on `Page`, not `BrowserContext`, causing a mandatory 10-second stall on every run.
* **Fix:** Remove `context.waitForEvent('download', ...)` and await `[page.waitForEvent('download', { timeout: 10000 }), exportBtn.click()]`.

### M14. `packages/e2e/package.json` — `.spec.js` Browser Tests Excluded from All NPM Scripts
* **File:** [package.json](file:///Users/moeini/Dev/didar/packages/e2e/package.json#L7-L15)
* **Diagnosis:** `test`, `test:e2e`, and `test:all` only run `node --test test/*.test.js` (`core.test.js` and `e2e-simulation.test.js`). None of the 9 Playwright `.spec.js` files are wired into any script or unified `@playwright/test` runner.
* **Fix:** Add `@playwright/test` configuration or a `test:browser` runner script executing all `.spec.js` files and failing on any red dossier.

### M15. `packages/e2e/test/*.spec.js` — Swallowed Fatal Setup Errors & Hardcoded Root-Cause Dossiers
* **Files:** [classic-crm.spec.js](file:///Users/moeini/Dev/didar/packages/e2e/test/classic-crm.spec.js#L194-L210), [global-features.spec.js](file:///Users/moeini/Dev/didar/packages/e2e/test/global-features.spec.js#L320-L336), [kanban-dnd.spec.js](file:///Users/moeini/Dev/didar/packages/e2e/test/kanban-dnd.spec.js#L418-L434), [deal-detail.spec.js](file:///Users/moeini/Dev/didar/packages/e2e/test/deal-detail.spec.js#L456-L474), [contacts-accounts.spec.js](file:///Users/moeini/Dev/didar/packages/e2e/test/contacts-accounts.spec.js#L731-L749), [activities.spec.js](file:///Users/moeini/Dev/didar/packages/e2e/test/activities.spec.js#L669-L687), [leads.spec.js](file:///Users/moeini/Dev/didar/packages/e2e/test/leads.spec.js#L546-L563), [dashboard-reports.spec.js](file:///Users/moeini/Dev/didar/packages/e2e/test/dashboard-reports.spec.js#L526-L543), [settings.spec.js](file:///Users/moeini/Dev/didar/packages/e2e/test/settings.spec.js#L704-L723)
* **Diagnosis:** Outer `try/catch` blocks swallow fatal setup/navigation errors (`page.goto` / login crashes) and return `testResults` with `bugDossier: null`. Meanwhile, several step `catch` blocks emit hardcoded historical `rootCause` strings (e.g., `kanban-dnd.spec.js` lines 241–242, `settings.spec.js` lines 257–259, `leads.spec.js` lines 501–503) regardless of the actual runtime error.
* **Fix:** Propagate or record fatal setup errors explicitly in the returned summary, and record actual `err.message`, HTTP status, and response payload rather than static root-cause prose.

### M16. `packages/e2e/scenarios/*.js` — Missing Request Timeouts & Duplicate Auth Headers
* **Files:** [01-health-and-login.js](file:///Users/moeini/Dev/didar/packages/e2e/scenarios/01-health-and-login.js#L27-L34), [02-dashboard-and-navigation.js](file:///Users/moeini/Dev/didar/packages/e2e/scenarios/02-dashboard-and-navigation.js#L16-L27) (and `03`–`06`)
* **Diagnosis:** `fetch()` calls have no `AbortSignal.timeout(config.timeoutMs)`, so hung requests stall indefinitely. Scenarios `02`–`06` send both `Espo-Authorization` and `Authorization: Bearer ${state.token}` (which can conflict with Apache/EspoCRM Basic/HMAC parsers).
* **Fix:** Pass `signal: AbortSignal.timeout(timeoutMs)` from `monitor.config.js` and standardize on EspoCRM's `Espo-Authorization` + `Espo-Authorization-By-Token: true`.

---

## 3. MINOR Findings

1. **`APP_VERSION` `grep -o` fragility & inconsistent defaults** — [build-release.sh](file:///Users/moeini/Dev/didar/scripts/build-release.sh#L20-L22) defaults to `"1.0.0"`, while [clean-install-smoke.sh](file:///Users/moeini/Dev/didar/tests/installer/clean-install-smoke.sh#L14-L16) and [verify-zip-structure.sh](file:///Users/moeini/Dev/didar/tests/installer/verify-zip-structure.sh#L12-L14) default to `"1.0.4"`. All three use `grep -o '"version": "[^"]*"'`, which breaks if multiple `"version"` keys appear in `package.json`. Add `| head -n 1` or parse via `node -p`/`php -r`.
2. **Subdirectory hosting assumptions in `deploy/htaccess.template`** — [htaccess.template](file:///Users/moeini/Dev/didar/deploy/htaccess.template#L13-L68) hardcodes `RewriteBase /`, `%{REQUEST_URI} ^/api/v1/`, and `%{DOCUMENT_ROOT}/public/...`, which breaks if deployed in a subfolder (`/crm/`).
3. **`scripts/export-static-html.mjs` `alert()` & hardcoded `۱۴۰۵` dates** — [export-static-html.mjs](file:///Users/moeini/Dev/didar/scripts/export-static-html.mjs#L199-L684) hardcodes `۱۴۰۵` across cards and uses `alert(...)` on line 455.
4. **`packages/e2e/monitor.config.js` & `docker-compose.yml` config drift** — [monitor.config.js](file:///Users/moeini/Dev/didar/packages/e2e/monitor.config.js#L13-L31) defaults `local.baseUrl` to `http://localhost:8080` (while `test/*.spec.js` default to `http://localhost:8089/app/`), declares unused `dotenv` in [package.json](file:///Users/moeini/Dev/didar/packages/e2e/package.json#L18) while using `process.loadEnvFile`, hardcodes `admin`/`admin`, and [packages/e2e/docker-compose.yml](file:///Users/moeini/Dev/didar/packages/e2e/docker-compose.yml#L8-L10) hardcodes `MONITOR_ENV: local` + Linux-centric `network_mode: "host"`.
5. **`packages/e2e/test/classic-crm.spec.js` weak login check** — [classic-crm.spec.js](file:///Users/moeini/Dev/didar/packages/e2e/test/classic-crm.spec.js#L87-L88) asserts `!page.url().includes('login')` after `waitForTimeout(3000)`. EspoCRM classic login does not put `login` in the URL, so a failed login can pass Step 1. Wait for `#navbar` or `#logout` instead.
6. **`packages/e2e/test/activities.spec.js` hardcoded dates & tight DnD timeout** — [activities.spec.js](file:///Users/moeini/Dev/didar/packages/e2e/test/activities.spec.js#L388-L430) hardcodes `'2026-11-28'` and `'2026-11-29'`, and line 610 uses a 3500ms `waitForResponse` timeout that can misclassify slow responses as missing DnD.
7. **`packages/e2e/test/settings.spec.js` unused locator & hardcoded IP** — [settings.spec.js](file:///Users/moeini/Dev/didar/packages/e2e/test/settings.spec.js#L237) hardcodes `'127.0.0.1'`, and lines 628–630 define an unused `titleInput` locator before redefining `initialTitleInput` on line 632.
8. **`tests/installer/clean-install-smoke.sh` suppressed PHP error output** — [clean-install-smoke.sh](file:///Users/moeini/Dev/didar/tests/installer/clean-install-smoke.sh#L452-L561) discards stderr (`2>/dev/null`) on the `Jalalian` autoload test and checks `php -l` via `grep -q "No syntax errors"` instead of exit code.

---

## 4. INFO Findings (Cleanup & Dead Code)

1. **Leftover Local Automation/Review Python Scripts in `scripts/`**
   The following 9 temporary scripts contain hardcoded local paths (`/Users/moeini/...`) and local Electron CDP ports (`9223`, `9226`) and should be deleted or moved out of the repository:
   * [asf_review_phase1.py](file:///Users/moeini/Dev/didar/scripts/asf_review_phase1.py)
   * [run_section_review.py](file:///Users/moeini/Dev/didar/scripts/run_section_review.py)
   * [run_section2_reviews.py](file:///Users/moeini/Dev/didar/scripts/run_section2_reviews.py)
   * [run_section3_reviews.py](file:///Users/moeini/Dev/didar/scripts/run_section3_reviews.py)
   * [run_section4_reviews.py](file:///Users/moeini/Dev/didar/scripts/run_section4_reviews.py)
   * [harvest_reviews.py](file:///Users/moeini/Dev/didar/scripts/harvest_reviews.py)
   * [harvest_section2.py](file:///Users/moeini/Dev/didar/scripts/harvest_section2.py)
   * [harvest_section3.py](file:///Users/moeini/Dev/didar/scripts/harvest_section3.py)
   * [harvest_section4.py](file:///Users/moeini/Dev/didar/scripts/harvest_section4.py)
2. **Orphaned `deploy/admin-entry.php`**
   [admin-entry.php](file:///Users/moeini/Dev/didar/deploy/admin-entry.php#L1-L10) redirects (`302`) to `/admin` but is not referenced or packaged by `build-release.sh`, `dev-setup.sh`, or any server template. Remove it or wire it intentionally if needed.

