'use strict';
/** -------------------------------------------------------------
 *  State – работа с локальным хранилищем и инициализация
 * ------------------------------------------------------------- */

const State = (() => {
    /* ────────────────────────────────────────────────────────────────
     *  Версия схемы данных.
     * ──────────────────────────────────────────────────────────────── */
    const _VERSION = 2;

    /* ────────────────────────────────────────────────────────────────
     *  Ключи в localStorage.
     * ──────────────────────────────────────────────────────────────── */
    const STORAGE_KEYS = {
        profile:   'ip_profile',
        history:   'ip_history',
        current:   'ip_current',
        prs:       'ip_prs',
        xp:        'ip_xp',
        lastEx:    'ip_lastEx',
        version:   'ip_version'
    };

    /* ────────────────────────────────────────────────────────────────
     *  Внутреннее состояние (закрыто в замыкании)
     * ──────────────────────────────────────────────────────────────── */
    const _state = {
        profile: null,
        history: [],
        currentSession: [],
        personalRecords: {},
        totalXP: 0,
        lastExName: null
    };

    /** ---------------------------------------------------------
     *  Безопасный JSON‑парсинг
     * --------------------------------------------------------- */
    const _safeParse = (raw, def) => {
        if (!raw || raw === 'undefined') return def;
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(def)) return Array.isArray(parsed) ? parsed : def;
            if (def === null) return (parsed && typeof parsed === 'object') ? parsed : def;
            return (typeof parsed === typeof def) ? parsed : def;
        } catch (e) {
            console.warn('[State] Ошибка парсинга JSON, используется значение по умолчанию', e);
            return def;
        }
    };

    /** ---------------------------------------------------------
     *  Валидация импортированных данных
     * --------------------------------------------------------- */
    const _validateImportedData = data => {
        if (typeof data !== 'object' || data === null) {
            console.warn('[State] Импортированные данные не являются объектом');
            return false;
        }
        if (data.profile != null && typeof data.profile !== 'object') {
            console.warn('[State] profile должен быть объектом');
            return false;
        }
        if (!Array.isArray(data.history) ||
            !Array.isArray(data.currentSession) ||
            typeof data.personalRecords !== 'object') {
            console.warn('[State] История, текущая сессия или PR имеют неверный тип');
            return false;
        }
        if (typeof data.totalXP !== 'number' && typeof data.totalXP !== 'string') {
            console.warn('[State] totalXP имеет неверный тип');
            return false;
        }
        return true;
    };

    /** ---------------------------------------------------------
     *  Публичный API
     * --------------------------------------------------------- */
    return {
        /** -------------------------------------------------
         *  Инициализация: загрузка, подключение к Telegram‑WebApp,
         *  выбор стартового экрана.
         * ------------------------------------------------- */
        init() {
            // Telegram‑WebApp (если доступен)
            try {
                if (window.Telegram?.WebApp) {
                    const tg = window.Telegram.WebApp;
                    tg.ready();
                    tg.expand();

                    UI.applyTelegramTheme();
                    tg.onEvent('themeChanged', UI.applyTelegramTheme);
                }
            } catch (e) {
                console.warn('Telegram API not available (running in browser?)', e);
            }

            // Загрузка данных
            this.load();

            // UI обязателен
            if (typeof UI === 'undefined') {
                alert('Ошибка: модуль UI не загружен');
                return;
            }

            // Стартовый экран
            if (!this.profile?.weight) {
                UI.showScreen('screen-onboarding');
                UI.renderSetupInputs();
            } else {
                UI.showScreen('main-app');
                UI.fillProfileInputs();
                UI.populateCategories();                     // ← гарантируем, что категории и упражнения уже есть
                UI.renderAll();

                const navItems = document.querySelectorAll('.nav-item');
                if (navItems.length) UI.switchTab('tab-hero', navItems[0]);
            }
        },

        /** -------------------------------------------------
         *  Загрузка всех данных из localStorage.
         * ------------------------------------------------- */
        load() {
            const storedVersion = parseInt(localStorage.getItem(STORAGE_KEYS.version), 10);
            if (isNaN(storedVersion) || storedVersion !== _VERSION) {
                console.warn('[State] Версия данных несовместима, делаем мягкий сброс');
                // Сохраняем только новую версию, чтобы дальше не «залипали».
                this.resetAll(true, false);
                localStorage.setItem(STORAGE_KEYS.version, _VERSION);
                return;
            }

            this.profile        = _safeParse(localStorage.getItem(STORAGE_KEYS.profile), null);
            this.history        = _safeParse(localStorage.getItem(STORAGE_KEYS.history), []);
            this.currentSession = _safeParse(localStorage.getItem(STORAGE_KEYS.current), []);
            this.personalRecords = _safeParse(localStorage.getItem(STORAGE_KEYS.prs), {});

            const xpRaw = localStorage.getItem(STORAGE_KEYS.xp);
            if (xpRaw) {
                try { this.totalXP = JSON.parse(xpRaw); }
                catch (_) { this.totalXP = parseInt(xpRaw, 10) || 0; }
            } else {
                this.totalXP = 0;
            }

            this.lastExName = localStorage.getItem(STORAGE_KEYS.lastEx) || null;
            this.calcTotalXP();
        },

        /** -------------------------------------------------
         *  Сохранение (debounced)
         * ------------------------------------------------- */
        _saveTimeout: null,
        save(force = false) {
            if (force) {
                this._commitSave();
                return;
            }
            clearTimeout(this._saveTimeout);
            this._saveTimeout = setTimeout(() => this._commitSave(), 300);
        },

        /** Фактическая запись без задержки */
        _commitSave() {
            try {
                if (this.profile) localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(this.profile));
                localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(this.history));
                localStorage.setItem(STORAGE_KEYS.current, JSON.stringify(this.currentSession));
                localStorage.setItem(STORAGE_KEYS.prs, JSON.stringify(this.personalRecords));
                localStorage.setItem(STORAGE_KEYS.xp, JSON.stringify(this.totalXP));
                localStorage.setItem(STORAGE_KEYS.lastEx, this.lastExName || '');
                localStorage.setItem(STORAGE_KEYS.version, _VERSION);
            } catch (e) {
                console.error('[State] Ошибка при записи в localStorage', e);
                if (typeof UI !== 'undefined') UI.showToast('⚠️ Не удалось записать данные');
            }
        },

        /** -------------------------------------------------
         *  Пересчёт общего XP из истории
         * ------------------------------------------------- */
        calcTotalXP() {
            this.totalXP = 0;
            this.history.forEach((rec, idx) => {
                const xp = Number(rec.xp);
                if (isNaN(xp)) {
                    console.warn(`[State] Запись истории #${idx} не содержит корректного xp`, rec);
                } else {
                    this.totalXP += xp;
                }
            });
        },

        /** -------------------------------------------------
         *  Полный сброс (можно сохранить версию и/или перезагрузить)
         * ------------------------------------------------- */
        resetAll(preserveVersion = false, reloadPage = true) {
            Object.values(STORAGE_KEYS).forEach(k => {
                if (preserveVersion && k === STORAGE_KEYS.version) return;
                localStorage.removeItem(k);
            });

            this.profile = null;
            this.history = [];
            this.currentSession = [];
            this.personalRecords = {};
            this.totalXP = 0;
            this.lastExName = null;

            const toast = document.getElementById('toast');
            if (toast) toast.className = 'hidden';
            const resultScreen = document.getElementById('screen-result');
            if (resultScreen) resultScreen.classList.remove('active-screen');

            if (reloadPage) window.location.reload();
        },

        /** -------------------------------------------------
         *  Пользовательский «безопасный» сброс – вызывается из UI.
         * ------------------------------------------------- */
        safeReset() {
            if (confirm('Удалить весь прогресс и профиль? Это действие нельзя отменить.')) {
                this.resetAll();
            }
        },

        /** -------------------------------------------------
         *  Экспорт данных (для бэкапа)
         * ------------------------------------------------- */
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

        /** -------------------------------------------------
         *  Импорт данных (бэкап)
         * ------------------------------------------------- */
        importData(jsonStr) {
            try {
                const data = JSON.parse(jsonStr);
                if (!_validateImportedData(data)) {
                    UI.showToast('❌ Данные некорректны');
                    return;
                }
                this.profile = data.profile || null;
                this.history = data.history || [];
                this.currentSession = data.currentSession || [];
                this.personalRecords = data.personalRecords || {};
                this.totalXP = typeof data.totalXP === 'string' ? parseInt(data.totalXP, 10) : data.totalXP || 0;
                this.lastExName = data.lastExName || null;
                this.save(true);
                UI.renderAll();
                UI.showToast('✅ Данные импортированы');
            } catch (e) {
                console.error('[State] Ошибка импорта данных', e);
                UI.showToast('❌ Не удалось импортировать данные');
            }
        },

        /** -------------------------------------------------
         *  Геттеры / Сеттеры
         * ------------------------------------------------- */
        get profile()    { return _state.profile; },
        set profile(v)    { _state.profile = v; },

        get history()     { return _state.history; },
        set history(v)    { _state.history = v; },

        get currentSession() { return _state.currentSession; },
        set currentSession(v) { _state.currentSession = v; },

        get personalRecords() { return _state.personalRecords; },
        set personalRecords(v) { _state.personalRecords = v; },

        get totalXP() { return _state.totalXP; },
        set totalXP(v) { _state.totalXP = v; },

        get lastExName() { return _state.lastExName; },
        set lastExName(v) { _state.lastExName = v; }
    };
})();

/* -----------------------------------------------------------------
 *  Сохраняем состояние перед закрытием/перезагрузкой страницы
 * ----------------------------------------------------------------- */
window.addEventListener('beforeunload', () => {
    try { State.save(true); }
    catch (e) { console.error('[State] Ошибка в beforeunload', e); }
});