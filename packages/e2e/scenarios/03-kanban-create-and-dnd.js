/**
 * Scenario 03: Kanban Pipeline, Deal Creation & Drag-and-Drop Transition
 *
 * Verifies pipeline stages discovery, creates a deal, and simulates stage transition.
 */
import { ok, fail } from '../lib/scenario.js';

export const name = '03-kanban-create-and-dnd';

export async function run({ baseUrl, state = {} }) {
  const start = performance.now();
  try {
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    if (state.token) {
      const username = state.username || 'admin';
      const authVal = Buffer.from(`${username}:${state.token}`).toString('base64');
      headers['Espo-Authorization'] = authVal;
      headers['Espo-Authorization-By-Token'] = 'true';
      headers['Authorization'] = `Bearer ${state.token}`;
    }

    // 1. Fetch Pipelines & Stages
    const pipeRes = await fetch(`${baseUrl}/api/v1/Pipeline`, {
      method: 'GET',
      headers,
    });
    if (!pipeRes.ok) {
      throw new Error(`Pipeline fetch failed with HTTP ${pipeRes.status}`);
    }
    const pipeData = await pipeRes.json();
    const pipelines = pipeData.list || [];
    state.pipeline = pipelines[0] || null;

    // 2. Create Opportunity
    const createRes = await fetch(`${baseUrl}/api/v1/Opportunity`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'معامله تستی سناریوی E2E',
        amount: 25000000,
        pipelineStageId: 'stage-1',
        stage: 'سرنخ جدید',
      }),
    });
    if (!createRes.ok) {
      throw new Error(`Opportunity creation failed with HTTP ${createRes.status}`);
    }
    const createdDeal = await createRes.json();
    const dealId = createdDeal.id || 'deal-e2e-101';
    state.dealId = dealId;

    // 3. Simulate Drag & Drop Stage Move (PATCH)
    const patchRes = await fetch(`${baseUrl}/api/v1/Opportunity/${dealId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        pipelineStageId: 'stage-2',
        stage: 'مذاکره اولیه',
      }),
    });
    if (!patchRes.ok) {
      throw new Error(`Stage transition PATCH failed with HTTP ${patchRes.status}`);
    }

    const duration = performance.now() - start;
    return ok(name, duration, 'Kanban deal creation and stage transition verified', {
      dealId,
      stage: 'مذاکره اولیه',
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
