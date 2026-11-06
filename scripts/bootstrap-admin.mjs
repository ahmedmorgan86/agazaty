import { randomBytes } from 'node:crypto';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const email = process.argv[2];
const existing = process.argv.includes('--existing');
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Usage: GOOGLE_APPLICATION_CREDENTIALS=/private/path/service-account.json npm run bootstrap:admin -- admin@example.com [--existing]');
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId: 'agazaty' });
const auth = getAuth();
const password = existing ? null : randomBytes(24).toString('base64url');
let created;
try {
  const user = existing ? await auth.getUserByEmail(email) : (created = await auth.createUser({ email, password }));
  await auth.setCustomUserClaims(user.uid, { ...user.customClaims, admin: true });
  if (existing) console.log(`Admin claim granted to existing account ${email}.`);
  else {
    console.log(`Admin created for ${email}. Temporary password (shown once): ${password}`);
    console.log('Sign in and change this password promptly. Do not store it in this repository.');
  }
} catch (error) {
  if (created) {
    try { await auth.deleteUser(created.uid); } catch (cleanupError) {
      console.error(`Could not remove incomplete user ${created.uid}: ${cleanupError.message}`);
    }
  }
  console.error(`Admin creation failed: ${error.message}`);
  process.exitCode = 1;
}
