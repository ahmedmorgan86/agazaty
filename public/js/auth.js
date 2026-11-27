        // ==========================================
        // 9. CLOUD SYNC & LOCAL STORAGE
        // ==========================================
        function saveToStorage() {
            // Firestore manages its own offline cache after sign-in.
        }

        let forcedPasswordTyped = '';
        function closeForcedPassword() { document.getElementById('forcedPasswordModal').classList.add('hidden'); forcedPasswordTyped = ''; }
        async function submitForcedPassword(event) {
            event.preventDefault();
            const next = document.getElementById('forcedNewPassword').value;
            const confirmation = document.getElementById('forcedConfirmPassword').value;
            const message = document.getElementById('forcedPasswordMessage');
            if (next !== confirmation) { message.textContent = 'كلمتا المرور غير متطابقتين.'; return; }
            try {
                await window.firebaseBridge.forcePasswordChange(forcedPasswordTyped, next);
                document.getElementById('forcedNewPassword').value = '';
                document.getElementById('forcedConfirmPassword').value = '';
                message.textContent = '';
                closeForcedPassword();
                showNotice('تم تغيير كلمة المرور.');
            } catch (error) { message.textContent = error.message; }
        }
        async function saveStarterPassword() {
            if (!isAdmin) return;
            const field = document.getElementById('starterPasswordInput');
            try {
                await window.firebaseBridge.setStarterPassword(field.value);
                field.value = '';
                showNotice('تم حفظ كلمة البدء.');
            } catch (error) { showNotice(error.message, 'error'); }
        }

        async function loginEmployee(event) {
            event.preventDefault();
            const code = toLatinDigits(document.getElementById('loginCode').value.trim());
            let password = document.getElementById('loginPassword').value;
            const errorLabel = document.getElementById('loginError');
            const button = document.getElementById('loginButton');
            const buttonLabel = button.innerHTML;
            errorLabel.classList.add('hidden');
            button.disabled = true;
            button.textContent = 'جارٍ الدخول...';
            try {
                try { await window.firebaseBridge.login(code, password); }
                catch (firstError) {
                    const latin = toLatinDigits(password);
                    if (latin === password) throw firstError;
                    await window.firebaseBridge.login(code, latin);
                    password = latin;
                }
                try {
                    if (await window.firebaseBridge.mustChangePassword(password)) {
                        forcedPasswordTyped = password;
                        document.getElementById('forcedPasswordModal').classList.remove('hidden');
                    }
                } catch (checkError) { /* a failed check must not block sign-in */ }
            }
            catch (error) {
                const authCode = String(error?.code || '');
                errorLabel.textContent = authCode === 'auth/too-many-requests' ? 'محاولات دخول كثيرة. انتظر بضع دقائق ثم حاول مرة أخرى.'
                    : authCode === 'auth/network-request-failed' ? 'تعذر الاتصال بالإنترنت. تحقق من الشبكة وحاول مرة أخرى.'
                    : 'الكود أو كلمة المرور غير صحيحين، أو الحساب غير مفعّل.';
                errorLabel.classList.remove('hidden');
            } finally { button.disabled = false; button.innerHTML = buttonLabel; }
        }
        function toggleLoginPassword() {
            const input = document.getElementById('loginPassword');
            const button = document.querySelector('.login-password-toggle');
            const visible = input.type === 'password';
            input.type = visible ? 'text' : 'password';
            button.setAttribute('aria-pressed', String(visible));
            button.setAttribute('aria-label', visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
            button.innerHTML = visible ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
        }
        function toLatinDigits(text) {
            return String(text).replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660)).replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0));
        }
        function normalizeLoginIdentifier(input) {
            input.value = toLatinDigits(input.value).replace(/[^0-9]/g, '').slice(0, 4);
        }
        function showRegistration() {
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('registrationForm').classList.remove('hidden');
        }
        function hideRegistration() {
            document.getElementById('registrationForm').classList.add('hidden');
            document.getElementById('loginForm').classList.remove('hidden');
        }
        async function submitRegistration(event) {
            event.preventDefault();
            const form = event.currentTarget, button = form.querySelector('[type="submit"]');
            button.disabled = true;
            const message = document.getElementById('registrationMessage');
            try {
                await window.firebaseBridge.registerEmployee({ name: document.getElementById('registrationName').value.trim(),
                    code: document.getElementById('registrationCode').value, team: document.getElementById('registrationTeam').value,
                    job: document.getElementById('registrationJob').value, pass: document.getElementById('registrationPassword').value });
                document.getElementById('registrationPassword').value = '';
                message.textContent = 'تم إرسال طلبك إلى المدير. انتظر الموافقة قبل استخدام الحساب.';
                document.getElementById('registrationForm').classList.add('hidden');
                document.getElementById('pendingCard').classList.remove('hidden');
            } catch (error) { message.textContent = error.code === 'auth/email-already-in-use' ? 'هذا الكود مسجل مسبقاً.' : error.message; }
            finally { button.disabled = false; }
        }

        function logoutEmployee() { window.firebaseBridge.logout(); }

        function showAccountModal() {
            document.getElementById('accountProfile').textContent = currentProfile
                ? `${currentProfile.name} · ${currentProfile.job} · ${currentProfile.code}${isAdmin ? ' · مدير النظام' : ''}`
                : 'حساب الإدارة';
            document.getElementById('accountMessage').textContent = '';
            document.getElementById('accountModal').classList.remove('hidden');
        }

        function closeAccountModal() { document.getElementById('accountModal').classList.add('hidden'); }

        async function changeEmployeePassword(event) {
            event.preventDefault();
            const message = document.getElementById('accountMessage');
            const current = document.getElementById('currentPassword').value;
            const next = document.getElementById('newPassword').value;
            const confirmation = document.getElementById('confirmPassword').value;
            if (next !== confirmation) {
                message.textContent = 'كلمتا المرور الجديدتان غير متطابقتين.';
                message.className = 'text-xs mt-2 text-red-700';
                showNotice(message.textContent, 'warning');
                return;
            }
            try {
                await window.firebaseBridge.changePassword(current, next);
                document.getElementById('currentPassword').value = '';
                document.getElementById('newPassword').value = '';
                document.getElementById('confirmPassword').value = '';
                message.textContent = 'تم تغيير كلمة المرور.';
                message.className = 'text-xs mt-2 text-emerald-700';
                showNotice(message.textContent);
                setTimeout(() => { closeAccountModal(); message.textContent = ''; }, 1500);
            } catch (error) {
                message.textContent = ['auth/wrong-password', 'auth/invalid-credential'].includes(error.code) ? 'كلمة المرور الحالية غير صحيحة.' : error.message;
                message.className = 'text-xs mt-2 text-red-700';
                showNotice(message.textContent, 'error');
            }
        }

        function showSignedOut() {
            clearTimeout(authGateTimer);
            currentAppPage = 'home';
            if (registrationListener) { registrationListener(); registrationListener = null; }
            pendingRegistrations = [];
            firebaseUser = null;
            themeUid = null;
            applyThemePref();
            currentProfile = null;
            isAdmin = false;
            renderJobs();
            activeTeam = null;
            employees = [];
            attendanceData = {};
            shiftSettings = { times: {}, overrides: {} };
            workspaceEmployees = [];
            registeredEmployees = [];
            workspaceLoaded = false;
            profilesLoaded = false;
            document.getElementById('appHeader').classList.add('hidden');
            document.getElementById('mobileBottomNav')?.classList.add('hidden');
            document.getElementById('appMain').classList.add('hidden');
            document.getElementById('employeePage').classList.add('hidden');
            document.getElementById('jobsPage').classList.add('hidden');
            document.getElementById('authGate').classList.add('hidden');
            document.getElementById('loginScreen').classList.remove('hidden');
            document.getElementById('loginForm').classList.remove('hidden');
            document.getElementById('registrationForm').classList.add('hidden');
            document.getElementById('pendingCard').classList.add('hidden');
            document.getElementById('loginPassword').value = '';
            document.querySelectorAll('.app-modal, #cloudModal').forEach(el => el.classList.add('hidden'));
        }

        function showSignedInProfile() {
            document.getElementById('profileName').textContent = currentProfile?.name || 'الإدارة';
            document.getElementById('profileDetails').textContent = currentProfile
                ? `الإدارة: ${currentProfile.job || 'غير محددة'}${isAdmin ? ' · مدير النظام' : ''}`
                : 'إدارة الموظفين والورديات';
            document.getElementById('headerUserName').textContent = currentProfile?.name || 'الموظف';
            document.getElementById('headerUserRole').textContent = isAdmin ? 'مدير النظام' : currentProfile?.job || 'موظف';
            document.getElementById('profileCode').textContent = currentProfile ? `الكود: ${currentProfile.code}` : 'ADMIN';
            ['autoFillButton', 'quickFillButton'].forEach(id => document.getElementById(id).classList.toggle('hidden', !isAdmin));
            [['btnTeamRed', 'red'], ['btnTeamBlue', 'blue'], ['btnTeamYellow', 'yellow'], ['btnTeamMorning', 'morning']]
                .forEach(([id, team]) => document.getElementById(id).classList.toggle('hidden', !isAdmin && currentProfile?.team !== team));
            document.querySelector('.team-controls').classList.toggle('single-team', !isAdmin);
            document.getElementById('backupControls').classList.toggle('hidden', !isAdmin);
            document.getElementById('myReportButton').classList.toggle('hidden', !myReportEmployee());
            document.getElementById('manageJobsButton').classList.toggle('hidden', !isAdmin);
            document.getElementById('mobileJobsButton').classList.toggle('hidden', !isAdmin);
            document.getElementById('cloudStatusBtn').classList.toggle('hidden', !isAdmin);
            document.getElementById('mobileCloudButton').classList.toggle('hidden', !isAdmin);
            document.getElementById('mobileCloudButton').style.display = isAdmin ? 'flex' : 'none';
            if (!isAdmin) document.getElementById('cloudModal').classList.add('hidden');
            document.getElementById('manageJobsButton').style.display = isAdmin ? 'flex' : 'none';
            document.getElementById('mobileJobsButton').style.display = isAdmin ? 'flex' : 'none';
            if (firebaseLoadFailed) return;
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('appHeader').classList.remove('hidden');
            document.getElementById('mobileBottomNav')?.classList.remove('hidden');
            showAppPage(currentAppPage, false);
            clearTimeout(authGateTimer);
            document.getElementById('authGate').classList.add('hidden');
        }

        function applyCloudSnapshots() {
            if (!firebaseUser || !workspaceLoaded || !profilesLoaded) return;
            const byId = new Map(workspaceEmployees.map(emp => [emp.id, emp]));
            registeredEmployees.forEach(profile => {
                if (!profile.name || !profile.code) return;
                const id = profile.id || profile.employeeId || profile.uid;
                const existing = byId.get(id) || {};
                const authUid = profile.authUid || profile.uid || existing.authUid || id;
                byId.set(id, { ...existing, ...profile, id, authUid });
            });
            employees = [...byId.values()];
            const emailCode = firebaseUser.email ? firebaseUser.email.split('@')[0].trim() : '';
            currentProfile = employees.find(emp =>
                (emp.authUid && emp.authUid === firebaseUser.uid) ||
                (emp.id && emp.id === firebaseUser.uid) ||
                (emp.employeeId && emp.employeeId === firebaseUser.uid) ||
                (emp.code && emailCode && String(emp.code).trim() === emailCode)
            ) || null;
            if (!isAdmin && !currentProfile) {
                document.getElementById('authGate').classList.add('hidden');
                document.getElementById('loginScreen').classList.remove('hidden');
                document.getElementById('loginForm').classList.add('hidden');
                document.getElementById('pendingCard').classList.remove('hidden');
                document.getElementById('pendingMessage').textContent = 'الحساب قيد المراجعة أو غير مسجل في هذه الوردية. تواصل مع المدير.';
                return;
            }
            ensureMonthDates(currentMonth);
            showSignedInProfile();
            renderEmployeeCards();
            if (!document.getElementById('rotationMatrixModal').classList.contains('hidden')) renderShiftEditor();
            if (!activeTeam && currentProfile && !isAdmin) switchTeam(currentProfile.team);
            else renderTable();
        }

