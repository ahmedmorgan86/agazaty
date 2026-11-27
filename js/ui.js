        // ==========================================
        // Mobile Navigation & Balances Management
        // ==========================================
        function openMobileMoreMenu() {
            document.getElementById('mobileMoreModal')?.classList.remove('hidden');
        }
        function openDownloadAppsModal() {
            document.getElementById('downloadAppsModal')?.classList.remove('hidden');
        }
        function closeDownloadAppsModal() {
            document.getElementById('downloadAppsModal')?.classList.add('hidden');
        }
        function closeMobileMoreMenu() {
            document.getElementById('mobileMoreModal')?.classList.add('hidden');
        }
        function navigateMobileTab(tab, el) {
            document.querySelectorAll('.mobile-nav-btn').forEach(btn => btn.classList.remove('active'));
            if (el) el.classList.add('active');
            if (tab === 'home') {
                showAppPage('home');
            } else if (tab === 'employees') {
                showAppPage('employees');
            } else if (tab === 'balances') {
                openMyBalancesModal();
            } else if (tab === 'report') {
                openMyReport();
            }
        }

        function openMyBalancesModal() {
            let myEmp = null;
            if (currentProfile) {
                myEmp = employees.find(e => e.id === currentProfile.id || e.id === currentProfile.employeeId || e.code === currentProfile.code);
            }
            if (myEmp) {
                openEmployeeBalancesModal(myEmp.id);
            } else {
                openBalancesModal();
            }
        }

        function openEmployeeBalancesModal(empId) {
            const emp = employees.find(e => e.id === empId);
            if (!emp) return;
            document.getElementById('editBalanceEmpId').value = emp.id;
            document.getElementById('editBalanceEmpName').value = emp.name || '';
            document.getElementById('editBalanceAnnual').value = emp.annual_balance ?? 21;
            document.getElementById('editBalanceCasual').value = emp.casual_balance ?? 7;
            document.getElementById('editBalancePerm').value = emp.perm_hours ?? 4;
            
            // Compute current usage
            let usedAnnual = 0, usedCasual = 0, usedPermMinutes = 0;
            const currentYr = currentMonth.slice(0, 4);
            Object.entries(attendanceData || {}).forEach(([date, day]) => {
                if (!date.startsWith(currentYr + '-')) return;
                const rec = day?.records?.[emp.id];
                if (rec) {
                    const eff = effectiveRecord(date, emp, rec);
                    const st = (eff.status || '').trim();
                    if (st === 'إعتيادي') usedAnnual++;
                    if (st === 'عارضة') usedCasual++;
                    if (st === 'إذن' && date.startsWith(currentMonth)) {
                        usedPermMinutes += (parseInt(eff.permissionMinutes, 10) || 0);
                    }
                }
            });
            const liveBox = document.getElementById('editBalanceLiveUsage');
            if (liveBox) {
                liveBox.innerHTML = `
                    <div class="font-bold text-slate-700">الاستهلاك الفعلي حتى الآن:</div>
                    <div>• إعتيادي مستهلك: <strong class="text-red-600">${usedAnnual} يوم</strong> (متبقٍ: <strong>${Math.max(0, (emp.annual_balance ?? 21) - usedAnnual)}</strong>)</div>
                    <div>• عارضة مستهلكة: <strong class="text-amber-600">${usedCasual} يوم</strong> (متبقٍ: <strong>${Math.max(0, (emp.casual_balance ?? 7) - usedCasual)}</strong>)</div>
                    <div>• إذن شهر ${currentMonth}: <strong class="text-purple-700">${(usedPermMinutes / 60).toFixed(1)} س</strong> (متبقٍ: <strong>${Math.max(0, (emp.perm_hours ?? 4) - usedPermMinutes / 60).toFixed(1)} س</strong>)</div>
                `;
            }
            document.getElementById('employeeBalancesEditModal').classList.remove('hidden');
        }

        function closeEmployeeBalancesModal() {
            document.getElementById('employeeBalancesEditModal').classList.add('hidden');
        }

        async function saveEmployeeBalancesFromModal(event) {
            event.preventDefault();
            const empId = document.getElementById('editBalanceEmpId').value;
            const name = document.getElementById('editBalanceEmpName').value.trim();
            const annual = Number(document.getElementById('editBalanceAnnual').value);
            const casual = Number(document.getElementById('editBalanceCasual').value);
            const perm = Number(document.getElementById('editBalancePerm').value);

            if (!name) { showNotice('يرجى كتابة الاسم', 'warning'); return; }
            if (isNaN(annual) || annual < 0 || annual > 365) { showNotice('رصيد الاعتيادي غير صحيح (0 - 365)', 'warning'); return; }
            if (isNaN(casual) || casual < 0 || casual > 365) { showNotice('رصيد العارضة غير صحيح (0 - 365)', 'warning'); return; }
            if (isNaN(perm) || perm < 0 || perm > 100) { showNotice('رصيد الإذن الشهري غير صحيح (0 - 100)', 'warning'); return; }

            const saveBtn = document.getElementById('saveBalancesBtn');
            const originalText = saveBtn.innerHTML;
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin ml-1"></i>جاري الحفظ...';

            try {
                const emp = employees.find(e => e.id === empId);
                const targetUid = emp?.authUid || (currentProfile?.id === empId ? currentProfile?.authUid : null);
                if (window.firebaseBridge?.updateEmployeeBalances) {
                    await window.firebaseBridge.updateEmployeeBalances(empId, {
                        name,
                        annual_balance: annual,
                        casual_balance: casual,
                        perm_hours: perm
                    }, targetUid);
                }
                if (emp) {
                    emp.name = name;
                    emp.annual_balance = annual;
                    emp.casual_balance = casual;
                    emp.perm_hours = perm;
                }
                if (currentProfile && (currentProfile.id === empId || currentProfile.employeeId === empId)) {
                    currentProfile.name = name;
                    currentProfile.annual_balance = annual;
                    currentProfile.casual_balance = casual;
                    currentProfile.perm_hours = perm;
                    document.getElementById('profileName').textContent = name;
                    document.getElementById('headerUserName').textContent = name;
                }
                closeEmployeeBalancesModal();
                renderEmployeesDirectory();
                renderEmployeeCards();
                if (!document.getElementById('balancesModal').classList.contains('hidden')) {
                    openBalancesModal();
                }
                renderTable();
                showNotice('تم حفظ الأرصدة وساعات الإذن بنجاح', 'success');
            } catch (err) {
                console.error(err);
                showNotice(err.message || 'تعذر حفظ الأرصدة', 'error');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalText;
            }
        }

        // INITIALIZATION
        // ==========================================
        window.addEventListener('DOMContentLoaded', () => {
            applyTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
            document.querySelectorAll('.copyright-year').forEach(item => item.textContent = new Date().getFullYear());
            switchMonth(currentMonth);
            if (DEMO_MODE) {
                document.body.classList.add('demo-mode');
                document.getElementById('attendanceHint').textContent = '💡 عرض توضيحي للقراءة فقط؛ تغييراتك لا تُحفظ.';
                ensureMonthDates(currentMonth);
                employees = [
                    { id: 'demo_1', code: 'A-104', name: 'ليلى محمود', team: 'red', job: 'دعم المستخدمين للأجهزة', annual_balance: 21, casual_balance: 7, perm_hours: 4 },
                    { id: 'demo_2', code: 'A-118', name: 'عمر ياسر', team: 'red', job: 'دعم المستخدمين للأجهزة', annual_balance: 21, casual_balance: 7, perm_hours: 4 },
                    { id: 'demo_3', code: 'A-126', name: 'سارة أحمد', team: 'red', job: 'دعم المستخدمين للأجهزة', annual_balance: 21, casual_balance: 7, perm_hours: 4 }
                ];
                currentProfile = employees[0];
                firebaseUser = { uid: 'demo' };
                const days = Object.keys(attendanceData).filter(date => date <= localDateKey());
                days.slice(0, 18).forEach((date, index) => {
                    attendanceData[date].records = {
                        demo_1: { status: index % 9 === 0 ? 'إعتيادي' : 'حضور', delay: index % 5 === 0 ? 15 : 0, notes: '' },
                        demo_2: { status: index % 7 === 0 ? 'عارضة' : 'حضور', delay: 0, notes: '' },
                        demo_3: { status: index % 8 === 0 ? 'إذن' : 'حضور', delay: 0, permissionMinutes: index % 8 === 0 ? 60 : 0, notes: '' }
                    };
                });
                document.getElementById('loginScreen').classList.add('hidden');
                showSignedInProfile();
                document.getElementById('cloudStatusText').textContent = 'معاينة تجريبية';
                renderEmployeeCards();
                switchTeam('red');
                document.getElementById('heroSubtitle').textContent = 'بيانات توضيحية للمعاينة، بلا اتصال بحسابات العمل.';
                return;
            }
            document.getElementById('loginScreen').classList.add('hidden');
            scheduleAuthGate();
            if (firebaseReady && !firebaseConnected) connectFirebase(FIREBASE_CONFIG);
        });
        window.addEventListener('firebase-bridge-ready', () => {
            firebaseReady = true;
            if (DEMO_MODE) return;
            if (!firebaseConnected) connectFirebase(FIREBASE_CONFIG);
        });
