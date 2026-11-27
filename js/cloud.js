        function openCloudModal() {
            if (!isAdmin) return;
            document.getElementById('cloudModal').classList.remove('hidden');
        }

        function closeCloudModal() {
            document.getElementById('cloudModal').classList.add('hidden');
        }

        function setFirebaseMessage(message, isError = false) {
            const label = document.getElementById('firebaseMessage');
            label.textContent = message;
            label.className = `text-xs ${isError ? 'text-red-700' : 'text-slate-600'}`;
        }

        function updateCloudUI(message, connected = false) {
            const dot = document.getElementById('cloudStatusDot');
            dot.className = `w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500'}`;
            document.getElementById('cloudStatusText').innerText = message;
        }

        function connectFirebase(config) {
            if (!firebaseReady) {
                updateCloudUI('تعذر تحميل Firebase');
                return;
            }
            try {
                firebaseConnected = true;
                window.firebaseBridge.connect(config, {
                    onSignedOut() { clearTimeout(cacheStatusTimer); showSignedOut(); },
                    onAuth(user, claims) {
                        clearTimeout(cacheStatusTimer);
                        if (firebaseUser?.uid !== user.uid) {
                            workspaceLoaded = false;
                            profilesLoaded = false;
                            activeTeam = null;
                        }
                        firebaseUser = user;
                        themeUid = user.uid;
                        applyThemePref();
                        isAdmin = claims.admin === true;
                        renderJobs();
                        if (registrationListener) { registrationListener(); registrationListener = null; }
                        if (isAdmin) registrationListener = window.firebaseBridge.watchRegistrations(requests => {
                            pendingRegistrations = requests;
                            renderRegistrationQueue();
                        });
                        updateCloudUI('جاري تحميل بيانات Firebase');
                        setFirebaseMessage('تم تسجيل الدخول. جارٍ تحميل بيانات الحضور.');
                        scheduleAuthGate();
                    },
                    onPending(status) {
                        document.getElementById('authGate').classList.add('hidden');
                        document.getElementById('loginScreen').classList.remove('hidden');
                        document.getElementById('loginForm').classList.add('hidden');
                        document.getElementById('registrationForm').classList.add('hidden');
                        document.getElementById('pendingCard').classList.remove('hidden');
                        document.getElementById('pendingMessage').textContent = status === 'rejected' ? 'رفض المدير الطلب. تواصل معه للمراجعة.' : 'تم إرسال الطلب إلى حساب المدير. الحساب قيد المراجعة.';
                    },
                    onProfiles(profiles) {
                        registeredEmployees = profiles;
                        profilesLoaded = true;
                        applyCloudSnapshots();
                    },
                    onData(data, metadata) {
                        if (metadata.hasPendingWrites) updateCloudUI('المزامنة قيد التنفيذ');
                        if (!isValidWorkspace(data)) {
                            setFirebaseMessage('بيانات السحابة غير صالحة.', true);
                            return;
                        }
                        applyingCloudData = true;
                        workspaceEmployees = data.employees;
                        attendanceData = data.attendanceData;
                        shiftSettings = data.shiftSettings && typeof data.shiftSettings === 'object'
                            ? { times: data.shiftSettings.times || {}, overrides: data.shiftSettings.overrides || {} }
                            : { times: {}, overrides: {} };
                        workspaceLoaded = true;
                        applyingCloudData = false;
                        applyCloudSnapshots();
                        clearTimeout(cacheStatusTimer);
                        if (metadata.fromCache) {
                            updateCloudUI(navigator.onLine ? 'جاري تحديث البيانات' : 'بيانات محفوظة دون اتصال');
                            if (navigator.onLine) cacheStatusTimer = setTimeout(() => {
                                updateCloudUI('تعذر تحديث البيانات؛ تُعرض نسخة محفوظة');
                            }, 10000);
                        } else {
                            updateCloudUI('Firebase متصل', true);
                        }
                    },
                    onEmpty() {
                        if (isAdmin) {
                            employees = INITIAL_EMPLOYEES;
                            attendanceData = INITIAL_ATTENDANCE;
                            shiftSettings = { times: {}, overrides: {} };
                            cloudWrite(window.firebaseBridge.initializeWorkspace());
                        }
                    },
                    onError(error) {
                        clearTimeout(cacheStatusTimer);
                        clearTimeout(authGateTimer);
                        updateCloudUI('فشلت مزامنة Firebase');
                        setFirebaseMessage(error.message, true);
                        if (firebaseUser && !workspaceLoaded) {
                            document.getElementById('authGateMessage').textContent = `تعذر تحميل البيانات: ${error.message}`;
                            document.getElementById('authGate').classList.remove('hidden');
                        }
                    }
                });
                if (jobListener) jobListener();
                jobListener = window.firebaseBridge.watchJobs(jobs => { availableJobs = jobs; renderJobs(); });
            } catch (error) {
                firebaseConnected = false;
                updateCloudUI('فشل إعداد Firebase');
                setFirebaseMessage(error.message, true);
            }
        }

        function cloudWrite(promise, successMessage) {
            updateCloudUI('المزامنة قيد التنفيذ');
            return promise.then(() => {
                clearTimeout(cacheStatusTimer);
                updateCloudUI('Firebase متصل', true);
                if (successMessage) showNotice(successMessage);
                return true;
            })
                .catch(error => {
                    updateCloudUI('فشلت مزامنة Firebase');
                    setFirebaseMessage(error.message, true);
                    showNotice(`تعذر حفظ التغييرات: ${error.message}`, 'error');
                    return false;
                });
        }

        function syncRecordToCloud(date, empId, successMessage) {
            if (!firebaseUser) return;
            const day = attendanceData[date];
            const emp = employees.find(item => item.id === empId);
            return cloudWrite(window.firebaseBridge.saveRecords([{ date, day: day.day, shift: day.shift,
                employeeId: empId, team: emp.team, job: emp.job, groupKey: employeeKey(emp), record: day.records[empId] }]), successMessage);
        }

        function downloadBackupJSON() {
            const backup = { employees, attendanceData, shiftSettings, exportedAt: new Date().toISOString() };
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `attendance_backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
        }

        async function uploadRecordsJSON(event) {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            if (DEMO_MODE || !firebaseUser || !firebaseConnected) {
                showNotice('سجّل الدخول إلى قاعدة البيانات لرفع السجلات.', 'warning');
                return;
            }
            try {
                if (file.size > 10 * 1024 * 1024) throw new Error('الملف أكبر من 10 ميجابايت. قسّمه إلى ملفات أصغر.');
                const data = JSON.parse(await file.text());
                if (!data || typeof data.attendanceData !== 'object' || Array.isArray(data.attendanceData)) {
                    throw new Error('الملف لا يحتوي على attendanceData صالحة.');
                }
                const roster = new Map(employees.map(emp => [emp.id, emp]));
                const allowedStatuses = new Set(['حضور', 'راحة', 'إعتيادي', 'عارضة', 'إذن', 'مأمورية']);
                const changes = [];
                for (const [date, day] of Object.entries(data.attendanceData)) {
                    if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date) ||
                        Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
                        new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date ||
                        !day || typeof day.records !== 'object' || Array.isArray(day.records)) {
                        throw new Error(`تاريخ أو مجموعة سجلات غير صالحة: ${date}`);
                    }
                    for (const [employeeId, record] of Object.entries(day.records)) {
                        const emp = roster.get(employeeId);
                        if (!emp || !canAccessEmployee(emp)) {
                            throw new Error(`الملف يتضمن موظفًا غير متاح لك: ${employeeId}`);
                        }
                        if (!record || !allowedStatuses.has(record.status) ||
                            !Number.isInteger(record.delay ?? 0) || (record.delay ?? 0) < 0 || (record.delay ?? 0) > 1440 ||
                            !Number.isInteger(record.permissionMinutes ?? 0) || (record.permissionMinutes ?? 0) < 0 || (record.permissionMinutes ?? 0) > 1440 ||
                            typeof (record.notes ?? '') !== 'string' || (record.notes ?? '').length > 1000) {
                            throw new Error(`سجل غير صالح للموظف ${employeeId} في ${date}`);
                        }
                        changes.push({ date, employeeId, team: emp.team, job: emp.job, groupKey: employeeKey(emp),
                            record: { status: record.status, delay: record.delay ?? 0,
                                permissionMinutes: record.permissionMinutes ?? 0, notes: record.notes ?? '' } });
                        if (changes.length > 5000) throw new Error('الملف يتجاوز 5000 سجل. قسّمه إلى ملفات أصغر.');
                    }
                }
                if (!changes.length) throw new Error('الملف لا يحتوي على سجلات قابلة للرفع.');
                if (!await askConfirmation(`سيُضاف أو يُستبدل ${changes.length} سجل حضور للموظفين الموجودين. هل تريد المتابعة؟`,
                    { title: 'رفع سجلات الحضور', accept: 'رفع السجلات' })) return;
                const saved = await cloudWrite(window.firebaseBridge.saveRecords(changes), 'تم رفع سجلات الحضور.');
                if (saved) closeCloudModal();
            } catch (error) {
                showNotice(error.message || 'الملف غير صالح أو تالف.', 'error');
            }
        }

        function uploadBackupJSON(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    const data = JSON.parse(e.target.result);
                    if (isValidWorkspace(data)) {
                        const currentIds = new Set(employees.map(emp => emp.id));
                        const importedIds = new Set(data.employees.map(emp => emp.id));
                        if (currentIds.size !== importedIds.size || [...currentIds].some(id => !importedIds.has(id))) {
                            showNotice('استعادة الحضور تتطلب تطابق حسابات الموظفين الحالية مع النسخة.', 'warning');
                            return;
                        }
                        if (!await askConfirmation('ستستبدل سجلات الحضور ومواعيد الورديات. ستبقى حسابات الموظفين الحالية كما هي. هل تريد المتابعة؟', { title: 'استعادة نسخة احتياطية', accept: 'استعادة البيانات', danger: true })) return;
                        attendanceData = data.attendanceData;
                        shiftSettings = data.shiftSettings && typeof data.shiftSettings === 'object'
                            ? { times: data.shiftSettings.times || {}, overrides: data.shiftSettings.overrides || {} }
                            : { times: {}, overrides: {} };
                        saveToStorage();
                        renderTable();
                        const saved = await cloudWrite(window.firebaseBridge.save({ employees, attendanceData, shiftSettings, updatedAt: new Date().toISOString() }), 'تم استعادة النسخة الاحتياطية بنجاح.');
                        if (saved) closeCloudModal();
                    } else {
                        showNotice('النسخة الاحتياطية لا تحتوي على بيانات صحيحة.', 'warning');
                    }
                } catch(err) {
                    showNotice('الملف غير صالح أو تالف.', 'error');
                }
            };
            reader.readAsText(file);
        }

        // ==========================================
        // 10. EXCEL EXPORT
        // ==========================================
        function exportToExcel() {
            if (!activeTeam) { showNotice('اختر وردية أولاً.', 'warning'); return; }
            if (typeof XLSX === 'undefined') { showNotice('تعذر تجهيز ملف Excel. أعد تحميل التطبيق ثم حاول مرة أخرى.', 'error'); return; }
            ensureMonthDates(currentMonth);
            const dates = Object.keys(attendanceData).sort().filter(d => d.startsWith(currentMonth));
            const exportRows = [];
            const visibleEmployees = employees.filter(emp => emp.team === activeTeam && canAccessEmployee(emp));

            const h1 = ["التاريخ", "اليوم", "الوردية"];
            visibleEmployees.forEach(emp => {
                h1.push(emp.name, "", "");
            });
            exportRows.push(h1);

            const h2 = ["", "", ""];
            visibleEmployees.forEach(() => {
                h2.push("وردية الموظف", "البيان", "التأخير (دقيقة)");
            });
            exportRows.push(h2);

            dates.forEach(date => {
                const day = attendanceData[date];
                const row = [date, day.day, calculateShiftForDate(Number(date.slice(-2)), activeTeam)];
                visibleEmployees.forEach(emp => {
                    const rec = effectiveRecord(date, emp, day.records && day.records[emp.id]);
                    row.push(calculateShiftForDate(Number(date.slice(-2)), teamOn(emp, date) || 'red'), displayedStatus(date, emp, rec), rec.delay || 0);
                });
                exportRows.push(row);
            });

            try {
                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.aoa_to_sheet(exportRows);
                ws['!cols'] = [{ wch: 14 }, { wch: 15 }, { wch: 18 },
                    ...visibleEmployees.flatMap(() => [{ wch: 18 }, { wch: 19 }, { wch: 17 }])];
                ws['!freeze'] = { xSplit: 3, ySplit: 2 };
                XLSX.utils.book_append_sheet(wb, ws, "الورديات والغياب");
                const filename = `attendance_sheet_${currentMonth}.xlsx`;
                if (window.AgazatyAndroidExport?.saveExcel) {
                    window.AgazatyAndroidExport.saveExcel(XLSX.write(wb, { bookType: 'xlsx', type: 'base64' }), filename);
                } else if (window.chrome?.webview?.postMessage) {
                    window.chrome.webview.postMessage({ type: 'saveExcel', filename,
                        data: XLSX.write(wb, { bookType: 'xlsx', type: 'base64' }) });
                } else {
                    const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                    const url = URL.createObjectURL(new Blob([bytes],
                        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    setTimeout(() => URL.revokeObjectURL(url), 60000);
                    showNotice('بدأ تنزيل ملف Excel.', 'success');
                }
            } catch (error) {
                showNotice(`تعذر تصدير Excel: ${error.message}`, 'error');
            }
        }

        // ==========================================
        
