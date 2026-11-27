        const ARABIC_DAYS = ['الاحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعه', 'السبت'];

        // ==========================================
        // 2. Shift Rotation & Calculation Engine
        // ==========================================
        // Returns the shift for a dayOfMonth (1..31) based on active team color:
        // - Red (الحمراء): 1-10 الصباحيه | 11 اليوم الطويل | 12-20 المسائيه | 21-31 الليليه
        // - Blue (الزرقاء): 1 اليوم الطويل | 2-10 المسائيه | 11-20 الليليه | 21-31 الصباحيه
        // - Yellow (الصفراء): 1-10 الليليه | 11-20 الصباحيه | 21 اليوم الطويل | 22-31 المسائيه
        // - Morning (الصباحية الثابتة): الصباحية في كل أيام الشهر
        function calculateShiftForDate(dayNum, team) {
            const dateKey = `${currentMonth}-${String(dayNum).padStart(2, '0')}`;
            const override = shiftSettings.overrides?.[dateKey]?.[team];
            if (override?.type) return override.type;
            if (team === 'morning') return 'الصباحيه';
            if (team === 'red') {
                if (dayNum === 11) return 'اليوم الطويل';
                if (dayNum >= 1 && dayNum <= 10) return 'الصباحيه';
                if (dayNum >= 12 && dayNum <= 20) return 'المسائيه';
                return 'الليليه';
            } else if (team === 'blue') {
                if (dayNum === 1) return 'اليوم الطويل';
                if (dayNum >= 2 && dayNum <= 10) return 'المسائيه';
                if (dayNum >= 11 && dayNum <= 20) return 'الليليه';
                return 'الصباحيه';
            } else if (team === 'yellow') {
                if (dayNum === 21) return 'اليوم الطويل';
                if (dayNum >= 1 && dayNum <= 10) return 'الليليه';
                if (dayNum >= 11 && dayNum <= 20) return 'الصباحيه';
                return 'المسائيه';
            }
            return '';
        }

        // Shift the employee belonged to on a given date. teamHistory entries hold the OLD team and the last day spent in it.
        function teamOn(employee, date) {
            const history = Array.isArray(employee?.teamHistory) ? [...employee.teamHistory].sort((a, b) => String(a.until).localeCompare(String(b.until))) : [];
            for (const entry of history) if (date && date <= entry.until) return entry.team;
            return employee?.team;
        }
        function fixedRestReason(date, employee) {
            const team = teamOn(employee, date);
            if (team === 'morning' && new Date(`${date}T12:00:00`).getDay() === 5) return 'إجازة الجمعة الثابتة';
            const restDays = { red: 1, blue: 21, yellow: 11 };
            if (Number(date.slice(-2)) === restDays[team]) return 'راحة الوردية';
            return '';
        }

        function isFixedRest(date, employee) {
            return Boolean(fixedRestReason(date, employee));
        }

        function effectiveRecord(date, employee, record) {
            const restReason = fixedRestReason(date, employee);
            return restReason
                ? { status: 'راحة', delay: 0, permissionMinutes: 0, notes: restReason }
                : (record || { status: '', delay: 0, notes: '' });
        }

        function displayedStatus(date, employee, record) {
            return fixedRestReason(date, employee) === 'راحة الوردية' ? 'راحة الوردية' : (record.status || '');
        }

        function countsAsEmployeeRest(date, employee, record) {
            return record.status === 'راحة' && !fixedRestReason(date, employee);
        }

