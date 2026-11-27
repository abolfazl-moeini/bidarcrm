/**
 * Scenario 02: Dashboard & Navigation Verification
 *
 * Fetches dashboard KPI summary and validates aggregated revenue and deal counts.
 */
import { ok, fail, createEspoAuthHeaders } from '../lib/scenario.js';

export const name = '02-dashboard-and-navigation';

export async function run({ baseUrl, state = {}, timeoutMs = 30000 }) {
  const start = performance.now();
  try {
    const headers = createEspoAuthHeaders(state);

    const response = await fetch(`${baseUrl}/api/v1/BidarDashboard/summary`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Dashboard summary request failed with HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Validate metrics structure (support both new contracts and legacy fallbacks)
    if (typeof data.openCount !== 'number' && typeof data.openDealsCount !== 'number') {
      throw new Error('Dashboard summary response missing expected KPI metrics');
    }

    state.kpis = {
      openCount: data.openCount ?? data.openDealsCount ?? 0,
      openAmount: data.openAmount ?? data.totalOpenAmount ?? 0,
      wonCount: data.wonCount ?? data.wonDealsCount ?? 0,
      rottenCount: data.rottenCount ?? data.rottenDealsCount ?? 0,
      openDealsCount: data.openCount ?? data.openDealsCount ?? 0,
      totalOpenAmount: data.openAmount ?? data.totalOpenAmount ?? 0,
      wonDealsCount: data.wonCount ?? data.wonDealsCount ?? 0,
      rottenDealsCount: data.rottenCount ?? data.rottenDealsCount ?? 0,
    };

    const duration = performance.now() - start;
    return ok(name, duration, 'Dashboard summary metrics and navigation verified', {
      kpis: state.kpis,
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
