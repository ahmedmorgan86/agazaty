import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const ADMIN_EMAIL = 'ahmed.morgan2009@gmail.com';

function adminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.AGAZATY_FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  return initializeApp({ credential: cert(JSON.parse(raw)) });
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
  let app;
  try { app = adminApp(); } catch { return response.status(503).json({ error: 'Unavailable' }); }
  if (!app) return response.status(503).json({ error: 'Unavailable' });
  try {
    const auth = getAuth(app);
    const db = getFirestore(app);
    const caller = await auth.verifyIdToken(idToken, true);
    const owner = caller.admin === true ? null : await db.doc(`ownerAccess/${caller.uid}`).get();
    const isAdmin = String(caller.email || '').toLowerCase() === ADMIN_EMAIL &&
      (caller.admin === true || owner?.data()?.role === 'admin');
    if (!isAdmin) return response.status(403).json({ error: 'Forbidden' });
    const staff = await db.doc(`staff/${employeeId}`).get();
    const authUid = staff.data()?.authUid;
    if (!staff.exists || typeof authUid !== 'string' || authUid === caller.uid) {
      return response.status(404).json({ error: 'Employee account not found' });
    }
    await auth.updateUser(authUid, { password });
    await auth.revokeRefreshTokens(authUid);
    return response.status(200).json({ ok: true });
  } catch {
    return response.status(401).json({ error: 'Unauthorized' });
  }
}
