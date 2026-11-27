# Cycle 2 Final Post-Implementation Review — Section 5: Deploy, Docker, Scripts, Installer Tests & E2E

**Scope:** `deploy/`, `docker/`, `docker-compose.dev.yml`, `scripts/` (excluding `scripts/apply-whitelabel.php`), `tests/`, and `packages/e2e/` in `/Users/moeini/Dev/didar`.  
**Primary Plan:** [cycle2-section-5-plan.md](file:///Users/moeini/Dev/didar/docs/reviews/cycle2-section-5-plan.md)  
**Pass 2 Adjustments:** [cycle2-section-5-pass2-qoder.md](file:///Users/moeini/Dev/didar/docs/reviews/cycle2-section-5-pass2-qoder.md)

---

## Review Verdict: `APPROVE` (via `agy-review`; `qoder-review` timed out at 90s on CDP)

- **`agy-review` (Pass 1 post-implementation):** `CHANGES REQUESTED` — identified 1 Blocker (`deploy/htaccess.template` `/app/*` static asset `public/app$1` check), 2 Majors (`tests/installer/clean-install-smoke.sh` `^admin(/.*)?$` parity; `kanban-dnd.spec.js` / `deal-detail.spec.js` outer `catch` & dynamic `rootCauseAnalysis`), and 3 Minors (`deploy/nginx.conf.template` `location ^~ /app/lead-capture`, `deal-detail.spec.js` Step 7 `Promise.all` conversion, `classic-crm.spec.js` dossier URLs).
- **Remediation & `agy-review` (Pass 2 post-implementation):** **`APPROVE`** — all 1 Blocker, 2 Majors, and 3 Minors verified resolved with zero new regressions.
- **`qoder-review` (90s bounded attempt under `/tmp/asf-qoder-cdp.lock`):** Timed out after 90s (`QODER_TIMEOUT_90S` due to Qoder CDP `bridge_helper.mjs` hang).

---

## Resolution Summary (All P0 / P1 / P2 & Pass 2 Items)

1. **Docker & Compose (`docker/Dockerfile.dev`, `docker/php.ini`, `docker-compose.dev.yml`, `deploy/Dockerfile`, `deploy/php.ini`, `deploy/docker-compose.yml`):**
   - `docker/Dockerfile.dev` enables `AllowOverride All` on `<Directory /var/www/>` and preserves `${APACHE_DOCUMENT_ROOT}` for runtime expansion (`/var/www/html/engine` in `docker-compose.dev.yml`); `docker/php.ini` sets PHP dev limits (`512M`, `50M`, `180s`, `expose_php = Off`).
   - `deploy/docker-compose.yml` is self-contained and multi-arch via `deploy/Dockerfile` (`php:8.3-apache`), `mariadb:11.4` (pinned, `127.0.0.1:3316:3306`, `healthcheck.sh --connect --innodb_initialized`), and `phpmyadmin:5.2-apache`, removing `arm64v8/*`, `shared_net`, and `./mysql/log`.

2. **Web Server Templates (`deploy/htaccess.template`, `deploy/public-htaccess.template`, `deploy/nginx.conf.template`):**
   - Security headers (`X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options: SAMEORIGIN` with `/lead-capture` exemption), `Options -Indexes` (without `+FollowSymLinks`), dotfile & sensitive file blocking (preserving `.well-known` and non-sensitive `.json`), and internal directory blocks.
   - `deploy/htaccess.template` checks `%{DOCUMENT_ROOT}/public/app$1 -f` before falling back to `public/app/index.html`, and never references `public/client/`.
   - `deploy/public-htaccess.template` passes `/client/` through (`RewriteRule ^client/ - [L]`) and documents `Alias /client/`.
   - `deploy/nginx.conf.template` uses `location ^~ /app/lead-capture`, repeats security headers with `frame-ancestors *;`, serves `/app/index.html` directly via `try_files /app/index.html =404;`, anchors `/admin`, allowlists only valid `public/` `.php` entrypoints, and uses `fastcgi_pass unix:/run/php/php8.3-fpm.sock;`.

3. **Scripts & Installer Tests (`scripts/seed-sample-data.php`, `scripts/build-release.sh`, `scripts/dev-setup.sh`, `tests/installer/*.sh`):**
   - `scripts/seed-sample-data.php` enforces fail-closed `PHP_SAPI !== 'cli'` (`403`).
   - `scripts/build-release.sh` uses portable `run_with_timeout`, `curl --max-time 180`, optional SHA-256 + `unzip -tq`, hard fails on missing `apps/web/dist`, registers `Assert\\` (`beberlei/assert/lib/Assert`) + helper requires in `vendor/morilog/autoload.php`, verifies `vendor/autoload.php` patching, preserves existing `nesbot/carbon`, and tightens `zip -x` without creating `public/client` symlinks.
   - `scripts/dev-setup.sh` uses relative symlinks and copies both `.htaccess` templates.
   - `tests/installer/clean-install-smoke.sh` traps `EXIT` only, uses exit-code-based `php -l` checks, and accepts both `^admin/?(.*)$` and `^admin(/.*)?$` rewrite rules.
   - `tests/installer/verify-zip-structure.sh` uses `unzip -Z1` with anchored regexes.
   - Deleted orphaned `deploy/admin-entry.php`, `scripts/asf_review_phase1.py`, and all 8 scratch `scripts/harvest_*.py` / `scripts/run_section*.py` files.

4. **UI-Level & Static HTML Export (`scripts/export-static-html.mjs`, `tests/ui-level/manifest.json`, `tests/ui-level/run-ui-checks.mjs`):**
   - Fixed `font-mono` typo and removed `alert()`, centralized `SNAPSHOT_YEAR`, regenerated CDN-free `tests/ui-level/refs/*.html` deterministically.
   - Switched `run-ui-checks.mjs` to `execFileSync`, added `BASE_URL` override, omitted unsupported `--delta-e` CLI flag, updated `kanban` target to `/app/kanban`, and added `leads`, `reports`, and `settings` screens to `manifest.json`.

5. **E2E Package (`packages/e2e/`):**
   - Updated `Dockerfile` to `mcr.microsoft.com/playwright:v1.50.0-noble`, `docker-compose.yml` to `${MONITOR_ENV:-local}` + `extra_hosts`, and `monitor.config.js` default to `http://localhost:8089`.
   - Removed all fake fallback IDs/tokens in `scenarios/01..06`, added `AbortSignal.timeout`, dynamic stages/dates, `DELETE` cleanup in `index.js` `finally`, shared `lib/test-helpers.js`, `bin/run-browser-tests.js` (`test:browser`), live SMS route guard in `leads.spec.js`, and dynamic error/cleanup handling across all 9 `.spec.js` files.

---

## Verification Summary

| Check | Command | Result |
|---|---|---|
| Shell syntax | `bash -n scripts/build-release.sh scripts/dev-setup.sh tests/installer/clean-install-smoke.sh tests/installer/verify-zip-structure.sh` | **PASS** |
| PHP syntax | `php -l scripts/seed-sample-data.php` | **PASS** |
| JS syntax | `node --check` on `scripts/export-static-html.mjs`, `tests/ui-level/run-ui-checks.mjs`, `packages/e2e/{index,monitor.config,bin/*.js,lib/*.js,scenarios/*.js,test/*.js}` | **PASS** |
| E2E unit & offline simulation | `npm --prefix packages/e2e run test:all` | **PASS** (`7/7` tests) |
| UI-level dry-run | `node tests/ui-level/run-ui-checks.mjs --dry-run` | **PASS** (`11/11` screens) |
| ZIP structure check | `bash tests/installer/verify-zip-structure.sh dist/bidar-crm-v1.0.4.zip` | **PASS** |
| Clean-install smoke test | `bash tests/installer/clean-install-smoke.sh dist/bidar-crm-v1.0.4.zip` | **PASS** (`0` errors) |
| Live Docker / Playwright / NGINX runtime | — | **Not run** (offline/static verification only) |
