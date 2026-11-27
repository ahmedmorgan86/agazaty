        function switchTeam(team) {
            if (!['red', 'blue', 'yellow', 'morning'].includes(team)) return;
            if (!isAdmin && currentProfile && team !== currentProfile.team) return;
            activeTeam = team;
            // Update UI buttons
            document.querySelectorAll('.team-tab-btn').forEach(btn => {
                const hidden = btn.classList.contains('hidden');
                btn.className = "team-tab-btn px-2.5 py-1 rounded-md text-xs font-bold flex items-center space-x-1.5 space-x-reverse transition text-slate-600 hover:bg-slate-200/50" + (hidden ? ' hidden' : '');
            });

            const teamButtons = { red: 'btnTeamRed', blue: 'btnTeamBlue', yellow: 'btnTeamYellow', morning: 'btnTeamMorning' };
            const activeBtn = document.getElementById(teamButtons[team]);
            if (!activeBtn) return;
            const badge = document.getElementById('activeTeamBadge');

            if (team === 'red') {
                activeBtn.className = "team-tab-btn px-2.5 py-1 rounded-md text-xs font-bold flex items-center space-x-1.5 space-x-reverse transition bg-red-600 text-white shadow-sm";
                badge.className = "bg-red-100 text-red-800 border border-red-200 text-[13px] font-bold px-2 py-0.5 rounded-full";
                badge.innerText = "الوردية الحمراء (اليوم الطويل: يوم 11)";
            } else if (team === 'blue') {
                activeBtn.className = "team-tab-btn px-2.5 py-1 rounded-md text-xs font-bold flex items-center space-x-1.5 space-x-reverse transition bg-blue-600 text-white shadow-sm";
                badge.className = "bg-blue-100 text-blue-800 border border-blue-200 text-[13px] font-bold px-2 py-0.5 rounded-full";
                badge.innerText = "الوردية الزرقاء (اليوم الطويل: يوم 1)";
            } else if (team === 'yellow') {
                activeBtn.className = "team-tab-btn px-2.5 py-1 rounded-md text-xs font-bold flex items-center space-x-1.5 space-x-reverse transition bg-amber-500 text-white shadow-sm";
                badge.className = "bg-amber-100 text-amber-800 border border-amber-200 text-[13px] font-bold px-2 py-0.5 rounded-full";
                badge.innerText = "الوردية الصفراء (اليوم الطويل: يوم 21)";
            } else if (team === 'morning') {
                activeBtn.className = "team-tab-btn px-2.5 py-1 rounded-md text-xs font-bold flex items-center space-x-1.5 space-x-reverse transition bg-emerald-600 text-white shadow-sm";
                badge.className = "bg-emerald-100 text-emerald-800 border border-emerald-200 text-[13px] font-bold px-2 py-0.5 rounded-full";
                badge.innerText = "الوردية الصباحية";
            }

            document.getElementById('heroTitle').textContent = `جدول ${badge.innerText}`;
            document.getElementById('heroSubtitle').textContent = isAdmin || team === currentProfile?.team
                ? 'كل أيام الشهر وبيانات الموظفين في نفس الوردية والإدارة.'
                : 'يمكنك مشاهدة هذه الوردية. تعديل الحضور متاح لورديتك فقط.';

            renderTable();
        }

        async function autoFillMonthShifts() {
            if (!isAdmin || !activeTeam) return;
            if (!await askConfirmation(`هل تريد تطبيق نظام الورديات التلقائي لشهر ${currentMonth} وفق نمط الوردية المعتمدة؟`, { accept: 'تطبيق الورديات' })) return;

            const [yearStr, monthStr] = currentMonth.split('-');
            const year = parseInt(yearStr);
            const month = parseInt(monthStr);
            const daysInMonth = new Date(year, month, 0).getDate();
            const changedDays = [];

            for (let d = 1; d <= daysInMonth; d++) {
                const dayStr = d < 10 ? `0${d}` : `${d}`;
                const dateKey = `${yearStr}-${monthStr}-${dayStr}`;
                const dateObj = new Date(year, month - 1, d);
                const dayName = ARABIC_DAYS[dateObj.getDay()];
                const shiftName = calculateShiftForDate(d, activeTeam);

                if (!attendanceData[dateKey]) {
                    attendanceData[dateKey] = { shift: shiftName, day: dayName, records: {} };
                } else {
                    attendanceData[dateKey].shift = shiftName;
                    attendanceData[dateKey].day = dayName;
                }
                changedDays.push({ date: dateKey, day: dayName, shift: shiftName });
            }

            saveToStorage();
            renderTable();
            cloudWrite(window.firebaseBridge.saveDays(changedDays), 'تم توزيع الورديات وتعيين اليوم الطويل بنجاح.');
        }

        async function quickFillPresent() {
            if (!isAdmin || !activeTeam) return;
            if (!await askConfirmation('هل تريد تعيين الأيام غير المسجلة حتى اليوم إلى حضور لجميع الموظفين؟', { accept: 'تعيين الحضور' })) return;

            const dates = Object.keys(attendanceData).filter(d => d.startsWith(currentMonth) && d <= localDateKey());
            const changes = [];
            dates.forEach(d => {
                if (!attendanceData[d].records) attendanceData[d].records = {};
                employees.forEach(emp => {
                    if (emp.team !== activeTeam || isFixedRest(d, emp)) return;
                    if (!attendanceData[d].records[emp.id] || !attendanceData[d].records[emp.id].status) {
                        attendanceData[d].records[emp.id] = { status: "حضور", delay: 0, notes: "" };
                        changes.push({ date: d, day: attendanceData[d].day, shift: attendanceData[d].shift,
                            employeeId: emp.id, team: emp.team, job: emp.job, groupKey: employeeKey(emp), record: attendanceData[d].records[emp.id] });
                    }
                });
            });

            saveToStorage();
            renderTable();
            if (changes.length) cloudWrite(window.firebaseBridge.saveRecords(changes), 'تم تعيين الحضور للأيام غير المسجلة.');
            else showNotice('لا توجد أيام غير مسجلة لتعديلها.', 'info');
        }

        // ==========================================
        // 3. Render Table & KPI UI
        // ==========================================
        function switchMonth(m) {
            if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) return;
            currentMonth = m;
            window.firebaseBridge?.ensureYear?.(Number(m.slice(0, 4)));
            document.getElementById('monthPicker').value = m;
            document.querySelectorAll('.month-tab-btn').forEach(btn => {
                btn.classList.remove('bg-white', 'text-blue-700', 'shadow-sm');
                btn.classList.add('text-slate-600');
            });
            const activeBtn = document.getElementById(`btn-${m}`);
            if (activeBtn) {
                activeBtn.classList.add('bg-white', 'text-blue-700', 'shadow-sm');
                activeBtn.classList.remove('text-slate-600');
            }

            const monthNames = { '2026-10': 'أكتوبر 2026', '2026-11': 'نوفمبر 2026', '2026-12': 'ديسمبر 2026' };
            document.getElementById('tableTitle').innerText = `جدول الحضور والورديات - ${monthNames[m] || m}`;
            
            // Ensure month dates exist
            ensureMonthDates(m);
            renderTable();
        }

        function ensureMonthDates(monthPrefix) {
            const [y, m] = monthPrefix.split('-').map(Number);
            const daysInMonth = new Date(y, m, 0).getDate();
            for (let d = 1; d <= daysInMonth; d++) {
                const dayStr = d < 10 ? `0${d}` : `${d}`;
                const key = `${monthPrefix}-${dayStr}`;
                const dateObj = new Date(y, m - 1, d);
                const shiftName = activeTeam ? calculateShiftForDate(d, activeTeam) : '';
                if (!attendanceData[key]) attendanceData[key] = { shift: shiftName, day: ARABIC_DAYS[dateObj.getDay()], records: {} };
                else {
                    attendanceData[key].day ||= ARABIC_DAYS[dateObj.getDay()];
                    attendanceData[key].shift ||= shiftName;
                }
            }
        }

        function getShiftBadgeClass(shift) {
            if (!shift) return 'bg-slate-100 text-slate-600';
            if (shift.includes('الصباح')) return 'badge-shift-morning';
            if (shift.includes('الطويل')) return 'badge-shift-long';
            if (shift.includes('المسائ')) return 'badge-shift-evening';
            if (shift.includes('الليل')) return 'badge-shift-night';
            return 'bg-slate-100 text-slate-600';
        }

        function getStatusBadge(status) {
            if (!status || status === '') return '<span class="text-slate-300">-</span>';
            const clean = status.trim();
            if (clean === 'حضور') return '<span class="status-present px-2 py-0.5 rounded text-[13px] font-bold border">حضور</span>';
            if (clean === 'راحة' || clean === 'راحة الوردية') return `<span class="status-rest px-2 py-0.5 rounded text-[13px] font-bold border">${escapeHTML(clean)}</span>`;
            if (clean === 'إعتيادي') return '<span class="status-annual px-2 py-0.5 rounded text-[13px] font-bold border">إعتيادي</span>';
            if (clean === 'عارضة') return '<span class="status-casual px-2 py-0.5 rounded text-[13px] font-bold border">عارضة</span>';
            if (clean === 'إذن') return '<span class="status-permission px-2 py-0.5 rounded text-[13px] font-bold border">إذن</span>';
            if (clean === 'مأمورية') return '<span class="status-mission px-2 py-0.5 rounded text-[13px] font-bold border">مأمورية</span>';
            return `<span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[13px] font-bold border">${escapeHTML(clean)}</span>`;
        }

        function renderMyStatus() {
            const box = document.getElementById('myStatusCard');
            if (!box) return;
            const emp = typeof currentProfile !== 'undefined' ? currentProfile : null;
            if (!firebaseUser || !emp || !emp.team) { box.classList.add('hidden'); return; }
            const now = new Date();
            const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const day = now.getDate();
            const restMap = { red: 1, blue: 21, yellow: 11 };
            const restDay = restMap[emp.team];
            const teamNames = { red: 'الحمراء', blue: 'الزرقاء', yellow: 'الصفراء', morning: 'الصباحية' };
            let todayText = '';
            if (key === currentMonth) {
                const rest = fixedRestReason(`${key}-${String(day).padStart(2, '0')}`, emp);
                todayText = rest ? rest : (calculateShiftForDate(day, emp.team) || '—');
            } else { todayText = 'افتح الشهر الحالي لعرض وردية اليوم'; }
            const restText = restDay ? `يوم ${restDay} من كل شهر` : 'الجمعة من كل أسبوع';
            box.innerHTML = `<div><span>وردية اليوم</span><strong>${escapeHTML(todayText)}</strong></div><div><span>فريقك</span><strong>${teamNames[emp.team] || '—'}</strong></div><div><span>يوم الراحة الثابت</span><strong>${restText}</strong></div>`;
            box.classList.remove('hidden');
        }
        function renderTable() {
            renderMyStatus();
            if (!firebaseUser) {
                document.getElementById('tableHeaderRow').innerHTML = '';
                document.getElementById('tableBody').innerHTML = '';
                document.getElementById('tableFooter').innerHTML = '';
                document.getElementById('kpiStatsContainer').innerHTML = '';
                document.getElementById('mobileAttendanceList').innerHTML = '';
                return;
            }
            ensureMonthDates(currentMonth);
            if (!activeTeam) {
                document.getElementById('tableHeaderRow').innerHTML = '';
                document.getElementById('tableBody').innerHTML = '<tr><td class="selection-empty"><i class="fa-solid fa-calendar-days"></i>اختر وردية من الأعلى لعرض أيام الشهر والموظفين.</td></tr>';
                document.getElementById('tableFooter').innerHTML = '';
                document.getElementById('mobileAttendanceList').innerHTML = '<div class="selection-empty"><i class="fa-solid fa-calendar-days"></i>اختر وردية لعرض الشهر كاملاً.</div>';
                document.getElementById('kpiStatsContainer').innerHTML = '';
                return;
            }
            const shiftFilter = document.getElementById('shiftFilter').value;
            const searchTerm = (document.getElementById('searchEmployeeInput').value || '').trim().toLowerCase();
            const dates = Object.keys(attendanceData).sort().filter(d => d.startsWith(currentMonth));
            
            // Filter employees by search
            const filteredEmployees = employees.filter(emp => emp.team === activeTeam &&
                canAccessEmployee(emp) && (
                emp.name.toLowerCase().includes(searchTerm) || (emp.code && emp.code.toLowerCase().includes(searchTerm)))
            );

            // 1. Build Header
            const headerRow = document.getElementById('tableHeaderRow');
            let headerHTML = `
                <th class="p-3 text-right bg-slate-100 sticky-col-1 w-24">التاريخ</th>
                <th class="p-3 text-right bg-slate-100 sticky-col-2 w-20">اليوم</th>
                <th class="p-3 text-right bg-slate-100 sticky-col-3 w-28">وردية الفريق المعروض</th>
            `;
            filteredEmployees.forEach(emp => {
                const teamIcon = ({ blue: '🔵', yellow: '🟡', morning: '🟢' })[emp.team] || '🔴';
                headerHTML += `
                    <th colspan="2" class="p-2.5 text-center border-r border-slate-200">
                        <div class="flex items-center justify-center space-x-1.5 space-x-reverse font-bold text-slate-900">
                            <span>${teamIcon}</span>
                            <span>${escapeHTML(emp.name)}</span>
                        </div>
                        <div class="flex justify-between items-center text-[13px] text-slate-400 font-normal mt-1 px-2">
                            <span>البيان</span>
                            <span>التأخير</span>
                        </div>
                        <div class="text-[13px] text-slate-500 font-normal mt-1">${escapeHTML(emp.job || 'غير محددة')} · ${escapeHTML(emp.code)}</div>
                    </th>
                `;
            });
            headerRow.innerHTML = headerHTML;

            // 2. Build Rows & Accumulate Totals
            const tbody = document.getElementById('tableBody');
            let bodyHTML = '';
            
            const totals = {};
            filteredEmployees.forEach(emp => {
                totals[emp.id] = { present: 0, rest: 0, annual: 0, casual: 0, permission: 0, permissionMinutes: 0, mission: 0, delay: 0 };
            });

            dates.forEach(date => {
                const dayData = attendanceData[date];
                const displayedShift = calculateShiftForDate(Number(date.slice(-2)), activeTeam);
                if (shiftFilter !== 'all' && displayedShift !== shiftFilter) return;

                const isToday = date === localDateKey();
                const isLongDay = displayedShift === "اليوم الطويل";
                const rowClass = isLongDay ? "bg-amber-50/70 font-semibold" : (isToday ? "bg-blue-50/50" : "hover:bg-slate-50");

                bodyHTML += `
                    <tr class="${rowClass} transition">
                        <td class="p-2.5 font-mono text-slate-600 sticky-col-1 bg-inherit">
                            ${date}
                            ${isToday ? '<span class="text-[9px] bg-blue-600 text-white px-1 rounded mr-1">اليوم</span>' : ''}
                        </td>
                        <td class="p-2.5 text-slate-700 sticky-col-2 bg-inherit">${escapeHTML(dayData.day)}</td>
                        <td class="p-2.5 sticky-col-3 bg-inherit">
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${getShiftBadgeClass(displayedShift)} flex items-center gap-1 w-max">
                                ${isLongDay ? '<i class="fa-solid fa-star text-amber-500"></i>' : ''}
                                ${escapeHTML(displayedShift)}
                            </span>
                        </td>
                `;

                filteredEmployees.forEach(emp => {
                    const rec = effectiveRecord(date, emp, dayData.records && dayData.records[emp.id]);
                    const employeeShift = calculateShiftForDate(Number(date.slice(-2)), teamOn(emp, date) || 'red');
                    
                    const st = (rec.status || "").trim();
                    if (st === 'حضور') totals[emp.id].present++;
                    else if (countsAsEmployeeRest(date, emp, rec)) totals[emp.id].rest++;
                    else if (st === 'إعتيادي') totals[emp.id].annual++;
                    else if (st === 'عارضة') totals[emp.id].casual++;
                    else if (st === 'إذن') {
                        totals[emp.id].permission++;
                        totals[emp.id].permissionMinutes = (totals[emp.id].permissionMinutes || 0) + (parseInt(rec.permissionMinutes, 10) || 0);
                    }
                    else if (st === 'مأمورية') totals[emp.id].mission++;

                    const delayNum = parseInt(rec.delay) || 0;
                    totals[emp.id].delay += delayNum;

                    const delayBadge = delayNum > 0 
                        ? `<span class="bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded text-[13px]">${delayNum} د</span>` 
                        : (rec.status ? '<span class="text-slate-400">0</span>' : '-');

                    bodyHTML += `
                        <td onclick="openEditModal('${date}', '${emp.id}')" class="p-2 text-center border-r border-slate-200 cursor-pointer hover:bg-blue-50/80 transition" title="${escapeHTML(rec.notes || 'انقر لتعديل الحالة')}">
                            <div class="flex items-center justify-center space-x-1 space-x-reverse">
                                ${getStatusBadge(displayedStatus(date, emp, rec))}
                                ${rec.notes ? '<i class="fa-solid fa-comment-dots text-slate-400 text-[10px]" title="'+escapeHTML(rec.notes)+'"></i>' : ''}
                            </div>
                            <span class="text-[13px] text-slate-500">${escapeHTML(employeeShift)}</span>
                        </td>
                        <td onclick="openEditModal('${date}', '${emp.id}')" class="p-2 text-center cursor-pointer hover:bg-blue-50/80 transition">
                            ${delayBadge}
                        </td>
                    `;
                });

                bodyHTML += `</tr>`;
            });

            tbody.innerHTML = bodyHTML;

            // 3. Build Footer Totals
            const footer = document.getElementById('tableFooter');
            let footerHTML = `
                <tr>
                    <td colspan="3" class="p-3 text-slate-800 font-bold text-center bg-slate-200">
                        إجمالي الشهر
                    </td>
            `;

            filteredEmployees.forEach(emp => {
                const t = totals[emp.id];
                footerHTML += `
                    <td class="p-3 text-center border-r border-slate-200 bg-slate-100">
                        <div class="text-[13px] space-y-0.5">
                            <div>حضور: <span class="font-bold text-emerald-700">${t.present}</span> | راحة الموظف: <span class="font-bold text-slate-700">${t.rest}</span></div>
                            <div class="text-[10px] text-slate-500">إعتيادي: ${t.annual} | عارضة: ${t.casual} | إذن: ${t.permission}</div>
                        </div>
                    </td>
                    <td class="p-3 text-center bg-slate-100">
                        <span class="text-xs font-extrabold text-red-600 block">${t.delay} د</span>
                        <span class="text-[13px] text-slate-400 block">${(t.delay/60).toFixed(1)} س</span>
                    </td>
                `;
            });
            footerHTML += `</tr>`;
            footer.innerHTML = footerHTML;

            renderKPICards(totals, filteredEmployees);
            renderMobileAttendance(dates, filteredEmployees, shiftFilter);
        }

        function renderMobileAttendance(dates, teamEmployees, shiftFilter) {
            const list = document.getElementById('mobileAttendanceList');
            const visibleDates = dates.filter(date => shiftFilter === 'all' || calculateShiftForDate(Number(date.slice(-2)), activeTeam) === shiftFilter);
            list.innerHTML = visibleDates.map(date => {
                const day = attendanceData[date];
                const shift = calculateShiftForDate(Number(date.slice(-2)), activeTeam);
                const people = teamEmployees.length ? teamEmployees.map(emp => {
                    const rec = effectiveRecord(date, emp, day.records?.[emp.id]);
                    const canEdit = !isFixedRest(date, emp) && canAccessEmployee(emp);
                    return `<button type="button" class="day-card-person" ${canEdit ? `onclick="openEditModal('${date}','${emp.id}')"` : 'disabled'}>
                        <span><strong>${escapeHTML(emp.name)}</strong><small>${escapeHTML(emp.job || 'غير محددة')} · ${escapeHTML(emp.code)}${teamOn(emp, date) !== activeTeam ? ` · وردية ذلك اليوم: ${escapeHTML(TEAM_NAMES_AR[teamOn(emp, date)] || '')}` : ''}</small>${rec.notes ? `<small>${escapeHTML(rec.notes)}</small>` : ''}</span>
                        <span class="text-left">${getStatusBadge(displayedStatus(date, emp, rec))}<small>${rec.delay ? `${Number(rec.delay)} دقيقة تأخير` : (isFixedRest(date, emp) ? 'راحة ثابتة' : 'بدون تأخير')}</small></span>
                    </button>`;
                }).join('') : '<p class="p-3 text-slate-500">لا يوجد موظفون في هذه الوردية.</p>';
                return `<article class="day-card"><div class="day-card-head"><strong>${escapeHTML(day.day)} · ${date}</strong><span class="text-xs font-bold text-cyan-800">${escapeHTML(shift)}</span></div>${people}</article>`;
            }).join('') || '<div class="selection-empty">لا توجد أيام مطابقة للفلتر.</div>';
        }

        let selectedKpiEmployeeId = null;
        let lastKpiTotals = null;
        let lastKpiEmployees = [];

        function selectKpiEmployee(empId) {
            selectedKpiEmployeeId = empId;
            if (lastKpiTotals && lastKpiEmployees) {
                renderKPICards(lastKpiTotals, lastKpiEmployees);
            }
        }

        function renderKPICards(totals, filteredEmployees = []) {
            lastKpiTotals = totals;
            lastKpiEmployees = filteredEmployees;
            const container = document.getElementById('kpiStatsContainer');
            const bar = document.getElementById('kpiEmployeeBar');
            if (!container) return;

            if (!filteredEmployees || filteredEmployees.length === 0) {
                if (bar) bar.innerHTML = '';
                container.innerHTML = '<div class="col-span-full text-center text-xs text-slate-400 p-4">لا توجد بيانات موظفين لعرض الإحصائيات</div>';
                return;
            }

            // Determine which employee to display
            if (!selectedKpiEmployeeId || (selectedKpiEmployeeId !== 'all' && !filteredEmployees.some(e => e.id === selectedKpiEmployeeId))) {
                if (currentProfile && filteredEmployees.some(e => e.id === currentProfile.id || e.id === currentProfile.employeeId || e.code === currentProfile.code)) {
                    const match = filteredEmployees.find(e => e.id === currentProfile.id || e.id === currentProfile.employeeId || e.code === currentProfile.code);
                    selectedKpiEmployeeId = match.id;
                } else {
                    selectedKpiEmployeeId = filteredEmployees[0].id;
                }
            }

            // Render Employee Selector Bar
            if (bar) {
                let barHTML = '<div class="flex items-center gap-1.5 shrink-0 text-xs font-bold text-slate-600 dark:text-slate-300 ml-1"><i class="fa-solid fa-user-chart text-cyan-600"></i><span>إحصائيات الموظف:</span></div>';
                filteredEmployees.forEach(emp => {
                    const isSelected = selectedKpiEmployeeId === emp.id;
                    const empTotals = totals[emp.id] || { present: 0, rest: 0 };
                    barHTML += `
                        <button type="button" onclick="selectKpiEmployee('${emp.id}')" class="kpi-emp-pill ${isSelected ? 'active' : ''}">
                            <span class="font-bold">${escapeHTML(emp.name)}</span>
                            <span class="text-[10px] opacity-75 mr-1">(${empTotals.present} حضور · ${empTotals.rest} راحة)</span>
                        </button>
                    `;
                });
                if (isAdmin && filteredEmployees.length > 1) {
                    const isAll = selectedKpiEmployeeId === 'all';
                    barHTML += `
                        <button type="button" onclick="selectKpiEmployee('all')" class="kpi-emp-pill ${isAll ? 'active' : ''}">
                            <span class="font-bold">📊 إجمالي الفريق كاملًا</span>
                        </button>
                    `;
                }
                bar.innerHTML = barHTML;
            }

            // Calculate metrics for selected employee or total
            let kpis = [];
            if (selectedKpiEmployeeId === 'all') {
                let totalPres = 0, totalRest = 0, totalAnnual = 0, totalCasual = 0, totalPerm = 0, totalPermMinutes = 0, totalDel = 0;
                Object.values(totals).forEach(t => {
                    totalPres += t.present || 0;
                    totalRest += t.rest || 0;
                    totalAnnual += t.annual || 0;
                    totalCasual += t.casual || 0;
                    totalPerm += t.permission || 0;
                    totalPermMinutes += t.permissionMinutes || 0;
                    totalDel += t.delay || 0;
                });
                kpis = [
                    { label: "إجمالي حضور الفريق", value: `${totalPres} يوم`, icon: "fa-solid fa-user-check", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
                    { label: "إجمالي راحات الفريق", value: `${totalRest} يوم`, icon: "fa-solid fa-bed", color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200" },
                    { label: "إجمالي إجازات إعتيادي", value: `${totalAnnual} يوم`, icon: "fa-solid fa-umbrella-beach", color: "text-sky-600", bg: "bg-sky-50", border: "border-sky-200" },
                    { label: "إجمالي إجازات عارضة", value: `${totalCasual} يوم`, icon: "fa-solid fa-triangle-exclamation", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
                    { label: "إجمالي أذونات الفريق", value: `${(totalPermMinutes / 60).toFixed(1)} ساعة`, sub: `${totalPerm} إذن`, icon: "fa-solid fa-clock-rotate-left", color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" },
                    { label: "إجمالي التأخير", value: `${totalDel} دقيقة`, sub: `${(totalDel/60).toFixed(1)} ساعة`, icon: "fa-solid fa-stopwatch", color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
                ];
            } else {
                const targetEmp = filteredEmployees.find(e => e.id === selectedKpiEmployeeId) || filteredEmployees[0];
                const t = totals[targetEmp.id] || { present: 0, rest: 0, annual: 0, casual: 0, permission: 0, permissionMinutes: 0, delay: 0 };
                
                // Calculate annual & casual usage across the whole year for this employee
                let yearAnnualUsed = 0, yearCasualUsed = 0;
                const currentYr = currentMonth.slice(0, 4);
                Object.entries(attendanceData || {}).forEach(([date, day]) => {
                    if (!date.startsWith(currentYr + '-')) return;
                    const rec = day?.records?.[targetEmp.id];
                    if (rec) {
                        const eff = effectiveRecord(date, targetEmp, rec);
                        const st = (eff.status || '').trim();
                        if (st === 'إعتيادي') yearAnnualUsed++;
                        if (st === 'عارضة') yearCasualUsed++;
                    }
                });

                const remAnnual = Math.max(0, (targetEmp.annual_balance ?? 21) - yearAnnualUsed);
                const remCasual = Math.max(0, (targetEmp.casual_balance ?? 7) - yearCasualUsed);
                const permHoursUsed = (t.permissionMinutes || 0) / 60;
                const remPermHours = Math.max(0, (targetEmp.perm_hours ?? 4) - permHoursUsed);

                kpis = [
                    { label: `حضور ${targetEmp.name.split(' ')[0]}`, value: `${t.present} يوم`, sub: `${targetEmp.job || 'الموظف'}`, icon: "fa-solid fa-user-check", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
                    { label: "راحات الموظف بالشهر", value: `${t.rest} يوم`, sub: "دون الراحات الإجبارية", icon: "fa-solid fa-bed", color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200" },
                    { label: "إجازات إعتيادي", value: `${t.annual} يوم`, sub: `متبقٍ بالرصيد: ${remAnnual} يوم`, icon: "fa-solid fa-umbrella-beach", color: "text-sky-600", bg: "bg-sky-50", border: "border-sky-200" },
                    { label: "إجازات عارضة", value: `${t.casual} يوم`, sub: `متبقٍ بالرصيد: ${remCasual} يوم`, icon: "fa-solid fa-triangle-exclamation", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
                    { label: "أذونات العمل بالشهر", value: `${permHoursUsed.toFixed(1)} ساعة`, sub: `متبقٍ: ${remPermHours.toFixed(1)} س من ${targetEmp.perm_hours ?? 4} س`, icon: "fa-solid fa-clock-rotate-left", color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" },
                    { label: "إجمالي التأخير", value: `${t.delay} دقيقة`, sub: `${(t.delay / 60).toFixed(1)} ساعة`, icon: "fa-solid fa-stopwatch", color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
                ];
            }

            container.innerHTML = kpis.map(k => `
                <div class="bg-white p-3.5 rounded-xl border ${k.border} shadow-sm flex items-center space-x-3 space-x-reverse">
                    <div class="w-10 h-10 rounded-lg ${k.bg} ${k.color} flex items-center justify-center text-lg flex-shrink-0">
                        <i class="${k.icon}"></i>
                    </div>
                    <div>
                        <span class="text-xs text-slate-500 block leading-tight">${escapeHTML(k.label)}</span>
                        <span class="text-base font-bold text-slate-900 block">${escapeHTML(k.value)}</span>
                        ${k.sub ? `<span class="text-[13px] text-slate-400 block">${escapeHTML(k.sub)}</span>` : ''}
                    </div>
                </div>
            `).join('');
        }


