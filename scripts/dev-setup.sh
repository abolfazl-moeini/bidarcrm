#!/usr/bin/env bash
# ==============================================================================
# BidarCRM - Local Development Setup Script
# Idempotent extraction of EspoCRM 10.1.4 & symlinking custom extensions
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

die() {
    echo "ERROR: $*" >&2
    exit 1
}

# Portable timeout: stock macOS ships neither GNU `timeout` nor `gtimeout`.
run_with_timeout() {
    local seconds="$1"
    shift

    if command -v timeout >/dev/null 2>&1; then
        timeout "${seconds}s" "$@"
    elif command -v gtimeout >/dev/null 2>&1; then
        gtimeout "${seconds}s" "$@"
    else
        "$@"
    fi
}

# 1. Version Detection
VERSION_FILE="${ROOT_DIR}/engine.version"
if [[ ! -f "${VERSION_FILE}" ]]; then
    echo "ERROR: Version file not found at ${VERSION_FILE}" >&2
    exit 1
fi
ESPO_VERSION="$(tr -d '[:space:]' < "${VERSION_FILE}")"
echo "==> Configuring BidarCRM for EspoCRM engine version: ${ESPO_VERSION}"

ENGINE_DIR="${ROOT_DIR}/engine"
CACHE_DIR="${ROOT_DIR}/.cache"
mkdir -p "${CACHE_DIR}"
mkdir -p "${ENGINE_DIR}"

# 2. Locate or Download EspoCRM release zip
ZIP_FILENAME="EspoCRM-${ESPO_VERSION}.zip"
CACHED_ZIP="${CACHE_DIR}/${ZIP_FILENAME}"

if [[ -n "${ESPO_TARBALL_PATH:-}" && -f "${ESPO_TARBALL_PATH}" ]]; then
    echo "==> Using local tarball specified in ESPO_TARBALL_PATH: ${ESPO_TARBALL_PATH}"
    SOURCE_ARCHIVE="${ESPO_TARBALL_PATH}"
elif [[ -f "${CACHED_ZIP}" ]]; then
    echo "==> Using cached EspoCRM archive: ${CACHED_ZIP}"
    SOURCE_ARCHIVE="${CACHED_ZIP}"
else
    DOWNLOAD_URL="https://www.espocrm.com/downloads/${ZIP_FILENAME}"
    echo "==> Downloading EspoCRM ${ESPO_VERSION} from ${DOWNLOAD_URL}..."
    curl -fSL --progress-bar --connect-timeout 30 --max-time 180 "${DOWNLOAD_URL}" -o "${CACHED_ZIP}"
    SOURCE_ARCHIVE="${CACHED_ZIP}"
fi

# 3. Extract into engine/ if not already extracted
if [[ ! -f "${ENGINE_DIR}/bootstrap.php" && ! -f "${ENGINE_DIR}/command.php" ]]; then
    echo "==> Extracting ${SOURCE_ARCHIVE} into ${ENGINE_DIR}..."
    TMP_EXTRACT="$(mktemp -d)"
    run_with_timeout 300 unzip -tq "${SOURCE_ARCHIVE}" >/dev/null || { rm -rf "${TMP_EXTRACT}"; die "corrupt or invalid ZIP archive: ${SOURCE_ARCHIVE}"; }
    run_with_timeout 300 unzip -q "${SOURCE_ARCHIVE}" -d "${TMP_EXTRACT}"
    
    # Check if archive extracted into a subdirectory or directly
    if [[ -d "${TMP_EXTRACT}/EspoCRM-${ESPO_VERSION}" ]]; then
        cp -a "${TMP_EXTRACT}/EspoCRM-${ESPO_VERSION}/." "${ENGINE_DIR}/"
    else
        cp -a "${TMP_EXTRACT}/." "${ENGINE_DIR}/"
    fi
    rm -rf "${TMP_EXTRACT}"
    echo "==> EspoCRM ${ESPO_VERSION} extracted successfully."
else
    echo "==> EspoCRM engine already extracted in ${ENGINE_DIR}."
fi

# 4. Scaffolding Extension Directories
EXTENSIONS_DIR="${ROOT_DIR}/extensions"
mkdir -p "${EXTENSIONS_DIR}/bidar-sales"
mkdir -p "${EXTENSIONS_DIR}/bidar-iran"
mkdir -p "${EXTENSIONS_DIR}/bidar-brand"
mkdir -p "${EXTENSIONS_DIR}/bidar-theme"

# 5. Symlinking Custom Modules into engine/custom/Espo/Modules
MODULES_DIR="${ENGINE_DIR}/custom/Espo/Modules"
mkdir -p "${MODULES_DIR}"

echo "==> Linking Bidar extensions into ${MODULES_DIR}..."

# Relative link targets keep the symlinks valid both on the host and inside the
# Docker container, where the repository root is mounted at /var/www/html.
ln -sfn "../../../../extensions/bidar-sales" "${MODULES_DIR}/BidarSales"
echo "  [OK] BidarSales -> ../../../../extensions/bidar-sales"

ln -sfn "../../../../extensions/bidar-iran" "${MODULES_DIR}/BidarIran"
echo "  [OK] BidarIran -> ../../../../extensions/bidar-iran"

ln -sfn "../../../../extensions/bidar-brand" "${MODULES_DIR}/BidarBrand"
echo "  [OK] BidarBrand -> ../../../../extensions/bidar-brand"

ln -sfn "../../../../extensions/bidar-theme" "${MODULES_DIR}/BidarTheme"
echo "  [OK] BidarTheme -> ../../../../extensions/bidar-theme"

# 5b. Symlinking Client Custom Modules into engine/client/custom/modules
CLIENT_MODULES_DIR="${ENGINE_DIR}/client/custom/modules"
mkdir -p "${CLIENT_MODULES_DIR}"
echo "==> Linking Bidar client modules into ${CLIENT_MODULES_DIR}..."

if [[ -d "${ROOT_DIR}/client/custom/modules/bidar-iran" ]]; then
    ln -sfn "../../../../client/custom/modules/bidar-iran" "${CLIENT_MODULES_DIR}/bidar-iran"
    echo "  [OK] bidar-iran -> ../../../../client/custom/modules/bidar-iran"
fi

if [[ -d "${ROOT_DIR}/client/custom/modules/bidar-theme" ]]; then
    ln -sfn "../../../../client/custom/modules/bidar-theme" "${CLIENT_MODULES_DIR}/bidar-theme"
    echo "  [OK] bidar-theme -> ../../../../client/custom/modules/bidar-theme"
fi

# 5c. Symlinking Bidar.json into core themes metadata
if [[ -f "${EXTENSIONS_DIR}/bidar-theme/Resources/metadata/themes/Bidar.json" ]]; then
    echo "==> Linking Bidar.json into core themes metadata..."
    mkdir -p "${ENGINE_DIR}/application/Espo/Resources/metadata/themes"
    ln -sfn "../../../../../../extensions/bidar-theme/Resources/metadata/themes/Bidar.json" "${ENGINE_DIR}/application/Espo/Resources/metadata/themes/Bidar.json"
    echo "  [OK] Bidar.json -> ../../../../../../extensions/bidar-theme/Resources/metadata/themes/Bidar.json"
fi

# 6. Apply Same-Origin Apache routing templates to engine/.htaccess and engine/public/.htaccess
if [[ -f "${ROOT_DIR}/deploy/htaccess.template" ]]; then
    echo "==> Applying Same-Origin .htaccess to engine/.htaccess..."
    cp "${ROOT_DIR}/deploy/htaccess.template" "${ENGINE_DIR}/.htaccess"
fi

if [[ -f "${ROOT_DIR}/deploy/public-htaccess.template" ]]; then
    echo "==> Applying Same-Origin public/.htaccess to engine/public/.htaccess..."
    mkdir -p "${ENGINE_DIR}/public"
    cp "${ROOT_DIR}/deploy/public-htaccess.template" "${ENGINE_DIR}/public/.htaccess"
fi

# 6b. Apply White-Label Branding and Installer Theme Patches to engine
if [[ -f "${ROOT_DIR}/scripts/apply-whitelabel.php" ]]; then
    echo "==> Applying White-Label Branding and Installer Theme Patches to engine..."
    php "${ROOT_DIR}/scripts/apply-whitelabel.php" \
        --target="${ENGINE_DIR}" \
        --brand="${ROOT_DIR}/config/brand.config.json"
fi

# 7. Check EspoCRM Rebuild CLI readiness
if [[ -f "${ENGINE_DIR}/command.php" ]]; then
    echo "==> Engine is ready. You can rebuild EspoCRM cache anytime with:"
    echo "    php engine/command.php rebuild"
fi

echo "==> Dev setup completed successfully."
