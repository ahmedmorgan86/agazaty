import { createSign } from 'node:crypto';

const ADMIN_EMAIL = 'ahmed.morgan2009@gmail.com';
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

function serviceAccount() {
  const raw = process.env.AGAZATY_FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  return parsed.client_email && parsed.private_key && parsed.project_id ? parsed : null;
}

const b64url = value => Buffer.from(value).toString('base64url');

async function accessToken(account) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({
    iss: account.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3000
  }))}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(account.private_key).toString('base64url');
  const result = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` })
  });
  if (!result.ok) throw new Error('token');
  return (await result.json()).access_token;
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
  const origin = request.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== request.headers.host) return response.status(403).json({ error: 'Forbidden' });
    } catch { return response.status(403).json({ error: 'Forbidden' }); }
  }
  const header = request.headers.authorization || '';
  const idToken = header.startsWith('Bearer ') ? header.slice(7) : '';
  const { employeeId, password } = request.body || {};
  if (!idToken || typeof employeeId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(employeeId) ||
      typeof password !== 'string' || password.length < 7 || password.length > 64) {
    return response.status(400).json({ error: 'Invalid request' });
  }
  let account;
  try { account = serviceAccount(); } catch { account = null; }
  const apiKey = process.env.AGAZATY_FIREBASE_API_KEY;
  if (!account || !apiKey) return response.status(503).json({ error: 'Unavailable' });
  try {
    // 1. Who is calling? Firebase validates the ID token and returns the user and custom claims.
    const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Referer: 'https://agazaty-am.vercel.app/' }, body: JSON.stringify({ idToken })
    });
    if (!lookup.ok) return response.status(401).json({ error: 'Unauthorized' });
    const caller = (await lookup.json()).users?.[0];
    if (!caller || String(caller.email || '').toLowerCase() !== ADMIN_EMAIL) return response.status(403).json({ error: 'Forbidden' });
    const token = await accessToken(account);
    const auth = { Authorization: `Bearer ${token}` };
    const docs = `https://firestore.googleapis.com/v1/projects/${account.project_id}/databases/(default)/documents`;
    let claims = {};
    try { claims = JSON.parse(caller.customAttributes || '{}'); } catch { claims = {}; }
    let isAdmin = claims.admin === true;
    if (!isAdmin) {
      const owner = await fetch(`${docs}/ownerAccess/${encodeURIComponent(caller.localId)}`, { headers: auth });
      isAdmin = owner.ok && (await owner.json()).fields?.role?.stringValue === 'admin';
    }
    if (!isAdmin) return response.status(403).json({ error: 'Forbidden' });
    // 2. Which Auth account belongs to this employee?
    const staff = await fetch(`${docs}/staff/${encodeURIComponent(employeeId)}`, { headers: auth });
    const authUid = staff.ok ? (await staff.json()).fields?.authUid?.stringValue : '';
    if (!authUid || authUid === caller.localId) return response.status(404).json({ error: 'Employee account not found' });
    // 3. Set the new password. Firebase signs the employee out of existing sessions.
    const update = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${account.project_id}/accounts:update`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: authUid, password })
    });
    if (!update.ok) return response.status(502).json({ error: 'Update failed' });
    return response.status(200).json({ ok: true });
  } catch {
    return response.status(500).json({ error: 'Server error' });
  }
}
