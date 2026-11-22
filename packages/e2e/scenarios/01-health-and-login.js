/**
 * Scenario 01: Health & Authentication Handshake
 *
 * Verifies system availability and performs EspoCRM auth handshake.
 */
import { ok, fail } from '../lib/scenario.js';

export const name = '01-health-and-login';

/**
 * Executes health check and authentication.
 *
 * @param {object} context
 * @param {string} context.baseUrl - Base target URL
 * @param {object} context.credentials - Credentials { username, password }
 * @param {object} context.state - Shared scenario state for chaining
 * @returns {Promise<object>}
 */
export async function run({ baseUrl, credentials = {}, state = {} }) {
  const start = performance.now();
  try {
    const authHeader = 'Basic ' + Buffer.from(`${credentials.username || 'admin'}:${credentials.password || 'admin'}`).toString('base64');
    
    // Call EspoCRM user authentication endpoint
    const response = await fetch(`${baseUrl}/api/v1/App/user`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
        'Espo-Authorization': Buffer.from(`${credentials.username || 'admin'}:${credentials.password || 'admin'}`).toString('base64'),
      },
    });

    if (!response.ok) {
      throw new Error(`Authentication check failed with HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const token = data.token || data.user?.id || 'simulated-token';

    // Store in shared state for subsequent scenarios (Chain of Responsibility)
    state.token = token;
    state.user = data.user;

    const duration = performance.now() - start;
    return ok(name, duration, 'Authentication handshake verified successfully', {
      token,
      user: data.user,
    });
  } catch (err) {
    const duration = performance.now() - start;
    return fail(name, duration, err);
  }
}

export default {
  name,
  run,
};
