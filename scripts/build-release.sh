#!/usr/bin/env bash
# ==============================================================================
# BidarCRM - Standalone Single-Zip Shared-Hosting Release Packager
# Builds a zero-node, zero-composer runtime distribution package
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

# Portable SHA-256: shasum on macOS, sha256sum on Linux.
file_sha256() {
    local file="$1"

    if command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "${file}" | awk '{print $1}'
    elif command -v sha256sum >/dev/null 2>&1; then
        sha256sum "${file}" | awk '{print $1}'
    else
        return 1
    fi
}

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

copy_tree() {
    local src="$1"
    local dst="$2"

    mkdir -p "${dst}"

    if command -v rsync >/dev/null 2>&1; then
        rsync -a \
            --exclude='tests' \
            --exclude='src' \
            --exclude='*.test.*' \
            --exclude='phpunit.xml*' \
            --exclude='.git*' \
            --exclude='node_modules' \
            "${src}/" "${dst}/"
    else
        cp -a "${src}/." "${dst}/"
        # Match the rsync exclusions at every depth, including .gitignore files.
        find "${dst}" -depth \
            \( -name 'tests' -o -name 'src' -o -name '*.test.*' \
               -o -name 'phpunit.xml*' -o -name '.git*' -o -name 'node_modules' \) \
            -exec rm -rf {} +
    fi
}

# 1. Read pinned engine version and release version
VERSION_FILE="${ROOT_DIR}/engine.version"
if [[ ! -f "${VERSION_FILE}" ]]; then
    die "engine.version file not found at ${VERSION_FILE}"
fi
ESPO_VERSION="$(tr -d '[:space:]' < "${VERSION_FILE}")"
[[ -n "${ESPO_VERSION}" ]] || die "engine.version is empty"

APP_VERSION="$(read_app_version "${ROOT_DIR}/package.json")"

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
    curl -fSL --connect-timeout 30 --max-time 180 "${DOWNLOAD_URL}" -o "${CACHED_ZIP}"
    SOURCE_ARCHIVE="${CACHED_ZIP}"
fi

# 2b. Optional pinned SHA-256 verification (engine.sha256 or <archive>.sha256)
SHA_FILE="${ENGINE_SHA256_FILE:-}"
if [[ -z "${SHA_FILE}" && -f "${ROOT_DIR}/engine.sha256" ]]; then
    SHA_FILE="${ROOT_DIR}/engine.sha256"
fi
if [[ -z "${SHA_FILE}" && -f "${SOURCE_ARCHIVE}.sha256" ]]; then
    SHA_FILE="${SOURCE_ARCHIVE}.sha256"
fi

if [[ -n "${SHA_FILE}" ]]; then
    [[ -f "${SHA_FILE}" ]] || die "checksum file not found: ${SHA_FILE}"
    EXPECTED_SHA="$(grep -Eo '[a-fA-F0-9]{64}' "${SHA_FILE}" | head -n 1 || true)"
    [[ -n "${EXPECTED_SHA}" ]] || die "no SHA-256 digest found in ${SHA_FILE}"
    EXPECTED_SHA="$(printf '%s' "${EXPECTED_SHA}" | tr '[:upper:]' '[:lower:]')"

    ACTUAL_SHA="$(file_sha256 "${SOURCE_ARCHIVE}")" \
        || die "cannot compute SHA-256 with shasum or sha256sum"
    [[ "${ACTUAL_SHA}" == "${EXPECTED_SHA}" ]] \
        || die "SHA-256 mismatch for $(basename "${SOURCE_ARCHIVE}"): expected ${EXPECTED_SHA}, got ${ACTUAL_SHA}"
    echo "==> SHA-256 verified for $(basename "${SOURCE_ARCHIVE}")"
fi

# 2c. Reject corrupt archives before touching the staging tree
echo "==> Verifying archive integrity..."
run_with_timeout 300 unzip -tq "${SOURCE_ARCHIVE}" >/dev/null || die "corrupt or invalid ZIP archive: ${SOURCE_ARCHIVE}"

# 3. Extract clean base engine into BUILD_DIR
echo "==> Unpacking base EspoCRM engine..."
TMP_UNPACK="$(mktemp -d)"
trap 'rm -rf "${TMP_UNPACK}"' EXIT
run_with_timeout 300 unzip -q "${SOURCE_ARCHIVE}" -d "${TMP_UNPACK}"

if [[ -d "${TMP_UNPACK}/EspoCRM-${ESPO_VERSION}" ]]; then
    cp -a "${TMP_UNPACK}/EspoCRM-${ESPO_VERSION}/." "${BUILD_DIR}/"
else
    cp -a "${TMP_UNPACK}/." "${BUILD_DIR}/"
fi
rm -rf "${TMP_UNPACK}"
trap - EXIT

# 4. Copy backend extensions into custom/Espo/Modules/ (excluding tests/)
MODULES_TARGET="${BUILD_DIR}/custom/Espo/Modules"
mkdir -p "${MODULES_TARGET}"

echo "==> Bundling BidarCRM backend extensions..."
for mod_slug in bidar-sales bidar-iran bidar-brand bidar-theme; do
    src_mod="${ROOT_DIR}/extensions/${mod_slug}"
    # Target directory name (PascalCase)
    if [[ "${mod_slug}" == "bidar-sales" ]]; then
        target_name="BidarSales"
    elif [[ "${mod_slug}" == "bidar-brand" ]]; then
        target_name="BidarBrand"
    elif [[ "${mod_slug}" == "bidar-theme" ]]; then
        target_name="BidarTheme"
    else
        target_name="BidarIran"
    fi
    target_mod="${MODULES_TARGET}/${target_name}"
    mkdir -p "${target_mod}"

    if [[ -d "${src_mod}" ]]; then
        # Copy everything except tests, legacy src directories and dev-only artifacts
        copy_tree "${src_mod}" "${target_mod}"
        rm -rf "${target_mod}/tests" "${target_mod}/src"
        find "${target_mod}" -type f \( -name '*.test.*' -o -name 'phpunit.xml*' \) -delete
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

# 4b. Copy client custom modules (e.g. JalaliDatePicker and BidarTheme for /admin)
if [[ -d "${ROOT_DIR}/client/custom/modules/bidar-iran" ]]; then
    echo "==> Bundling BidarIran client modules (Jalali Datepicker)..."
    mkdir -p "${BUILD_DIR}/client/custom/modules/bidar-iran"
    cp -a "${ROOT_DIR}/client/custom/modules/bidar-iran/." "${BUILD_DIR}/client/custom/modules/bidar-iran/"
fi
if [[ -d "${ROOT_DIR}/client/custom/modules/bidar-theme" ]]; then
    echo "==> Bundling BidarTheme client modules (CSS, fonts, JS)..."
    mkdir -p "${BUILD_DIR}/client/custom/modules/bidar-theme"
    cp -a "${ROOT_DIR}/client/custom/modules/bidar-theme/." "${BUILD_DIR}/client/custom/modules/bidar-theme/"
fi

# 4c. Ensure Bidar theme definition is placed into core themes metadata
if [[ -f "${ROOT_DIR}/extensions/bidar-theme/Resources/metadata/themes/Bidar.json" ]]; then
    echo "==> Ensuring Bidar.json is in core themes metadata..."
    mkdir -p "${BUILD_DIR}/application/Espo/Resources/metadata/themes"
    cp -f "${ROOT_DIR}/extensions/bidar-theme/Resources/metadata/themes/Bidar.json" "${BUILD_DIR}/application/Espo/Resources/metadata/themes/Bidar.json"
fi

# 4d. Bundle morilog/jalali into vendor runtime
if [[ -d "${ROOT_DIR}/vendor/morilog/jalali" ]]; then
    echo "==> Bundling morilog/jalali into standalone vendor runtime..."
    mkdir -p "${BUILD_DIR}/vendor/morilog"
    rm -rf "${BUILD_DIR}/vendor/morilog/jalali"
    cp -a "${ROOT_DIR}/vendor/morilog/jalali" "${BUILD_DIR}/vendor/morilog/"

    # Carbon / doctrine types already ship with the EspoCRM engine: never overwrite them.
    if [[ -d "${ROOT_DIR}/vendor/nesbot/carbon" && ! -d "${BUILD_DIR}/vendor/nesbot/carbon" ]]; then
        echo "  [OK] Bundling nesbot/carbon (not present in engine/vendor)"
        mkdir -p "${BUILD_DIR}/vendor/nesbot"
        cp -a "${ROOT_DIR}/vendor/nesbot/carbon" "${BUILD_DIR}/vendor/nesbot/"
    fi
    if [[ -d "${ROOT_DIR}/vendor/carbonphp/carbon-doctrine-types" && ! -d "${BUILD_DIR}/vendor/carbonphp/carbon-doctrine-types" ]]; then
        echo "  [OK] Bundling carbonphp/carbon-doctrine-types (not present in engine/vendor)"
        mkdir -p "${BUILD_DIR}/vendor/carbonphp"
        cp -a "${ROOT_DIR}/vendor/carbonphp/carbon-doctrine-types" "${BUILD_DIR}/vendor/carbonphp/"
    fi

    # morilog/jalali requires beberlei/assert, which the EspoCRM engine does not ship.
    if [[ -d "${ROOT_DIR}/vendor/beberlei/assert" ]]; then
        rm -rf "${BUILD_DIR}/vendor/beberlei/assert"
        mkdir -p "${BUILD_DIR}/vendor/beberlei"
        cp -a "${ROOT_DIR}/vendor/beberlei/assert" "${BUILD_DIR}/vendor/beberlei/"
        echo "  [OK] Bundling beberlei/assert"
    else
        die "vendor/beberlei/assert is missing; morilog/jalali requires Assert\\Assertion"
    fi

    # Create dedicated autoload helper for Jalali, Carbon and Assert
    cat <<'PHP' > "${BUILD_DIR}/vendor/morilog/autoload.php"
<?php
declare(strict_types=1);

if (isset($loader) && is_object($loader) && method_exists($loader, 'addPsr4')) {
    $loader->addPsr4('Morilog\\Jalali\\', __DIR__ . '/jalali/src');
    $loader->addPsr4('Carbon\\', dirname(__DIR__) . '/nesbot/carbon/src/Carbon');
    $loader->addPsr4('Carbon\\Doctrine\\', dirname(__DIR__) . '/carbonphp/carbon-doctrine-types/src/Carbon/Doctrine');

    if (is_dir(dirname(__DIR__) . '/beberlei/assert/lib/Assert')) {
        $loader->addPsr4('Assert\\', dirname(__DIR__) . '/beberlei/assert/lib/Assert');
    }
}

// Procedural helpers are not PSR-4 autoloadable, so load them eagerly.
$helperFiles = [
    __DIR__ . '/jalali/src/helpers.php',
    dirname(__DIR__) . '/beberlei/assert/lib/Assert/functions.php',
];

foreach ($helperFiles as $helperFile) {
    if (is_file($helperFile)) {
        require_once $helperFile;
    }
}
PHP

    # Hook into vendor/autoload.php and prove the file was really modified
    VENDOR_AUTOLOAD="${BUILD_DIR}/vendor/autoload.php"
    [[ -f "${VENDOR_AUTOLOAD}" ]] || die "vendor/autoload.php is missing from the EspoCRM base archive"

    AUTOLOAD_PATCHER="$(mktemp)"
    cat <<'PHP' > "${AUTOLOAD_PATCHER}"
<?php
declare(strict_types=1);

$file = $argv[1] ?? '';

if ($file === '' || !is_file($file)) {
    fwrite(STDERR, "vendor/autoload.php not found\n");
    exit(2);
}

$content = file_get_contents($file);

if ($content === false) {
    fwrite(STDERR, "cannot read vendor/autoload.php\n");
    exit(3);
}

if (strpos($content, 'morilog/autoload.php') !== false) {
    fwrite(STDERR, "vendor/autoload.php already references morilog/autoload.php; refusing an unverified patch\n");
    exit(6);
}

$pattern = '/return\s+([A-Za-z0-9_\\\\]+::getLoader\(\));/';
$replacement = "\$loader = \$1;\n"
    . "if (file_exists(__DIR__ . '/morilog/autoload.php')) {\n"
    . "    require_once __DIR__ . '/morilog/autoload.php';\n"
    . "}\n"
    . "return \$loader;";

$patched = preg_replace($pattern, $replacement, $content, 1, $count);

if ($patched === null || $count < 1 || $patched === $content) {
    fwrite(STDERR, "could not locate the Composer loader return statement\n");
    exit(4);
}

$written = file_put_contents($file, $patched);
if ($written === false || $written !== strlen($patched) || file_get_contents($file) !== $patched) {
    fwrite(STDERR, "cannot verify the vendor/autoload.php patch was written\n");
    exit(5);
}

echo "patched\n";
PHP

    set +e
    AUTOLOAD_PATCH_RESULT="$(php "${AUTOLOAD_PATCHER}" "${VENDOR_AUTOLOAD}" 2>&1)"
    AUTOLOAD_PATCH_STATUS=$?
    set -e

    rm -f "${AUTOLOAD_PATCHER}"

    if [[ ${AUTOLOAD_PATCH_STATUS} -ne 0 ]]; then
        die "could not patch vendor/autoload.php (status ${AUTOLOAD_PATCH_STATUS}): ${AUTOLOAD_PATCH_RESULT}"
    fi
    [[ "${AUTOLOAD_PATCH_RESULT}" == "patched" ]] \
        || die "vendor/autoload.php patch did not report a successful modification: ${AUTOLOAD_PATCH_RESULT}"

    grep -Fq "require_once __DIR__ . '/morilog/autoload.php';" "${VENDOR_AUTOLOAD}" \
        || die "vendor/autoload.php still lacks the morilog autoloader hook after patching"
    echo "  [OK] vendor/autoload.php hooked into vendor/morilog/autoload.php (${AUTOLOAD_PATCH_RESULT})"

    php -l "${VENDOR_AUTOLOAD}" >/dev/null || die "vendor/autoload.php is not valid PHP after patching"
    php -l "${BUILD_DIR}/vendor/morilog/autoload.php" >/dev/null || die "vendor/morilog/autoload.php is not valid PHP"
fi

# 5. Build and bundle Front-Office SPA
WEB_DIR="${ROOT_DIR}/apps/web"
APP_TARGET="${BUILD_DIR}/public/app"

[[ -f "${WEB_DIR}/package.json" ]] || die "apps/web/package.json is missing; the Front-Office SPA cannot be built"

echo "==> Compiling Front-Office React SPA..."
if [[ ! -d "${WEB_DIR}/node_modules" ]]; then
    npm --prefix "${WEB_DIR}" ci || npm --prefix "${WEB_DIR}" install
fi
npm --prefix "${WEB_DIR}" run build

[[ -d "${WEB_DIR}/dist" ]] || die "apps/web/dist is missing after 'npm run build'; refusing to ship a fallback page"
[[ -f "${WEB_DIR}/dist/index.html" ]] || die "apps/web/dist/index.html is missing; refusing to ship a fallback page"

echo "==> Staging compiled SPA into public/app..."
rm -rf "${APP_TARGET}"
mkdir -p "${APP_TARGET}"
cp -a "${WEB_DIR}/dist/." "${APP_TARGET}/"

# 6. Apply Same-Origin Routing Templates
echo "==> Applying Apache Same-Origin routing templates..."
if [[ -f "${ROOT_DIR}/deploy/htaccess.template" ]]; then
    cp "${ROOT_DIR}/deploy/htaccess.template" "${BUILD_DIR}/.htaccess"
fi
if [[ -f "${ROOT_DIR}/deploy/public-htaccess.template" ]]; then
    cp "${ROOT_DIR}/deploy/public-htaccess.template" "${BUILD_DIR}/public/.htaccess"
fi

# 7. Apply White-Label Branding
echo "==> Applying White-Label branding from config/brand.config.json..."
php "${ROOT_DIR}/scripts/apply-whitelabel.php" \
    --target="${BUILD_DIR}" \
    --brand="${ROOT_DIR}/config/brand.config.json"

# 8. Package standalone distribution ZIP
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
        -x "*.DS_Store" \
        -x "*.log" \
        -x ".env*" \
        -x "*/.env*" \
        -x "*.bak" \
        -x "*.swp" \
        -x "phpunit.xml*" \
        -x "*/phpunit.xml*" \
        -x "data/config.php" \
        -x "*/data/config.php"
)

run_with_timeout 300 unzip -tq "${ZIP_OUT}" >/dev/null || die "packaged archive failed its integrity check: ${ZIP_OUT}"

echo "==> Build complete: ${ZIP_OUT}"
echo "    Size: $(du -h "${ZIP_OUT}" | cut -f1)"
