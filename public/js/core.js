        // ==========================================
        // 1. Initial State & Seed Data
        // ==========================================
        const INITIAL_EMPLOYEES = [];

        const INITIAL_ATTENDANCE = {};
        const DEMO_MODE = new URLSearchParams(location.search).has('preview');

        const THEME_LABELS = { system: 'تلقائي (حسب الجهاز)', light: 'نهاري', dark: 'ليلي' };
        const THEME_ICONS = { system: 'fa-circle-half-stroke', light: 'fa-sun', dark: 'fa-moon' };
        let themeUid = null;
        function themeKey() { return `agazaty-theme-pref:${themeUid || 'device'}`; }
        function getThemePref() {
            const value = localStorage.getItem(themeKey()) || localStorage.getItem('agazaty-theme-pref:device');
            return ['system', 'light', 'dark'].includes(value) ? value : 'system';
        }
        function applyTheme(mode) {
            const dark = mode === 'dark';
            document.documentElement.classList.toggle('dark', dark);
            document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
            document.querySelector('meta[name="theme-color"]').content = dark ? '#000000' : '#176d68';
        }
        function applyThemePref() {
            const pref = getThemePref();
            applyTheme(pref === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : pref);
            const button = document.getElementById('themeButton');
            if (button) button.innerHTML = `<i class="fa-solid ${THEME_ICONS[pref]}"></i><span>المظهر: ${THEME_LABELS[pref]}</span>`;
            document.querySelectorAll('.theme-choice button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.theme === pref)));
        }
        function setThemePref(pref) {
            if (!['system', 'light', 'dark'].includes(pref)) return;
            localStorage.setItem(themeKey(), pref);
            localStorage.setItem('agazaty-theme-pref:device', pref);
            applyThemePref();
        }
        function toggleTheme() {
            const order = ['system', 'light', 'dark'];
            setThemePref(order[(order.indexOf(getThemePref()) + 1) % order.length]);
        }
        matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (getThemePref() === 'system') applyThemePref(); });
        applyThemePref();

        function showTemporaryPassword(code, pass) {
            document.getElementById('temporaryCode').textContent = code;
            document.getElementById('temporaryPassword').textContent = pass;
            document.getElementById('temporaryPasswordModal').classList.remove('hidden');
        }
        function closeTemporaryPassword() {
            document.getElementById('temporaryPasswordModal').classList.add('hidden');
            document.getElementById('temporaryPassword').textContent = '';
        }

        const noticeTypes = {
            success: { title: 'تم بنجاح', icon: 'fa-circle-check' },
            error: { title: 'تعذر إكمال الإجراء', icon: 'fa-circle-exclamation' },
            warning: { title: 'تنبيه', icon: 'fa-triangle-exclamation' },
            info: { title: 'معلومة', icon: 'fa-circle-info' }
        };

        function showNotice(message, type = 'success') {
            const kind = noticeTypes[type] ? type : 'info';
            const stack = document.getElementById('noticeStack');
            const notice = document.createElement('div');
            notice.className = `app-notice ${kind}`;
            const icon = document.createElement('div');
            icon.className = 'app-notice-icon';
            icon.innerHTML = `<i class="fa-solid ${noticeTypes[kind].icon}"></i>`;
            const content = document.createElement('div');
            content.className = 'app-notice-content';
            const title = document.createElement('strong');
            title.textContent = noticeTypes[kind].title;
            const detail = document.createElement('span');
            detail.textContent = message;
            content.append(title, detail);
            const close = document.createElement('button');
            close.type = 'button';
            close.className = 'app-notice-close';
            close.setAttribute('aria-label', 'إغلاق الرسالة');
            close.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            close.onclick = () => notice.remove();
            notice.append(icon, content, close);
            stack.prepend(notice);
            while (stack.children.length > 3) stack.lastElementChild.remove();
            setTimeout(() => notice.remove(), kind === 'error' ? 8500 : 5000);
        }

        let confirmationResolve = null;
        let confirmationPreviousFocus = null;
        function askConfirmation(message, options = {}) {
            if (confirmationResolve) closeConfirmation(false);
            confirmationPreviousFocus = document.activeElement;
            document.getElementById('confirmationTitle').textContent = options.title || 'تأكيد الإجراء';
            document.getElementById('confirmationMessage').textContent = message;
            const accept = document.getElementById('confirmationAccept');
            accept.textContent = options.accept || 'تأكيد';
            accept.className = `rounded-xl px-4 py-2.5 font-bold text-white ${options.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-cyan-700 hover:bg-cyan-800'}`;
            document.getElementById('confirmationModal').classList.remove('hidden');
            document.getElementById('confirmationCancel').focus();
            return new Promise(resolve => { confirmationResolve = resolve; });
        }
        function closeConfirmation(accepted) {
            document.getElementById('confirmationModal').classList.add('hidden');
            const resolve = confirmationResolve;
            confirmationResolve = null;
            resolve?.(accepted);
            confirmationPreviousFocus?.focus?.();
        }
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && confirmationResolve) closeConfirmation(false);
            if (event.key === 'Tab' && confirmationResolve) {
                const cancel = document.getElementById('confirmationCancel');
                const accept = document.getElementById('confirmationAccept');
                if (event.shiftKey && document.activeElement === cancel) { event.preventDefault(); accept.focus(); }
                else if (!event.shiftKey && document.activeElement === accept) { event.preventDefault(); cancel.focus(); }
            }
        });

