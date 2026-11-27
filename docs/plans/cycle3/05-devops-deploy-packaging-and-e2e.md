# Cycle 3 Remediation Plan 05 — DevOps, Deploy Templates, Packaging & E2E (`deploy/`, `docker/`, `scripts/`, `packages/e2e/`)

```yaml
Scope (Allowed Files):
  - deploy/**
  - docker/**
  - docker-compose.dev.yml
  - scripts/build-release.sh
  - tests/**
  - packages/e2e/**
Forbidden Changes:
  - Anything inside extensions/, apps/web/, client/, or scripts/apply-whitelabel.php
  - Root package.json / composer.json / manifest.json versions (must remain 1.0.4)
Prerequisites: None
Estimated Context Size: Small (5 atomic tasks, ~24 KB across 7 files)
Recommended Model Tier: Weak / Fast (Flash, GLM-5.3-Flash, hy4-flash, Haiku)
```

## Global Execution Rules

1. **Read ONLY** the files listed in each task's `Targets`.
2. **Never edit** `scripts/apply-whitelabel.php`, `extensions/`, or `apps/web/`.
3. **Follow strict verify-first:** Step 1 (confirm baseline or failing check) -> Step 2 (apply exact minimal fix) -> Step 3 (run exact lint/unit verification command).
4. **Never change** package versions or delete `dist/` unintentionally.
5. **Escalate immediately** if any `Stop / Escalate If` condition occurs.

---

## T5.1 [P0] Forward Missing VoIP HMAC & Espo Token Headers in Apache & NGINX Templates

- **Severity:** `P0` (Blocker — Production Auth Failure Under Apache/CGI/NGINX FastCGI)
- **Targets:**
  - `deploy/htaccess.template` (lines 31-37)
  - `deploy/public-htaccess.template` (lines 31-37)
  - `deploy/nginx.conf.template` (lines 101-106, 116-121)
- **Root Cause:** `PostVoipWebhook.php:49-50` requires `X-Bidar-Voip-Timestamp` and `X-Bidar-Voip-Signature` headers for HMAC authentication, and `apps/web/` sends `Espo-Authorization-By-Token` and `Espo-Authorization-Create-Token-Secret`, none of which are forwarded/preserved alongside existing headers in the Apache `.htaccess` templates or NGINX FastCGI config.

### Step 1 — Check Current State
Run:
`grep -nE 'HTTP_X_BIDAR_VOIP_TIMESTAMP|HTTP_ESPO_AUTHORIZATION_BY_TOKEN' deploy/htaccess.template deploy/public-htaccess.template deploy/nginx.conf.template || echo "MISSING_HEADERS"`
Expected: `MISSING_HEADERS` (RED check confirms headers are missing).

### Step 2 — Minimal Fix
1. In BOTH `deploy/htaccess.template` (after line 36) AND `deploy/public-htaccess.template` (after line 36), append:
   ```apache
   RewriteRule .* - [E=HTTP_ESPO_AUTHORIZATION_BY_TOKEN:%{HTTP:Espo-Authorization-By-Token}]
   RewriteRule .* - [E=HTTP_ESPO_AUTHORIZATION_CREATE_TOKEN_SECRET:%{HTTP:Espo-Authorization-Create-Token-Secret}]
   RewriteRule .* - [E=HTTP_X_BIDAR_VOIP_TIMESTAMP:%{HTTP:X-Bidar-Voip-Timestamp}]
   RewriteRule .* - [E=HTTP_X_BIDAR_VOIP_SIGNATURE:%{HTTP:X-Bidar-Voip-Signature}]
   ```
2. In `deploy/nginx.conf.template` inside BOTH `location = /oauth-callback.php` (after line 105) AND the main PHP FastCGI block (after line 120), add:
   ```nginx
   fastcgi_param HTTP_ESPO_AUTHORIZATION_BY_TOKEN $http_espo_authorization_by_token;
   fastcgi_param HTTP_ESPO_AUTHORIZATION_CREATE_TOKEN_SECRET $http_espo_authorization_create_token_secret;
   fastcgi_param HTTP_X_BIDAR_VOIP_TIMESTAMP $http_x_bidar_voip_timestamp;
   fastcgi_param HTTP_X_BIDAR_VOIP_SIGNATURE $http_x_bidar_voip_signature;
   ```

### Step 3 — Verify GREEN
Run:
`grep -cE 'HTTP_X_BIDAR_VOIP_TIMESTAMP|HTTP_X_BIDAR_VOIP_SIGNATURE|HTTP_ESPO_AUTHORIZATION_BY_TOKEN|HTTP_ESPO_AUTHORIZATION_CREATE_TOKEN_SECRET' deploy/htaccess.template deploy/public-htaccess.template deploy/nginx.conf.template`
Expected: `deploy/htaccess.template:4`, `deploy/public-htaccess.template:4`, `deploy/nginx.conf.template:8`.

### Stop / Escalate If
- Existing Apache/NGINX lines differ from expected line numbers.

---

## T5.2 [P1] Tighten NGINX `/app/lead-capture` Prefix Bleed & Apache Private-Dir / Sensitive Extension Rules

- **Severity:** `P1` (Major — Security Header Bypass & File Exposure)
- **Targets:**
  - `deploy/nginx.conf.template` (lines 20-36)
  - `deploy/htaccess.template` (lines 24, 28)
  - `deploy/public-htaccess.template` (line 29)
- **Root Cause:**
  1. `deploy/nginx.conf.template:30` uses `location ^~ /app/lead-capture` (no trailing slash/anchor), so `/app/lead-capture-anything` inherits `frame-ancestors *` without `X-Frame-Options: SAMEORIGIN`.
  2. `deploy/htaccess.template:24` requires trailing `/` (`^(...|apps)/`), so requests to bare directory paths without `/` may trigger Apache `301` directory listing leaks instead of immediate `403`. Both `.htaccess` templates and NGINX omit `sqlite|db|orig|dist` extensions.

### Step 1 — Check Current State
Inspect lines 20-37 of `deploy/nginx.conf.template` and lines 23-30 of `deploy/htaccess.template`.

### Step 2 — Minimal Fix
1. In `deploy/nginx.conf.template`: replace `location ^~ /app/lead-capture {` (lines 30-36) with exact `location = /app/lead-capture` AND `location ^~ /app/lead-capture/` (or handle both `/lead-capture` and `/app/lead-capture` cleanly without matching `/app/lead-capture-evil`). Also include `sqlite|db|orig|dist` in line 54 regex.
2. In `deploy/htaccess.template`:
   - Line 24: replace `^(application|data|custom|vendor|logs|engine|packages|extensions|scripts|config|tests|docs|build|dist|docker|deploy|apps)/` with `^(application|data|custom|vendor|logs|engine|packages|extensions|scripts|config|tests|docs|build|dist|docker|deploy|apps)(/|$)`.
   - Line 28 (and `deploy/public-htaccess.template:29`): add `sqlite|db|orig|dist` to `\.(log|sql|bak|swp|env|ini|sh|md|yml|yaml|lock)$`.

### Step 3 — Verify GREEN
Confirm `clean-install-smoke.sh` Apache checks still match (if `tests/installer/clean-install-smoke.sh` checks exact rule strings, read `tests/installer/clean-install-smoke.sh` first!). If `nginx -t` is available in environment, validate syntax cleanly; otherwise verify pattern syntax manually.

### Stop / Escalate If
- Changing line 24 of `deploy/htaccess.template` causes `tests/installer/clean-install-smoke.sh` to fail an assertion.

---

## T5.3 [P1] Fix `deploy/Dockerfile` Ignoring `APACHE_DOCUMENT_ROOT`

- **Severity:** `P1` (Major — Misconfigured Production Container DocumentRoot)
- **Targets:**
  - `deploy/Dockerfile` (lines 1-20)
  - `deploy/docker-compose.yml` (lines 10-14)
- **Root Cause:** `deploy/docker-compose.yml:11` passes `APACHE_DOCUMENT_ROOT: /var/www/html`, whereas `deploy/Dockerfile` never updates `/etc/apache2/sites-available/*.conf` or `apache2.conf` with `${APACHE_DOCUMENT_ROOT}` (unlike `docker/Dockerfile.dev`), so changing `APACHE_DOCUMENT_ROOT` to `/var/www/html/public` has zero effect.

### Step 1 — Check Current State
Read `docker/Dockerfile.dev` and confirm how it configures `APACHE_DOCUMENT_ROOT`.

### Step 2 — Minimal Fix
In `deploy/Dockerfile` (before `WORKDIR /var/www/html`):
```dockerfile
ENV APACHE_DOCUMENT_ROOT=/var/www/html
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' \
    /etc/apache2/sites-available/*.conf \
    /etc/apache2/apache2.conf \
    /etc/apache2/conf-available/*.conf
```
And in `deploy/docker-compose.yml`, add a brief comment above `volumes:` noting that `./source` must hold the extracted `dist/bidar-crm-v<version>.zip` bundle.

### Step 3 — Verify GREEN
Inspect `deploy/Dockerfile` diff; if Docker daemon is running and `docker compose -f deploy/docker-compose.yml config` succeeds, run `docker compose -f deploy/docker-compose.yml config -q` to validate YAML syntax.

### Stop / Escalate If
- `docker compose -f deploy/docker-compose.yml config -q` reports YAML error.

---

## T5.4 [P1] Harden `scripts/build-release.sh` Fail-Closed Checks & Unified Cleanup Trap

- **Severity:** `P1` (Major — Silent Broken Release Bundle Risk)
- **Targets:**
  - `scripts/build-release.sh` (lines 149-199, 221-348)
- **Root Cause:**
  1. Line 186 silently creates empty placeholder modules if any of `bidar-sales`/`bidar-iran`/`bidar-brand`/`bidar-theme` directories are missing instead of failing.
  2. Line 222 silently skips Jalali/Carbon/Assert bundling if `vendor/morilog/jalali` is missing instead of running `die`.
  3. Line 159 clears `trap - EXIT`, leaving `AUTOLOAD_PATCHER` (line 282) without an `EXIT` cleanup trap if interrupted mid-patch.

### Step 1 — Check Current State
Run `bash -n scripts/build-release.sh` -> confirm clean baseline syntax.

### Step 2 — Minimal Fix
In `scripts/build-release.sh`:
1. Add global cleanup helper at top (`TMP_UNPACK=""`, `AUTOLOAD_PATCHER=""`, `cleanup() { rm -rf "${TMP_UNPACK:-}" "${AUTOLOAD_PATCHER:-}"; }`, `trap cleanup EXIT`). Remove `trap - EXIT` at line 159.
2. Replace `else` placeholder block at lines 186-198 with `die "Required extension directory missing: ${src_mod}"`.
3. Replace `if [[ -d "${ROOT_DIR}/vendor/morilog/jalali" ]]; then` (line 222) with explicit `[[ -d "${ROOT_DIR}/vendor/morilog/jalali" ]] || die "vendor/morilog/jalali missing; run composer install first"`.

### Step 3 — Verify GREEN
Run: `bash -n scripts/build-release.sh`
Expected: exit code `0`.

### Stop / Escalate If
- Running `clean-install-smoke.sh` (if tested) fails because a test relies on placeholder modules (unlikely — all 4 modules exist in `extensions/`).

---

## T5.5 [P2] Guard `packages/e2e/lib/test-helpers.js` `recordFatalError` & Auto-Track Converted Lead Entities

- **Severity:** `P2` (Minor — E2E Stability & Test Data Hygiene)
- **Targets:**
  - `packages/e2e/lib/test-helpers.js` (lines 106-127, 168-180)
  - `packages/e2e/test/*.test.js` (add/update unit check for `test-helpers.js`)
- **Root Cause:**
  1. `recordFatalError` assumes `testResults` has `.auth`, `.classicLoginPage`, or a non-empty first value; if `testResults` is empty or invalid, assigning `result.passed = false` throws a `TypeError` hiding the original error.
  2. `cleanupEntities`'s `trackResponse` only matches `/api/v1/<Entity>` POSTs, missing `POST /api/v1/Lead/action/convert` which returns `{ opportunityId, contactId, accountId }`, leaving orphaned converted records in the DB after `leads.spec.js` or `deal-detail.spec.js`.

### Step 1 — RED Test
Add unit tests (e.g. in `packages/e2e/test/test-helpers.test.js` or an existing `packages/e2e/test/*.test.js` file) testing:
1. `recordFatalError({}, new Error('boom'))` does NOT throw and initializes `testResults._fatal.passed === false`.
2. `cleanup.trackResponse` with URL `/api/v1/Lead/action/convert` returning `{ opportunityId: 'o1', contactId: 'c1', accountId: 'a1' }` tracks all three IDs for `DELETE` cleanup.
Run: `npm --prefix packages/e2e run test:all` -> **Confirm FAIL (RED)**.

### Step 2 — Minimal Fix
In `packages/e2e/lib/test-helpers.js`:
1. Lines 168-171 (`recordFatalError`):
   ```js
   let result = testResults.auth || testResults.classicLoginPage || Object.values(testResults)[0];
   if (!result || typeof result !== 'object') {
     testResults._fatal = { passed: false };
     result = testResults._fatal;
   }
   ```
2. In `trackResponse` (lines 117-122):
   - If `url.pathname === '/api/v1/Lead/action/convert'` and `response.status() >= 200 && response.status() < 300`, read `response.json()` and call `trackId('Opportunity', body?.opportunityId)`, `trackId('Contact', body?.contactId)`, `trackId('Account', body?.accountId)`.

### Step 3 — Verify GREEN & Final Verification
Run full Section 5 verification:
`bash -n scripts/build-release.sh scripts/dev-setup.sh tests/installer/clean-install-smoke.sh tests/installer/verify-zip-structure.sh && node --check packages/e2e/lib/test-helpers.js packages/e2e/index.js packages/e2e/bin/run-browser-tests.js && npm --prefix packages/e2e run test:all`
Expected: all syntax checks pass (`0`), all `packages/e2e` unit tests pass (`0` failures).

### Stop / Escalate If
- `npm --prefix packages/e2e run test:all` glob does not pick up a newly named `*.test.js` file unless matched by `test/*.test.js` (check `packages/e2e/package.json`).
