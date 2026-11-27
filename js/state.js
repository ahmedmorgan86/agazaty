        // Application State
        let employees = [];
        let attendanceData = {};
        let shiftSettings = { times: {}, overrides: {} };
        let workspaceEmployees = [];
        let registeredEmployees = [];
        let workspaceLoaded = false;
        let profilesLoaded = false;
        localStorage.removeItem('app_employees_v2');
        localStorage.removeItem('app_attendance_v2');
        function localDateKey() {
            const now = new Date();
            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        }
        let currentMonth = localDateKey().slice(0, 7);
        let activeTeam = null;
        let currentAppPage = 'home';
        let editingCell = null;
        let firebaseUser = null;
        let currentProfile = null;
        let isAdmin = false;
        let applyingCloudData = false;
        let firebaseReady = false;
        let firebaseLoadFailed = false;
        let firebaseConnected = false;
        let cacheStatusTimer = null;
        let authGateTimer = null;
        function scheduleAuthGate() {
            clearTimeout(authGateTimer);
            document.getElementById('authGateMessage').textContent = 'يتم الاتصال بقاعدة البيانات المشتركة.';
            authGateTimer = setTimeout(() => {
                if (!workspaceLoaded) document.getElementById('authGate').classList.remove('hidden');
            }, 3000);
        }
        function showAppPage(page, scroll = true) {
            if (page === 'jobs' && !isAdmin) page = 'home';
            currentAppPage = page;
            document.getElementById('appMain').classList.toggle('hidden', page !== 'home');
            document.getElementById('employeePage').classList.toggle('hidden', page !== 'employees');
            document.getElementById('jobsPage').classList.toggle('hidden', page !== 'jobs');
            for (const [id, target] of [['navHomeButton', 'home'], ['manageEmployeesButton', 'employees'], ['manageJobsButton', 'jobs']]) {
                const button = document.getElementById(id);
                if (button) {
                    button.classList.toggle('nav-primary', page === target);
                    if (page === target) button.setAttribute('aria-current', 'page');
                    else button.removeAttribute('aria-current');
                }
            }
            if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        const employeeKey = emp => emp?.groupKey || (emp?.team && emp?.job ? `${emp.team}|${emp.job}` : '');
        const canAccessEmployee = emp => isAdmin || Boolean(currentProfile && employeeKey(emp) === employeeKey(currentProfile));
        let registrationListener = null;
        let pendingRegistrations = [];
        let jobListener = null;
        let availableJobs = [];
        const FIREBASE_CONFIG = {
            apiKey: 'AIzaSyCAVUh5QzRgkErTu-BpaWwn2XBAueN92A0',
            authDomain: 'agazaty.firebaseapp.com',
            projectId: 'agazaty',
            appId: '1:785497512315:web:728fb42d12dd733bd185de',
            messagingSenderId: '785497512315',
            storageBucket: 'agazaty.firebasestorage.app'
        };

        function escapeHTML(value) {
            return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
        }

        function isValidWorkspace(data) {
            if (!data || !Array.isArray(data.employees) || !data.attendanceData ||
                typeof data.attendanceData !== 'object' || Array.isArray(data.attendanceData)) return false;
            if (!data.employees.every(emp => emp && /^[A-Za-z0-9_-]+$/.test(emp.id) &&
                !['__proto__', 'constructor', 'prototype'].includes(emp.id) &&
                typeof emp.name === 'string' && typeof (emp.code ?? '') === 'string' &&
                typeof (emp.job ?? '') === 'string' &&
                ['red', 'blue', 'yellow', 'morning'].includes(emp.team || 'red') &&
                ['annual_balance', 'casual_balance', 'perm_hours'].every(key =>
                    emp[key] == null || (typeof emp[key] === 'number' && Number.isFinite(emp[key]) && emp[key] >= 0)))) return false;
            return Object.entries(data.attendanceData).every(([date, day]) =>
                /^\d{4}-\d{2}-\d{2}$/.test(date) && day && typeof day === 'object' &&
                (!day.records || (typeof day.records === 'object' && !Array.isArray(day.records) &&
                    Object.values(day.records).every(rec => rec && typeof rec === 'object' &&
                        typeof (rec.status ?? '') === 'string' && typeof (rec.notes ?? '') === 'string' &&
                        Number.isFinite(Number(rec.delay ?? 0)) && Number.isFinite(Number(rec.permissionMinutes ?? 0))))));
        }

