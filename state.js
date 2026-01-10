const State = {
    profile: null,
    history: [],
    currentSession: [],
    personalRecords: {},
    totalXP: 0,
    lastExName: null, // Для "липкого" веса

    init() {
        const tg = window.Telegram.WebApp;
        tg.expand();

        this.profile = JSON.parse(localStorage.getItem('ip_profile'));
        this.history = JSON.parse(localStorage.getItem('ip_history')) || [];
        this.currentSession = JSON.parse(localStorage.getItem('ip_current')) || [];
        this.personalRecords = JSON.parse(localStorage.getItem('ip_prs')) || {};
        this.totalXP = parseInt(localStorage.getItem('ip_xp')) || 0;

        // Если профиля нет — показываем онбординг, иначе главное приложение
        if (!this.profile || !this.profile.weight) {
            UI.showScreen('screen-onboarding');
        } else {
            UI.showScreen('main-app');
            // При старте заполняем поля настроек
            UI.fillProfileInputs(); 
            UI.updateExList();
            UI.renderAll();
        }
    },

    save() {
        if(this.profile) localStorage.setItem('ip_profile', JSON.stringify(this.profile));
        localStorage.setItem('ip_history', JSON.stringify(this.history));
        localStorage.setItem('ip_current', JSON.stringify(this.currentSession));
        localStorage.setItem('ip_prs', JSON.stringify(this.personalRecords));
        localStorage.setItem('ip_xp', this.totalXP);
    },

    resetAll() {
        const keys = ['ip_profile', 'ip_history', 'ip_current', 'ip_prs', 'ip_xp'];
        keys.forEach(k => localStorage.removeItem(k));
        location.reload();
    }
};