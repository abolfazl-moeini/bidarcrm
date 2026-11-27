# Cycle 2 Remediation Plan — Section 5: Deploy, Docker, Scripts, Installer Tests & E2E

**Scope:** `deploy/`, `docker/`, `docker-compose.dev.yml`, `scripts/` (excluding `scripts/apply-whitelabel.php`), `tests/`, and `packages/e2e/` in `/Users/moeini/Dev/didar`.  
**Source:** [cycle2-section-5-pass1-agy.md](file:///Users/moeini/Dev/didar/docs/reviews/cycle2-section-5-pass1-agy.md)

---

## 1. Priority Remediation Items

### P0 — Blockers (Security, Broken Containers, Broken Routing & Masked Failures)

1. **[B1] Fix `docker/Dockerfile.dev` `AllowOverride All` & Literal `${APACHE_DOCUMENT_ROOT}`**
   - **File:** `docker/Dockerfile.dev`
   - **Action:**
     - Use double-quoted `sed` so `${APACHE_DOCUMENT_ROOT}` expands properly instead of writing literal `${APACHE_DOCUMENT_ROOT}` into Apache configs.
     - Run the `<Directory /var/www/>` `AllowOverride None` -> `AllowOverride All` replacement **before** rewriting `/var/www/` to `${APACHE_DOCUMENT_ROOT}`, or match `<Directory ${APACHE_DOCUMENT_ROOT}>` after rewriting.
     - Copy a dev `docker/php.ini` (`memory_limit=512M`, `upload_max_filesize=50M`, `post_max_size=50M`, `max_execution_time=180`, `expose_php=Off`, opcache settings).

2. **[B2] Fix `deploy/docker-compose.yml` Wrong Image, Missing Files & Hardcoded ARM64**
   - **Files:** `deploy/docker-compose.yml`, `deploy/php.ini` (new)
   - **Action:**
     - Replace `arm64v8/wordpress`, `arm64v8/mysql`, and `arm64v8/phpmyadmin` + hardcoded `platform: linux/arm64/v8` with multi-arch `php:8.3-apache` (building via `../docker/Dockerfile.dev` or inline / dedicated `deploy/Dockerfile` installing `pdo_mysql`, `gd`, `zip`, `intl`, `mbstring`, `curl`, `bcmath`, `opcache` and enabling `rewrite headers`), `mariadb:11.4` (pinned), and `phpmyadmin:5.2-apache` (optional profile or standard multi-arch image).
     - Add `deploy/php.ini` with production-safe PHP settings (`expose_php = Off`, `memory_limit = 512M`, `upload_max_filesize = 50M`, `post_max_size = 50M`, `max_execution_time = 180`).
     - Keep `8089:80` mapping (for compatibility with `docs/INSTALL_TLDR.md` and E2E defaults) and bind DB port to `127.0.0.1:3316:3306`.
     - Remove mandatory external `shared_net` dependency (use default compose bridge network), parameterize DB credentials via `${...:-...}` defaults, use `restart: unless-stopped`, and avoid passing password on CLI in `healthcheck` (use `healthcheck.sh --connect --innodb_initialized` on `mariadb:11.4`).

3. **[B3] Fix `deploy/public-htaccess.template` Missing `/client/` Pass-Through & Security Rules**
   - **File:** `deploy/public-htaccess.template`
   - **Action:**
     - Add `Options -Indexes` and `Options +FollowSymLinks`.
     - Add security headers (`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`) and `X-Frame-Options: SAMEORIGIN` (exempting `/lead-capture` which is designed for external `<iframe>` embed, or setting `CSP frame-ancestors`).
     - Block dotfiles (`(^|/)\.` except `.well-known`) and sensitive extensions (`\.(log|sql|bak|swp|env|ini|sh|md|yml|yaml|lock|json)$`).
     - Handle `/app` (without trailing slash) cleanly so `^app(/.*)?$` routes to `app/index.html` when not a file.
     - Add rule/handling for `/client/` (and ensure `build-release.sh` or documentation handles `public/client` symlink or Apache `Alias /client` when `DocumentRoot = public/`). Specifically: in `public-htaccess.template`, do not hijack `/client/` to `app/index.html` if `public/client` symlink/alias exists, and document/create safe `public/client` handling or return 404/pass-through cleanly. Wait — verify whether symlink `public/client -> ../client` in zip works on shared hosting or if `Alias` is safer; let's check during Pass 2 / implementation (`public/client` symlink inside ZIP can break on Windows/some cPanel extractors, whereas `RewriteCond` + documented `Alias /client` in Apache vhost or `client` copy/fallback can be evaluated carefully).

4. **[B4] Fix `deploy/nginx.conf.template` PHP Execution, `if` Pitfall & Broken `php:9000`**
   - **File:** `deploy/nginx.conf.template`
   - **Action:**
     - Add `server_tokens off;` and security headers (`X-Content-Type-Options "nosniff" always`, `Referrer-Policy "strict-origin-when-cross-origin" always`, `Permissions-Policy`, `X-Frame-Options "SAMEORIGIN" always` with exemption for `location = /lead-capture` / `location ^~ /lead-capture`).
     - Block all dotfiles `location ~ /\.(?!well-known)` and sensitive file extensions (`\.(log|sql|bak|swp|env|ini|sh|lock)$`) and internal dirs anywhere in path (`location ~* ^/(application|data|custom|vendor|logs|engine|packages|extensions|scripts|config|tests|docs|build|dist|docker|deploy|apps)/`).
     - Fix `location /admin` -> `location ~ ^/admin(/|$)` (anchored, so it won't match `/admin-entry.php` or `/administrator`).
     - Remove server-level `if ($arg_entryPoint != "")` pitfall; handle `?entryPoint=` safely via `location = /` (`if ($arg_entryPoint != "") { rewrite ^ /index.php last; }`) so `/api/v1/` and `/app/` are never hijacked.
     - Restrict `location ~ \.php$` with `try_files $fastcgi_script_name =404;` (preventing path-info/arbitrary PHP execution in `/app/`, `/client/`, uploads), and add explicit PHP entrypoint allowlist or deny PHP inside `/app/` and `/client/` (`location ^~ /app/ { try_files $uri $uri/ /app/index.html; }` with `~ \.php$ { return 404; }`).
     - Add `fastcgi_pass unix:/run/php/php8.3-fpm.sock;` (or parameterized upstream / comment explaining FPM socket vs `php:9000` container).
     - Add `location /portal/` and `location = /oauth-callback.php` support matching `.htaccess`.

5. **[B5] Enforce CLI-Only Guard in `scripts/seed-sample-data.php`**
   - **File:** `scripts/seed-sample-data.php`
   - **Action:** Replace lines 17–19 (`header('Content-Type: text/plain...')`) with a fail-closed CLI check (`if (PHP_SAPI !== 'cli') { http_response_code(403); exit("Forbidden: CLI execution only.\n"); }`).

6. **[B6] Fix `packages/e2e/Dockerfile` Missing Playwright Browsers**
   - **File:** `packages/e2e/Dockerfile`
   - **Action:** Use `mcr.microsoft.com/playwright:v1.50.0-noble` (matching `"playwright": "^1.50.0"` in `packages/e2e/package.json`) so Chromium and system libraries are present.

7. **[B7] Remove Fake Fallback IDs/Tokens in `packages/e2e/scenarios/*.js` & Fix Auth/Dates**
   - **Files:** `packages/e2e/scenarios/01-health-and-login.js` through `06-activities-and-jalali-calendar.js`, `packages/e2e/index.js`
   - **Action:**
     - Throw immediately if `data.token` (`01`), `createdDeal.id` (`03`), `noteData.id` (`04`), `contactData.id` (`05`), or `taskData.id` (`06`) is missing—no `'simulated-token'`, `'deal-e2e-101'`, `'note-e2e-201'`, `'contact-e2e-301'`, `'task-e2e-401'`.
     - In `03`: use dynamic stage IDs/names discovered from `state.pipeline` (if `stages` array exists, else fetch/fail clearly rather than blindly hardcoding `'stage-1'`/`'stage-2'`). Note: keep compatibility with `test/e2e-simulation.test.js` mock server!
     - In `05`: parse JSON from `GET /api/v1/Contact?maxSize=20&search=09121234567` and assert the created contact appears in `list`.
     - In `06`: compute dynamic future dates in EspoCRM `YYYY-MM-DD HH:mm:ss` format (`dateStart`/`dateDue`/`dateEnd`).
     - Add `AbortSignal.timeout(timeoutMs)` to all `fetch` calls and standardize on `Espo-Authorization` + `Espo-Authorization-By-Token: true` (removing conflicting `Authorization: Bearer`).
     - Add best-effort cleanup (`DELETE`) of created `taskId`, `contactId`, `noteId`, `dealId` at the end of `index.js` / scenarios (or `cleanup()` hook in `index.js` when running against real servers).

---

### P1 — Majors (Web Security, Docker Dev Alignment, Packaging, Smoke Tests, E2E Reliability)

8. **[M1/M2] Harden `deploy/htaccess.template`**
   - **File:** `deploy/htaccess.template`
   - **Action:**
     - Add `Options -Indexes`.
     - Add security headers (`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `X-Frame-Options: SAMEORIGIN` with `lead-capture` exemption).
     - Expand blocked directories: `(application|data|custom|vendor|logs|engine|packages|extensions|scripts|config|tests|docs|build|dist|docker|deploy|apps)/`.
     - Block root CLI/internal PHP scripts (`^(bootstrap|command|cron|daemon|websocket|rebuild|upgrade|clear_cache|extension|preload)\.php$`) and block dotfiles anywhere (`(^|/)\.(?!well-known)`), `*.log`, `*.sql`, `*.bak`.

9. **[M3] Align `docker-compose.dev.yml` with `engine/` DocumentRoot**
   - **Files:** `docker-compose.dev.yml`, `docker/php.ini` (new)
   - **Action:**
     - Keep `.:/var/www/html` mount so repo root files (`extensions/`, `client/`) stay accessible, and set `APACHE_DOCUMENT_ROOT=/var/www/html/engine` (matching `dev-setup.sh`), so `.git`, `scripts`, `config` sit outside web DocumentRoot.
     - Pin `mariadb:11.4` and bind `127.0.0.1:3306:3306`.
     - Remove misleading unused `ESPO_SITE_URL` / `DATABASE_*` env vars (or document them clearly) and mount `./docker/php.ini:/usr/local/etc/php/conf.d/bidar.ini:ro`.

10. **[M4/M5/M6] Harden `scripts/build-release.sh` & `scripts/dev-setup.sh`**
    - **Files:** `scripts/build-release.sh`, `scripts/dev-setup.sh`
    - **Action:**
      - Replace `/usr/bin/timeout` with portable macOS/Linux handling (`curl --max-time 180` natively; `timeout` / `gtimeout` fallback for `unzip`).
      - Add optional/pinned SHA-256 verification if `engine.sha256` exists (or compute/log checksum and fail on corrupt zip via `unzip -tq`).
      - In `build-release.sh`:
        - Fail hard if `apps/web/package.json` or `apps/web/dist` is missing (no silent fallback `index.html`).
        - Clean `${APP_TARGET}` before copying `${WEB_DIR}/dist/.`.
        - Fix `rsync` (no `2>/dev/null`; also exclude `*.test.*`, `phpunit.xml*`, `.git*`, `node_modules`).
        - Register `Assert\\` PSR-4 namespace in `vendor/morilog/autoload.php` (if `beberlei/assert` exists) and assert `vendor/autoload.php` patching actually modified the file (fail build if regex didn't match).
        - Parse `APP_VERSION` safely via `php -r` / `node -p` (fallback `"1.0.4"`).
        - Tighten `zip -x` to exclude `*.log`, `.env*`, `*.bak`, `*.swp`, `phpunit.xml*`, `data/config.php`.
      - In `dev-setup.sh`:
        - Use relative symlinks (`../../../../extensions/...`, `../../../../client/custom/modules/...`, `../../../../../../extensions/bidar-theme/Resources/metadata/themes/Bidar.json`) so symlinks work both on host and inside Docker containers.
        - Copy `deploy/public-htaccess.template` to `engine/public/.htaccess` as well as `deploy/htaccess.template` to `engine/.htaccess`.

11. **[M7/M8] Fix `tests/installer/clean-install-smoke.sh` & `verify-zip-structure.sh`**
    - **Files:** `tests/installer/clean-install-smoke.sh`, `tests/installer/verify-zip-structure.sh`
    - **Action:**
      - `clean-install-smoke.sh`:
        - Trap `EXIT` only (`trap cleanup EXIT`) to prevent double cleanup execution.
        - Fix `php -l` check: capture exit code cleanly (`if LINT_OUTPUT="$(find "${MODULES_DIR}" -type f -name "*.php" -print0 | xargs -0 -n1 php -l 2>&1)"; then ...`) and use exit codes rather than parsing `No syntax errors` strings; remove `2>/dev/null` on `Jalalian` autoload check.
        - Parse `APP_VERSION` cleanly without fragile `grep -o` across whole file.
      - `verify-zip-structure.sh`:
        - Use `unzip -Z1 "${ZIP_FILE}"` instead of human-readable `unzip -l`.
        - Anchor all required & forbidden regexes (`^\.htaccess$`, `^public/\.htaccess$`, `(^|/)\.git(/|$)`, `(^|/)\.env(\.|$)`, `\.log$`, `^data/config\.php$`).
        - Parse `APP_VERSION` cleanly.

12. **[M9/M10] Fix `scripts/export-static-html.mjs`, `tests/ui-level/run-ui-checks.mjs` & `manifest.json`**
    - **Files:** `scripts/export-static-html.mjs`, `tests/ui-level/run-ui-checks.mjs`, `tests/ui-level/manifest.json`
    - **Action:**
      - `export-static-html.mjs`: fix typo `font-mono展开` -> `font-mono` (line 327), remove `alert(...)` (line 455), regenerate all `tests/ui-level/refs/*.html` deterministically (not only missing ones), and update year/dates cleanly.
      - `run-ui-checks.mjs`: replace `execSync` with `execFileSync('node', [UI_LEVEL_CLI, 'daemon', 'start'|'stop'])`, forward `--delta-e` / `colorThresholdDeltaE` if supported or document/pass `colorThresholdDeltaE`, support `BASE_URL` env override when passing `-t` URLs to `ui-level`.
      - `manifest.json`: fix `kanban` URL (`/app/deals` -> `/app/kanban` or keep valid route matching `apps/web/src/App.tsx`), add `leads`, `reports`, and `settings` screen definitions matching `tests/ui-level/refs/{leads,reports,settings}.html`.

13. **[M11/M12/M13/M14/M15/M16] Stabilize `packages/e2e/` Browser Specs, Cleanup, NPM Scripts & Runner**
    - **Files:** `packages/e2e/package.json`, `packages/e2e/monitor.config.js`, `packages/e2e/docker-compose.yml`, `packages/e2e/lib/test-helpers.js` (new), `packages/e2e/test/*.spec.js`
    - **Action:**
      - `packages/e2e/test/dashboard-reports.spec.js`: remove `context.waitForEvent('download', ...)` so CSV download doesn't stall for 10 seconds every run.
      - `packages/e2e/test/classic-crm.spec.js`: replace `!page.url().includes('login')` with waiting for `#navbar` / `#logout` visibility.
      - `packages/e2e/test/activities.spec.js`: replace hardcoded `'2026-11-28'`/`'2026-11-29'` with dynamic future dates, raise DnD `waitForResponse` timeout from `3500` to `8000`.
      - `packages/e2e/test/settings.spec.js`: remove unused `titleInput` locator (lines 628–630).
      - `packages/e2e/test/contacts-accounts.spec.js`: fix Scenario 5 export test to verify the real authenticated blob download (instead of asserting unauthenticated `fetch('/api/v1/BidarExport/Contact')` must NOT return `401`—it SHOULD return `401` when unauthenticated!).
      - Reduce `waitForTimeout(...)` flakiness across all 9 `.spec.js` files by introducing shared helper utilities in `packages/e2e/lib/test-helpers.js` (e.g., `loginToApp`, `waitForVisible`, `triggerAndWaitForResponse`, `cleanupEntities`, `formatFutureDate`) and wrapping `Promise.all([page.waitForResponse(...), action])` instead of stale `networkLogs.find(...)` in `deal-detail.spec.js`.
      - Track created entity IDs from `POST` responses in `.spec.js` files and clean them up (`DELETE /api/v1/{Entity}/{id}`) in `finally` blocks.
      - Fix outer `try/catch` in all `.spec.js` files so fatal setup errors record a failure (`setupError` / mark failed) and never exit `0` silently.
      - Replace hardcoded historical root-cause prose in `catch` blocks with dynamic error details (`err.message`, status, response body).
      - Wire a `test:browser` runner script in `packages/e2e/package.json` and align `monitor.config.js` default `LOCAL_BASE_URL` / remove unused `dotenv` dependency (or actually load via `dotenv`/keep native `loadEnvFile`).
      - Fix `packages/e2e/docker-compose.yml`: remove hardcoded `network_mode: "host"` / `MONITOR_ENV: local` override when `.env` sets it, use `${MONITOR_ENV:-local}`.

---

### P2 — Minors & Cleanup

14. **[INFO-1] Clean Up Leftover Scratch Python Scripts in `scripts/`**
    - **Files:** `scripts/asf_review_phase1.py`, `scripts/harvest_reviews.py`, `scripts/harvest_section2.py`, `scripts/harvest_section3.py`, `scripts/harvest_section4.py`, `scripts/run_section2_reviews.py`, `scripts/run_section3_reviews.py`, `scripts/run_section4_reviews.py`, `scripts/run_section_review.py`
    - **Action:** Delete the 8 untracked temporary section review/harvest scripts (`harvest_*.py`, `run_section*.py`) and remove `scripts/asf_review_phase1.py` (or verify whether anything tracks/imports it before deleting).

15. **[INFO-2] Orphaned `deploy/admin-entry.php`**
    - **Action:** Remove `deploy/admin-entry.php` (not referenced anywhere in docs, templates, or build scripts).

---

## 2. Verification Plan
- `bash -n` on all `.sh` files (`scripts/build-release.sh`, `scripts/dev-setup.sh`, `tests/installer/clean-install-smoke.sh`, `tests/installer/verify-zip-structure.sh`).
- `php -l` on `scripts/seed-sample-data.php`.
- `node --check` on `scripts/export-static-html.mjs`, `tests/ui-level/run-ui-checks.mjs`, and all `.js`/`.spec.js` files in `packages/e2e/`.
- `npm --prefix packages/e2e run test:all` (unit + offline simulation tests).
- `node tests/ui-level/run-ui-checks.mjs --dry-run`.
- `bash tests/installer/verify-zip-structure.sh dist/bidar-crm-v1.0.4.zip` and `bash tests/installer/clean-install-smoke.sh dist/bidar-crm-v1.0.4.zip` (non-destructive verification against existing release zip, without modifying `dist/` or version numbers).
