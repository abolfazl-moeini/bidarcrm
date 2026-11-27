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

/** Build EspoCRM token headers and fail closed when authentication is missing. */
export function createEspoAuthHeaders(state = {}) {
  const token = typeof state.token === 'string' ? state.token.trim() : '';
  if (!token) {
    throw new Error('Authenticated scenario requires state.token from scenario 01');
  }

  const username = state.username || 'admin';
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Espo-Authorization': Buffer.from(`${username}:${token}`).toString('base64'),
    'Espo-Authorization-By-Token': 'true',
  };
}
