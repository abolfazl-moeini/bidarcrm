/**
 * BidarCRM - Scenario Result Helpers
 *
 * Provides standardized result builders for E2E scenarios.
 */

/**
 * Returns a standardized passing scenario result.
 *
 * @param {string} name - Scenario name or identifier
 * @param {number} durationMs - Execution time in milliseconds
 * @param {string} [message='Passed'] - Description or success note
 * @param {Record<string, any>} [extra={}] - Additional metadata or state to propagate
 */
export function ok(name, durationMs, message = 'Passed', extra = {}) {
  return {
    name,
    ok: true,
    durationMs: Math.round(durationMs),
    message,
    ...extra,
  };
}

/**
 * Returns a standardized failing scenario result.
 *
 * @param {string} name - Scenario name or identifier
 * @param {number} durationMs - Execution time in milliseconds
 * @param {Error|string} error - Error instance or error message
 * @param {Record<string, any>} [extra={}] - Additional diagnostic metadata
 */
export function fail(name, durationMs, error, extra = {}) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return {
    name,
    ok: false,
    durationMs: Math.round(durationMs),
    message: errorMessage,
    error: errorMessage,
    ...extra,
  };
}
