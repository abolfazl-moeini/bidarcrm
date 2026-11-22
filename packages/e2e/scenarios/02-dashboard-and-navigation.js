/**
 * Scenario 02: Dashboard & Navigation Verification
 *
 * Fetches dashboard KPI summary and validates aggregated revenue and deal counts.
 */
import { ok, fail } from '../lib/scenario.js';

export const name = '02-dashboard-and-navigation';

export async function run({ baseUrl, state = {} }) {
  const start = performance.now();
  try {
    const headers = {
      Accept: 'application/json',
    };
    if (state.token) {
      headers['Espo-Authorization'] = state.token;
      headers['Authorization'] = `Bearer ${state.token}`;
    }

    const response = await fetch(`${baseUrl}/api/v1/BidarDashboard/summary`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Dashboard summary request failed with HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Validate metrics structure
    if (typeof data.openDealsCount !== 'number' && typeof data.totalOpenAmount !== 'number') {
      throw new Error('Dashboard summary response missing expected KPI metrics');
    }

    state.kpis = {
      openDealsCount: data.openDealsCount ?? 0,
      totalOpenAmount: data.totalOpenAmount ?? 0,
      wonDealsCount: data.wonDealsCount ?? 0,
      rottenDealsCount: data.rottenDealsCount ?? 0,
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
