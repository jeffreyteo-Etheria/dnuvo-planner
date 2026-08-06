// Live sync — one shared blob holding the current plan.
// No database, no per-user accounts: a single shared workspace,
// protected by one passphrase (WORKSPACE_KEY, set in Netlify's site
// environment variables, never committed to this repo).
import { getStore } from '@netlify/blobs';

const json = (body, status) => new Response(JSON.stringify(body), {
  status: status || 200,
  headers: { 'Content-Type': 'application/json' }
});

export default async (req) => {
  const store = getStore('dnuvo-planner');

  if (req.method === 'GET') {
    const data = await store.get('state', { type: 'json' });
    return json(data || {});
  }

  if (req.method === 'POST') {
    const key = process.env.WORKSPACE_KEY;
    if (!key) {
      return json({ error: 'WORKSPACE_KEY is not set on this site yet — add it in Netlify site settings before using Live sync.' }, 500);
    }
    if (req.headers.get('x-workspace-key') !== key) {
      return json({ error: 'Wrong workspace key.' }, 401);
    }

    let body;
    try { body = await req.json(); }
    catch (e) { return json({ error: 'Invalid JSON body.' }, 400); }

    await store.setJSON('state', body);
    return json({ ok: true, savedAt: new Date().toISOString() });
  }

  return json({ error: 'Method not allowed' }, 405);
};
