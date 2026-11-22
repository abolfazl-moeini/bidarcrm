#!/usr/bin/env bash
# ==============================================================================
# BidarCRM - Local Development Setup Script
# Idempotent extraction of EspoCRM 10.1.4 & symlinking custom extensions
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

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
    /usr/bin/timeout 180s curl -fSL --progress-bar "${DOWNLOAD_URL}" -o "${CACHED_ZIP}"
    SOURCE_ARCHIVE="${CACHED_ZIP}"
fi

# 3. Extract into engine/ if not already extracted
if [[ ! -f "${ENGINE_DIR}/bootstrap.php" && ! -f "${ENGINE_DIR}/command.php" ]]; then
    echo "==> Extracting ${SOURCE_ARCHIVE} into ${ENGINE_DIR}..."
    TMP_EXTRACT="$(mktemp -d)"
    /usr/bin/timeout 120s unzip -q "${SOURCE_ARCHIVE}" -d "${TMP_EXTRACT}"
    
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

# 5. Symlinking Custom Modules into engine/custom/Espo/Modules
MODULES_DIR="${ENGINE_DIR}/custom/Espo/Modules"
mkdir -p "${MODULES_DIR}"

echo "==> Linking Bidar extensions into ${MODULES_DIR}..."

# Symlink BidarSales
ln -sfn "${EXTENSIONS_DIR}/bidar-sales" "${MODULES_DIR}/BidarSales"
echo "  [OK] BidarSales -> ${MODULES_DIR}/BidarSales"

# Symlink BidarIran
ln -sfn "${EXTENSIONS_DIR}/bidar-iran" "${MODULES_DIR}/BidarIran"
echo "  [OK] BidarIran -> ${MODULES_DIR}/BidarIran"

# 6. Apply Same-Origin Apache routing template to engine/.htaccess
if [[ -f "${ROOT_DIR}/deploy/htaccess.template" ]]; then
    echo "==> Applying Same-Origin .htaccess to engine/.htaccess..."
    cp "${ROOT_DIR}/deploy/htaccess.template" "${ENGINE_DIR}/.htaccess"
fi

# 7. Check EspoCRM Rebuild CLI readiness
if [[ -f "${ENGINE_DIR}/command.php" ]]; then
    echo "==> Engine is ready. You can rebuild EspoCRM cache anytime with:"
    echo "    php engine/command.php rebuild"
fi

echo "==> Dev setup completed successfully."
