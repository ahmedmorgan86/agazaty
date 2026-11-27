import { createSign } from 'node:crypto';

const ADMIN_EMAIL = 'ahmed.morgan2009@gmail.com';
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const REFERER = 'https://agazaty-am.vercel.app/';
const b64url = value => Buffer.from(value).toString('base64url');

function serviceAccount() {
  const raw = process.env.AGAZATY_FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  return parsed.client_email && parsed.private_key && parsed.project_id ? parsed : null;
}

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

// The starter password lives in serverSecrets/starter. No Firestore rule matches that path,
// so browsers can never read it; only this server code (service account) can.
async function readStarter(docs, auth) {
  const secret = await fetch(`${docs}/serverSecrets/starter`, { headers: auth });
  if (secret.ok) {
    const value = (await secret.json()).fields?.value?.stringValue;
    if (typeof value === 'string' && value.length >= 7) return value;
  }
  // Before the one-time move, the old location is used.
  const legacy = await fetch(`${docs}/meta/workspace`, { headers: auth });
  if (legacy.ok) {
    const value = (await legacy.json()).fields?.starterPassword?.stringValue;
    if (typeof value === 'string' && value.length >= 7) return value;
  }
  return '';
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
  const body = request.body || {};
  const action = body.action;
  if (!idToken || !['get', 'set', 'status', 'change'].includes(action)) return response.status(400).json({ error: 'Invalid request' });
  let account;
  try { account = serviceAccount(); } catch { account = null; }
  const apiKey = process.env.AGAZATY_FIREBASE_API_KEY;
  if (!account || !apiKey) return response.status(503).json({ error: 'Unavailable' });
  try {
    const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Referer: REFERER }, body: JSON.stringify({ idToken })
    });
    if (!lookup.ok) return response.status(401).json({ error: 'Unauthorized' });
    const caller = (await lookup.json()).users?.[0];
    if (!caller) return response.status(401).json({ error: 'Unauthorized' });
    const email = String(caller.email || '').toLowerCase();
    const token = await accessToken(account);
    const auth = { Authorization: `Bearer ${token}` };
    const docs = `https://firestore.googleapis.com/v1/projects/${account.project_id}/databases/(default)/documents`;
    let claims = {};
    try { claims = JSON.parse(caller.customAttributes || '{}'); } catch { claims = {}; }
    let isAdmin = email === ADMIN_EMAIL && claims.admin === true;
    if (email === ADMIN_EMAIL && !isAdmin) {
      const owner = await fetch(`${docs}/ownerAccess/${encodeURIComponent(caller.localId)}`, { headers: auth });
      isAdmin = owner.ok && (await owner.json()).fields?.role?.stringValue === 'admin';
    }

    if (action === 'get' || action === 'set') {
      if (!isAdmin) return response.status(403).json({ error: 'Forbidden' });
      if (action === 'get') return response.status(200).json({ password: await readStarter(docs, auth) });
      const value = body.password;
      if (typeof value !== 'string' || value.length < 7 || value.length > 64) return response.status(400).json({ error: 'Invalid request' });
      const write = await fetch(`${docs}/serverSecrets/starter?updateMask.fieldPaths=value&updateMask.fieldPaths=updatedAt`, {
        method: 'PATCH', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { value: { stringValue: value }, updatedAt: { timestampValue: new Date().toISOString() } } })
      });
      if (!write.ok) return response.status(502).json({ error: 'Save failed' });
      return response.status(200).json({ ok: true });
    }

    // status / change: only for a blue or yellow employee whose CURRENT password is the starter.
    if (isAdmin || email === ADMIN_EMAIL) return response.status(200).json({ mustChange: false });
    const typed = body.typed;
    if (typeof typed !== 'string' || typed.length < 1 || typed.length > 128) return response.status(400).json({ error: 'Invalid request' });
    const profile = await fetch(`${docs}/employeeAccounts/${encodeURIComponent(caller.localId)}`, { headers: auth });
    const team = profile.ok ? (await profile.json()).fields?.team?.stringValue : '';
    if (!['blue', 'yellow'].includes(team)) return response.status(200).json({ mustChange: false });
    // Prove the typed value really is this account's current password before comparing it.
    const proof = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Referer: REFERER },
      body: JSON.stringify({ email: caller.email, password: typed, returnSecureToken: false })
    });
    if (!proof.ok) return response.status(403).json({ error: 'Forbidden' });
    const starter = await readStarter(docs, auth);
    const onStarter = Boolean(starter) && typed === starter;
    if (action === 'status') return response.status(200).json({ mustChange: onStarter });
    const next = body.next;
    if (!onStarter || typeof next !== 'string' || next.length < 7 || next.length > 64 || next === starter) {
      return response.status(400).json({ error: 'Invalid request' });
    }
    const update = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${account.project_id}/accounts:update`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: caller.localId, password: next })
    });
    if (!update.ok) return response.status(502).json({ error: 'Update failed' });
    return response.status(200).json({ ok: true });
  } catch {
    return response.status(500).json({ error: 'Server error' });
  }
}
