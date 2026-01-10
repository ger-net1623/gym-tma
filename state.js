const State = {
    profile: null,
    history: [],
    currentSession: [],
    personalRecords: {},
    totalXP: 0,
    lastExName: null, 

    init() {
        // Инициализация Telegram WebApp с защитой
        try {
            if (window.Telegram && window.Telegram.WebApp) {
                const tg = window.Telegram.WebApp;
                tg.ready();
                tg.expand();
            }
        } catch (e) {
            console.warn("Telegram API not available (running in browser?)", e);
        }

        // Загрузка данных из LocalStorage с защитой от сбоев
        try {
            const safeParse = (key, def) => {
                const item = localStorage.getItem(key);
                if (!item || item === "undefined") return def;
                try { return JSON.parse(item); } catch (e) { return def; }
            };

            this.profile = safeParse('ip_profile', null);
            this.history = safeParse('ip_history', []);
            this.currentSession = safeParse('ip_current', []);
            this.personalRecords = safeParse('ip_prs', {});
            this.totalXP = parseInt(localStorage.getItem('ip_xp')) || 0;
            this.lastExName = localStorage.getItem('ip_lastEx') || null;

        } catch (e) {
            console.error("Storage Error:", e);
            alert("Ошибка загрузки данных. Приложение сброшено.");
            this.resetAll();
            return;
        }

        if(typeof UI !== 'undefined') {
            UI.renderSetupInputs();
        } else {
            return alert("Ошибка: UI модуль не загружен");
        }

        if (!this.profile || !this.profile.weight) {
            UI.showScreen('screen-onboarding');
        } else {
            UI.showScreen('main-app');
            UI.fillProfileInputs(); 
            UI.updateExList();
            UI.renderAll();
            
            const navItems = document.querySelectorAll('.nav-item');
            if (navItems.length > 0) {
                UI.switchTab('tab-hero', navItems[0]);
            }
        }
    },

    save() {
        try {
            if(this.profile) localStorage.setItem('ip_profile', JSON.stringify(this.profile));
            localStorage.setItem('ip_history', JSON.stringify(this.history));
            localStorage.setItem('ip_current', JSON.stringify(this.currentSession));
            localStorage.setItem('ip_prs', JSON.stringify(this.personalRecords));
            localStorage.setItem('ip_xp', this.totalXP);
            // Надежное сохранение (защита от null)
            localStorage.setItem('ip_lastEx', this.lastExName || '');
        } catch(e) {
            console.error("Save error", e);
        }
    },

    resetAll() {
        const keys = ['ip_profile', 'ip_history', 'ip_current', 'ip_prs', 'ip_xp', 'ip_lastEx'];
        keys.forEach(k => localStorage.removeItem(k));
        location.reload();
    }
};