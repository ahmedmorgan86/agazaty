import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider, getIdTokenResult, createUserWithEmailAndPassword, deleteUser, setPersistence, inMemoryPersistence } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, doc, collection, onSnapshot, getDocFromServer, setDoc, updateDoc, deleteField, FieldPath, writeBatch } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';

let auth;
let database;
let stopListening;
let stopProfiles;
let stopAuth;
let configInUse;

const employeeEmail = code => `${String(code).trim().toLowerCase()}@accounts.shifts-attendance-am-2026.firebaseapp.com`;

function connect(config, callbacks) {
    if (!config?.apiKey || !config?.authDomain || !config?.projectId || !config?.appId) {
        throw new Error('إعدادات Firebase غير مكتملة. انسخ firebaseConfig كاملاً من إعدادات تطبيق الويب.');
    }
    if (stopListening) stopListening();
    if (stopProfiles) stopProfiles();
    if (stopAuth) stopAuth();
    const existing = getApps().find(item => item.name === config.projectId);
    const app = existing || initializeApp(config, config.projectId);
    configInUse = config;
    auth = getAuth(app);
    database = existing ? getFirestore(app) : initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
    stopAuth = onAuthStateChanged(auth, async user => {
        if (stopListening) stopListening();
        if (stopProfiles) stopProfiles();
        if (!user || user.isAnonymous) {
            if (user?.isAnonymous) await signOut(auth);
            callbacks.onSignedOut();
            return;
        }
        const token = await getIdTokenResult(user);
        callbacks.onAuth(user, token.claims);
        stopProfiles = onSnapshot(collection(database, 'employeeAccounts'), snapshot => {
            callbacks.onProfiles(snapshot.docs.map(item => ({ uid: item.id, ...item.data() })));
        }, callbacks.onError);
        const workspace = doc(database, 'shared', 'workspace');
        stopListening = onSnapshot(workspace, { includeMetadataChanges: true }, snapshot => {
            if (!snapshot.exists()) {
                // A missing cached document does not prove that the server is empty.
                if (!snapshot.metadata.fromCache) callbacks.onEmpty();
                return;
            }
            callbacks.onData(snapshot.data(), snapshot.metadata);
        }, callbacks.onError);
    }, callbacks.onError);
}

function login(code, password) {
    if (!auth) throw new Error('لم يكتمل إعداد Firebase.');
    return signInWithEmailAndPassword(auth, employeeEmail(code), password);
}

function logout() { return signOut(auth); }

async function changePassword(currentPassword, newPassword) {
    if (!auth?.currentUser) throw new Error('سجّل الدخول أولاً.');
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);
    return updatePassword(auth.currentUser, newPassword);
}

async function acquireEmployeeAccount(provisioningAuth, registrationDb, code) {
    try {
        const created = await createUserWithEmailAndPassword(provisioningAuth, employeeEmail(code), '1234567');
        return { user: created.user, createdNow: true };
    } catch (error) {
        if (error.code !== 'auth/email-already-in-use') throw error;
        let existing;
        try {
            existing = await signInWithEmailAndPassword(provisioningAuth, employeeEmail(code), '1234567');
        } catch {
            throw Object.assign(new Error('هذا الكود له حساب بالفعل. استخدم شاشة الدخول أو اطلب مساعدة المدير.'), { code: 'auth/email-already-in-use' });
        }
        const profile = await getDocFromServer(doc(registrationDb, 'employeeAccounts', existing.user.uid));
        if (profile.exists()) {
            throw Object.assign(new Error('هذا الكود مسجل بالفعل. استخدم شاشة الدخول.'), { code: 'auth/email-already-in-use' });
        }
        return { user: existing.user, createdNow: false };
    }
}

async function registerEmployee(employee) {
    if (!auth || !database || !configInUse) throw new Error('لم يكتمل إعداد Firebase.');
    const app = getApps().find(item => item.name === 'employee-provisioning') || initializeApp(configInUse, 'employee-provisioning');
    const provisioningAuth = getAuth(app);
    const registrationDb = getFirestore(app);
    await setPersistence(provisioningAuth, inMemoryPersistence);
    let account;
    try {
        account = await acquireEmployeeAccount(provisioningAuth, registrationDb, employee.code);
        await setDoc(doc(registrationDb, 'employeeAccounts', account.user.uid), {
            employeeId: account.user.uid,
            team: employee.team,
            name: employee.name,
            code: employee.code,
            job: employee.job,
            dept: employee.dept || '',
            annual_balance: 21,
            casual_balance: 7,
            perm_hours: 4
        });
    } catch (error) {
        if (account?.createdNow) await deleteUser(account.user).catch(() => {});
        throw error;
    } finally {
        await signOut(provisioningAuth).catch(() => {});
    }
    return login(employee.code, '1234567');
}

function save(data) {
    if (!auth?.currentUser || !database) throw new Error('لم يكتمل الاتصال بقاعدة البيانات.');
    return setDoc(doc(database, 'shared', 'workspace'), data);
}

function patch(fields) {
    if (!auth?.currentUser || !database) throw new Error('لم يكتمل الاتصال بقاعدة البيانات.');
    if (!fields.length) return Promise.resolve();
    const args = fields.flatMap(([path, value]) => [new FieldPath(...path), value]);
    return updateDoc(doc(database, 'shared', 'workspace'), ...args);
}

function saveRecords(changes) {
    const fields = [];
    const seenDates = new Set();
    for (const change of changes) {
        if (!seenDates.has(change.date)) {
            fields.push([['attendanceData', change.date, 'day'], change.day]);
            fields.push([['attendanceData', change.date, 'shift'], change.shift]);
            seenDates.add(change.date);
        }
        fields.push([['attendanceData', change.date, 'records', change.employeeId], change.record]);
    }
    return patch(fields);
}

function clearRecord(date, employeeId) {
    return patch([[['attendanceData', date, 'records', employeeId], deleteField()]]);
}

function saveDays(days) {
    return patch(days.flatMap(day => [
        [['attendanceData', day.date, 'day'], day.day],
        [['attendanceData', day.date, 'shift'], day.shift]
    ]));
}

function saveEmployees(employees) {
    return patch([[['employees'], employees]]);
}

function saveShiftSettings(settings) {
    return patch([[['shiftSettings'], settings]]);
}

async function createEmployeeAccount(employee, employees) {
    if (!auth?.currentUser || !database || !configInUse) throw new Error('سجّل الدخول أولاً.');
    const app = getApps().find(item => item.name === 'employee-provisioning') || initializeApp(configInUse, 'employee-provisioning');
    const provisioningAuth = getAuth(app);
    const registrationDb = getFirestore(app);
    await setPersistence(provisioningAuth, inMemoryPersistence);
    let account;
    try {
        account = await acquireEmployeeAccount(provisioningAuth, registrationDb, employee.code);
        const completeEmployee = { ...employee, authUid: account.user.uid };
        const batch = writeBatch(database);
        batch.update(doc(database, 'shared', 'workspace'), 'employees', [...employees, completeEmployee]);
        batch.set(doc(database, 'employeeAccounts', account.user.uid), { ...completeEmployee, employeeId: employee.id });
        batch.set(doc(database, 'teamMembership', employee.id), { team: employee.team });
        await batch.commit();
        return completeEmployee;
    } catch (error) {
        if (account?.createdNow) await deleteUser(account.user).catch(() => {});
        throw error;
    } finally {
        await signOut(provisioningAuth).catch(() => {});
    }
}

async function updateEmployeeAccount(employee, employees) {
    const batch = writeBatch(database);
    batch.update(doc(database, 'shared', 'workspace'), 'employees', employees);
    batch.set(doc(database, 'teamMembership', employee.id), { team: employee.team });
    if (employee.authUid || employee.id.startsWith('emp_')) {
        batch.set(doc(database, 'employeeAccounts', employee.authUid || employee.id), { ...employee, employeeId: employee.id });
    }
    return batch.commit();
}

function updatePeerProfile(employee) {
    if (!auth?.currentUser || !database) throw new Error('سجّل الدخول أولاً.');
    return updateDoc(doc(database, 'employeeAccounts', employee.authUid || employee.id), {
        name: employee.name,
        annual_balance: employee.annual_balance,
        casual_balance: employee.casual_balance,
        perm_hours: employee.perm_hours
    });
}

function deleteEmployeeRecords(employees, employeeId, dates, uid) {
    const batch = writeBatch(database);
    const fields = [['employees', employees], ...dates.map(date =>
        [new FieldPath('attendanceData', date, 'records', employeeId), deleteField()])];
    batch.update(doc(database, 'shared', 'workspace'), ...fields.flat());
    batch.delete(doc(database, 'teamMembership', employeeId));
    if (uid) batch.delete(doc(database, 'employeeAccounts', uid));
    return batch.commit();
}

window.firebaseBridge = {
    connect,
    login,
    registerEmployee,
    logout,
    changePassword,
    save,
    saveRecords,
    clearRecord,
    saveDays,
    saveEmployees,
    saveShiftSettings,
    createEmployeeAccount,
    updateEmployeeAccount,
    updatePeerProfile,
    deleteEmployeeRecords
};
window.dispatchEvent(new Event('firebase-bridge-ready'));
