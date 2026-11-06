import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

const testEnv = await initializeTestEnvironment({
  projectId: 'demo-agazaty',
  firestore: { rules: readFileSync('firestore.rules', 'utf8') }
});
const admin = testEnv.authenticatedContext('admin', { admin: true }).firestore();
const red = testEnv.authenticatedContext('red-user').firestore();
const blue = testEnv.authenticatedContext('blue-user').firestore();
const keyRed = 'red|دعم المستخدمين';
const keyBlue = 'blue|دعم المستخدمين';

try {
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await db.doc('employeeAccounts/red-user').set({ employeeId: 'emp_red', team: 'red', job: 'دعم المستخدمين' });
    await db.doc('employeeAccounts/blue-user').set({ employeeId: 'emp_blue', team: 'blue', job: 'دعم المستخدمين' });
    await db.doc('teamMembership/emp_red').set({ team: 'red', job: 'دعم المستخدمين', groupKey: keyRed });
    await db.doc('teamMembership/emp_blue').set({ team: 'blue', job: 'دعم المستخدمين', groupKey: keyBlue });
    await db.doc('staff/emp_red').set({ team: 'red', job: 'دعم المستخدمين', groupKey: keyRed });
    await db.doc('staff/emp_blue').set({ team: 'blue', job: 'دعم المستخدمين', groupKey: keyBlue });
    await db.doc('meta/workspace').set({ shiftSettings: {} });
  });

  await assertFails(red.doc('employeeAccounts/fake').set({ employeeId: 'fake', team: 'red', job: 'دعم المستخدمين' }));
  await assertFails(red.doc('shared/workspace').get());
  await assertFails(red.doc('staff/emp_blue').get());
  await assertSucceeds(red.collection('staff').where('groupKey', '==', keyRed).get());
  await assertSucceeds(admin.doc('staff/emp_blue').get());
  await assertFails(red.doc('meta/workspace').update({ shiftSettings: { times: {} } }));

  const valid = { date: '2026-11-06', team: 'red', job: 'دعم المستخدمين', groupKey: keyRed,
    status: 'حضور', delay: 0, permissionMinutes: 0, notes: '' };
  await assertSucceeds(red.doc('attendance/2026-11-06/records/emp_red').set(valid));
  await assertFails(red.doc('attendance/2026-11-06/records/emp_blue').set({ ...valid, team: 'blue', groupKey: keyBlue }));
  await assertFails(red.doc('attendance/2026-11-06/records/emp_red').set({ ...valid, delay: -5 }));
  await assertSucceeds(red.collectionGroup('records').where('groupKey', '==', keyRed).get());
  await assertFails(red.collectionGroup('records').get());
  await assertSucceeds(admin.doc('attendance/2026-11-06/records/emp_blue').set({ ...valid, team: 'blue', groupKey: keyBlue }));
  console.log('Firestore rules: access and validation checks passed');
} finally {
  await testEnv.cleanup();
}
