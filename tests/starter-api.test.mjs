// Exercises api/starter.js with a mocked network: no real accounts or data are touched.
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.AGAZATY_FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
  client_email: 't@t.iam.gserviceaccount.com', project_id: 'proj',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' })
});
process.env.AGAZATY_FIREBASE_API_KEY = 'key';
const { default: handler } = await import('../api/starter.js');

const STARTER = 'starter-pass-1';
const users = {
  admin: { localId: 'A', email: 'ahmed.morgan2009@gmail.com', customAttributes: '{"admin":true}' },
  blue: { localId: 'B', email: '1111@x', customAttributes: '' },
  red: { localId: 'R', email: '2222@x', customAttributes: '' }
};
const teams = { B: 'blue', R: 'red' };
const passwords = { B: STARTER, R: 'redpass-1' };
let secretDoc = null, updated = [];
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  const ok = body => ({ ok: true, status: 200, json: async () => body });
  const no = { ok: false, status: 403, json: async () => ({}) };
  if (url.includes('oauth2.googleapis.com')) return ok({ access_token: 'tok' });
  if (url.includes('accounts:lookup')) {
    const user = users[JSON.parse(init.body).idToken];
    return user ? ok({ users: [user] }) : no;
  }
  if (url.includes('signInWithPassword')) {
    const { email, password } = JSON.parse(init.body);
    const u = Object.values(users).find(x => x.email === email);
    return u && passwords[u.localId] === password ? ok({}) : no;
  }
  if (url.includes('/documents/serverSecrets/starter')) {
    if (init.method === 'PATCH') { secretDoc = JSON.parse(init.body).fields.value.stringValue; return ok({}); }
    return secretDoc ? ok({ fields: { value: { stringValue: secretDoc } } }) : no;
  }
  if (url.includes('/documents/meta/workspace')) return no;
  if (url.includes('/documents/employeeAccounts/')) {
    const id = decodeURIComponent(url.split('/').pop());
    return teams[id] ? ok({ fields: { team: { stringValue: teams[id] } } }) : no;
  }
  if (url.includes('accounts:update')) { updated.push(JSON.parse(init.body)); return ok({}); }
  throw new Error('unexpected ' + url);
};
const call = async (token, body, origin) => {
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  await handler({ method: 'POST', headers: { authorization: token ? `Bearer ${token}` : '', host: 'h', origin }, body }, res);
  return res;
};

assert.equal((await call('', { action: 'status', typed: 'x' })).code, 400, 'no token');
assert.equal((await call('nobody', { action: 'status', typed: 'x' })).code, 401, 'bad token');
assert.equal((await call('blue', { action: 'get' })).code, 403, 'employee cannot read starter');
assert.equal((await call('blue', { action: 'set', password: 'abcdefgh' })).code, 403, 'employee cannot set starter');
assert.equal((await call('blue', { action: 'status', typed: 'x' }, 'https://evil.example')).code, 403, 'foreign origin');
assert.equal((await call('admin', { action: 'set', password: 'short' })).code, 400, 'too short');
assert.equal((await call('admin', { action: 'set', password: STARTER })).code, 200, 'admin sets');
assert.equal((await call('admin', { action: 'get' })).body.password, STARTER, 'admin reads');
assert.equal((await call('admin', { action: 'status', typed: STARTER })).body.mustChange, false, 'admin never forced');
assert.equal((await call('blue', { action: 'status', typed: 'wrong-guess' })).code, 403, 'guess must be the real current password');
assert.equal((await call('blue', { action: 'status', typed: STARTER })).body.mustChange, true, 'blue on starter');
assert.equal((await call('red', { action: 'status', typed: 'redpass-1' })).body.mustChange, false, 'red never forced');
assert.equal((await call('blue', { action: 'change', typed: STARTER, next: STARTER })).code, 400, 'same as starter');
assert.equal((await call('blue', { action: 'change', typed: STARTER, next: 'abc' })).code, 400, 'too short');
assert.equal(updated.length, 0, 'no password changed by rejected requests');
assert.equal((await call('blue', { action: 'change', typed: STARTER, next: 'brand-new-pass' })).code, 200, 'change ok');
assert.deepEqual(updated, [{ localId: 'B', password: 'brand-new-pass' }], 'only the caller account changed');
passwords.B = 'brand-new-pass';
assert.equal((await call('blue', { action: 'status', typed: 'brand-new-pass' })).body.mustChange, false, 'no longer forced');
assert.equal((await call('blue', { action: 'change', typed: 'brand-new-pass', next: 'another-pass-1' })).code, 400, 'cannot use change once off starter');
console.log('starter API tests passed');
