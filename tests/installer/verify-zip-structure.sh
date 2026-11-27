#!/usr/bin/env bash
# ==============================================================================
# BidarCRM - Release ZIP Structure Verifier
# Validates self-contained shared-hosting package structure without live extraction
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

    printf '%s' "${version:-1.0.5}"
}

APP_VERSION="$(read_app_version "${PACKAGE_JSON}")"

ZIP_FILE="${1:-${ROOT_DIR}/dist/bidar-crm-v${APP_VERSION}.zip}"

echo "==> Verifying BidarCRM Release Package: ${ZIP_FILE}"

if [[ ! -f "${ZIP_FILE}" ]]; then
    echo "ERROR: Release package not found at: ${ZIP_FILE}" >&2
    exit 1
fi

# Verify ZIP integrity
unzip -tq "${ZIP_FILE}" >/dev/null || {
    echo "ERROR: Corrupt or invalid ZIP archive." >&2
    exit 1
}

# Dump the machine-readable entry list (one path per line) to a temporary file to
# avoid pipefail / SIGPIPE issues on large archives.
TMP_LIST="$(mktemp)"
trap 'rm -f "${TMP_LIST}"' EXIT
unzip -Z1 "${ZIP_FILE}" > "${TMP_LIST}"

# 1. Required Path Assertions (fully anchored: no accidental substring matches)
REQUIRED_PATTERNS=(
    "^\.htaccess$"
    "^public/\.htaccess$"
    "^public/api/v1/index\.php$"
    "^public/install/$"
    "^client/css/espo/espo\.css$"
    "^client/lib/espo\.js$"
    "^public/app/index\.html$"
    "^custom/Espo/Modules/BidarSales/$"
    "^custom/Espo/Modules/BidarSales/Api/GetDashboardSummary\.php$"
    "^custom/Espo/Modules/BidarSales/Hooks/BidarDealItem/RecalculateOpportunityAmount\.php$"
    "^custom/Espo/Modules/BidarIran/$"
    "^custom/Espo/Modules/BidarIran/Api/PostVoipWebhook\.php$"
    "^custom/Espo/Modules/BidarIran/Api/PostSendSms\.php$"
    "^custom/Espo/Modules/BidarIran/Services/SmsCampaignService\.php$"
    "^custom/Espo/Modules/BidarBrand/manifest\.json$"
    "^custom/Espo/Modules/BidarTheme/manifest\.json$"
    "^NOTICE\.txt$"
    "^client/custom/modules/bidar-iran/lib/jalalidatepicker\.min\.js$"
    "^client/custom/modules/bidar-theme/css/bidar\.css$"
    "^client/custom/modules/bidar-theme/fonts/vazirmatn/Vazirmatn-Variable\.woff2$"
    "^vendor/morilog/jalali/$"
)

MISSING=0
for pattern in "${REQUIRED_PATTERNS[@]}"; do
    if grep -qE -- "${pattern}" "${TMP_LIST}"; then
        echo "  [PASS] Found required structure: ${pattern}"
    else
        echo "  [FAIL] Missing required structure: ${pattern}" >&2
        MISSING=$((MISSING + 1))
    fi
done

# 2. Forbidden Path Assertions
FORBIDDEN_PATTERNS=(
    "(^|/)node_modules(/|$)"
    "(^|/)\.git(/|$)"
    "(^|/)\.env(\.|$)"
    "\.log$"
    "^data/config\.php$"
    "^custom/Espo/Modules/[^/]+/tests(/|$)"
    "^custom/Espo/Modules/[^/]+/src(/|$)"
)

FORBIDDEN_FOUND=0
for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
    if grep -qE -- "${pattern}" "${TMP_LIST}"; then
        echo "  [FAIL] Found forbidden content in release bundle: ${pattern}" >&2
        FORBIDDEN_FOUND=$((FORBIDDEN_FOUND + 1))
    else
        echo "  [PASS] Excluded forbidden pattern: ${pattern}"
    fi
done

if [[ ${MISSING} -gt 0 || ${FORBIDDEN_FOUND} -gt 0 ]]; then
    echo "ERROR: Release package structure verification failed (missing=${MISSING}, forbidden=${FORBIDDEN_FOUND})." >&2
    exit 1
fi

echo "==> All release structure invariants verified successfully."
exit 0
