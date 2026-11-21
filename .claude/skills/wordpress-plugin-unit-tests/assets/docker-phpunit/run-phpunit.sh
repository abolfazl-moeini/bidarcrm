#!/usr/bin/env bash
#
# Run plugin PHPUnit tests inside Docker.
# Usage:
#   ./run-phpunit.sh                  # full suite
#   ./run-phpunit.sh 'MyTestClass'    # --filter value
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FILTER="${1:-}"

if [[ ! -f "${SCRIPT_DIR}/.env" ]]; then
  echo "Missing .env — copy env.example to .env and set PLUGIN_ROOT, WORDPRESS_DEVELOP_ROOT, and PLUGIN_MAIN_FILE."
  exit 1
fi

# shellcheck disable=SC1091
set -a
source "${SCRIPT_DIR}/.env"
set +a

: "${PLUGIN_ROOT:?Set PLUGIN_ROOT in .env}"
: "${WORDPRESS_DEVELOP_ROOT:?Set WORDPRESS_DEVELOP_ROOT in .env}"
: "${PLUGIN_MAIN_FILE:?Set PLUGIN_MAIN_FILE in .env (relative to PLUGIN_ROOT)}"
# Always use this script's directory so rendered config matches the compose bind mount.
# Must be exported: docker compose interpolates ${DOCKER_PHPUNIT_DIR} in docker-compose.yml.
export DOCKER_PHPUNIT_DIR="${SCRIPT_DIR}"

PLUGIN_CONTAINER_PATH="${PLUGIN_CONTAINER_PATH:-/var/www/plugin}"
WORDPRESS_DEVELOP_CONTAINER_PATH="${WORDPRESS_DEVELOP_CONTAINER_PATH:-/var/www/wordpress-develop}"
DOCKER_PHPUNIT_CONTAINER_PATH="${DOCKER_PHPUNIT_CONTAINER_PATH:-/var/www/docker-phpunit}"
WP_TESTS_LIB_CONTAINER_PATH="${WP_TESTS_LIB_CONTAINER_PATH:-/var/www/wordpress-tests-lib}"
WORDPRESS_CORE_CONTAINER_PATH="${WORDPRESS_CORE_CONTAINER_PATH:-/var/www/wordpress-develop/src}"
PHPUNIT_BIN="${PHPUNIT_BIN:-./vendor/bin/phpunit}"

if [[ "${PLUGIN_MAIN_FILE}" = /* ]]; then
  echo "PLUGIN_MAIN_FILE must be relative to PLUGIN_ROOT, not an absolute path."
  exit 1
fi

if [[ ! -f "${PLUGIN_ROOT}/${PLUGIN_MAIN_FILE}" ]]; then
  echo "Plugin main file not found at ${PLUGIN_ROOT}/${PLUGIN_MAIN_FILE}"
  exit 1
fi

# phpunit.xml.dist normally contains a host path. Override it for Docker so
# Setup::mu_plugins_loaded() can require the mounted plugin file.
BOOTSTRAP_FILE="${PLUGIN_CONTAINER_PATH}/${PLUGIN_MAIN_FILE}"

DB_NAME="${DB_NAME:-wp_tests}"
DB_USER="${DB_USER:-wp_test_user}"
DB_PASSWORD="${DB_PASSWORD:-wp_test_pass}"
DB_ROOT_PASSWORD="${DB_ROOT_PASSWORD:-root}"

PHP_SERVICE="${PHP_SERVICE:-php}"
DB_SERVICE="${DB_SERVICE:-db}"

compose_exec() {
  local service="$1"
  shift
  docker compose exec -T "${service}" "$@"
}

if [[ ! -d "${PLUGIN_ROOT}/vendor" ]]; then
  echo "vendor/ not found in PLUGIN_ROOT. Run composer install in ${PLUGIN_ROOT} first."
  exit 1
fi

if [[ ! -d "${WORDPRESS_DEVELOP_ROOT}/tests/phpunit/includes" ]]; then
  echo "WordPress PHPUnit includes not found at ${WORDPRESS_DEVELOP_ROOT}/tests/phpunit/includes"
  exit 1
fi

if [[ ! -f "${WORDPRESS_DEVELOP_ROOT}/src/wp-includes/version.php" ]]; then
  echo "WordPress core not found at ${WORDPRESS_DEVELOP_ROOT}/src"
  exit 1
fi

if [[ -n "${WOOCOMMERCE_ROOT:-}" && ! -f "${WOOCOMMERCE_ROOT}/woocommerce.php" ]]; then
  echo "WooCommerce main file not found at ${WOOCOMMERCE_ROOT}/woocommerce.php"
  exit 1
fi

if ! command -v envsubst >/dev/null 2>&1; then
  echo "envsubst is required on the host. Install GNU gettext (for example: brew install gettext)."
  exit 1
fi

cd "${SCRIPT_DIR}"

echo "Starting Docker services..."
docker compose up -d

render_wp_tests_config() {
  local template="${SCRIPT_DIR}/wp-tests-config.php.template"
  local output="${SCRIPT_DIR}/wp-tests-config.php"

  if [[ ! -f "${template}" ]]; then
    echo "Missing template: ${template}"
    exit 1
  fi

  export WORDPRESS_CORE_CONTAINER_PATH DB_NAME DB_USER DB_PASSWORD
  envsubst '${WORDPRESS_CORE_CONTAINER_PATH} ${DB_NAME} ${DB_USER} ${DB_PASSWORD}' \
    < "${template}" > "${output}"
}

render_wp_tests_config

echo "Copying WordPress PHPUnit library into the PHP container..."
compose_exec "${PHP_SERVICE}" bash -c "
  set -euo pipefail
  rm -rf '${WP_TESTS_LIB_CONTAINER_PATH}'
  cp -r '${WORDPRESS_DEVELOP_CONTAINER_PATH}/tests/phpunit' '${WP_TESTS_LIB_CONTAINER_PATH}'
  cp '${DOCKER_PHPUNIT_CONTAINER_PATH}/wp-tests-config.php' '${WP_TESTS_LIB_CONTAINER_PATH}/wp-tests-config.php'
"

# compose `depends_on: service_healthy` already gates startup; this is a bounded
# safety net for restarts, so a stuck database fails fast instead of hanging.
echo "Waiting for MySQL..."
for attempt in $(seq 1 60); do
  if compose_exec "${DB_SERVICE}" mysqladmin ping -h localhost -u root -p"${DB_ROOT_PASSWORD}" --silent 2>/dev/null; then
    break
  fi
  if [[ "${attempt}" -eq 60 ]]; then
    echo "MySQL did not become ready in 60s. Check: docker compose logs db"
    exit 1
  fi
  sleep 1
done

PHPUNIT_CMD="WP_TESTS_DIR=${WP_TESTS_LIB_CONTAINER_PATH} WP_TESTS_CONFIG_FILE_PATH=${WP_TESTS_LIB_CONTAINER_PATH}/wp-tests-config.php PLUGIN_ROOT=${PLUGIN_CONTAINER_PATH} BOOTSTRAP_FILE=${BOOTSTRAP_FILE} ${PHPUNIT_BIN}"

if [[ -n "${FILTER}" ]]; then
  PHPUNIT_CMD="${PHPUNIT_CMD} --filter '${FILTER}'"
fi

echo "Running PHPUnit in container (${PHP_SERVICE})..."
compose_exec "${PHP_SERVICE}" bash -c "cd '${PLUGIN_CONTAINER_PATH}' && ${PHPUNIT_CMD}"
