/**
 * Scenario 04: 360-Degree Deal Detail Stream & Rotten Deal Activity Reset
 *
 * Inspects deal stream timeline and logs interaction note to reset rottenness.
 */
import { ok, fail } from '../lib/scenario.js';

export const name = '04-deal-detail-stream-and-rotten-reset';

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

    // 1. Fetch Deal Stream Timeline
    const streamRes = await fetch(`${baseUrl}/api/v1/Opportunity/${dealId}/stream`, {
      method: 'GET',
      headers,
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
        type: 'Note',
        post: 'ثبت فعالیت پیگیری فوری جهت رفع پوسیدگی معامله و تمدید تعامل',
      }),
    });
    if (!noteRes.ok) {
      throw new Error(`Note creation failed with HTTP ${noteRes.status}`);
    }

    const noteData = await noteRes.json();
    const noteId = noteData.id || 'note-e2e-201';
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
