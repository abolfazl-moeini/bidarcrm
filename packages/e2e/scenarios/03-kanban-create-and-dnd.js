/**
 * Scenario 03: Kanban Pipeline, Deal Creation & Drag-and-Drop Transition
 *
 * Verifies pipeline stages discovery, creates a deal, and simulates stage transition.
 */
import { ok, fail, createEspoAuthHeaders } from '../lib/scenario.js';

export const name = '03-kanban-create-and-dnd';

export async function run({ baseUrl, state = {}, timeoutMs = 30000 }) {
  const start = performance.now();
  try {
    const headers = createEspoAuthHeaders(state);

    // 1. Fetch Pipelines & Stages
    const pipeRes = await fetch(`${baseUrl}/api/v1/Pipeline`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!pipeRes.ok) {
      throw new Error(`Pipeline fetch failed with HTTP ${pipeRes.status}`);
    }
    const pipeData = await pipeRes.json();
    const pipelines = Array.isArray(pipeData.list) ? pipeData.list : [];
    const discoveredPipeline = pipelines.find((pipeline) => Array.isArray(pipeline?.stages) && pipeline.stages.length > 0);
    state.pipeline = Array.isArray(state.pipeline?.stages) && state.pipeline.stages.length > 0
      ? state.pipeline
      : discoveredPipeline || pipelines[0] || null;

    let stages = Array.isArray(state.pipeline?.stages) ? state.pipeline.stages : null;
    if (!Array.isArray(stages)) {
      const stagesRes = await fetch(`${baseUrl}/api/v1/PipelineStage`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!stagesRes.ok) {
        throw new Error(`Pipeline has no stages array and PipelineStage fetch failed with HTTP ${stagesRes.status}`);
      }
      const stagesData = await stagesRes.json();
      stages = Array.isArray(stagesData.list) ? stagesData.list : null;
    }
    if (!Array.isArray(stages) || stages.length < 2 || !stages[0]?.id || !stages[1]?.id) {
      throw new Error('Pipeline stage discovery requires at least two stages with IDs');
    }
    const [firstStage, nextStage] = stages.slice(0, 2);
    if (!firstStage.name || !nextStage.name) {
      throw new Error('Pipeline stage discovery requires names for the first two stages');
    }

    // 2. Create Opportunity
    const createRes = await fetch(`${baseUrl}/api/v1/Opportunity`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'معامله تستی سناریوی E2E',
        amount: 25000000,
        pipelineStageId: firstStage.id,
        stage: firstStage.name,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!createRes.ok) {
      throw new Error(`Opportunity creation failed with HTTP ${createRes.status}`);
    }
    const createdDeal = await createRes.json();
    if (!createdDeal.id) throw new Error('Opportunity creation response is missing createdDeal.id');
    const dealId = createdDeal.id;
    state.dealId = dealId;

    // 3. Simulate Drag & Drop Stage Move (PATCH)
    const patchRes = await fetch(`${baseUrl}/api/v1/Opportunity/${dealId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        pipelineStageId: nextStage.id,
        stage: nextStage.name,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!patchRes.ok) {
      throw new Error(`Stage transition PATCH failed with HTTP ${patchRes.status}`);
    }

    const duration = performance.now() - start;
    return ok(name, duration, 'Kanban deal creation and stage transition verified', {
      dealId,
      stage: nextStage.name,
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
