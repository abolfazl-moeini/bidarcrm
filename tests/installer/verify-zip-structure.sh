#!/usr/bin/env bash
# ==============================================================================
# BidarCRM - Release ZIP Structure Verifier
# Validates self-contained shared-hosting package structure without live extraction
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

ZIP_FILE="${1:-${ROOT_DIR}/dist/bidar-crm-v1.0.0.zip}"

echo "==> Verifying BidarCRM Release Package: ${ZIP_FILE}"

if [[ ! -f "${ZIP_FILE}" ]]; then
    echo "ERROR: Release package not found at: ${ZIP_FILE}" >&2
    exit 1
fi

# Verify ZIP integrity
unzip -tq "${ZIP_FILE}" || {
    echo "ERROR: Corrupt or invalid ZIP archive." >&2
    exit 1
}

# Dump archive file list to a temporary file to avoid pipefail / SIGPIPE issues on large archives
TMP_LIST="$(mktemp)"
trap 'rm -f "${TMP_LIST}"' EXIT
unzip -l "${ZIP_FILE}" > "${TMP_LIST}"

# 1. Required Path Assertions
REQUIRED_PATTERNS=(
    "\.htaccess"
    "public/\.htaccess"
    "public/api/v1/index\.php"
    "public/install/"
    "public/app/index\.html"
    "custom/Espo/Modules/BidarSales/"
    "custom/Espo/Modules/BidarIran/"
)

MISSING=0
for pattern in "${REQUIRED_PATTERNS[@]}"; do
    if grep -qE "${pattern}" "${TMP_LIST}"; then
        echo "  [PASS] Found required structure: ${pattern}"
    else
        echo "  [FAIL] Missing required structure: ${pattern}" >&2
        MISSING=$((MISSING + 1))
    fi
done

# 2. Forbidden Path Assertions
FORBIDDEN_PATTERNS=(
    "node_modules/"
    "\.git/"
    "custom/Espo/Modules/.*/tests/"
)

FORBIDDEN_FOUND=0
for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
    if grep -qE "${pattern}" "${TMP_LIST}"; then
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
