#!/usr/bin/env bash
# ==============================================================================
# BidarCRM - Shared Hosting Clean Installation Smoke Test
# Simulates fresh extraction on cPanel / DirectAdmin shared-hosting environment.
# Validates directory structure, zero-node/zero-composer runtime, PHP syntax lint,
# Front-Office SPA assets, Same-Origin routing (.htaccess), and forbidden paths.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || (cd "${SCRIPT_DIR}/../.." && pwd))"

PACKAGE_JSON="${ROOT_DIR}/package.json"

read_app_version() {
    local pkg="$1"
    local version=""

    if [[ -f "${pkg}" ]]; then
        if command -v node >/dev/null 2>&1; then
            version="$(node -p "require(process.argv[1]).version || ''" "${pkg}" 2>/dev/null || true)"
        fi
        if [[ -z "${version}" ]] && command -v php >/dev/null 2>&1; then
            version="$(php -r '$d = json_decode((string) file_get_contents($argv[1]), true); echo (is_array($d) && isset($d["version"])) ? $d["version"] : "";' "${pkg}" 2>/dev/null || true)"
        fi
        if [[ ! "${version}" =~ ^[0-9A-Za-z][0-9A-Za-z._+-]*$ ]]; then
            version=""
        fi
    fi

    printf '%s' "${version:-1.0.4}"
}

APP_VERSION="$(read_app_version "${PACKAGE_JSON}")"

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
    if [[ -d "${SMOKE_DIR}" ]]; then
        echo "==> [CLEANUP] Removing temporary test environment: ${SMOKE_DIR}"
        rm -rf "${SMOKE_DIR}" || true
    fi
}
# EXIT only: trapping INT/TERM/ERR as well runs the cleanup twice (once for the
# signal, once when the shell finally exits) and rewrites the real exit status.
trap cleanup EXIT

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
    "custom/Espo/Modules/BidarBrand"
    "custom/Espo/Modules/BidarTheme"
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
        # Trust php -l's exit status instead of parsing its human-readable output.
        if LINT_OUTPUT="$(find "${MODULES_DIR}" -type f -name "*.php" -print0 | xargs -0 -n1 php -l 2>&1)"; then
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

    # Accept both the legacy ^admin/?(.*)$ and updated ^admin(/.*)?$ forms so
    # pre-existing and freshly built release archives both pass this gate.
    if grep -qF "RewriteRule ^admin/?(.*)$ public/index.php" "${ROOT_HTACCESS}" \
        || grep -qF "RewriteRule ^admin(/.*)?$ public/index.php" "${ROOT_HTACCESS}"; then
        log_pass "Root .htaccess contains admin rewrite rule (legacy or updated pattern)"
    else
        log_fail "Root .htaccess missing admin rewrite rule (expected ^admin/?(.*)$ or ^admin(/.*)?$)"
    fi

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
        "app/index.html"
    )

    for rule in "${PUBLIC_RULES[@]}"; do
        if grep -qF "${rule}" "${PUBLIC_HTACCESS}" || grep -qE "${rule}" "${PUBLIC_HTACCESS}"; then
            log_pass "public/.htaccess contains rule: ${rule}"
        else
            log_fail "public/.htaccess missing expected rule: ${rule}"
        fi
    done

    # Accept both the legacy ^admin/?(.*)$ and updated ^admin(/.*)?$ forms so
    # pre-existing and freshly built release archives both pass this gate.
    if grep -qF "^admin/?(.*)$ index.php" "${PUBLIC_HTACCESS}" \
        || grep -qF "^admin(/.*)?$ index.php" "${PUBLIC_HTACCESS}"; then
        log_pass "public/.htaccess contains admin rewrite rule (legacy or updated pattern)"
    else
        log_fail "public/.htaccess missing admin rewrite rule (expected ^admin/?(.*)$ or ^admin(/.*)?$)"
    fi
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
# 8. White-Label Verification Gate (AGPLv3 Section 7(b) & Zero-Leakage)
# ------------------------------------------------------------------------------
echo "==> Step 6: White-Label Verification Gate (Zero EspoCRM UI Leakage)..."

# 1. Check NOTICE.txt and BidarBrand module
if [[ -f "${SMOKE_DIR}/NOTICE.txt" && -s "${SMOKE_DIR}/NOTICE.txt" ]]; then
    log_pass "NOTICE.txt exists in package root (AGPLv3 Section 7(b) legal compliance preserved)"
else
    log_fail "NOTICE.txt missing or empty in package root"
fi

if [[ -f "${SMOKE_DIR}/custom/Espo/Modules/BidarBrand/manifest.json" ]]; then
    log_pass "BidarBrand extension manifest exists (custom/Espo/Modules/BidarBrand/manifest.json)"
else
    log_fail "Missing custom/Espo/Modules/BidarBrand/manifest.json"
fi

# 2. Check brand logo and favicon assets
if [[ -f "${SMOKE_DIR}/client/img/logo-light.svg" || -f "${SMOKE_DIR}/client/img/logo.svg" ]]; then
    log_pass "Brand logo asset exists in client/img/"
else
    log_fail "Missing brand logo in client/img/"
fi

if [[ -f "${SMOKE_DIR}/client/img/favicon.svg" ]]; then
    log_pass "Brand favicon asset exists in client/img/favicon.svg"
else
    log_fail "Missing brand favicon in client/img/favicon.svg"
fi

# 3. Assert EspoCRM, Inc. is NOT in footers
FOOTER_FILES=(
    "html/main.html"
    "client/res/templates/site/footer.tpl"
    "install/core/tpl/footer.tpl"
)

for fpath in "${FOOTER_FILES[@]}"; do
    if [[ -f "${SMOKE_DIR}/${fpath}" ]]; then
        if grep -q "EspoCRM, Inc." "${SMOKE_DIR}/${fpath}"; then
            log_fail "Found forbidden upstream copyright 'EspoCRM, Inc.' in ${fpath}"
        else
            log_pass "Zero upstream copyright in ${fpath} (Clean white-label footer)"
        fi
    fi
done

# 4. Assert EspoCRM Installation is NOT in install.json
INSTALL_JSON_FILES=(
    "install/core/i18n/fa_IR/install.json"
    "install/core/i18n/en_US/install.json"
)

for ipath in "${INSTALL_JSON_FILES[@]}"; do
    if [[ -f "${SMOKE_DIR}/${ipath}" ]]; then
        if grep -qi "EspoCRM Installation" "${SMOKE_DIR}/${ipath}"; then
            log_fail "Found forbidden 'EspoCRM Installation' in ${ipath}"
        else
            log_pass "Zero 'EspoCRM Installation' in ${ipath} (Clean white-label installer labels)"
        fi
    fi
done

# ------------------------------------------------------------------------------
# 9. Iran Localization Verification Gate
# ------------------------------------------------------------------------------
echo "==> Step 7: Iran Localization Verification Gate..."

if [[ -f "${SMOKE_DIR}/client/custom/modules/bidar-iran/lib/jalalidatepicker.min.js" ]]; then
    log_pass "JalaliDatePicker script packaged (client/custom/modules/bidar-iran/lib/jalalidatepicker.min.js)"
else
    log_fail "Missing client/custom/modules/bidar-iran/lib/jalalidatepicker.min.js"
fi

if [[ -d "${SMOKE_DIR}/vendor/morilog/jalali" ]]; then
    log_pass "Morilog Jalali packaged in vendor/morilog/jalali"
    if JALALIAN_AUTOLOAD_OUTPUT="$(php -r 'require $argv[1] . "/vendor/autoload.php"; echo class_exists("Morilog\\Jalali\\Jalalian") ? "YES" : "NO";' "${SMOKE_DIR}" 2>&1)" && [[ "${JALALIAN_AUTOLOAD_OUTPUT}" == *YES* ]]; then
        log_pass "Morilog Jalali autoloader successfully loaded Jalalian class in clean package"
    else
        log_fail "Failed to autoload Jalalian class via vendor/autoload.php: ${JALALIAN_AUTOLOAD_OUTPUT}"
    fi
else
    log_fail "Missing vendor/morilog/jalali in release package"
fi

# ------------------------------------------------------------------------------
echo "==> Step 8: BidarTheme Verification Gate..."

if [[ -f "${SMOKE_DIR}/custom/Espo/Modules/BidarTheme/manifest.json" ]]; then
    log_pass "BidarTheme module manifest packaged (custom/Espo/Modules/BidarTheme/manifest.json)"
else
    log_fail "Missing custom/Espo/Modules/BidarTheme/manifest.json"
fi

if [[ -f "${SMOKE_DIR}/custom/Espo/Modules/BidarTheme/Resources/metadata/themes/Bidar.json" ]]; then
    log_pass "BidarTheme theme definition packaged (custom/Espo/Modules/BidarTheme/Resources/metadata/themes/Bidar.json)"
else
    log_fail "Missing custom/Espo/Modules/BidarTheme/Resources/metadata/themes/Bidar.json"
fi

if [[ -f "${SMOKE_DIR}/client/custom/modules/bidar-theme/css/bidar.css" ]]; then
    log_pass "BidarTheme stylesheet packaged (client/custom/modules/bidar-theme/css/bidar.css)"
else
    log_fail "Missing client/custom/modules/bidar-theme/css/bidar.css"
fi

if [[ -f "${SMOKE_DIR}/client/custom/modules/bidar-theme/fonts/vazirmatn/Vazirmatn-Variable.woff2" ]]; then
    log_pass "BidarTheme offline font packaged (client/custom/modules/bidar-theme/fonts/vazirmatn/Vazirmatn-Variable.woff2)"
else
    log_fail "Missing client/custom/modules/bidar-theme/fonts/vazirmatn/Vazirmatn-Variable.woff2"
fi

# ------------------------------------------------------------------------------
echo "==> Step 9: Installer Theme & RTL Defaults Verification Gate..."

if grep -q "'Bidar'" "${SMOKE_DIR}/install/core/Installer.php" 2>/dev/null; then
    log_pass "Installer getThemeList() contains 'Bidar' as available theme"
else
    log_fail "Installer getThemeList() missing 'Bidar' in install/core/Installer.php"
fi

if grep -q "'theme' => \$saveData\['theme'\] ?? 'Bidar'" "${SMOKE_DIR}/install/core/Installer.php" 2>/dev/null; then
    log_pass "Installer default saved theme is 'Bidar'"
else
    log_fail "Installer default saved theme is not 'Bidar' in install/core/Installer.php"
fi

if grep -q "'Bidar'" "${SMOKE_DIR}/install/entry.php" 2>/dev/null; then
    log_pass "Installer entry.php falls back to theme 'Bidar'"
else
    log_fail "Installer entry.php does not fall back to theme 'Bidar'"
fi

if grep -q "'fa_IR'" "${SMOKE_DIR}/install/entry.php" 2>/dev/null; then
    log_pass "Installer entry.php falls back to language 'fa_IR'"
else
    log_fail "Installer entry.php does not fall back to language 'fa_IR'"
fi

if [[ -f "${SMOKE_DIR}/application/Espo/Resources/metadata/themes/Bidar.json" ]]; then
    log_pass "Bidar.json exists in core themes metadata (application/Espo/Resources/metadata/themes/Bidar.json)"
else
    log_fail "Missing application/Espo/Resources/metadata/themes/Bidar.json"
fi

if grep -q "بیدار (پیش‌فرض RTL)" "${SMOKE_DIR}/install/core/i18n/fa_IR/install.json" 2>/dev/null; then
    log_pass "Installer fa_IR translation has 'Bidar': 'بیدار (پیش‌فرض RTL)'"
else
    log_fail "Missing Bidar theme translation in install/core/i18n/fa_IR/install.json"
fi

# ------------------------------------------------------------------------------
echo "==> Step 10: Demo Data Seeder Verification Gate (Track D)..."

if grep -q 'name="importDemoData"' "${SMOKE_DIR}/install/core/tpl/step4.tpl" 2>/dev/null; then
    log_pass "Demo data checkbox packaged in installer step4.tpl (name='importDemoData')"
else
    log_fail "Missing demo data checkbox in install/core/tpl/step4.tpl"
fi

if grep -q "'seedDemoData'" "${SMOKE_DIR}/install/core/Utils.php" 2>/dev/null; then
    log_pass "Action 'seedDemoData' whitelisted in install/core/Utils.php"
else
    log_fail "Action 'seedDemoData' missing from whitelist in install/core/Utils.php"
fi

if [[ -f "${SMOKE_DIR}/install/core/actions/seedDemoData.php" ]]; then
    log_pass "Installer action script packaged (install/core/actions/seedDemoData.php)"
    if SEED_ACTION_LINT="$(php -l "${SMOKE_DIR}/install/core/actions/seedDemoData.php" 2>&1)"; then
        log_pass "install/core/actions/seedDemoData.php passed syntax lint"
    else
        log_fail "install/core/actions/seedDemoData.php has syntax errors: ${SEED_ACTION_LINT}"
    fi
else
    log_fail "Missing install/core/actions/seedDemoData.php"
fi

if grep -q "importDemoData" "${SMOKE_DIR}/public/install/js/install.js" 2>/dev/null && grep -q "'seedDemoData'" "${SMOKE_DIR}/public/install/js/install.js" 2>/dev/null; then
    log_pass "Installer JavaScript captures importDemoData and triggers seedDemoData AJAX (public/install/js/install.js)"
else
    log_fail "Installer JavaScript missing importDemoData or seedDemoData handling in public/install/js/install.js"
fi

if [[ -f "${SMOKE_DIR}/custom/Espo/Modules/BidarSales/Seed/DemoDataSeeder.php" ]]; then
    log_pass "DemoDataSeeder packaged in BidarSales module (custom/Espo/Modules/BidarSales/Seed/DemoDataSeeder.php)"
    if SEEDER_LINT="$(php -l "${SMOKE_DIR}/custom/Espo/Modules/BidarSales/Seed/DemoDataSeeder.php" 2>&1)"; then
        log_pass "custom/Espo/Modules/BidarSales/Seed/DemoDataSeeder.php passed syntax lint"
    else
        log_fail "custom/Espo/Modules/BidarSales/Seed/DemoDataSeeder.php has syntax errors: ${SEEDER_LINT}"
    fi
else
    log_fail "Missing custom/Espo/Modules/BidarSales/Seed/DemoDataSeeder.php in release bundle"
fi

# ------------------------------------------------------------------------------
# 11. Summary & Exit

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
