const State = {
    profile: null,
    history: [],
    currentSession: [],
    personalRecords: {},
    totalXP: 0,
    lastExName: null, 

    init() {
        // Инициализация Telegram WebApp
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();

        // Загрузка данных из LocalStorage
        this.profile = JSON.parse(localStorage.getItem('ip_profile'));
        this.history = JSON.parse(localStorage.getItem('ip_history')) || [];
        this.currentSession = JSON.parse(localStorage.getItem('ip_current')) || [];
        this.personalRecords = JSON.parse(localStorage.getItem('ip_prs')) || {};
        this.totalXP = parseInt(localStorage.getItem('ip_xp')) || 0;

        // ВАЖНО: Сначала создаем инпуты в DOM, иначе при переходе на экраны будет ошибка
        UI.renderSetupInputs();

        // Логика маршрутизации (Роутинг)
        if (!this.profile || !this.profile.weight) {
            // Если профиля нет — показываем онбординг
            UI.showScreen('screen-onboarding');
        } else {
            // Если профиль есть — загружаем главное приложение
            UI.showScreen('main-app');
            
            // Заполняем поля и списки
            UI.fillProfileInputs(); 
            UI.updateExList(); // Теперь это сработает, так как DB.CATS существует
            UI.renderAll();
            
            // Открываем вкладку героя по умолчанию
            const navItems = document.querySelectorAll('.nav-item');
            if (navItems.length > 0) {
                UI.switchTab('tab-hero', navItems[0]);
            }
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

// Запуск приложения ТОЛЬКО после полной загрузки HTML
window.addEventListener('DOMContentLoaded', () => {
    State.init();
});