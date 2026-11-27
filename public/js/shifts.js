        // ==========================================
        // 8. ROTATION MATRIX MODAL
        // ==========================================
        const SHIFT_TYPES = [
            { key: 'morning', label: 'الصباحية' },
            { key: 'evening', label: 'المسائية' },
            { key: 'night', label: 'الليلية' },
            { key: 'long', label: 'اليوم الطويل' }
        ];
        const SHIFT_TEAM_LABELS = { red: 'الحمراء', blue: 'الزرقاء', yellow: 'الصفراء' };

        function renderShiftEditor() {
            const details = document.getElementById('shiftDetailsList');
            details.innerHTML = SHIFT_TYPES.map(shift => {
                const time = shiftSettings.times?.[shift.key] || {};
                const range = time.start && time.end ? `${time.start} – ${time.end}` : 'لم يُحدد الموعد بعد';
                return `<div class="rounded-lg border border-slate-200 bg-white p-3"><strong class="block text-sm">${shift.label}</strong><span class="text-xs text-slate-600">${escapeHTML(range)}</span></div>`;
            }).join('');
            document.getElementById('shiftEditorPanel').classList.toggle('hidden', !isAdmin);
            if (!isAdmin) return;
            document.getElementById('shiftTimesEditor').innerHTML = SHIFT_TYPES.map(shift => {
                const time = shiftSettings.times?.[shift.key] || {};
                return `<div class="rounded-lg border border-cyan-100 bg-white p-3"><strong class="block text-xs mb-2">${shift.label}</strong><div class="grid grid-cols-2 gap-2"><label class="text-xs">من<input type="time" id="shiftStart-${shift.key}" value="${escapeHTML(time.start || '')}" class="mt-1 w-full rounded-lg border border-slate-300 p-2"></label><label class="text-xs">إلى<input type="time" id="shiftEnd-${shift.key}" value="${escapeHTML(time.end || '')}" class="mt-1 w-full rounded-lg border border-slate-300 p-2"></label></div></div>`;
            }).join('');
            const today = localDateKey();
            document.getElementById('shiftEditDate').value = today.startsWith(currentMonth) ? today : `${currentMonth}-01`;
            const entries = Object.entries(shiftSettings.overrides || {}).filter(([date, teams]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date.startsWith(currentMonth) && teams && typeof teams === 'object')
                .flatMap(([date, teams]) => Object.entries(teams).filter(([team, value]) => Object.hasOwn(SHIFT_TEAM_LABELS, team) && value && typeof value === 'object').map(([team, value]) => ({ date, team, ...value })));
            document.getElementById('shiftOverrideList').innerHTML = entries.length ? entries.map(item => `
                <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2 text-xs">
                    <span><strong>${escapeHTML(item.date)} · ${SHIFT_TEAM_LABELS[item.team] || '—'} · ${escapeHTML(item.type)}</strong>${item.note ? ` · ${escapeHTML(item.note)}` : ''}</span>
                    <span class="flex gap-1"><button type="button" onclick="editShiftOverride('${item.date}','${item.team}')" class="rounded bg-cyan-50 px-2 py-1 font-bold text-cyan-800">تعديل</button><button type="button" onclick="removeShiftOverride('${item.date}','${item.team}')" class="rounded bg-red-50 px-2 py-1 font-bold text-red-700">إلغاء التغيير</button></span>
                </div>`).join('') : '<p class="text-xs text-slate-500">لا توجد تغييرات يدوية لهذا الشهر.</p>';
        }

        async function saveShiftTimes() {
            if (!isAdmin) return;
            const times = {};
            for (const shift of SHIFT_TYPES) {
                const start = document.getElementById(`shiftStart-${shift.key}`).value;
                const end = document.getElementById(`shiftEnd-${shift.key}`).value;
                if (Boolean(start) !== Boolean(end)) { showNotice(`أدخل وقت البداية والنهاية للوردية ${shift.label} معاً.`, 'warning'); return; }
                times[shift.key] = { start, end };
            }
            const next = { ...shiftSettings, times };
            if (await cloudWrite(window.firebaseBridge.saveShiftSettings(next), 'تم حفظ مواعيد الورديات.')) {
                shiftSettings = next;
                renderShiftEditor();
            }
        }

        function editShiftOverride(date, team) {
            if (!isAdmin) return;
            const value = shiftSettings.overrides?.[date]?.[team];
            if (!value) return;
            document.getElementById('shiftEditDate').value = date;
            document.getElementById('shiftEditTeam').value = team;
            document.getElementById('shiftEditType').value = value.type;
            document.getElementById('shiftEditNote').value = value.note || '';
            document.getElementById('shiftEditDate').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        async function saveShiftOverride() {
            if (!isAdmin) return;
            const date = document.getElementById('shiftEditDate').value;
            const team = document.getElementById('shiftEditTeam').value;
            const type = document.getElementById('shiftEditType').value;
            const note = document.getElementById('shiftEditNote').value.trim();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Object.hasOwn(SHIFT_TEAM_LABELS, team) || !['الصباحيه', 'المسائيه', 'الليليه', 'اليوم الطويل'].includes(type)) {
                showNotice('اختر التاريخ والفريق والوردية بشكل صحيح.', 'warning'); return;
            }
            if (!date.startsWith(currentMonth)) { showNotice('اختر تاريخاً من الشهر المعروض، أو غيّر الشهر أولاً.', 'warning'); return; }
            if (isFixedRest(date, { team })) {
                showNotice('هذا اليوم راحة الوردية للفريق ولا يمكن تغيير ورديته.', 'warning'); return;
            }
            const overrides = { ...shiftSettings.overrides, [date]: { ...(shiftSettings.overrides?.[date] || {}), [team]: { type, note } } };
            const next = { ...shiftSettings, overrides };
            if (await cloudWrite(window.firebaseBridge.saveShiftSettings(next), 'تم حفظ تغيير الوردية لهذا اليوم.')) {
                shiftSettings = next;
                renderShiftEditor();
                renderTable();
            }
        }

        async function removeShiftOverride(date, team) {
            if (!isAdmin || !shiftSettings.overrides?.[date]?.[team]) return;
            if (!await askConfirmation(`هل تريد إلغاء تغيير وردية ${SHIFT_TEAM_LABELS[team]} يوم ${date} والعودة للجدول المعتاد؟`, { accept: 'إلغاء التغيير' })) return;
            const overrides = { ...shiftSettings.overrides, [date]: { ...shiftSettings.overrides[date] } };
            delete overrides[date][team];
            if (!Object.keys(overrides[date]).length) delete overrides[date];
            const next = { ...shiftSettings, overrides };
            if (await cloudWrite(window.firebaseBridge.saveShiftSettings(next), 'عادت الوردية إلى جدولها المعتاد.')) {
                shiftSettings = next;
                renderShiftEditor();
                renderTable();
            }
        }

        function openRotationMatrixModal() {
            renderShiftEditor();
            document.getElementById('rotationMatrixModal').classList.remove('hidden');
        }

        function closeRotationMatrixModal() {
            document.getElementById('rotationMatrixModal').classList.add('hidden');
        }

