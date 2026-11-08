import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

const testEnv = await initializeTestEnvironment({
  projectId: 'demo-agazaty',
  firestore: { rules: readFileSync('firestore.rules', 'utf8') }
});
const admin = testEnv.authenticatedContext('admin', { admin: true, email: 'ahmed.morgan2009@gmail.com' }).firestore();
const red = testEnv.authenticatedContext('red-user').firestore();
const blue = testEnv.authenticatedContext('blue-user').firestore();
const solo = testEnv.authenticatedContext('solo-user').firestore();
const owner = testEnv.authenticatedContext('owner-user', { email: 'ahmed.morgan2009@gmail.com' }).firestore();
const falseOwner = testEnv.authenticatedContext('false-owner').firestore();
const impostor = testEnv.authenticatedContext('impostor', { admin: true, email: 'other@example.com' }).firestore();
const applicant = testEnv.authenticatedContext('new-user', { email: '1234@accounts.shifts-attendance-am-2026.firebaseapp.com' }).firestore();
const anonymous = testEnv.unauthenticatedContext().firestore();
const keyRed = 'red|دعم المستخدمين للأجهزة';
const keyBlue = 'blue|دعم المستخدمين للأجهزة';
const keySolo = 'self|emp_solo';

try {
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await db.doc('employeeAccounts/red-user').set({ employeeId: 'emp_red', team: 'red', job: 'دعم المستخدمين للأجهزة' });
    await db.doc('employeeAccounts/blue-user').set({ employeeId: 'emp_blue', team: 'blue', job: 'دعم المستخدمين للأجهزة' });
    await db.doc('employeeAccounts/solo-user').set({ employeeId: 'emp_solo', team: 'red', job: 'دعم المستخدمين للأجهزة', groupKey: keySolo, accessScope: 'self' });
    await db.doc('teamMembership/emp_red').set({ team: 'red', job: 'دعم المستخدمين للأجهزة', groupKey: keyRed });
    await db.doc('teamMembership/emp_blue').set({ team: 'blue', job: 'دعم المستخدمين للأجهزة', groupKey: keyBlue });
    await db.doc('teamMembership/emp_solo').set({ team: 'red', job: 'دعم المستخدمين للأجهزة', groupKey: keySolo });
    await db.doc('staff/emp_red').set({ team: 'red', job: 'دعم المستخدمين للأجهزة', groupKey: keyRed });
    await db.doc('staff/emp_blue').set({ team: 'blue', job: 'دعم المستخدمين للأجهزة', groupKey: keyBlue });
    await db.doc('staff/emp_solo').set({ team: 'red', job: 'دعم المستخدمين للأجهزة', groupKey: keySolo });
    await db.doc('meta/workspace').set({ shiftSettings: {} });
    await db.doc('ownerAccess/owner-user').set({ role: 'admin' });
    await db.doc('ownerAccess/false-owner').set({ role: 'member' });
    await db.doc('jobs/دعم المستخدمين للأجهزة').set({ name: 'دعم المستخدمين للأجهزة', active: true });
    await db.doc('jobs/البنية التحتية').set({ name: 'البنية التحتية', active: true });
  });

  await assertFails(red.doc('employeeAccounts/fake').set({ employeeId: 'fake', team: 'red', job: 'دعم المستخدمين للأجهزة' }));
  await assertSucceeds(owner.doc('ownerAccess/owner-user').get());
  await assertFails(red.doc('ownerAccess/owner-user').get());
  await assertFails(owner.doc('ownerAccess/other-user').set({ role: 'admin' }));
  await assertSucceeds(owner.doc('staff/emp_blue').get());
  await assertFails(falseOwner.doc('staff/emp_blue').get());
  await assertFails(impostor.doc('staff/emp_blue').get());
  await assertSucceeds(anonymous.collection('jobs').get());
  await assertFails(red.doc('jobs/وظيفة جديدة').set({ name: 'وظيفة جديدة', active: true }));
  await assertSucceeds(admin.doc('jobs/وظيفة جديدة').set({ name: 'وظيفة جديدة', active: true }));
  const application = { name: 'موظف جديد', code: '1234', team: 'red', job: 'دعم المستخدمين للأجهزة', status: 'pending', createdAt: '2026-11-06T00:00:00Z' };
  await assertSucceeds(applicant.doc('registrationRequests/new-user').set(application));
  await assertFails(applicant.doc('registrationRequests/new-user').update({ status: 'approved' }));
  await assertFails(applicant.doc('registrationRequests/other').set(application));
  await assertFails(applicant.doc('registrationRequests/new-user').set({ ...application, code: '5686' }));
  await assertSucceeds(admin.collection('registrationRequests').where('status', '==', 'pending').get());
  await assertFails(red.collection('registrationRequests').get());
  await assertSucceeds(admin.doc('registrationRequests/new-user').update({ status: 'approved' }));
  await assertFails(red.doc('shared/workspace').get());
  await assertFails(red.doc('staff/emp_blue').get());
  await assertSucceeds(red.doc('staff/emp_red').update({ name: 'اسم جديد' }));
  await assertFails(red.doc('staff/emp_blue').update({ name: 'محاولة' }));
  await assertFails(red.doc('staff/emp_red').update({ team: 'blue' }));
  await assertSucceeds(red.doc('staff/emp_red').update({ annual_balance: 25, casual_balance: 6, perm_hours: 5 }));
  await assertSucceeds(red.doc('employeeAccounts/red-user').update({ annual_balance: 25, casual_balance: 6, perm_hours: 5 }));
  await assertFails(red.doc('staff/emp_red').update({ groupKey: keyBlue }));
  await assertFails(red.doc('staff/emp_red').update({ job: 'البنية التحتية' }));
  await assertFails(red.doc('staff/emp_red').update({ annual_balance: 999 }));
  await assertFails(red.doc('employeeAccounts/red-user').update({ team: 'blue', groupKey: keyBlue }));
  await assertFails(red.doc('employeeAccounts/red-user').update({ job: 'البنية التحتية' }));
  await assertFails(red.doc('employeeAccounts/blue-user').update({ annual_balance: 25 }));
  await assertFails(red.doc('staff/emp_red').update({ role: 'admin' }));
  await assertSucceeds(red.collection('staff').where('groupKey', '==', keyRed).get());
  await assertSucceeds(solo.doc('staff/emp_solo').get());
  await assertFails(solo.doc('staff/emp_red').get());
  await assertFails(red.doc('staff/emp_solo').get());
  await assertSucceeds(solo.collection('staff').where('groupKey', '==', keySolo).get());
  await assertSucceeds(admin.doc('staff/emp_blue').get());
  await assertFails(red.doc('meta/workspace').update({ shiftSettings: { times: {} } }));

  const valid = { date: '2026-11-06', team: 'red', job: 'دعم المستخدمين للأجهزة', groupKey: keyRed,
    status: 'حضور', delay: 0, permissionMinutes: 0, notes: '' };
  await assertSucceeds(red.doc('attendance/2026-11-06/records/emp_red').set(valid));
  const ownRecord = { ...valid, groupKey: keySolo };
  await assertSucceeds(solo.doc('attendance/2026-11-06/records/emp_solo').set(ownRecord));
  await assertFails(solo.doc('attendance/2026-11-06/records/emp_red').set(valid));
  await assertFails(red.doc('attendance/2026-11-06/records/emp_solo').set(ownRecord));
  await assertSucceeds(solo.collectionGroup('records').where('groupKey', '==', keySolo).get());
  await assertFails(red.doc('attendance/2026-11-06/records/emp_blue').set({ ...valid, team: 'blue', groupKey: keyBlue }));
  await assertFails(red.doc('attendance/2026-11-06/records/emp_red').set({ ...valid, delay: -5 }));
  await assertSucceeds(red.collectionGroup('records').where('groupKey', '==', keyRed).get());
  await assertFails(red.collectionGroup('records').get());
  await assertSucceeds(admin.doc('attendance/2026-11-06/records/emp_blue').set({ ...valid, team: 'blue', groupKey: keyBlue }));
  console.log('Firestore rules: access and validation checks passed');
} finally {
  await testEnv.cleanup();
}
