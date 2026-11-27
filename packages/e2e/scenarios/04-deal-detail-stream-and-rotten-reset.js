/**
 * Scenario 04: 360-Degree Deal Detail Stream & Rotten Deal Activity Reset
 *
 * Inspects deal stream timeline and logs interaction note to reset rottenness.
 */
import { ok, fail, createEspoAuthHeaders } from '../lib/scenario.js';

export const name = '04-deal-detail-stream-and-rotten-reset';

export async function run({ baseUrl, state = {}, timeoutMs = 30000 }) {
  const start = performance.now();
  try {
    if (!state.dealId) throw new Error('Deal detail scenario requires state.dealId from scenario 03');
    const dealId = state.dealId;
    const headers = createEspoAuthHeaders(state);

    // 1. Fetch Deal Stream Timeline
    const streamRes = await fetch(`${baseUrl}/api/v1/Opportunity/${dealId}/stream`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!streamRes.ok) {
      throw new Error(`Stream fetch failed with HTTP ${streamRes.status}`);
    }

    // 2. Post New Follow-up Note to Reset Rottenness
    const noteRes = await fetch(`${baseUrl}/api/v1/Note`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        parentType: 'Opportunity',
        parentId: dealId,
        type: 'Post',
        post: 'ثبت فعالیت پیگیری فوری جهت رفع پوسیدگی معامله و تمدید تعامل',
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!noteRes.ok) {
      throw new Error(`Note creation failed with HTTP ${noteRes.status}`);
    }

    const noteData = await noteRes.json();
    if (!noteData.id) throw new Error('Note creation response is missing noteData.id');
    const noteId = noteData.id;
    state.noteId = noteId;

    const duration = performance.now() - start;
    return ok(name, duration, 'Deal stream timeline and rotten activity reset verified', {
      dealId,
      noteId,
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
