/** -------------------------------------------------------------
 *  State – работа с локальным хранилищем и инициализация приложения
 *  -------------------------------------------------------------
 *  Описание полей:
 *    profile          – объект {weight, height, age, gender, goal}
 *    history          – массив записей тренировок
 *    currentSession   – массив подходов текущей тренировки
 *    personalRecords – PR‑ы (самый большой вес/повтор)
 *    totalXP          – суммарный опыт
 *    lastExName       – имя последнего выбранного упражнения
 * ------------------------------------------------------------- */
const State = {
    profile: null,
    history: [],
    currentSession: [],
    personalRecords: {},
    totalXP: 0,
    lastExName: null,

    /** ---------------------------------------------------------
     *  Инициализация: загрузка из localStorage, подготовка UI и Telegram‑WebApp
     * --------------------------------------------------------- */
    init() {
        // 1️⃣ Telegram‑WebApp
        try {
            if (window.Telegram && window.Telegram.WebApp) {
                const tg = window.Telegram.WebApp;
                tg.ready();
                tg.expand();
            }
        } catch (e) {
            console.warn('Telegram API not available (running in browser?)', e);
        }

        // 2️⃣ Загрузка из хранилища
        this.load();

        // UI‑модуль обязателен
        if (typeof UI === 'undefined') {
            alert('Ошибка: модуль UI не загружен');
            return;
        }

        // 3️⃣ Если профиля нет – показываем onboarding,
        //    иначе сразу переходим к главному интерфейсу
        if (!this.profile || !this.profile.weight) {
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
     *  Сохранение всех данных в localStorage
     * --------------------------------------------------------- */
    save() {
        try {
            if (this.profile) localStorage.setItem('ip_profile', JSON.stringify(this.profile));
            localStorage.setItem('ip_history', JSON.stringify(this.history));
            localStorage.setItem('ip_current', JSON.stringify(this.currentSession));
            localStorage.setItem('ip_prs', JSON.stringify(this.personalRecords));
            // XP сохраняем как JSON‑строку – безопаснее при будущих изменениях структуры
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
            try { return JSON.parse(raw); } catch (_) { return def; }
        };

        this.profile = safeParse('ip_profile', null);
        this.history = safeParse('ip_history', []);
        this.currentSession = safeParse('ip_current', []);
        this.personalRecords = safeParse('ip_prs', {});

        // XP может храниться как число или как JSON‑строка
        const xpRaw = localStorage.getItem('ip_xp');
        if (xpRaw) {
            try {
                this.totalXP = JSON.parse(xpRaw);
            } catch (_) {
                this.totalXP = parseInt(xpRaw, 10) || 0;
            }
        } else {
            this.totalXP = 0;
        }

        this.lastExName = localStorage.getItem('ip_lastEx') || null;
    },

    /** ---------------------------------------------------------
     *  Полный сброс прогресса + перезагрузка страницы
     * --------------------------------------------------------- */
    resetAll() {
        const keys = ['ip_profile', 'ip_history', 'ip_current', 'ip_prs', 'ip_xp', 'ip_lastEx'];
        keys.forEach(k => localStorage.removeItem(k));

        // Очищаем в памяти – после reload всё будет «чисто»
        this.profile = null;
        this.history = [];
        this.currentSession = [];
        this.personalRecords = {};
        this.totalXP = 0;
        this.lastExName = null;

        location.reload();
    },

    /** ---------------------------------------------------------
     *  Пользовательский сброс – вызывается из UI
     * --------------------------------------------------------- */
    safeReset() {
        if (confirm('Удалить весь прогресс и профиль? Это действие нельзя отменить.')) {
            this.resetAll();
        }
    }
};