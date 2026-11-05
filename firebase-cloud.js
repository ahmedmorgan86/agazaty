import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, doc, onSnapshot, setDoc, updateDoc, deleteField, FieldPath } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';

let auth;
let database;
let stopListening;
let stopAuth;

function connect(config, callbacks) {
    if (!config?.apiKey || !config?.authDomain || !config?.projectId || !config?.appId) {
        throw new Error('إعدادات Firebase غير مكتملة. انسخ firebaseConfig كاملاً من إعدادات تطبيق الويب.');
    }
    if (stopListening) stopListening();
    if (stopAuth) stopAuth();
    const existing = getApps().find(item => item.name === config.projectId);
    const app = existing || initializeApp(config, config.projectId);
    auth = getAuth(app);
    database = existing ? getFirestore(app) : initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
    stopAuth = onAuthStateChanged(auth, user => {
        if (stopListening) stopListening();
        if (!user) {
            signInAnonymously(auth).catch(callbacks.onError);
            return;
        }
        callbacks.onAuth(user);
        const workspace = doc(database, 'shared', 'workspace');
        stopListening = onSnapshot(workspace, snapshot => {
            if (!snapshot.exists()) {
                // A missing cached document does not prove that the server is empty.
                if (!snapshot.metadata.fromCache) callbacks.onEmpty();
                return;
            }
            callbacks.onData(snapshot.data(), snapshot.metadata);
        }, callbacks.onError);
    }, callbacks.onError);
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

function saveDays(days) {
    return patch(days.flatMap(day => [
        [['attendanceData', day.date, 'day'], day.day],
        [['attendanceData', day.date, 'shift'], day.shift]
    ]));
}

function saveEmployees(employees) {
    return patch([[['employees'], employees]]);
}

function deleteEmployeeRecords(employees, employeeId, dates) {
    return patch([[['employees'], employees], ...dates.map(date =>
        [['attendanceData', date, 'records', employeeId], deleteField()])]);
}

window.firebaseBridge = {
    connect,
    save,
    saveRecords,
    saveDays,
    saveEmployees,
    deleteEmployeeRecords
};
window.dispatchEvent(new Event('firebase-bridge-ready'));
