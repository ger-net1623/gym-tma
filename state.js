/** -------------------------------------------------------------
 *  State – работа с локальным хранилищем и инициализация
 * ------------------------------------------------------------- */
const State = {
    profile: null,
    history: [],
    currentSession: [],
    personalRecords: {},
    totalXP: 0,
    lastExName: null,

    /** ---------------------------------------------------------
     *  Инициализация: загрузка из localStorage, подготовка UI,
     *  Telegram‑WebApp
     * --------------------------------------------------------- */
    init() {
        // 1️⃣ Telegram‑WebApp (если доступен)
        try {
            if (window.Telegram?.WebApp) {
                const tg = window.Telegram.WebApp;
                tg.ready();
                tg.expand();

                // Применяем текущую тему и подписываемся на её изменения
                UI.applyTelegramTheme();
                tg.onEvent('themeChanged', UI.applyTelegramTheme);
            }
        } catch (e) {
            console.warn('Telegram API not available (running in browser?)', e);
        }

        // 2️⃣ Загрузка из хранилища
        this.load();

        // UI‑модуль обязан быть загружен
        if (typeof UI === 'undefined') {
            alert('Ошибка: модуль UI не загружен');
            return;
        }

        // 3️⃣ Выбор стартового экрана
        if (!this.profile?.weight) {
            UI.showScreen('screen-onboarding');
            UI.renderSetupInputs(); // только в режиме onboarding
        } else {
            UI.showScreen('main-app');
            UI.fillProfileInputs();
            UI.updateExList();
            UI.renderAll();

            const navItems = document.querySelectorAll('.nav-item');
            if (navItems.length) UI.switchTab('tab-hero', navItems[0]);
        }
    },

    /** ---------------------------------------------------------
     *  Сохранение всех данных в localStorage (debounced)
     * --------------------------------------------------------- */
    _saveTimeout: null,
    /**
     *  save([force]) – сохраняет состояние.
     *  Если `force === true`, запись происходит сразу без debounce.
     */
    save(force = false) {
        if (force) {
            this._commitSave();
            return;
        }
        clearTimeout(this._saveTimeout);
        this._saveTimeout = setTimeout(() => this._commitSave(), 300);
    },

    /** Выполняет запись в localStorage без задержек */
    _commitSave() {
        try {
            if (this.profile) localStorage.setItem('ip_profile', JSON.stringify(this.profile));
            localStorage.setItem('ip_history', JSON.stringify(this.history));
            localStorage.setItem('ip_current', JSON.stringify(this.currentSession));
            localStorage.setItem('ip_prs', JSON.stringify(this.personalRecords));
            localStorage.setItem('ip_xp', JSON.stringify(this.totalXP));
            localStorage.setItem('ip_lastEx', this.lastExName || '');
        } catch (e) {
            console.error('Ошибка при сохранении в localStorage', e);
        }
    },

    /** ---------------------------------------------------------
     *  Загрузка всех данных из localStorage с полной безопасностью
     * --------------------------------------------------------- */
    load() {
        const safeParse = (key, def) => {
            const raw = localStorage.getItem(key);
            if (!raw || raw === 'undefined') return def;
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(def)) return Array.isArray(parsed) ? parsed : def;
                if (def === null) return (parsed && typeof parsed === 'object') ? parsed : def;
                return (typeof parsed === typeof def) ? parsed : def;
            } catch (_) {
                return def;
            }
        };

        this.profile          = safeParse('ip_profile', null);
        this.history          = safeParse('ip_history', []);
        this.currentSession   = safeParse('ip_current', []);
        this.personalRecords  = safeParse('ip_prs', {});

        // totalXP может быть числом либо JSON‑строкой
        const xpRaw = localStorage.getItem('ip_xp');
        if (xpRaw) {
            try { this.totalXP = JSON.parse(xpRaw); }
            catch (_) { this.totalXP = parseInt(xpRaw, 10) || 0; }
        } else {
            this.totalXP = 0;
        }

        this.calcTotalXP();               // гарантируем консистентность
        this.lastExName = localStorage.getItem('ip_lastEx') || null;
    },

    /** ---------------------------------------------------------
     *  Пересчёт общего XP из массива history
     * --------------------------------------------------------- */
    calcTotalXP() {
        this.totalXP = this.history.reduce((sum, rec) => sum + (rec.xp || 0), 0);
    },

    /** ---------------------------------------------------------
     *  Полный сброс прогресса + перезагрузка страницы
     * --------------------------------------------------------- */
    resetAll() {
        const keys = ['ip_profile', 'ip_history', 'ip_current',
                      'ip_prs', 'ip_xp', 'ip_lastEx'];
        keys.forEach(k => localStorage.removeItem(k));

        this.profile = null;
        this.history = [];
        this.currentSession = [];
        this.personalRecords = {};
        this.totalXP = 0;
        this.lastExName = null;

        // Перезагружаем страницу
        window.location.reload();
    },

    /** ---------------------------------------------------------
     *  Пользовательский (безопасный) сброс – вызывается из UI
     * --------------------------------------------------------- */
    safeReset() {
        if (confirm('Удалить весь прогресс и профиль? Это действие нельзя отменить.')) {
            this.resetAll();
        }
    },

    // ---------------------------------------------------------------
    //  Экспорт / импорт данных (для бэкапа)
    // ---------------------------------------------------------------
    exportData() {
        const data = {
            profile: this.profile,
            history: this.history,
            currentSession: this.currentSession,
            personalRecords: this.personalRecords,
            totalXP: this.totalXP,
            lastExName: this.lastExName
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ironpath-backup-${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    importData(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            this.profile = data.profile || null;
            this.history = data.history || [];
            this.currentSession = data.currentSession || [];
            this.personalRecords = data.personalRecords || {};
            this.totalXP = data.totalXP || 0;
            this.lastExName = data.lastExName || null;
            this.save(true);
            UI.renderAll();
        } catch (e) {
            UI.showToast('❌ Не удалось импортировать данные');
        }
    }
};

/* -----------------------------------------------------------------
 *  Сохраняем состояние сразу при попытке закрыть/перезагрузить страницу
 * ----------------------------------------------------------------- */
window.addEventListener('beforeunload', () => {
    // Принудительно сохраняем без debounce
    State.save(true);
});