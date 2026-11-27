        // ==========================================
        // 4. ADVANCED EMPLOYEE CRUD MANAGEMENT
        // ==========================================
        function openEmployeesManagerModal() {
            renderEmployeesDirectory();
            resetEmployeeForm();
            document.getElementById('employeesManagerModal').classList.remove('hidden');
        }

        function openNewEmployeeForm() {
            if (!isAdmin) return;
            openEmployeesManagerModal();
            document.getElementById('formEmpName').focus();
        }

        function closeEmployeesManagerModal() {
            document.getElementById('employeesManagerModal').classList.add('hidden');
            resetEmployeeForm();
        }

        function renderEmployeesDirectory() {
            const tbody = document.getElementById('employeesDirectoryTableBody');
            let html = '';

            const visibleEmployees = employees.filter(canAccessEmployee);
            visibleEmployees.forEach((emp, index) => {
                const teamBadge = {
                    blue: '<span class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[10px] font-bold">الزرقاء (طويل 1)</span>',
                    yellow: '<span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-bold">الصفراء (طويل 21)</span>',
                    morning: '<span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">الوردية الصباحية</span>'
                }[emp.team] || '<span class="bg-red-100 text-red-800 px-2 py-0.5 rounded text-[10px] font-bold">الحمراء (طويل 11)</span>';

                html += `
                    <tr class="hover:bg-slate-50 transition">
                        <td class="p-3 text-slate-400 font-mono">${index + 1}</td>
                        <td class="p-3 font-bold text-slate-800">${escapeHTML(emp.name)}</td>
                        <td class="p-3 font-mono text-slate-500">${escapeHTML(emp.code || '-')}</td>
                        <td class="p-3 text-slate-600">${escapeHTML(emp.job || 'غير محددة')}</td>
                        <td class="p-3">${teamBadge}</td>
                        <td class="p-3 text-center font-bold text-sky-700">${emp.annual_balance ?? 21} يوم</td>
                        <td class="p-3 text-center font-bold text-amber-700">${emp.casual_balance ?? 7} أيام</td>
                        <td class="p-3 text-center font-mono">${emp.perm_hours ?? 4} س</td>
                        <td class="p-3 text-center">
                            <div class="flex items-center justify-center space-x-2 space-x-reverse">
                                ${isAdmin ? `<button onclick="editEmployee('${emp.id}')" class="px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold text-xs" title="تعديل بيانات الموظف">
                                    <i class="fa-solid fa-pen-to-square"></i> تعديل
                                </button>` : ''}
                                <button type="button" onclick="openEmployeeBalancesModal('${emp.id}')" class="px-2 py-1 rounded bg-teal-50 text-teal-700 hover:bg-teal-100 font-bold text-xs" title="تعديل أرصدة الإجازات والإذن">
                                    <i class="fa-solid fa-wallet"></i> الأرصدة
                                </button>
                                <button onclick="openEmployeeReport('${emp.id}')" class="px-2 py-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-bold text-xs" title="كشف حضور الموظف">
                                    <i class="fa-solid fa-file-invoice"></i> كشف
                                </button>
                                ${isAdmin ? `<button onclick="openTransfer('${emp.id}')" class="px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs" title="نقل لوردية جديدة"><i class="fa-solid fa-right-left"></i> نقل وردية</button>` : ''}
                                ${isAdmin && emp.authUid ? `<button onclick="resetEmployeePassword('${emp.id}')" class="px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold text-xs" title="إعادة تعيين كلمة المرور">
                                    <i class="fa-solid fa-key"></i> كلمة المرور
                                </button>` : ''}
                                ${isAdmin ? `<button onclick="deleteEmployee('${emp.id}')" class="px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 font-bold text-xs" title="حذف الموظف">
                                    <i class="fa-solid fa-trash-can"></i> حذف
                                </button>` : ''}
                            </div>
                        </td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;
        }

        function renderEmployeeCards() {
            const visible = employees.filter(canAccessEmployee);
            document.getElementById('addEmployeeButton').classList.toggle('hidden', !isAdmin);
            document.getElementById('employeeDirectorySubtitle').textContent = isAdmin
                ? 'جميع الموظفين: تعديل البيانات والأرصدة، إضافة الحسابات وحذفها'
                : currentProfile?.accessScope === 'self' ? 'حسابك وسجلاتك فقط' : 'زملاؤك في نفس الوردية والإدارة';
            const teamNames = { red: 'الحمراء', blue: 'الزرقاء', yellow: 'الصفراء', morning: 'الصباحية' };
            document.getElementById('employeeCards').innerHTML = visible.length ? visible.map(emp => `
                <article class="employee-card">
                    <h3>${escapeHTML(emp.name)}</h3>
                    <p>الكود: ${escapeHTML(emp.code || '—')} · الوردية: ${teamNames[emp.team] || '—'}</p>
                    <p>الإدارة: ${escapeHTML(emp.job || 'غير محددة')}</p>
                    <p>الاعتيادي: ${emp.annual_balance ?? 21} يوم · العارضة: ${emp.casual_balance ?? 7} أيام · الأذونات: ${emp.perm_hours ?? 4} ساعات</p>
                    <div class="employee-card-actions">
                        <button type="button" class="card-primary-btn bg-teal-700 hover:bg-teal-800 text-white" onclick="openEmployeeReport('${emp.id}')"><i class="fa-solid fa-file-lines ml-1"></i>كشف الحضور</button>
                        <details class="card-more">
                            <summary aria-label="المزيد من الإجراءات"><i class="fa-solid fa-ellipsis"></i> المزيد</summary>
                            <div class="card-more-menu">
                                ${isAdmin ? `<button type="button" onclick="openEmployeesManagerModal(); editEmployee('${emp.id}')"><i class="fa-solid fa-pen ml-1"></i>تعديل البيانات</button>` : ''}
                                <button type="button" onclick="openEmployeeBalancesModal('${emp.id}')"><i class="fa-solid fa-wallet ml-1"></i>تعديل الأرصدة والإذن</button>
                            </div>
                        </details>
                    </div>
                </article>
            `).join('') : '<p class="text-slate-500 text-sm">لا يوجد موظفون في هذه المجموعة.</p>';
        }
        function editColleagueName(id) {
            const emp = employees.find(item => item.id === id);
            if (!emp || !canAccessEmployee(emp)) return;
            document.getElementById('colleagueId').value = id;
            document.getElementById('colleagueName').value = emp.name;
            document.getElementById('colleagueModal').classList.remove('hidden');
            document.getElementById('colleagueName').focus();
        }
        async function saveColleagueName(event) {
            event.preventDefault();
            const id = document.getElementById('colleagueId').value;
            const name = document.getElementById('colleagueName').value.trim();
            const emp = employees.find(item => item.id === id);
            if (!emp || !name || name.length > 80 || !canAccessEmployee(emp)) return;
            try {
                await window.firebaseBridge.updateColleagueName(id, name);
                document.getElementById('colleagueModal').classList.add('hidden');
                showNotice('تم تحديث الاسم.');
            } catch (error) { showNotice(`تعذر تعديل الاسم: ${error.message}`, 'error'); }
        }
        function renderRegistrationQueue() {
            document.getElementById('registrationQueue').classList.toggle('hidden', !isAdmin || !pendingRegistrations.length);
            document.getElementById('registrationQueueItems').innerHTML = pendingRegistrations.map(item => `
                <article class="rounded-xl border border-slate-200 p-3 bg-slate-50"><strong>${escapeHTML(item.name)}</strong><p class="text-xs mt-1">الكود: ${escapeHTML(item.code)} · الوردية: ${escapeHTML(item.team)} · الوظيفة: ${escapeHTML(item.job)}</p>
                <div class="flex gap-2 mt-3"><button type="button" class="action-primary" onclick="decideRegistration('${item.uid}', true)">موافقة</button><button type="button" class="px-3 py-2 text-red-700" onclick="decideRegistration('${item.uid}', false)">رفض</button></div></article>`).join('');
        }
        function renderJobs() {
            for (const id of ['registrationJob', 'formEmpJob']) {
                const select = document.getElementById(id), selected = select.value;
                select.innerHTML = `<option value="">اختر الإدارة</option>${availableJobs.map(name => `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`).join('')}`;
                if (availableJobs.includes(selected)) select.value = selected;
            }
            document.getElementById('jobManager').classList.toggle('hidden', !isAdmin);
            document.getElementById('jobItems').innerHTML = availableJobs.map((name, index) => `<div class="rounded-xl border border-slate-200 p-2 bg-slate-50"><span>${escapeHTML(name)}</span><button type="button" class="text-cyan-700 mx-2" onclick="editJob(${index})">تعديل</button><button type="button" class="text-red-700" onclick="deleteJob(${index})">حذف</button></div>`).join('');
        }
        async function addJobFromForm(event) {
            event.preventDefault();
            if (!isAdmin) return;
            const input = document.getElementById('newJobName'), name = input.value.trim();
            if (!name || name.length > 80 || name.includes('/') || availableJobs.includes(name)) { showNotice('اسم الوظيفة غير صالح أو موجود.', 'warning'); return; }
            try { await window.firebaseBridge.addJob(name); input.value = ''; showNotice('تمت إضافة الوظيفة.'); }
            catch (error) { showNotice(error.message, 'error'); }
        }
        async function deleteJob(index) {
            if (!isAdmin) return;
            const name = availableJobs[index];
            if (!name) return;
            if (employees.some(emp => emp.job === name) || pendingRegistrations.some(item => item.job === name)) { showNotice('انقل الموظفين وتعامل مع طلبات التسجيل المرتبطة بهذه الوظيفة أولاً.', 'warning'); return; }
            if (!await askConfirmation(`حذف وظيفة ${name} من الاختيارات؟`, { title: 'حذف الوظيفة', accept: 'حذف' })) return;
            try { await window.firebaseBridge.removeJob(name); showNotice('تم حذف الوظيفة.'); }
            catch (error) { showNotice(error.message, 'error'); }
        }
        async function editJob(index) {
            if (!isAdmin) return;
            const oldName = availableJobs[index];
            if (!oldName) return;
            if (employees.some(emp => emp.job === oldName) || pendingRegistrations.some(item => item.job === oldName)) { showNotice('انقل الموظفين وتعامل مع طلبات التسجيل المرتبطة بهذه الوظيفة أولاً.', 'warning'); return; }
            const name = prompt('اسم الوظيفة الجديد', oldName)?.trim();
            if (!name || name === oldName) return;
            if (name.length > 80 || name.includes('/') || availableJobs.includes(name)) { showNotice('اسم الوظيفة غير صالح أو موجود.', 'warning'); return; }
            try { await window.firebaseBridge.addJob(name); await window.firebaseBridge.removeJob(oldName); showNotice('تم تعديل الوظيفة.'); }
            catch (error) { showNotice(`تعذر تعديل الوظيفة: ${error.message}`, 'error'); }
        }
        async function decideRegistration(uid, approve) {
            if (!isAdmin) return;
            const request = pendingRegistrations.find(item => item.uid === uid);
            if (!request || !await askConfirmation(`${approve ? 'الموافقة على' : 'رفض'} طلب ${request.name} بالكود ${request.code}؟`, { title: 'مراجعة طلب التسجيل', accept: approve ? 'موافقة' : 'رفض' })) return;
            if (approve && !availableJobs.includes(request.job)) { showNotice('الوظيفة لم تعد معتمدة. ارفض الطلب ليعيد الموظف التسجيل ببيانات محدثة.', 'error'); return; }
            if (approve && employees.some(emp => emp.code === request.code)) { showNotice('الكود مستخدم بالفعل.', 'error'); return; }
            try {
                if (approve) await window.firebaseBridge.approveRegistration(uid, request);
                else await window.firebaseBridge.rejectRegistration(uid);
                showNotice(approve ? 'تم تفعيل حساب الموظف.' : 'تم رفض الطلب.');
            } catch (error) { showNotice(`تعذر تحديث الطلب: ${error.message}`, 'error'); }
        }

        function editEmployee(empId) {
            const emp = employees.find(e => e.id === empId);
            if (!emp || !isAdmin) return;

            document.getElementById('formEmpId').value = emp.id;
            document.getElementById('formEmpName').value = emp.name;
            document.getElementById('formEmpCode').value = emp.code || '';
            document.getElementById('formEmpCode').readOnly = true;
            document.getElementById('formEmpTeam').value = emp.team || '';
            document.getElementById('formEmpJob').value = emp.job || '';
            document.getElementById('formEmpSelfOnly').checked = emp.accessScope === 'self';
            document.getElementById('formEmpTeam').disabled = true; // shift changes go through the transfer button so history is kept
            document.getElementById('formEmpTeam').title = 'لنقل الموظف لوردية أخرى استخدم زر نقل وردية';
            document.getElementById('formEmpJob').disabled = !isAdmin;
            document.getElementById('employeeFormPanel').classList.remove('hidden');
            document.getElementById('formEmpAnnual').value = emp.annual_balance ?? 21;
            document.getElementById('formEmpCasual').value = emp.casual_balance ?? 7;
            document.getElementById('formEmpPermHours').value = emp.perm_hours ?? 4;

            document.getElementById('empFormHeading').innerHTML = `<i class="fa-solid fa-pen-to-square text-amber-600 ml-1"></i> تعديل بيانات: ${escapeHTML(emp.name)}`;
            document.getElementById('saveEmpBtn').innerHTML = `<i class="fa-solid fa-check ml-1"></i> حفظ التعديلات`;
            document.getElementById('saveEmpBtn').className = "w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded-lg shadow-sm transition";
            document.getElementById('cancelEditEmpBtn').classList.remove('hidden');
        }

        function resetEmployeeForm() {
            document.getElementById('formEmpId').value = '';
            document.getElementById('formEmpName').value = '';
            document.getElementById('formEmpCode').value = '';
            document.getElementById('formEmpCode').readOnly = false;
            document.getElementById('formEmpTeam').value = '';
            document.getElementById('formEmpJob').value = '';
            document.getElementById('formEmpSelfOnly').checked = false;
            document.getElementById('formEmpTeam').disabled = false;
            document.getElementById('formEmpTeam').title = '';
            document.getElementById('formEmpJob').disabled = false;
            document.getElementById('employeeFormPanel').classList.toggle('hidden', !isAdmin);
            document.getElementById('employeeFormHelp').classList.toggle('hidden', !isAdmin);
            document.getElementById('formEmpAnnual').value = '21';
            document.getElementById('formEmpCasual').value = '7';
            document.getElementById('formEmpPermHours').value = '4';

            document.getElementById('empFormHeading').innerHTML = `<i class="fa-solid fa-user-plus text-blue-600 ml-1"></i> إضافة موظف جديد`;
            document.getElementById('saveEmpBtn').innerHTML = `<i class="fa-solid fa-plus-circle ml-1"></i> حفظ الموظف`;
            document.getElementById('saveEmpBtn').className = "w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg shadow-sm transition";
            document.getElementById('cancelEditEmpBtn').classList.add('hidden');
        }

        let employeeSaveInProgress = false;
        let rosterImportInProgress = false;
        async function importRosterJSON(event) {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file || rosterImportInProgress || !isAdmin || !firebaseConnected) return;
            const passwordField = document.getElementById('rosterInitialPassword');
            const initialPassword = passwordField.value;
            passwordField.value = '';
            let completed = 0;
            try {
                if (file.size > 1024 * 1024) throw new Error('ملف الموظفين أكبر من ١ ميجابايت.');
                const data = JSON.parse(await file.text());
                const rows = data?.employees;
                if (!Array.isArray(rows) || !rows.length || rows.length > 100 || initialPassword.length < 7) {
                    throw new Error('اختر ملف موظفين صالحًا وأدخل كلمة بدء لا تقل عن ٧ أحرف.');
                }
                const codes = new Set();
                for (const row of rows) {
                    if (!row || !/^[0-9]{4}$/.test(row.code) || codes.has(row.code) ||
                        typeof row.name !== 'string' || !row.name.trim() || row.name.length > 80 ||
                        !['red', 'blue', 'yellow', 'morning'].includes(row.team) ||
                        !availableJobs.includes(row.job) || !['group', 'self', undefined].includes(row.accessScope)) {
                        throw new Error('الملف يحتوي على كود مكرر أو بيانات موظف/وردية/وظيفة غير صالحة.');
                    }
                    codes.add(row.code);
                }
                const newRows = rows.filter(row => !employees.some(emp => emp.code === row.code));
                if (!newRows.length) throw new Error('كل الأكواد في الملف مسجلة بالفعل.');
                if (!await askConfirmation(`سيُنشأ ${newRows.length} حساب وملف موظف. كلمة بدء الموظفين واحدة، بينما يحتفظ المدير بكلمة مروره. هل تريد المتابعة؟`,
                    { title: 'استيراد الموظفين', accept: 'إنشاء الحسابات' })) return;
                rosterImportInProgress = true;
                for (const row of newRows) {
                    const employee = { id: `emp_${row.code}`, name: row.name.trim(), code: row.code,
                        team: row.team, job: row.job, dept: '', accessScope: row.accessScope || 'group',
                        title: typeof row.title === 'string' ? row.title.slice(0, 80) : '',
                        annual_balance: 0, casual_balance: 0, perm_hours: 0 };
                    const created = row.code === '5686'
                        ? await window.firebaseBridge.linkAdminAsEmployee(employee)
                        : await window.firebaseBridge.createEmployeeAccount(employee, initialPassword);
                    if (!employees.some(existing => existing.id === created.employee.id)) employees.push(created.employee);
                    completed++;
                }
                renderEmployeesDirectory();
                renderEmployeeCards();
                renderTable();
                showNotice(`تم إنشاء ${completed} حساب وملف موظف.`);
            } catch (error) {
                showNotice(`اكتمل ${completed} حساب قبل التوقف: ${error.message}`, 'error');
            } finally { rosterImportInProgress = false; }
        }
        async function saveEmployeeFromForm() {
            if (employeeSaveInProgress) return;
            const id = document.getElementById('formEmpId').value.trim();
            if (!isAdmin) return;
            const name = document.getElementById('formEmpName').value.trim();
            const code = document.getElementById('formEmpCode').value.trim();
            const team = document.getElementById('formEmpTeam').value;
            const dept = '';
            const job = document.getElementById('formEmpJob').value;
            const accessScope = document.getElementById('formEmpSelfOnly').checked ? 'self' : 'group';
            const annual = Number(document.getElementById('formEmpAnnual').value);
            const casual = Number(document.getElementById('formEmpCasual').value);
            const perm = Number(document.getElementById('formEmpPermHours').value);

            if (!name) {
                showNotice('يرجى إدخال اسم الموظف.', 'warning');
                return;
            }
            if (!/^[0-9]{4}$/.test(code) || !team || !availableJobs.includes(job) || employees.some(e => e.id !== id && e.code === code)) {
                showNotice('أدخل كوداً فريداً من ٤ أرقام، واختر الوظيفة والوردية.', 'warning');
                return;
            }
            if (![annual, casual, perm].every(value => Number.isFinite(value) && value >= 0)) {
                showNotice('أدخل أرصدة صحيحة لا تقل عن صفر.', 'warning');
                return;
            }

            const button = document.getElementById('saveEmpBtn');
            employeeSaveInProgress = true;
            button.disabled = true;
            try {
                if (id) {
                    const index = employees.findIndex(e => e.id === id);
                    if (index < 0) return;
                    const original = employees[index];
                    const changed = { ...original, name, annual_balance: annual, casual_balance: casual, perm_hours: perm };
                    if (isAdmin) Object.assign(changed, { code, team, dept, job, accessScope });
                    const updated = employees.map(e => e.id === id ? changed : e);
                    await window.firebaseBridge.updateEmployeeAccount(changed);
                    employees = updated;
                } else {
                    const employee = { id: `emp_${code}`, name, code, team, dept, job, accessScope, annual_balance: annual, casual_balance: casual, perm_hours: perm };
                    const created = code === '5686'
                        ? await window.firebaseBridge.linkAdminAsEmployee(employee)
                        : await window.firebaseBridge.createEmployeeAccount(employee);
                    if (!employees.some(existing => existing.id === created.employee.id)) employees.push(created.employee);
                    if (created.temporaryPassword) showTemporaryPassword(created.employee.code, created.temporaryPassword);
                }
                renderEmployeesDirectory();
                renderEmployeeCards();
                resetEmployeeForm();
                renderTable();
                showNotice(isAdmin && !id && code !== '5686' ? 'تم إنشاء الحساب. احفظ كلمة المرور المؤقتة المعروضة.' : 'تم حفظ بيانات الموظف وأرصدته.');
            } catch (error) {
                showNotice(`تعذر حفظ الحساب: ${error.message}`, 'error');
            } finally { employeeSaveInProgress = false; button.disabled = false; }
        }

        const TEAM_NAMES_AR = { red: 'الحمراء', blue: 'الزرقاء', yellow: 'الصفراء', morning: 'الصباحية' };
        function dayBefore(date) { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }
        function openTransfer(empId) {
            if (!isAdmin) return;
            const emp = employees.find(e => e.id === empId);
            if (!emp) return;
            document.getElementById('transferEmpId').value = empId;
            document.getElementById('transferWho').textContent = `${emp.name} · الوردية الحالية: ${TEAM_NAMES_AR[emp.team] || '—'}`;
            const select = document.getElementById('transferTeam');
            [...select.options].forEach(o => { o.disabled = o.value === emp.team; });
            select.value = [...select.options].find(o => !o.disabled).value;
            document.getElementById('transferDate').value = new Date().toISOString().slice(0, 10);
            updateTransferPreview();
            document.getElementById('transferModal').classList.remove('hidden');
        }
        function closeTransfer() { document.getElementById('transferModal').classList.add('hidden'); }
        function updateTransferPreview() {
            const emp = employees.find(e => e.id === document.getElementById('transferEmpId').value);
            if (!emp) return;
            const team = document.getElementById('transferTeam').value, date = document.getElementById('transferDate').value;
            const rest = { red: 'يوم 1', blue: 'يوم 21', yellow: 'يوم 11', morning: 'الجمعة' };
            document.getElementById('transferPreview').textContent = `قبل ${date || '—'} تبقى كل سجلاته وراحاته على وردية ${TEAM_NAMES_AR[emp.team]}. من ${date || '—'} يصبح على وردية ${TEAM_NAMES_AR[team]} وراحته الإجبارية ${rest[team]} من كل شهر. الأرصدة والأذونات والسجلات كلها تنتقل معه كما هي.`;
        }
        async function confirmTransfer() {
            if (!isAdmin) return;
            const id = document.getElementById('transferEmpId').value;
            const emp = employees.find(e => e.id === id);
            const team = document.getElementById('transferTeam').value, date = document.getElementById('transferDate').value;
            if (!emp || !TEAM_NAMES_AR[team] || team === emp.team || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { showNotice('اختر وردية مختلفة وتاريخاً صحيحاً.', 'warning'); return; }
            const button = document.getElementById('transferConfirm');
            button.disabled = true;
            try {
                const history = [...(Array.isArray(emp.teamHistory) ? emp.teamHistory : []), { team: emp.team, until: dayBefore(date) }];
                const changed = { ...emp, team, teamHistory: history };
                await window.firebaseBridge.updateEmployeeAccount(changed);
                employees = employees.map(e => e.id === id ? changed : e);
                closeTransfer();
                renderTable();
                showNotice(`تم نقل ${emp.name} إلى الوردية ${TEAM_NAMES_AR[team]} من ${date}.`);
            } catch (error) { showNotice(`تعذر النقل: ${error.message}`, 'error'); }
            finally { button.disabled = false; }
        }
        async function resetEmployeePassword(empId) {
            if (!isAdmin) return;
            const emp = employees.find(e => e.id === empId);
            if (!emp) return;
            const next = window.prompt(`كلمة مرور جديدة للموظف ${emp.name} (٧ أحرف على الأقل):`);
            if (next === null) return;
            if (next.length < 7 || next.length > 64) { showNotice('كلمة المرور يجب أن تكون من ٧ إلى ٦٤ حرفًا.', 'warning'); return; }
            try {
                await window.firebaseBridge.resetEmployeePassword(empId, next);
                showNotice('تم تغيير كلمة مرور الموظف. سيُطلب منه الدخول من جديد.');
            } catch (error) { showNotice(error.message, 'error'); }
        }

        async function deleteEmployee(empId) {
            if (!isAdmin) return;
            const emp = employees.find(e => e.id === empId);
            if (!emp) return;

            if (!await askConfirmation(`سيُمنع ${emp.name} من الوصول وتُحذف سجلات حضوره. ستحتاج لتعطيل هوية Authentication من Firebase Console. هل تريد المتابعة؟`, { title: 'حذف الموظف', accept: 'حذف الموظف', danger: true })) return;

            const updatedEmployees = employees.filter(e => e.id !== empId);

            // Clean records
            const affectedDates = [];
            Object.entries(attendanceData).forEach(([date, day]) => {
                if (day.records && day.records[empId]) {
                    affectedDates.push(date);
                }
            });

            try {
                await window.firebaseBridge.deleteEmployeeRecords(updatedEmployees, empId, affectedDates, emp.authUid || emp.id);
                employees = updatedEmployees;
                affectedDates.forEach(date => delete attendanceData[date].records[empId]);
                renderEmployeesDirectory();
                renderEmployeeCards();
                renderTable();
                showNotice('تم حذف الموظف وسجلات حضوره.');
            } catch (error) { showNotice(`تعذر حذف الموظف: ${error.message}`, 'error'); }
        }

