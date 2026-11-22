#!/usr/bin/env bash
# ==============================================================================
# BidarCRM - Shared Hosting Clean Installation Smoke Test
# Simulates fresh extraction on cPanel / DirectAdmin shared-hosting environment.
# Validates directory structure, zero-node/zero-composer runtime, PHP syntax lint,
# Front-Office SPA assets, Same-Origin routing (.htaccess), and forbidden paths.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

PACKAGE_JSON="${ROOT_DIR}/package.json"
APP_VERSION="1.0.1"
if [[ -f "${PACKAGE_JSON}" ]]; then
    APP_VERSION="$(grep -o '"version": "[^"]*"' "${PACKAGE_JSON}" | cut -d'"' -f4 || echo "1.0.1")"
fi

ZIP_FILE="${1:-${ROOT_DIR}/dist/bidar-crm-v${APP_VERSION}.zip}"

echo "================================================================================"
echo "==> BidarCRM Shared-Hosting Clean Install Smoke Test"
echo "==> Target Bundle: ${ZIP_FILE}"
echo "================================================================================"

if [[ ! -f "${ZIP_FILE}" ]]; then
    echo "ERROR: Release package not found at: ${ZIP_FILE}" >&2
    echo "Run 'bash scripts/build-release.sh' first to create the distribution package." >&2
    exit 1
fi

# ------------------------------------------------------------------------------
# 1. Setup Isolated Temporary Environment (Simulating cPanel public_html)
# ------------------------------------------------------------------------------
SMOKE_DIR="$(mktemp -d -t bidar-smoke-XXXXXX)"
echo "==> Creating isolated hosting directory: ${SMOKE_DIR}"

cleanup() {
    local exit_code=$?
    if [[ -d "${SMOKE_DIR}" ]]; then
        echo "==> [CLEANUP] Removing temporary test environment: ${SMOKE_DIR}"
        rm -rf "${SMOKE_DIR}"
    fi
    exit "${exit_code}"
}
trap cleanup EXIT INT TERM ERR

# ------------------------------------------------------------------------------
# 2. Extract Release Package
# ------------------------------------------------------------------------------
echo "==> Extracting release archive into simulated hosting root..."
unzip -q "${ZIP_FILE}" -d "${SMOKE_DIR}"

ERRORS=0

log_pass() {
    echo "  [PASS] $1"
}

log_fail() {
    echo "  [FAIL] $1" >&2
    ERRORS=$((ERRORS + 1))
}

# ------------------------------------------------------------------------------
# 3. Verify Directory Structure & Zero Runtime Dependencies (No Node / Composer)
# ------------------------------------------------------------------------------
echo "==> Step 1: Validating Directory Structure & Runtime Independence..."

REQUIRED_DIRS=(
    "public"
    "public/api/v1"
    "public/install"
    "public/app"
    "custom/Espo/Modules/BidarSales"
    "custom/Espo/Modules/BidarIran"
    "application"
    "vendor"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [[ -d "${SMOKE_DIR}/${dir}" ]]; then
        log_pass "Required directory present: ${dir}"
    else
        log_fail "Missing required directory: ${dir}"
    fi
done

# Verify vendor/autoload.php exists (Pre-packaged Composer runtime)
if [[ -f "${SMOKE_DIR}/vendor/autoload.php" && -r "${SMOKE_DIR}/vendor/autoload.php" ]]; then
    log_pass "Composer autoloader pre-packaged (vendor/autoload.php exists and is readable; zero composer CLI needed at runtime)"
else
    log_fail "Missing or unreadable vendor/autoload.php (Composer installation would be required)"
fi

# Verify no package.json in public/app (Zero Node.js dependency at runtime)
if [[ ! -f "${SMOKE_DIR}/public/app/package.json" ]]; then
    log_pass "Front-Office app contains no package.json (Pure pre-compiled static assets; zero Node.js needed at runtime)"
else
    log_fail "Forbidden file public/app/package.json found in distribution"
fi

# ------------------------------------------------------------------------------
# 4. Verify PHP Syntax of All Bidar Extension Files
# ------------------------------------------------------------------------------
echo "==> Step 2: Linting PHP Syntax of BidarCRM Modules (custom/Espo/Modules/)..."

MODULES_DIR="${SMOKE_DIR}/custom/Espo/Modules"
if [[ -d "${MODULES_DIR}" ]]; then
    PHP_FILES=()
    while IFS= read -r -d '' file; do
        PHP_FILES+=("${file}")
    done < <(find "${MODULES_DIR}" -type f -name "*.php" -print0)

    PHP_COUNT="${#PHP_FILES[@]}"
    if [[ ${PHP_COUNT} -eq 0 ]]; then
        log_fail "No PHP files found in custom/Espo/Modules"
    else
        echo "    Checking ${PHP_COUNT} PHP module file(s)..."
        # Run php -l on all files
        LINT_OUTPUT="$(find "${MODULES_DIR}" -type f -name "*.php" -exec php -l {} + 2>&1)" || {
            log_fail "PHP syntax lint failed: ${LINT_OUTPUT}"
        }
        if [[ $? -eq 0 && ! "${LINT_OUTPUT}" =~ "Fatal error" && ! "${LINT_OUTPUT}" =~ "Parse error" ]]; then
            log_pass "All ${PHP_COUNT} BidarCRM PHP module files passed syntax check (php -l)"
        else
            log_fail "Syntax errors detected in BidarCRM PHP files: ${LINT_OUTPUT}"
        fi
    fi

    # Verify PSR-4 module paths (no src/ directory)
    if [[ -f "${MODULES_DIR}/BidarSales/Api/GetDashboardSummary.php" ]]; then
        log_pass "BidarSales PSR-4 root path verified (Api/GetDashboardSummary.php exists without src/)"
    else
        log_fail "Missing ${MODULES_DIR}/BidarSales/Api/GetDashboardSummary.php"
    fi

    if [[ -f "${MODULES_DIR}/BidarIran/Api/PostVoipWebhook.php" ]]; then
        log_pass "BidarIran PSR-4 root path verified (Api/PostVoipWebhook.php exists without src/)"
    else
        log_fail "Missing ${MODULES_DIR}/BidarIran/Api/PostVoipWebhook.php"
    fi

    MODULE_SRC_FOUND="$(find "${MODULES_DIR}" -type d -name "src" 2>/dev/null | wc -l | tr -d ' ')"
    if [[ "${MODULE_SRC_FOUND}" -eq 0 ]]; then
        log_pass "Zero legacy src/ directories found inside custom/Espo/Modules"
    else
        log_fail "Found ${MODULE_SRC_FOUND} forbidden legacy src/ directory(ies) in custom/Espo/Modules"
    fi

    # Verify routes.json uses actionClassName (EspoCRM 10.1.4 standard)
    for rfile in "${MODULES_DIR}/BidarSales/Resources/routes.json" "${MODULES_DIR}/BidarIran/Resources/routes.json"; do
        if [[ -f "${rfile}" ]]; then
            if grep -q '"actionClassName"' "${rfile}" && ! grep -q '"action":' "${rfile}"; then
                log_pass "routes.json ($(basename "$(dirname "$(dirname "${rfile}")")")) uses 'actionClassName'"
            else
                log_fail "routes.json (${rfile}) must use 'actionClassName' instead of legacy 'action'"
            fi
        fi
    done
else
    log_fail "Modules directory ${MODULES_DIR} does not exist"
fi

# ------------------------------------------------------------------------------
# 5. Verify Front-Office React SPA Files & Bundled Assets
# ------------------------------------------------------------------------------
echo "==> Step 3: Validating Front-Office React SPA Assets..."

SPA_INDEX="${SMOKE_DIR}/public/app/index.html"
if [[ -f "${SPA_INDEX}" && -r "${SPA_INDEX}" && -s "${SPA_INDEX}" ]]; then
    log_pass "Front-Office SPA entrypoint exists and is non-empty: public/app/index.html"
    if grep -qE "(id=\"root\"|<script)" "${SPA_INDEX}"; then
        log_pass "public/app/index.html contains valid SPA mount container / scripts"
    else
        log_fail "public/app/index.html lacks standard SPA elements"
    fi
else
    log_fail "Missing or unreadable public/app/index.html"
fi

# Check for bundled JS and CSS assets
JS_ASSETS="$(find "${SMOKE_DIR}/public/app" -type f -name "*.js" 2>/dev/null | wc -l | tr -d ' ')"
CSS_ASSETS="$(find "${SMOKE_DIR}/public/app" -type f -name "*.css" 2>/dev/null | wc -l | tr -d ' ')"

if [[ ${JS_ASSETS} -gt 0 ]]; then
    log_pass "Found ${JS_ASSETS} bundled JavaScript asset(s) in public/app"
else
    log_fail "No JavaScript bundle found in public/app"
fi

if [[ ${CSS_ASSETS} -gt 0 ]]; then
    log_pass "Found ${CSS_ASSETS} bundled CSS stylesheet(s) in public/app"
else
    log_fail "No CSS stylesheet found in public/app"
fi

# Verify all assets are readable
ASSET_READ_FAIL=0
while IFS= read -r -d '' asset_file; do
    if [[ ! -r "${asset_file}" || ! -s "${asset_file}" ]]; then
        ASSET_READ_FAIL=$((ASSET_READ_FAIL + 1))
    fi
done < <(find "${SMOKE_DIR}/public/app" -type f \( -name "*.js" -o -name "*.css" \) -print0)

if [[ ${ASSET_READ_FAIL} -eq 0 ]]; then
    log_pass "All Front-Office bundled assets are non-empty and readable"
else
    log_fail "${ASSET_READ_FAIL} bundled asset(s) are empty or unreadable"
fi

# Verify compiled Tailwind CSS (no raw directives, substantial size > 5KB)
UNCOMPILED_TAILWIND="$(grep -n "@tailwind" "${SMOKE_DIR}"/public/app/assets/*.css 2>/dev/null || true)"
if [[ -z "${UNCOMPILED_TAILWIND}" ]]; then
    log_pass "Compiled CSS contains zero raw @tailwind directives"
else
    log_fail "Compiled CSS contains uncompiled @tailwind directives: ${UNCOMPILED_TAILWIND}"
fi

FIRST_CSS_FILE="$(find "${SMOKE_DIR}/public/app" -type f -name "*.css" | head -n 1 || true)"
if [[ -n "${FIRST_CSS_FILE}" && -f "${FIRST_CSS_FILE}" ]]; then
    CSS_SIZE="$(wc -c < "${FIRST_CSS_FILE}" | tr -d ' ')"
    if [[ ${CSS_SIZE} -gt 5000 ]]; then
        log_pass "Compiled CSS stylesheet size is substantial (${CSS_SIZE} bytes > 5KB)"
    else
        log_fail "Compiled CSS stylesheet size is too small (${CSS_SIZE} bytes <= 5KB; suspected uncompiled styles)"
    fi
else
    log_fail "Could not find any CSS stylesheet to check size"
fi

# ------------------------------------------------------------------------------
# 6. Verify Same-Origin Routing Rules in .htaccess and public/.htaccess
# ------------------------------------------------------------------------------
echo "==> Step 4: Validating Same-Origin Routing (.htaccess & public/.htaccess)..."

ROOT_HTACCESS="${SMOKE_DIR}/.htaccess"
if [[ -f "${ROOT_HTACCESS}" && -r "${ROOT_HTACCESS}" ]]; then
    log_pass "Root .htaccess exists and is readable"

    ROOT_RULES=(
        "RewriteEngine On"
        "E=HTTP_AUTHORIZATION:%{HTTP:Authorization}"
        "E=HTTP_X_BIDAR_VOIP_SECRET:%{HTTP:X-Bidar-Voip-Secret}"
        "E=HTTP_X_VOIP_TOKEN:%{HTTP:X-Voip-Token}"
        "RewriteRule ^api/v1/(.*)$ public/api/v1/index.php"
        "RewriteRule ^admin/?(.*)$ public/index.php"
        "RewriteRule ^client/ - [L]"
        "public/app/index.html"
        "(application|data|custom|vendor|logs"
    )

    for rule in "${ROOT_RULES[@]}"; do
        if grep -qF "${rule}" "${ROOT_HTACCESS}" || grep -qE "${rule}" "${ROOT_HTACCESS}"; then
            log_pass "Root .htaccess contains rule: ${rule}"
        else
            log_fail "Root .htaccess missing expected rule: ${rule}"
        fi
    done

    # Verification Gate: Ensure client/ static assets are never rewritten to non-existent public/client/
    if grep -q "public/client/" "${ROOT_HTACCESS}"; then
        log_fail "Root .htaccess incorrectly contains 'public/client/' rewrite (breaks installer CSS/JS with SPA fallback 404)"
    else
        log_pass "Root .htaccess does not contain 'public/client/' rewrite (direct pass-through intact)"
    fi

    # Verification Gate: Simulated requests for client/ assets find physical files
    # EspoCRM 10.1.4 installer template (/install/index.php) references:
    #   <link href="../client/css/espo/espo.css" rel="stylesheet">
    #   <script src="../client/lib/espo.js"></script>
    #   <script src="../client/lib/espo-main.js"></script>
    ESPO_CSS="${SMOKE_DIR}/client/css/espo/espo.css"
    if [[ -f "${ESPO_CSS}" && -r "${ESPO_CSS}" && -s "${ESPO_CSS}" ]]; then
        ESPO_CSS_SIZE="$(wc -c < "${ESPO_CSS}" | tr -d ' ')"
        if [[ ${ESPO_CSS_SIZE} -gt 500000 ]]; then
            log_pass "Simulated request for client/css/espo/espo.css resolves to physical file (${ESPO_CSS_SIZE} bytes > 500KB)"
        else
            log_fail "client/css/espo/espo.css is unexpectedly small (${ESPO_CSS_SIZE} bytes <= 500KB)"
        fi
    else
        log_fail "Simulated request for client/css/espo/espo.css failed: physical file missing or unreadable in release bundle"
    fi

    ESPO_JS="${SMOKE_DIR}/client/lib/espo.js"
    if [[ -f "${ESPO_JS}" && -r "${ESPO_JS}" && -s "${ESPO_JS}" ]]; then
        ESPO_JS_SIZE="$(wc -c < "${ESPO_JS}" | tr -d ' ')"
        if [[ ${ESPO_JS_SIZE} -gt 1000000 ]]; then
            log_pass "Simulated request for client/lib/espo.js resolves to physical file (${ESPO_JS_SIZE} bytes > 1MB)"
        else
            log_fail "client/lib/espo.js is unexpectedly small (${ESPO_JS_SIZE} bytes <= 1MB)"
        fi
    else
        log_fail "Simulated request for client/lib/espo.js failed: physical file missing or unreadable in release bundle"
    fi

    ESPO_MAIN_JS="${SMOKE_DIR}/client/lib/espo-main.js"
    if [[ -f "${ESPO_MAIN_JS}" && -r "${ESPO_MAIN_JS}" && -s "${ESPO_MAIN_JS}" ]]; then
        ESPO_MAIN_JS_SIZE="$(wc -c < "${ESPO_MAIN_JS}" | tr -d ' ')"
        if [[ ${ESPO_MAIN_JS_SIZE} -gt 1000000 ]]; then
            log_pass "Simulated request for client/lib/espo-main.js resolves to physical file (${ESPO_MAIN_JS_SIZE} bytes > 1MB)"
        else
            log_fail "client/lib/espo-main.js is unexpectedly small (${ESPO_MAIN_JS_SIZE} bytes <= 1MB)"
        fi
    else
        log_fail "Simulated request for client/lib/espo-main.js failed: physical file missing or unreadable in release bundle"
    fi
else
    log_fail "Root .htaccess missing or unreadable"
fi

PUBLIC_HTACCESS="${SMOKE_DIR}/public/.htaccess"
if [[ -f "${PUBLIC_HTACCESS}" && -r "${PUBLIC_HTACCESS}" ]]; then
    log_pass "public/.htaccess exists and is readable"

    PUBLIC_RULES=(
        "RewriteEngine On"
        "E=HTTP_AUTHORIZATION:%{HTTP:Authorization}"
        "E=HTTP_X_BIDAR_VOIP_SECRET:%{HTTP:X-Bidar-Voip-Secret}"
        "E=HTTP_X_VOIP_TOKEN:%{HTTP:X-Voip-Token}"
        "^api/v1/(.*)$ api/v1/index.php"
        "^admin/?(.*)$ index.php"
        "app/index.html"
    )

    for rule in "${PUBLIC_RULES[@]}"; do
        if grep -qF "${rule}" "${PUBLIC_HTACCESS}" || grep -qE "${rule}" "${PUBLIC_HTACCESS}"; then
            log_pass "public/.htaccess contains rule: ${rule}"
        else
            log_fail "public/.htaccess missing expected rule: ${rule}"
        fi
    done
else
    log_fail "public/.htaccess missing or unreadable"
fi

# ------------------------------------------------------------------------------
# 7. Verify Absence of Forbidden Paths (node_modules, .git, tests)
# ------------------------------------------------------------------------------
echo "==> Step 5: Checking for Forbidden Artifacts (node_modules, .git, tests)..."

# Check node_modules
NODE_MODULES_FOUND="$(find "${SMOKE_DIR}" -type d -name "node_modules" 2>/dev/null | wc -l | tr -d ' ')"
if [[ "${NODE_MODULES_FOUND}" -eq 0 ]]; then
    log_pass "Zero node_modules directories present across the package"
else
    log_fail "Found ${NODE_MODULES_FOUND} forbidden node_modules directory(ies)"
fi

# Check .git
GIT_FOUND="$(find "${SMOKE_DIR}" -name ".git" 2>/dev/null | wc -l | tr -d ' ')"
if [[ "${GIT_FOUND}" -eq 0 ]]; then
    log_pass "Zero .git repository directories or references present"
else
    log_fail "Found ${GIT_FOUND} forbidden .git directory(ies)"
fi

# Check tests/ inside custom/Espo/Modules
MODULE_TESTS_FOUND="$(find "${SMOKE_DIR}/custom/Espo/Modules" -type d -name "tests" 2>/dev/null | wc -l | tr -d ' ')"
if [[ "${MODULE_TESTS_FOUND}" -eq 0 ]]; then
    log_pass "Zero tests directories inside custom/Espo/Modules"
else
    log_fail "Found ${MODULE_TESTS_FOUND} forbidden tests directory(ies) in custom/Espo/Modules"
fi

# Check top-level tests/ directory
if [[ ! -d "${SMOKE_DIR}/tests" ]]; then
    log_pass "Zero top-level tests directory in release bundle"
else
    log_fail "Top-level tests directory unexpectedly present in release bundle"
fi

# ------------------------------------------------------------------------------
# 8. Summary & Exit
# ------------------------------------------------------------------------------
echo "================================================================================"
if [[ ${ERRORS} -eq 0 ]]; then
    echo "==> [SUCCESS] All clean installation smoke tests passed successfully (0 errors)."
    echo "==> Release package '${ZIP_FILE}' is 100% verified for shared-hosting deployment."
    echo "================================================================================"
    exit 0
else
    echo "==> [FAILURE] Clean installation smoke tests failed with ${ERRORS} error(s)." >&2
    echo "================================================================================"
    exit 1
fi
