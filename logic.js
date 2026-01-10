const Logic = {
    saveProfile(isSetup) {
        const w = parseFloat(document.getElementById('prof-weight').value);
        const h = parseFloat(document.getElementById('prof-height').value);
        const a = parseFloat(document.getElementById('prof-age').value);
        
        if (!w || !h || !a) return window.Telegram.WebApp.showAlert("Заполни все поля!");
        
        State.profile = { 
            weight: w, height: h, age: a, 
            gender: document.getElementById('prof-gender').value, 
            goal: document.getElementById('prof-goal').value 
        };
        
        State.save();
        
        if (isSetup) {
            UI.showScreen('main-app');
            UI.updateExList();
            UI.renderAll();
        } else {
            UI.showToast("Профиль обновлен");
            UI.renderHero(); // Обновляем данные на вкладке героя
        }
    },

    addSet() {
        const cat = document.getElementById('select-cat').value;
        const exIdx = document.getElementById('select-ex').value;
        const [name, type, mult, flags] = DB.EXERCISES[cat][exIdx];
        
        let w = 0, r = 0, kcal = 0, vol = 0, xp = 0;
        const safeBodyWeight = (State.profile && State.profile.weight > 0) ? parseFloat(State.profile.weight) : 75;

        if (type === 3) { // КАРДИО
            const intensityKey = document.getElementById('input-cardio-intensity').value; 
            const duration = parseFloat(document.getElementById('input-cardio-time').value);
            if (!duration) return window.Telegram.WebApp.showAlert("Укажи время!");
            
            let realMET = parseFloat(intensityKey);
            if (DB.MET_CARDIO[name] && DB.MET_CARDIO[name][intensityKey]) {
                realMET = DB.MET_CARDIO[name][intensityKey];
            }
            kcal = (realMET * 3.5 * safeBodyWeight / 200) * duration; 
            xp = Math.round(kcal * 1.5);
            r = duration; 
            vol = duration; 
        } else { // СИЛОВЫЕ
            w = parseFloat(document.getElementById('input-w').value) || 0;
            r = parseFloat(document.getElementById('input-r').value);
            if (!r) return window.Telegram.WebApp.showAlert("Укажи повторы!");

            if (w > (State.personalRecords[name] || 0) && type !== 2) {
                State.personalRecords[name] = w;
                UI.showToast(`🏆 Новый рекорд: ${w} кг!`);
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }

            let load = w;
            if (mult === 2) load = w * 2; 
            if (type === 1) load = 0; 
            vol = (type === 2) ? 0 : (load * r);

            let workingWeight = (type === 1) ? safeBodyWeight : ( (type === 4) ? w : load );
            let intensityRatio = Math.max(0.3, Math.min(1.5, workingWeight / safeBodyWeight));
            let MET = 3.5 + (intensityRatio * 1.7);
            if (MET > 6) MET = 6;
            let minutes = (type === 2) ? (r / 60) : (r * 3 / 60);
            kcal = (MET * 3.5 * safeBodyWeight / 200) * minutes;
            if (kcal < 2) kcal = 2;

            let liftXP = (type === 1) ? (r * 2.5) : (vol / 15 + w * 0.4);
            xp = Math.round(liftXP + kcal);
        }

        // Добавляем сет
        State.currentSession.unshift({ id: Date.now(), name, vol, kcal: Math.round(kcal), xp, w, r, type });
        State.save();
        
        window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
        
        // UI Updates
        State.lastExName = name; // Запоминаем для UI
        UI.adaptInputs(); 
        if (type !== 3) document.getElementById('input-r').value = ''; // Очищаем только повторы для силовых
        
        UI.renderSession(); // Обновляем список сессии
        UI.updateNavBadge(); // Обновляем точку на табе
    },

    finishWorkout() {
        if (State.currentSession.length === 0) return;

        let cardioMins = 0, strengthSets = 0;
        State.currentSession.forEach(s => {
            if (s.type === 3) cardioMins += s.r; 
            else strengthSets++;
        });

        const vol = State.currentSession.reduce((a, c) => a + c.vol, 0);
        const mechKcal = State.currentSession.reduce((a, c) => a + c.kcal, 0);
        
        let sessionMinutes = Math.round(cardioMins + strengthSets * 2.5);
        let baseMET = 3.0; 
        let sessionKcalBonus = (baseMET * 3.5 * (State.profile.weight || 80) / 200) * sessionMinutes;
        let totalKcal = Math.round(mechKcal + sessionKcalBonus);
        
        let sessionXP = State.currentSession.reduce((a, c) => a + c.xp, 0);
        if (sessionXP > 15000) sessionXP = 15000;

        let sessionType = (cardioMins > strengthSets * 3) ? 'cardio' : 'strength';

        const record = {
            date: Date.now(),
            dateStr: new Date().toLocaleDateString('ru-RU', {day:'numeric', month:'short'}),
            vol, kcal: totalKcal, xp: sessionXP, 
            time: Math.round(cardioMins + strengthSets * 3), 
            type: sessionType
        };

        // Diff calculation
        let diffPercent = 0, diffType = 'neutral';
        if (State.history.length > 0) {
            const prev = State.history.find(h => (h.type || 'strength') === sessionType);
            if (prev) {
                let currVal = (sessionType === 'cardio') ? record.time : record.vol;
                let prevVal = (sessionType === 'cardio') ? prev.time : prev.vol;
                if (prevVal > 0) {
                    diffPercent = ((currVal - prevVal) / prevVal) * 100;
                    if (diffPercent > 3) diffType = 'pos';
                    if (diffPercent < -3) diffType = 'neg';
                }
            }
        }

        // Сохранение
        State.history.unshift(record);
        State.totalXP += sessionXP;
        State.currentSession = [];
        State.save();

        // Показ результатов
        UI.showResult(record, sessionXP, diffType, diffPercent);
        UI.renderAll();
    },

    deleteSet(id) {
        State.currentSession = State.currentSession.filter(s => s.id !== id);
        State.save();
        UI.renderSession();
        UI.updateNavBadge();
    },

    deleteHistoryItem(index) {
        if(confirm("Удалить запись из истории?")) {
            const item = State.history[index];
            if (item.xp) State.totalXP = Math.max(0, State.totalXP - item.xp);
            State.history.splice(index, 1);
            State.save();
            UI.renderAll();
        }
    },

    safeReset() {
        if(confirm("Удалить ВЕСЬ прогресс и начать заново?")) {
            State.resetAll();
        }
    }
};