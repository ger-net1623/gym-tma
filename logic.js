/** -------------------------------------------------------------
 *  Logic – бизнес‑логика приложения
 * ------------------------------------------------------------- */
const Logic = {
    /** ---------------------------------------------------------
     *  Универсальный алерт (Telegram‑WebApp → alert)
     * --------------------------------------------------------- */
    showAlert(msg) {
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.showAlert) {
            window.Telegram.WebApp.showAlert(msg);
        } else {
            alert(msg);
        }
    },

    // -----------------------------------------------------------------
    //  Сохранение/обновление профиля
    // -----------------------------------------------------------------
    saveProfile(isSetup) {
        const prefix = isSetup ? 'setup-' : 'prof-';

        const wInput = document.getElementById(prefix + 'weight');
        const hInput = document.getElementById(prefix + 'height');
        const aInput = document.getElementById(prefix + 'age');
        const gInput = document.getElementById(prefix + 'gender');
        const glInput = document.getElementById(prefix + 'goal');

        if (!wInput || !hInput || !aInput) {
            return this.showAlert('Ошибка интерфейса: поля не найдены');
        }

        const w = parseFloat(wInput.value);
        const h = parseFloat(hInput.value);
        const a = parseFloat(aInput.value);

        const hasError = [w, h, a].some(v => Number.isNaN(v) || v <= 0);
        if (hasError) {
            return this.showAlert('Заполни все поля корректно!');
        }

        // Сохраняем профиль
        State.profile = {
            weight: w,
            height: h,
            age: a,
            gender: gInput.value,
            goal: glInput.value
        };
        State.save();

        if (isSetup) {
            UI.showScreen('main-app');
            UI.switchTab('tab-hero', document.querySelector('.nav-item'));
            UI.renderHero();

            // Инициализируем «Зал», иначе он будет пустым
            UI.updateExList();
            UI.renderAll();
        } else {
            this.showAlert('Профиль обновлён');
            UI.renderHero();
        }
    },

    // -----------------------------------------------------------------
    //  Добавление подхода (set)
    // -----------------------------------------------------------------
    addSet() {
        const catSelect = document.getElementById('select-cat');
        const exSelect = document.getElementById('select-ex');
        if (!catSelect || !exSelect) {
            return this.showAlert('Выберите категорию и упражнение');
        }

        const catKey = catSelect.value;
        const exIdx = parseInt(exSelect.value, 10);
        const exData = DB.EXERCISES[catKey][exIdx];
        const [name, type, mult = 1, flags = {}] = exData;

        const safeBodyWeight = (State.profile && State.profile.weight)
            ? Math.max(1, State.profile.weight)
            : 1;

        let w = 0, r = 0, kcal = 0, vol = 0, xp = 0;

        if (type === 3) { // ==== Кардио ====
            const intensity = document.getElementById('input-cardio-intensity').value;
            const duration  = parseFloat(document.getElementById('input-cardio-time').value);
            if (!duration || duration <= 0) {
                return this.showAlert('Укажи время!');
            }

            // MET‑коэффициент (упрощённый поиск)
            const coeffs = DB.MET_CARDIO[name] || {};
            const met = coeffs[intensity] ?? Object.values(coeffs)[0] ?? 1;

            kcal = (met * 3.5 * safeBodyWeight / 200) * duration;
            xp   = Math.round(kcal * 1.5);
            r    = duration;      // r = minutes (для вывода в UI)
            vol  = duration;      // placeholder – нужен только для совместимости
        } else { // ==== Силовые упражнения ====
            w = parseFloat(document.getElementById('input-w').value) || 0;
            r = parseFloat(document.getElementById('input-r').value);
            if (Number.isNaN(r) || r <= 0) {
                return this.showAlert('Укажи количество повторений!');
            }

            // Тоннаж
            if (type === 1) { // собственный вес
                vol = (safeBodyWeight + w) * r;
            } else {
                const load = (mult === 2) ? w * 2 : w;
                vol = load * r;
            }

            // MET‑расчёт (упрощённый, но безопасный)
            const workingWeight = (type === 1) ? safeBodyWeight : w;
            const intensityRatio = Math.max(0.3, Math.min(1.5, workingWeight / safeBodyWeight));
            let MET = 3.5 + (intensityRatio * 1.7);
            MET = Math.min(MET, 6);
            const minutes = (type === 2) ? (r / 60) : (r * 3 / 60);
            kcal = (MET * 3.5 * safeBodyWeight / 200) * minutes;
            if (kcal < 2) kcal = 2;

            const liftXP = (type === 1) ? (r * 2.5) : (vol / 15 + w * 0.4);
            xp = Math.round(liftXP + kcal);
        }

        // -------------------------------------------------
        // PR‑проверка (по весу) – только для силовых
        // -------------------------------------------------
        if (type !== 3 && w > (State.personalRecords[name] || 0)) {
            State.personalRecords[name] = w;
            UI.showToast(`🏆 Новый рекорд: ${w} кг!`);
            try {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            } catch (e) { /* ignore */ }
        }

        // Сохраняем в текущей сессии
        State.lastExName = name; // <-- BEFORE adaptInputs()
        State.currentSession.unshift({
            id: (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? crypto.randomUUID()
                : (Date.now() + '_' + Math.random()),
            name,
            vol,
            kcal: Math.round(kcal),
            xp,
            w,
            r,
            type
        });
        State.save();

        try {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
        } catch (e) { /* ignore */ }

        UI.adaptInputs();

        // Очищаем вводы
        if (type === 3) {
            document.getElementById('input-cardio-time').value = '';
            const iSelect = document.getElementById('input-cardio-intensity');
            if (iSelect) iSelect.selectedIndex = 0;
        } else {
            document.getElementById('input-r').value = '';
        }

        UI.renderSession();
        UI.updateNavBadge();
    },

    // -----------------------------------------------------------------
    //  Завершение текущей тренировки
    // -----------------------------------------------------------------
    finishWorkout() {
        if (State.currentSession.length === 0) {
            return this.showAlert('Нет подходов для сохранения');
        }

        const hasCardio   = State.currentSession.some(s => s.type === 3);
        const hasStrength = State.currentSession.some(s => s.type !== 3);
        const sessionType = hasCardio && !hasStrength ? 'cardio' : 'strength';

        const totalVol      = State.currentSession.reduce((a, s) => a + s.vol, 0);
        const totalKcalRaw  = State.currentSession.reduce((a, s) => a + s.kcal, 0);
        const totalXP       = State.currentSession.reduce((a, s) => a + s.xp, 0);
        const cardioMins    = State.currentSession
            .filter(s => s.type === 3)
            .reduce((a, s) => a + s.r, 0);
        const strengthSets = State.currentSession.filter(s => s.type !== 3).length;

        // Приблизительное время сессии
        const AVG_SET_TIME = 2.5; // минут на один силовой подход
        const sessionMinutes = Math.round(cardioMins + strengthSets * AVG_SET_TIME);

        // ---------- БОНУС КАЛОРИЙ ЗА ВРЕМЯ В ЗАЛЕ ----------
        const baseMET   = 3.0;
        const bodyWeight = State.profile?.weight || 80;
        const sessionKcalBonus = (baseMET * 3.5 * bodyWeight / 200) * sessionMinutes;
        const totalKcal = Math.round(totalKcalRaw + sessionKcalBonus);
        // -----------------------------------------------------

        const record = {
            date: Date.now(),
            dateStr: new Date().toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short'
            }),
            vol: totalVol,
            kcal: totalKcal,
            xp: totalXP,
            time: sessionMinutes,
            type: sessionType
        };

        // Сравнение с прошлой тренировкой того же типа
        let diffPercent = 0;
        let diffType = 'neutral';

        if (State.history.length > 0) {
            const prev = State.history.find(h => h.type === sessionType);
            if (prev) {
                const currVal = sessionType === 'cardio' ? record.time : record.vol;
                const prevVal = sessionType === 'cardio' ? prev.time : prev.vol;
                if (prevVal > 0) {
                    diffPercent = ((currVal - prevVal) / prevVal) * 100;
                    diffType = Math.abs(diffPercent) <= 3 ? 'neutral'
                               : diffPercent > 0 ? 'pos'
                               : 'neg';
                }
            }
        }

        // Обновляем глобальное состояние
        State.history.unshift(record);
        State.calcTotalXP();               // ← гарантируем консистентность XP
        State.currentSession = [];
        State.save();

        UI.showResult(record, totalXP, diffType, diffPercent);
        UI.renderAll();
    },

    // -----------------------------------------------------------------
    //  Удаление отдельного подхода из текущей сессии
    // -----------------------------------------------------------------
    deleteSet(id) {
        State.currentSession = State.currentSession.filter(s => s.id !== id);
        State.save();
        UI.renderSession();
        UI.updateNavBadge();
    },

    // -----------------------------------------------------------------
    //  Удаление записи из истории
    // -----------------------------------------------------------------
    deleteHistoryItem(index) {
        if (confirm('Удалить запись из истории? Прогресс будет пересчитан.')) {
            State.history.splice(index, 1);
            State.calcTotalXP();
            State.save();
            UI.renderAll();
        }
    },

    // -----------------------------------------------------------------
    //  Полный сброс (вызывается из UI)
    // -----------------------------------------------------------------
    safeReset() {
        State.safeReset();
    }
};