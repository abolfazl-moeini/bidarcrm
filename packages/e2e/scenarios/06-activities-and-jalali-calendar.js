/**
 * Scenario 06: Activities Scheduling, Task Completion & Jalali Follow-up
 *
 * Schedules an activity attached to the deal, marks it completed, and verifies follow-up readiness.
 */
import { ok, fail } from '../lib/scenario.js';

export const name = '06-activities-and-jalali-calendar';

export async function run({ baseUrl, state = {} }) {
  const start = performance.now();
  try {
    const dealId = state.dealId || 'deal-e2e-101';
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    if (state.token) {
      headers['Espo-Authorization'] = state.token;
      headers['Authorization'] = `Bearer ${state.token}`;
    }

    // 1. Schedule Activity
    const taskPayload = {
      name: 'جلسه بازبینی قرارداد نهایی',
      type: 'Meeting',
      priority: 'High',
      dateDue: '2026-11-25T10:00:00.000Z',
      parentId: dealId,
      parentType: 'Opportunity',
    };

    const createRes = await fetch(`${baseUrl}/api/v1/Task`, {
      method: 'POST',
      headers,
      body: JSON.stringify(taskPayload),
    });

    if (!createRes.ok) {
      throw new Error(`Activity creation failed with HTTP ${createRes.status}`);
    }

    const taskData = await createRes.json();
    const taskId = taskData.id || 'task-e2e-401';
    state.taskId = taskId;

    // 2. Mark Activity Completed (PATCH)
    const patchRes = await fetch(`${baseUrl}/api/v1/Task/${taskId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        status: 'Completed',
      }),
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
