import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider, getIdTokenResult, createUserWithEmailAndPassword, deleteUser, setPersistence, inMemoryPersistence } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, doc, collection, collectionGroup, query, where, onSnapshot, getDocFromServer, getDocs, setDoc, updateDoc, deleteDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';

let auth, database, configInUse;
let listeners = [], stopAuth;
const groupKey = employee => employee.accessScope === 'self' ? `self|${employee.id || employee.employeeId}` : `${employee.team}|${employee.job}`;
const adminEmail = 'ahmed.morgan2009@gmail.com';
const adminCode = '5686';
const employeeEmail = code => String(code).trim() === adminCode ? adminEmail : `${String(code).trim()}@accounts.shifts-attendance-am-2026.firebaseapp.com`;
const validCode = code => /^[0-9]{4}$/.test(String(code));
const requestRef = uid => doc(database, 'registrationRequests', uid);
const defaultJobs = ['دعم المستخدمين للأجهزة', 'دعم المستخدمين', 'البنية التحتية'];
const metaRef = () => doc(database, 'meta', 'workspace');
const staffRef = id => doc(database, 'staff', id);
const recordRef = (date, id) => doc(database, 'attendance', date, 'records', id);
const password = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&';
    return Array.from(bytes, value => alphabet[value % alphabet.length]).join('');
};
// Firestore rejects undefined at any depth. Keep optional fields absent instead.
const firestoreData = value => {
    if (Array.isArray(value)) return value.map(item => item === undefined ? null : firestoreData(item));
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
        return Object.fromEntries(Object.entries(value)
            .filter(([, item]) => item !== undefined)
            .map(([key, item]) => [key, firestoreData(item)]));
    }
    return value;
};

function stopListeners() {
    listeners.forEach(stop => stop());
    listeners = [];
}

async function migrateLegacyData() {
    const legacy = await getDocFromServer(doc(database, 'shared', 'workspace'));
    if (!legacy.exists()) return;
    const marker = await getDocFromServer(metaRef());
    if (marker.data()?.legacyMigrated) return;
    const data = legacy.data();
    const accounts = await getDocs(collection(database, 'employeeAccounts'));
    const profiles = accounts.docs.map(item => ({ ...item.data(), authUid: item.id }));
    const roster = new Map((data.employees || []).map(emp => [emp.id, emp]));
    profiles.forEach(profile => {
        const id = profile.employeeId || profile.authUid;
        roster.set(id, { ...roster.get(id), ...profile, id });
    });
    const operations = [];
    roster.forEach(emp => {
        if (emp.id && emp.team && emp.job) {
            operations.push(['set', staffRef(emp.id), { ...emp, groupKey: groupKey(emp) }]);
            operations.push(['set', doc(database, 'teamMembership', emp.id), { team: emp.team, job: emp.job, groupKey: groupKey(emp) }]);
        }
    });
    Object.entries(data.attendanceData || {}).forEach(([date, day]) => {
        Object.entries(day.records || {}).forEach(([id, record]) => {
            const employee = roster.get(id);
            if (employee?.team && employee?.job) operations.push(['set', recordRef(date, id), { ...record, groupKey: groupKey(employee), team: employee.team, job: employee.job, date }]);
        });
    });
    for (let offset = 0; offset < operations.length; offset += 400) {
        const batch = writeBatch(database);
        operations.slice(offset, offset + 400).forEach(([, ref, value]) => batch.set(ref, value));
        await batch.commit();
    }
    await setDoc(metaRef(), { shiftSettings: data.shiftSettings || { times: {}, overrides: {} }, legacyMigrated: true });
}

function connect(config, callbacks) {
    if (!config?.apiKey || !config?.authDomain || !config?.projectId || !config?.appId) throw new Error('إعدادات Firebase غير مكتملة.');
    stopListeners();
    if (stopAuth) stopAuth();
    const app = getApps().find(item => item.name === config.projectId) || initializeApp(config, config.projectId);
    configInUse = config;
    auth = getAuth(app);
    database ||= initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
    stopAuth = onAuthStateChanged(auth, async user => {
        stopListeners();
        if (!user || user.isAnonymous) { callbacks.onSignedOut(); return; }
        try {
            const claims = (await getIdTokenResult(user)).claims;
            const owner = await getDocFromServer(doc(database, 'ownerAccess', user.uid));
            const admin = user.email?.toLowerCase() === adminEmail &&
                (claims.admin === true || (owner.exists() && owner.data()?.role === 'admin'));
            const own = admin ? null : await getDocFromServer(doc(database, 'employeeAccounts', user.uid));
            if (!admin && !own.exists()) {
                const pending = await getDocFromServer(requestRef(user.uid));
                callbacks.onPending(pending.exists() ? pending.data().status : 'preparing');
                listeners.push(onSnapshot(requestRef(user.uid), snap => {
                    if (snap.data()?.status === 'approved') { stopListeners(); connect(configInUse, callbacks); }
                    else callbacks.onPending(snap.data()?.status || 'preparing');
                }, callbacks.onError));
                return;
            }
            if (admin) { await migrateLegacyData(); await ensureDefaultJobs(); }
            const key = admin ? null : groupKey(own.data());
            callbacks.onAuth(user, { ...claims, admin });
            let settings = null, records = null;
            const emit = metadata => {
                if (!settings || !records) return;
                callbacks.onData({ employees: [], attendanceData: records, shiftSettings: settings }, metadata);
            };
            const staffQuery = admin ? collection(database, 'staff') : query(collection(database, 'staff'), where('groupKey', '==', key));
            listeners.push(onSnapshot(staffQuery, snap => callbacks.onProfiles(snap.docs.map(item => ({ ...item.data(), id: item.id }))), callbacks.onError));
            listeners.push(onSnapshot(metaRef(), { includeMetadataChanges: true }, snap => {
                if (!snap.exists()) { if (admin && !snap.metadata.fromCache) callbacks.onEmpty(); return; }
                settings = snap.data().shiftSettings || { times: {}, overrides: {} };
                emit(snap.metadata);
            }, callbacks.onError));
            const recordsQuery = admin ? collectionGroup(database, 'records') : query(collectionGroup(database, 'records'), where('groupKey', '==', key));
            listeners.push(onSnapshot(recordsQuery, { includeMetadataChanges: true }, snap => {
                const result = {};
                snap.docs.forEach(item => {
                    const date = item.ref.parent.parent.id;
                    const day = result[date] ||= { day: '', shift: '', records: {} };
                    day.records[item.id] = item.data();
                });
                records = result;
                emit(snap.metadata);
            }, callbacks.onError));
        } catch (error) { callbacks.onError(error); }
    }, callbacks.onError);
}

const login = (identifier, pass) => {
    const value = String(identifier).trim();
    if (value.includes('@') && value.toLowerCase() !== adminEmail) throw new Error('بريد الإدارة غير صحيح.');
    if (!value.includes('@') && !validCode(value)) throw new Error('كود الموظف أربعة أرقام فقط.');
    return signInWithEmailAndPassword(auth, value.includes('@') ? adminEmail : employeeEmail(value), pass);
};
const logout = () => signOut(auth);
async function registerEmployee({ name, code, team, job, pass }) {
    if (!validCode(code) || code === adminCode || !name || name.length > 80 ||
        !['red', 'blue', 'yellow', 'morning'].includes(team) || !job || job.length > 80 || pass.length < 7) {
        throw new Error('تحقق من الاسم والكود والوردية والوظيفة وكلمة المرور.');
    }
    const user = (await createUserWithEmailAndPassword(auth, employeeEmail(code), pass)).user;
    try {
        await setDoc(requestRef(user.uid), { name, code, team, job, status: 'pending', createdAt: new Date().toISOString() });
    } catch (error) { await deleteUser(user).catch(() => {}); throw error; }
}
async function changePassword(current, next) {
    const credential = EmailAuthProvider.credential(auth.currentUser.email, current);
    await reauthenticateWithCredential(auth.currentUser, credential);
    return updatePassword(auth.currentUser, next);
}

async function createEmployeeAccount(employee, initialPassword = '') {
    if (!auth?.currentUser || !configInUse) throw new Error('سجّل الدخول أولاً.');
    if (!validCode(employee.code)) throw new Error('الكود يجب أن يتكون من أربعة أرقام.');
    const app = getApps().find(item => item.name === 'employee-provisioning') || initializeApp(configInUse, 'employee-provisioning');
    const provisioningAuth = getAuth(app);
    await setPersistence(provisioningAuth, inMemoryPersistence);
    if (initialPassword && initialPassword.length < 7) throw new Error('كلمة البدء يجب ألا تقل عن ٧ أحرف.');
    const temporaryPassword = initialPassword || password();
    let created;
    try {
        created = (await createUserWithEmailAndPassword(provisioningAuth, employeeEmail(employee.code), temporaryPassword)).user;
        const complete = { ...employee, authUid: created.uid, groupKey: groupKey(employee) };
        const batch = writeBatch(database);
        batch.set(staffRef(employee.id), complete);
        batch.set(doc(database, 'employeeAccounts', created.uid), { ...complete, employeeId: employee.id });
        batch.set(doc(database, 'teamMembership', employee.id), { team: employee.team, job: employee.job, groupKey: complete.groupKey });
        await batch.commit();
        return { employee: complete, temporaryPassword };
    } catch (error) {
        if (created) await deleteUser(created).catch(() => {});
        throw error;
    } finally { await signOut(provisioningAuth).catch(() => {}); }
}

async function approveRegistration(uid, request, balances = {}) {
    if (!auth?.currentUser || !request || request.status !== 'pending' || !validCode(request.code)) throw new Error('طلب التسجيل غير صالح.');
    const id = `emp_${uid}`;
    const complete = { id, authUid: uid, name: request.name, code: request.code, team: request.team, job: request.job,
        dept: '', annual_balance: balances.annual_balance ?? 21, casual_balance: balances.casual_balance ?? 7,
        perm_hours: balances.perm_hours ?? 4, groupKey: groupKey(request) };
    const batch = writeBatch(database);
    batch.set(staffRef(id), complete);
    batch.set(doc(database, 'employeeAccounts', uid), { ...complete, employeeId: id });
    batch.set(doc(database, 'teamMembership', id), { team: request.team, job: request.job, groupKey: complete.groupKey });
    batch.update(requestRef(uid), { status: 'approved' });
    await batch.commit();
    return complete;
}
async function linkAdminAsEmployee(employee) {
    const user = auth?.currentUser;
    if (!user || user.email?.toLowerCase() !== adminEmail || String(employee.code).trim() !== adminCode ||
        !((await getIdTokenResult(user)).claims.admin ||
          (await getDocFromServer(doc(database, 'ownerAccess', user.uid))).data()?.role === 'admin')) {
        throw new Error('ربط هذا الكود متاح لحساب المدير المحدد فقط.');
    }
    if ((await getDocFromServer(doc(database, 'employeeAccounts', user.uid))).exists()) throw new Error('حساب المدير مرتبط بالفعل بملف موظف.');
    const complete = { ...employee, authUid: user.uid, groupKey: groupKey(employee) };
    const batch = writeBatch(database);
    batch.set(staffRef(employee.id), complete);
    batch.set(doc(database, 'employeeAccounts', user.uid), { ...complete, employeeId: employee.id });
    batch.set(doc(database, 'teamMembership', employee.id), { team: employee.team, job: employee.job, groupKey: complete.groupKey });
    await batch.commit();
    return { employee: complete, temporaryPassword: null };
}
const rejectRegistration = uid => updateDoc(requestRef(uid), { status: 'rejected' });
const watchRegistrations = callback => onSnapshot(query(collection(database, 'registrationRequests'), where('status', '==', 'pending')),
    snap => callback(snap.docs.map(item => ({ uid: item.id, ...item.data() }))));
const updateColleagueName = (employeeId, name) => updateDoc(staffRef(employeeId), { name });
async function ensureDefaultJobs() {
    for (const name of defaultJobs) {
        const ref = doc(database, 'jobs', name);
        if (!(await getDocFromServer(ref)).exists()) await setDoc(ref, { name, active: true });
    }
}
const watchJobs = callback => onSnapshot(collection(database, 'jobs'), snap =>
    callback(snap.docs.filter(item => item.data().active === true).map(item => item.id)));
async function addJob(name) {
    if (!auth?.currentUser || !name || name.length > 80 || name.includes('/')) throw new Error('اسم الوظيفة غير صالح.');
    await setDoc(doc(database, 'jobs', name), { name, active: true });
}
async function removeJob(name) {
    await setDoc(doc(database, 'jobs', name), { name, active: false });
}

async function updateEmployeeAccount(employee) {
    const complete = firestoreData({ ...employee, groupKey: groupKey(employee) });
    const records = await getDocs(collectionGroup(database, 'records'));
    const owned = records.docs.filter(item => item.id === employee.id);
    for (let offset = 0; offset < owned.length; offset += 400) {
        const changes = writeBatch(database);
        owned.slice(offset, offset + 400).forEach(item => changes.update(item.ref, { team: employee.team, job: employee.job, groupKey: complete.groupKey }));
        await changes.commit();
    }
    const batch = writeBatch(database);
    batch.set(staffRef(employee.id), complete);
    batch.set(doc(database, 'teamMembership', employee.id), { team: employee.team, job: employee.job, groupKey: complete.groupKey });
    if (employee.authUid) batch.set(doc(database, 'employeeAccounts', employee.authUid), { ...complete, employeeId: employee.id });
    return batch.commit();
}

async function saveRecords(changes) {
    for (let offset = 0; offset < changes.length; offset += 400) {
        const batch = writeBatch(database);
        changes.slice(offset, offset + 400).forEach(change => {
            batch.set(recordRef(change.date, change.employeeId), firestoreData({ ...change.record, date: change.date, team: change.team, job: change.job, groupKey: change.groupKey || `${change.team}|${change.job}` }));
        });
        await batch.commit();
    }
}
const clearRecord = (date, employeeId) => deleteDoc(recordRef(date, employeeId));
const saveDays = () => Promise.resolve(); // Calendar dates and shifts are derived from the selected month.
const saveShiftSettings = settings => updateDoc(metaRef(), { shiftSettings: settings });
const initializeWorkspace = () => setDoc(metaRef(), { shiftSettings: { times: {}, overrides: {} }, legacyMigrated: true });

async function deleteEmployeeRecords(employees, employeeId, dates, uid) {
    for (let offset = 0; offset < dates.length; offset += 400) {
        const records = writeBatch(database);
        dates.slice(offset, offset + 400).forEach(date => records.delete(recordRef(date, employeeId)));
        await records.commit();
    }
    const batch = writeBatch(database);
    batch.delete(staffRef(employeeId));
    batch.delete(doc(database, 'teamMembership', employeeId));
    if (uid) batch.delete(doc(database, 'employeeAccounts', uid));
    await batch.commit();
}

async function save(data) {
    // Admin restore. Existing account identities are retained; attendance records are replaced.
    const existing = await getDocs(collectionGroup(database, 'records'));
    const desired = new Map();
    Object.entries(data.attendanceData || {}).forEach(([date, day]) => {
        Object.entries(day.records || {}).forEach(([id, record]) => {
            const emp = data.employees.find(item => item.id === id);
            if (emp) desired.set(`${date}/${id}`, [recordRef(date, id), { ...record, date, team: emp.team, job: emp.job, groupKey: groupKey(emp) }]);
        });
    });
    const operations = existing.docs.filter(item => !desired.has(`${item.ref.parent.parent.id}/${item.id}`)).map(item => ['delete', item.ref]);
    desired.forEach(([ref, value]) => operations.push(['set', ref, value]));
    for (let offset = 0; offset < operations.length; offset += 400) {
        const batch = writeBatch(database);
        operations.slice(offset, offset + 400).forEach(([action, ref, value]) => action === 'delete' ? batch.delete(ref) : batch.set(ref, value));
        await batch.commit();
    }
    await setDoc(metaRef(), { shiftSettings: data.shiftSettings || { times: {}, overrides: {} }, legacyMigrated: true });
}

window.firebaseBridge = { connect, login, registerEmployee, logout, changePassword, save, saveRecords, clearRecord, saveDays, saveShiftSettings, initializeWorkspace, createEmployeeAccount, linkAdminAsEmployee, approveRegistration, rejectRegistration, watchRegistrations, updateColleagueName, watchJobs, addJob, removeJob, updateEmployeeAccount, deleteEmployeeRecords };
window.dispatchEvent(new Event('firebase-bridge-ready'));
