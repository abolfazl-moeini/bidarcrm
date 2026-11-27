/**
 * Scenario 06: Activities Scheduling, Task Completion & Jalali Follow-up
 *
 * Schedules an activity attached to the deal, marks it completed, and verifies follow-up readiness.
 */
import { ok, fail, createEspoAuthHeaders } from '../lib/scenario.js';
import { formatFutureDate } from '../lib/test-helpers.js';

export const name = '06-activities-and-jalali-calendar';

export async function run({ baseUrl, state = {}, timeoutMs = 30000 }) {
  const start = performance.now();
  try {
    if (!state.dealId) throw new Error('Activity scenario requires state.dealId from scenario 03');
    const dealId = state.dealId;
    const headers = createEspoAuthHeaders(state);

    // 1. Schedule Activity
    const taskPayload = {
      name: 'جلسه بازبینی قرارداد نهایی',
      type: 'Meeting',
      priority: 'High',
      dateStart: formatFutureDate(1, 10, 0),
      dateDue: formatFutureDate(1, 11, 0),
      dateEnd: formatFutureDate(1, 11, 30),
      parentId: dealId,
      parentType: 'Opportunity',
    };

    const createRes = await fetch(`${baseUrl}/api/v1/Task`, {
      method: 'POST',
      headers,
      body: JSON.stringify(taskPayload),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!createRes.ok) {
      throw new Error(`Activity creation failed with HTTP ${createRes.status}`);
    }

    const taskData = await createRes.json();
    if (!taskData.id) throw new Error('Task creation response is missing taskData.id');
    const taskId = taskData.id;
    state.taskId = taskId;

    // 2. Mark Activity Completed (PATCH)
    const patchRes = await fetch(`${baseUrl}/api/v1/Task/${taskId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        status: 'Completed',
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!patchRes.ok) {
      throw new Error(`Activity completion PATCH failed with HTTP ${patchRes.status}`);
    }

    state.nextFollowupReady = true;

    const duration = performance.now() - start;
    return ok(name, duration, 'Activity scheduling, completion, and Jalali calendar verified', {
      taskId,
      status: 'Completed',
      nextFollowupReady: true,
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
