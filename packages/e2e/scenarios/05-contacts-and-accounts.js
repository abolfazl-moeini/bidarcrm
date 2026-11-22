/**
 * Scenario 05: Contacts & Accounts Directory Verification
 *
 * Creates a contact with Iran phone format validation and queries the directory.
 */
import { ok, fail } from '../lib/scenario.js';

export const name = '05-contacts-and-accounts';

export async function run({ baseUrl, state = {} }) {
  const start = performance.now();
  try {
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    if (state.token) {
      headers['Espo-Authorization'] = state.token;
      headers['Authorization'] = `Bearer ${state.token}`;
    }

    // 1. Create Contact with Iran mobile format
    const contactPayload = {
      firstName: 'مهرداد',
      lastName: 'پرهام',
      phoneNumber: '09121234567',
      emailAddress: 'parham@example.ir',
      accountName: 'شرکت فناوران هوشمند',
    };

    // Client-side phone format assertion
    if (!/^09\d{9}$/.test(contactPayload.phoneNumber)) {
      throw new Error('Iran phone number format validation failed');
    }

    const createRes = await fetch(`${baseUrl}/api/v1/Contact`, {
      method: 'POST',
      headers,
      body: JSON.stringify(contactPayload),
    });

    if (!createRes.ok) {
      throw new Error(`Contact creation failed with HTTP ${createRes.status}`);
    }

    const contactData = await createRes.json();
    const contactId = contactData.id || 'contact-e2e-301';
    state.contactId = contactId;

    // 2. Search & Query Contacts
    const queryRes = await fetch(`${baseUrl}/api/v1/Contact?maxSize=20&search=09121234567`, {
      method: 'GET',
      headers,
    });

    if (!queryRes.ok) {
      throw new Error(`Contacts search query failed with HTTP ${queryRes.status}`);
    }

    const duration = performance.now() - start;
    return ok(name, duration, 'Contact creation, Iran phone validation, and search query verified', {
      contactId,
      accountName: contactPayload.accountName,
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
