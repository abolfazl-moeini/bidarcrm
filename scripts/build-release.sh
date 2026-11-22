#!/usr/bin/env bash
# ==============================================================================
# BidarCRM - Standalone Single-Zip Shared-Hosting Release Packager
# Builds a zero-node, zero-composer runtime distribution package
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# 1. Read pinned engine version and release version
VERSION_FILE="${ROOT_DIR}/engine.version"
if [[ ! -f "${VERSION_FILE}" ]]; then
    echo "ERROR: engine.version file not found at ${VERSION_FILE}" >&2
    exit 1
fi
ESPO_VERSION="$(tr -d '[:space:]' < "${VERSION_FILE}")"

PACKAGE_JSON="${ROOT_DIR}/package.json"
APP_VERSION="1.0.0"
if [[ -f "${PACKAGE_JSON}" ]]; then
    APP_VERSION="$(grep -o '"version": "[^"]*"' "${PACKAGE_JSON}" | cut -d'"' -f4 || echo "1.0.0")"
fi

echo "==> Building BidarCRM v${APP_VERSION} (EspoCRM engine: ${ESPO_VERSION})"

BUILD_DIR="${ROOT_DIR}/build/release"
DIST_DIR="${ROOT_DIR}/dist"
CACHE_DIR="${ROOT_DIR}/.cache"

rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}" "${DIST_DIR}" "${CACHE_DIR}"

# 2. Locate or download EspoCRM base archive
ZIP_FILENAME="EspoCRM-${ESPO_VERSION}.zip"
CACHED_ZIP="${CACHE_DIR}/${ZIP_FILENAME}"

if [[ -n "${ESPO_TARBALL_PATH:-}" && -f "${ESPO_TARBALL_PATH}" ]]; then
    SOURCE_ARCHIVE="${ESPO_TARBALL_PATH}"
elif [[ -f "${CACHED_ZIP}" ]]; then
    SOURCE_ARCHIVE="${CACHED_ZIP}"
else
    DOWNLOAD_URL="https://www.espocrm.com/downloads/${ZIP_FILENAME}"
    echo "==> Downloading EspoCRM ${ESPO_VERSION} base..."
    /usr/bin/timeout 180s curl -fSL "${DOWNLOAD_URL}" -o "${CACHED_ZIP}"
    SOURCE_ARCHIVE="${CACHED_ZIP}"
fi

# 3. Extract clean base engine into BUILD_DIR
echo "==> Unpacking base EspoCRM engine..."
TMP_UNPACK="$(mktemp -d)"
/usr/bin/timeout 120s unzip -q "${SOURCE_ARCHIVE}" -d "${TMP_UNPACK}"

if [[ -d "${TMP_UNPACK}/EspoCRM-${ESPO_VERSION}" ]]; then
    cp -a "${TMP_UNPACK}/EspoCRM-${ESPO_VERSION}/." "${BUILD_DIR}/"
else
    cp -a "${TMP_UNPACK}/." "${BUILD_DIR}/"
fi
rm -rf "${TMP_UNPACK}"

# 4. Copy backend extensions into custom/Espo/Modules/ (excluding tests/)
MODULES_TARGET="${BUILD_DIR}/custom/Espo/Modules"
mkdir -p "${MODULES_TARGET}"

echo "==> Bundling BidarCRM backend extensions..."
for mod_slug in bidar-sales bidar-iran; do
    src_mod="${ROOT_DIR}/extensions/${mod_slug}"
    # Target directory name (PascalCase)
    if [[ "${mod_slug}" == "bidar-sales" ]]; then
        target_name="BidarSales"
    else
        target_name="BidarIran"
    fi
    target_mod="${MODULES_TARGET}/${target_name}"
    mkdir -p "${target_mod}"

    if [[ -d "${src_mod}" ]]; then
        # Copy everything except tests
        rsync -a --exclude="tests" --exclude="*.test.*" "${src_mod}/" "${target_mod}/" 2>/dev/null || \
        cp -a "${src_mod}/." "${target_mod}/"
        rm -rf "${target_mod}/tests"
    else
        # Placeholder module if not yet created
        cat <<EOF > "${target_mod}/manifest.json"
{
  "name": "${target_name}",
  "version": "${APP_VERSION}",
  "acceptableVersions": [">=10.1.0"],
  "php": [">=8.3"]
}
EOF
        mkdir -p "${target_mod}/Resources"
        echo '{"order": 50}' > "${target_mod}/Resources/module.json"
    fi
    echo "  [OK] Bundled ${target_name} -> custom/Espo/Modules/${target_name}"
done

# 5. Build and bundle Front-Office SPA
APP_TARGET="${BUILD_DIR}/public/app"
mkdir -p "${APP_TARGET}"

WEB_DIR="${ROOT_DIR}/apps/web"
if [[ -f "${WEB_DIR}/package.json" ]]; then
    echo "==> Compiling Front-Office React SPA..."
    if [[ ! -d "${WEB_DIR}/node_modules" ]]; then
        npm --prefix "${WEB_DIR}" ci || npm --prefix "${WEB_DIR}" install
    fi
    npm --prefix "${WEB_DIR}" run build
    cp -a "${WEB_DIR}/dist/." "${APP_TARGET}/"
else
    echo "==> Generating Front-Office fallback index.html..."
    cat <<'EOF' > "${APP_TARGET}/index.html"
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>بیدار - نرم‌افزار مدیریت ارتباط با مشتری (BidarCRM)</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; direction: rtl; }
        .card { background: #1e293b; padding: 2rem; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); text-align: center; max-width: 480px; }
        h1 { color: #38bdf8; margin-bottom: 0.5rem; }
    </style>
</head>
<body>
    <div id="root" class="card">
        <h1>سامانه یکپارچه بیدار (BidarCRM)</h1>
        <p>موتور هسته EspoCRM آماده است. فرانت‌اند اختصاصی در حال بارگذاری است...</p>
    </div>
</body>
</html>
EOF
fi

# 6. Apply Same-Origin Routing Templates
echo "==> Applying Apache Same-Origin routing templates..."
if [[ -f "${ROOT_DIR}/deploy/htaccess.template" ]]; then
    cp "${ROOT_DIR}/deploy/htaccess.template" "${BUILD_DIR}/.htaccess"
fi
if [[ -f "${ROOT_DIR}/deploy/public-htaccess.template" ]]; then
    cp "${ROOT_DIR}/deploy/public-htaccess.template" "${BUILD_DIR}/public/.htaccess"
fi

# 7. Package standalone distribution ZIP
ZIP_OUT="${DIST_DIR}/bidar-crm-v${APP_VERSION}.zip"
echo "==> Packaging distribution bundle: ${ZIP_OUT}..."
rm -f "${ZIP_OUT}"

(
    cd "${BUILD_DIR}"
    zip -q -r -9 "${ZIP_OUT}" . \
        -x "*.git*" \
        -x "*/.git*" \
        -x "*node_modules*" \
        -x "*/node_modules/*" \
        -x "*/tests/*" \
        -x "*.DS_Store"
)

echo "==> Build complete: ${ZIP_OUT}"
echo "    Size: $(du -h "${ZIP_OUT}" | cut -f1)"
