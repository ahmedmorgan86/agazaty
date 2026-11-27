        // ==========================================
        // 5. EMPLOYEE MONTHLY REPORT CARD
        // ==========================================
        function openEmployeeReport(empId) {
            const emp = employees.find(e => e.id === empId);
            if (!emp || !canAccessEmployee(emp)) return;

            const [reportYear, reportMonth] = currentMonth.split('-').map(Number);
            const monthName = new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' }).format(new Date(reportYear, reportMonth - 1, 1));
            document.getElementById('repEmpName').textContent = emp.name;
            document.getElementById('repMonthInfo').textContent = `${monthName} · الكود ${emp.code || '-'} · ${emp.job || 'إدارة غير محددة'}`;

            // Calculate stats for current month
            let pres = 0, rest = 0, fixedRest = 0, annual = 0, casual = 0, perm = 0, permissionMinutes = 0, delay = 0;
            const daysInMonth = new Date(reportYear, reportMonth, 0).getDate();
            const dates = Array.from({ length: daysInMonth }, (_, index) => `${currentMonth}-${String(index + 1).padStart(2, '0')}`);
            const detailRows = [];
            let annualUsedThisYear = 0, casualUsedThisYear = 0;
            Object.entries(attendanceData).forEach(([date, day]) => {
                if (!date.startsWith(currentMonth.slice(0, 4) + '-')) return;
                const status = effectiveRecord(date, emp, day.records?.[empId]).status;
                if (status === 'إعتيادي') annualUsedThisYear++;
                if (status === 'عارضة') casualUsedThisYear++;
            });

            dates.forEach(d => {
                const day = attendanceData[d] || { records: {} };
                const rec = effectiveRecord(d, emp, day.records && day.records[empId]);
                const st = (rec.status || "").trim();
                const del = parseInt(rec.delay) || 0;

                if (st === 'حضور') pres++;
                else if (countsAsEmployeeRest(d, emp, rec)) rest++;
                else if (fixedRestReason(d, emp)) fixedRest++;
                else if (st === 'إعتيادي') annual++;
                else if (st === 'عارضة') casual++;
                else if (st === 'إذن') { perm++; permissionMinutes += parseInt(rec.permissionMinutes, 10) || 0; }
                delay += del;

                const dayName = day.day || ARABIC_DAYS[new Date(reportYear, reportMonth - 1, Number(d.slice(-2))).getDay()];
                detailRows.push({ date: d, day: dayName, shift: calculateShiftForDate(Number(d.slice(-2)), teamOn(emp, d) || 'red'),
                    status: fixedRestReason(d, emp) || displayedStatus(d, emp, rec) || '', delay: del,
                    notes: fixedRestReason(d, emp) ? 'راحة إجبارية لا تُحسب ضمن راحات الموظف' : (rec.notes || '') });
            });

            const content = document.getElementById('employeeReportContent');
            content.innerHTML = `
                <!-- Summary Metrics -->
                <div class="report-summary">
                    <div class="bg-emerald-50 border border-emerald-200 p-2 rounded-lg">
                        <span class="text-[10px] text-emerald-700 block">الحضور</span>
                        <span class="text-sm font-black text-emerald-900">${pres} يوم</span>
                    </div>
                    <div class="bg-slate-50 border border-slate-200 p-2 rounded-lg">
                        <span class="text-[10px] text-slate-600 block">راحات الموظف</span>
                        <span class="text-sm font-black text-slate-900">${rest} يوم</span>
                    </div>
                    <div class="bg-slate-50 border border-slate-200 p-2 rounded-lg">
                        <span class="text-[10px] text-slate-600 block">راحة إجبارية</span>
                        <span class="text-sm font-black text-slate-900">${fixedRest} يوم</span>
                    </div>
                    <div class="bg-sky-50 border border-sky-200 p-2 rounded-lg">
                        <span class="text-[10px] text-sky-700 block">إعتيادي</span>
                        <span class="text-sm font-black text-sky-900">${annual} يوم</span>
                    </div>
                    <div class="bg-amber-50 border border-amber-200 p-2 rounded-lg">
                        <span class="text-[10px] text-amber-700 block">عارضة</span>
                        <span class="text-sm font-black text-amber-900">${casual} يوم</span>
                    </div>
                    <div class="bg-purple-50 border border-purple-200 p-2 rounded-lg">
                        <span class="text-[10px] text-purple-700 block">أذونات</span>
                        <span class="text-sm font-black text-purple-900">${perm} · ${(permissionMinutes / 60).toFixed(1)} س</span>
                    </div>
                    <div class="bg-red-50 border border-red-200 p-2 rounded-lg">
                        <span class="text-[10px] text-red-700 block">تأخير</span>
                        <span class="text-sm font-black text-red-900">${delay} دقيقة</span>
                    </div>
                </div>

                <!-- Leaves Balance Status -->
                <div class="report-balances">
                    <div><span>متبقي الإعتيادي هذا العام</span><strong>${Math.max(0, (emp.annual_balance ?? 21) - annualUsedThisYear)} يوم</strong></div>
                    <div><span>متبقي العارضة هذا العام</span><strong>${Math.max(0, (emp.casual_balance ?? 7) - casualUsedThisYear)} يوم</strong></div>
                    <div><span>متبقي الأذونات هذا الشهر</span><strong>${Math.max(0, (emp.perm_hours ?? 4) - permissionMinutes / 60).toFixed(1)} ساعة</strong></div>
                </div>

                <!-- Breakdown Table -->
                <div class="report-section-title"><strong>تفاصيل الشهر يومًا بيوم</strong><span>${daysInMonth} يومًا · الأيام الفارغة غير مسجلة</span></div>
                <div class="report-table-wrap">
                    <table class="report-table">
                        <thead class="bg-slate-100 border-b border-slate-200 font-bold">
                            <tr>
                                <th class="p-2">التاريخ</th>
                                <th class="p-2">اليوم</th>
                                <th class="p-2">الوردية</th>
                                <th class="p-2 text-center">البيان</th>
                                <th class="p-2 text-center">التأخير</th>
                                <th class="p-2">ملاحظات</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            ${detailRows.map(r => `
                                <tr>
                                    <td class="p-2 font-mono">${r.date}</td>
                                    <td class="p-2">${escapeHTML(r.day)}</td>
                                    <td class="p-2">${escapeHTML(r.shift)}</td>
                                    <td class="p-2 text-center">${getStatusBadge(r.status)}</td>
                                    <td class="p-2 text-center font-bold ${r.delay > 0 ? 'text-red-600' : 'text-slate-400'}">${r.delay} د</td>
                                    <td class="p-2 text-slate-500">${escapeHTML(r.notes || '—')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <div class="report-mobile-list">
                    ${detailRows.map(r => `
                        <article class="report-day-card">
                            <div class="report-day-head"><strong>${escapeHTML(r.day)} <span dir="ltr">${r.date}</span></strong>${getStatusBadge(r.status)}</div>
                            <div class="report-day-meta"><span>الوردية: ${escapeHTML(r.shift || '—')}</span><span>التأخير: ${r.delay} دقيقة</span></div>
                            ${r.notes ? `<p>${escapeHTML(r.notes)}</p>` : ''}
                        </article>
                    `).join('')}
                </div>

                <!-- Signatures (Visible on Print) -->
                <div class="report-signatures">
                    <div>توقيع المشرف / مدير الوردية: ..........................</div>
                    <div>توقيع الموظف بالعلم: ..........................</div>
                </div>
            `;

            document.getElementById('employeeReportModal').classList.remove('hidden');
        }

        function closeEmployeeReportModal() {
            document.getElementById('employeeReportModal').classList.add('hidden');
        }

        function printEmployeeReport() {
            if (document.getElementById('employeeReportModal').classList.contains('hidden')) return;
            if (navigator.userAgent.includes('AgazatyAndroid/')) window.location.href = 'agazaty://print-report';
            else window.print();
        }

        function myReportEmployee() {
            if (currentProfile) return employees.find(e => e.id === currentProfile.id || e.id === currentProfile.employeeId) || currentProfile;
            // The admin signs in with code 5686, so use the employee record that carries that code.
            if (isAdmin) return employees.find(e => String(e.code).trim() === '5686') || null;
            return null;
        }
        function openMyReport() {
            const me = myReportEmployee();
            if (!me) { showNotice(isAdmin ? 'لا يوجد ملف موظف بالكود 5686. افتح كشف أي موظف من قائمة الموظفين.' : 'لا يوجد ملف موظف مرتبط بحسابك.', 'warning'); return; }
            openEmployeeReport(me.id);
        }

        // ==========================================
        // 6. CELL EDIT HANDLERS
        // ==========================================
        let selectedModalStatus = "";

        function openEditModal(date, empId) {
            if (DEMO_MODE) { showNotice('هذه معاينة للقراءة فقط.', 'info'); return; }
            const emp = employees.find(e => e.id === empId);
            if (!emp || !canAccessEmployee(emp) || isFixedRest(date, emp)) return;
            editingCell = { date, empId };
            const dayData = attendanceData[date] || {};
            const rec = effectiveRecord(date, emp, dayData.records && dayData.records[empId]);

            document.getElementById('modalEmployeeName').innerText = `تعديل: ${emp ? emp.name : ''}`;
            const employeeShift = calculateShiftForDate(Number(date.slice(-2)), teamOn(emp, date) || 'red');
            document.getElementById('modalDateInfo').innerText = `${dayData.day || ''}، ${date} - الوردية: ${employeeShift}`;
            
            selectedModalStatus = rec.status || "";
            updateStatusButtonsUI();

            document.getElementById('modalDelay').value = rec.delay ?? 0;
            document.getElementById('modalPermissionMinutes').value = rec.permissionMinutes ?? 0;
            document.getElementById('modalNotes').value = rec.notes || "";

            document.getElementById('cellEditModal').classList.remove('hidden');
        }

        function closeEditModal() {
            document.getElementById('cellEditModal').classList.add('hidden');
            editingCell = null;
        }

        function selectStatus(status) {
            selectedModalStatus = status;
            updateStatusButtonsUI();
            if (!status) {
                document.getElementById('modalDelay').value = 0;
                document.getElementById('modalPermissionMinutes').value = 0;
                document.getElementById('modalNotes').value = '';
            }
            if (status === 'راحة' || status === 'إعتيادي' || status === 'عارضة') {
                document.getElementById('modalDelay').value = 0;
            }
            document.getElementById('permissionMinutesField').classList.toggle('hidden', status !== 'إذن');
        }

        function updateStatusButtonsUI() {
            document.getElementById('permissionMinutesField').classList.toggle('hidden', selectedModalStatus !== 'إذن');
            document.querySelectorAll('.status-btn').forEach(btn => {
                const s = btn.getAttribute('data-status');
                if (s === selectedModalStatus) {
                    btn.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50/50', 'border-blue-400');
                } else {
                    btn.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50/50', 'border-blue-400');
                }
            });
        }

        function saveCellData() {
            if (!editingCell) return;
            const { date, empId } = editingCell;
            const emp = employees.find(e => e.id === empId);
            if (!emp || !canAccessEmployee(emp) || isFixedRest(date, emp)) return;

            if (!attendanceData[date]) {
                attendanceData[date] = { shift: "الصباحيه", day: "", records: {} };
            }
            if (!attendanceData[date].records) {
                attendanceData[date].records = {};
            }

            if (!selectedModalStatus) {
                const hadRecord = Object.hasOwn(attendanceData[date].records, empId);
                delete attendanceData[date].records[empId];
                closeEditModal();
                renderTable();
                if (hadRecord) cloudWrite(window.firebaseBridge.clearRecord(date, empId), 'تم مسح حالة اليوم وإعادتها فارغة.');
                else showNotice('حالة اليوم فارغة بالفعل.', 'info');
                return;
            }

            const delayVal = Math.min(1440, Math.max(0, parseInt(document.getElementById('modalDelay').value, 10) || 0));
            const permissionMinutes = selectedModalStatus === 'إذن'
                ? Math.min(1440, Math.max(0, parseInt(document.getElementById('modalPermissionMinutes').value, 10) || 0)) : 0;
            const notesVal = document.getElementById('modalNotes').value.trim().slice(0, 1000);

            attendanceData[date].records[empId] = {
                status: selectedModalStatus,
                delay: delayVal,
                permissionMinutes,
                notes: notesVal
            };

            saveToStorage();
            closeEditModal();
            renderTable();
            syncRecordToCloud(date, empId, 'تم حفظ حالة اليوم.');
        }

        // ==========================================
        // 7. LEAVE BALANCES OVERVIEW
        // ==========================================
        function openBalancesModal() {
            const tbody = document.getElementById('balancesTableBody');
            let html = '';

            const usedLeaves = {};
            const visibleEmployees = employees.filter(emp => isAdmin ? (!activeTeam || emp.team === activeTeam) : canAccessEmployee(emp));
            visibleEmployees.forEach(emp => {
                usedLeaves[emp.id] = { annual: 0, casual: 0, permMinutes: 0 };
            });

            Object.entries(attendanceData).forEach(([date, day]) => {
                if (!date.startsWith(currentMonth.slice(0, 4) + '-') || date > localDateKey()) return;
                if (day.records) {
                    Object.entries(day.records).forEach(([empId, rec]) => {
                        if (usedLeaves[empId]) {
                            const employee = visibleEmployees.find(emp => emp.id === empId);
                            const effective = effectiveRecord(date, employee, rec);
                            const st = (effective.status || "").trim();
                            if (st === 'إعتيادي') usedLeaves[empId].annual++;
                            if (st === 'عارضة') usedLeaves[empId].casual++;
                            if (st === 'إذن' && date.startsWith(currentMonth)) usedLeaves[empId].permMinutes += (parseInt(effective.permissionMinutes, 10) || 0);
                        }
                    });
                }
            });

            visibleEmployees.forEach(emp => {
                const u = usedLeaves[emp.id] || { annual: 0, casual: 0, permMinutes: 0 };
                const remAnnual = (emp.annual_balance ?? 21) - u.annual;
                const remCasual = (emp.casual_balance ?? 7) - u.casual;
                const teamName = ({ blue: 'الزرقاء', yellow: 'الصفراء', morning: 'الوردية الصباحية' })[emp.team] || 'الحمراء';

                html += `
                    <tr class="hover:bg-slate-50 transition font-medium">
                        <td class="p-2.5 font-bold text-slate-800">${escapeHTML(emp.name)}</td>
                        <td class="p-2.5 text-center text-slate-600">${teamName}</td>
                        <td class="p-2.5 text-center">${emp.annual_balance ?? 21} يوم</td>
                        <td class="p-2.5 text-center text-red-600 font-bold">${u.annual} يوم</td>
                        <td class="p-2.5 text-center text-emerald-700 font-bold bg-emerald-50/50">${remAnnual} يوم</td>
                        <td class="p-2.5 text-center">${emp.casual_balance ?? 7} أيام</td>
                        <td class="p-2.5 text-center text-amber-600 font-bold">${u.casual} أيام</td>
                        <td class="p-2.5 text-center text-amber-700 font-bold bg-amber-50/50">${remCasual} أيام</td>
                        <td class="p-2.5 text-center text-purple-700 font-mono">${(u.permMinutes / 60).toFixed(1)} / ${((emp.perm_hours ?? 4) - u.permMinutes / 60).toFixed(1)} س</td>
                        <td class="p-2.5 text-center">
                            <button type="button" onclick="openEmployeeBalancesModal('${emp.id}')" class="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-xs whitespace-nowrap" title="تعديل الأرصدة والإذونات">
                                <i class="fa-solid fa-pen-to-square ml-1"></i>تعديل
                            </button>
                        </td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;
            document.getElementById('balancesModal').classList.remove('hidden');
        }

        function closeBalancesModal() {
            document.getElementById('balancesModal').classList.add('hidden');
        }

