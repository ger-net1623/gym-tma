/** -------------------------------------------------------------
 *  Logic – бизнес‑логика приложения
 * ------------------------------------------------------------- */
const Logic = {
    /** ---------------------------------------------------------
     *  Универсальный алерт (Telegram‑WebApp → alert)
     * --------------------------------------------------------- */
    showAlert(msg) {
        if (
            window.Telegram &&
            window.Telegram.WebApp &&
            window.Telegram.WebApp.showAlert
        ) {
            window.Telegram.WebApp.showAlert(msg);
        } else {
            alert(msg);
        }
    },

    // -----------------------------------------------------------------
    //  Сохранение/обновление профиля
    // -----------------------------------------------------------------
    saveProfile(isSetup) {
        const prefix = isSetup ? "setup-" : "prof-";

        const wInput = document.getElementById(prefix + "weight");
        const hInput = document.getElementById(prefix + "height");
        const aInput = document.getElementById(prefix + "age");
        const gInput = document.getElementById(prefix + "gender");
        const glInput = document.getElementById(prefix + "goal");

        // Проверяем наличие всех полей (включая gender/goal)
        if (!wInput || !hInput || !aInput || !gInput || !glInput) {
            return this.showAlert(
                "Ошибка интерфейса: не найдены все поля профиля"
            );
        }

        const w = parseFloat(wInput.value);
        const h = parseFloat(hInput.value);
        const a = parseFloat(aInput.value);
        const gender = gInput.value;
        const goal = glInput.value;

        const hasError = [w, h, a].some(v => Number.isNaN(v) || v <= 0);
        if (hasError) {
            return this.showAlert("Заполни все поля корректно!");
        }

        // Сохраняем профиль в глобальное состояние
        State.profile = { weight: w, height: h, age: a, gender, goal };
        State.save(); // debounce‑сохранение

        if (isSetup) {
            // Переходим к главному приложению
            UI.showScreen("main-app");
            UI.switchTab("tab-hero", document.querySelector(".nav-item"));
            UI.renderAll(); // герой + история + текущая сессия
        } else {
            this.showAlert("Профиль обновлён");
            UI.renderHero();
        }
    },

    // -----------------------------------------------------------------
    //  Добавление подхода (set)
    // -----------------------------------------------------------------
    addSet() {
        const catSelect = document.getElementById("select-cat");
        const exSelect = document.getElementById("select-ex");

        if (!catSelect || !exSelect) {
            return this.showAlert("Выберите категорию и упражнение");
        }

        const catKey = catSelect.value;
        const exIdx = parseInt(exSelect.value, 10);

        // Защитим от неверных категорий / индексов
        const catExercises = DB.EXERCISES[catKey];
        if (!catExercises || !catExercises[exIdx]) {
            return this.showAlert("Упражнение не найдено");
        }

        const [name, type, mult = 1, flags = {}] = catExercises[exIdx];
        const safeBodyWeight =
            State.profile && State.profile.weight
                ? Math.max(1, State.profile.weight)
                : 1;

        let w = 0,
            r = 0,
            kcal = 0,
            vol = 0,
            xp = 0;

        // -------------------------------------------------------------
        //  Кардио
        // -------------------------------------------------------------
        if (type === 3) {
            const intensityEl = document.getElementById(
                "input-cardio-intensity"
            );
            const timeEl = document.getElementById("input-cardio-time");

            if (!intensityEl || !timeEl) {
                return this.showAlert(
                    "Ошибка интерфейса (кардио‑контролы не найдены)"
                );
            }

            const intensity = intensityEl.value;
            const duration = parseFloat(timeEl.value);

            if (!duration || duration <= 0) {
                return this.showAlert("Укажи время!");
            }

            const coeffs = DB.MET_CARDIO[name] || {};
            const met =
                coeffs[intensity] ??
                Object.values(coeffs)[0] ??
                1; // fallback = 1

            kcal = (met * 3.5 * safeBodyWeight / 200) * duration;
            xp = Math.round(kcal * 1.5);
            r = duration; // minutes – для UI
            vol = duration; // placeholder, нужен только для совместимости
        }
        // -------------------------------------------------------------
        //  Силовые упражнения
        // -------------------------------------------------------------
        else {
            const wEl = document.getElementById("input-w");
            const rEl = document.getElementById("input-r");

            if (!wEl || !rEl) {
                return this.showAlert(
                    "Ошибка интерфейса (силовые контролы не найдены)"
                );
            }

            w = parseFloat(wEl.value) || 0;
            r = parseFloat(rEl.value);

            if (Number.isNaN(r) || r <= 0) {
                return this.showAlert("Укажи количество повторений!");
            }

            // Тоннаж
            if (type === 1) {
                // собственный вес
                vol = (safeBodyWeight + w) * r;
            } else {
                const load = mult === 2 ? w * 2 : w;
                vol = load * r;
            }

            // MET‑расчёт (упрощённый, но ограниченный)
            const workingWeight = type === 1 ? safeBodyWeight : w;
            const intensityRatio = Math.max(
                0.3,
                Math.min(1.5, workingWeight / safeBodyWeight)
            );
            let MET = 3.5 + intensityRatio * 1.7;
            MET = Math.min(MET, 6);
            const minutes = type === 2 ? r / 60 : (r * 3) / 60;
            kcal = (MET * 3.5 * safeBodyWeight / 200) * minutes;
            if (kcal < 2) kcal = 2;

            const liftXP = type === 1 ? r * 2.5 : vol / 15 + w * 0.4;
            xp = Math.round(liftXP + kcal);
        }

        // -------------------------------------------------------------
        //  PR‑проверка (по весу) – только для силовых
        // -------------------------------------------------------------
        if (type !== 3 && w > (State.personalRecords[name] || 0)) {
            State.personalRecords[name] = w;
            UI.showToast(`🏆 Новый рекорд: ${w} кг!`);
            try {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred(
                    "success"
                );
            } catch (_) {
                // игнорируем отсутствие haptic‑feedback
            }
        }

        // -------------------------------------------------------------
        //  Сохраняем подход в текущую сессию
        // -------------------------------------------------------------
        State.lastExName = name; // запоминаем последнее упражнение
        State.currentSession.unshift({
            id:
                typeof crypto !== "undefined" && crypto.randomUUID
                    ? crypto.randomUUID()
                    : Date.now() + "_" + Math.random(),
            name,
            vol,
            kcal: Math.round(kcal),
            xp,
            w,
            r,
            type
        });
        State.save(); // debounce‑сохранение

        // haptic‑feedback при успешном добавлении
        try {
            window.Telegram.WebApp.HapticFeedback.impactOccurred("medium");
        } catch (_) {
            // игнорируем, если недоступно
        }

        // Обновляем UI
        UI.adaptInputs();

        // Очищаем вводы (оставляем вес, чтобы можно быстро добавить ещё один сет)
        if (type === 3) {
            const timeEl = document.getElementById("input-cardio-time");
            const intensityEl = document.getElementById(
                "input-cardio-intensity"
            );
            if (timeEl) timeEl.value = "";
            if (intensityEl) intensityEl.selectedIndex = 0;
        } else {
            const rEl = document.getElementById("input-r");
            if (rEl) rEl.value = "";
        }

        UI.renderSession();
        UI.updateNavBadge();
    },

    // -----------------------------------------------------------------
    //  Завершение текущей тренировки
    // -----------------------------------------------------------------
    finishWorkout() {
        if (State.currentSession.length === 0) {
            return this.showAlert("Нет подходов для сохранения");
        }

        const hasCardio = State.currentSession.some(s => s.type === 3);
        const hasStrength = State.currentSession.some(s => s.type !== 3);
        const sessionType = hasCardio && !hasStrength ? "cardio" : "strength";

        const totalVol = State.currentSession.reduce(
            (sum, s) => sum + s.vol,
            0
        );
        const totalKcalRaw = State.currentSession.reduce(
            (sum, s) => sum + s.kcal,
            0
        );
        const totalXP = State.currentSession.reduce(
            (sum, s) => sum + s.xp,
            0
        );
        const cardioMins = State.currentSession
            .filter(s => s.type === 3)
            .reduce((sum, s) => sum + s.r, 0);
        const strengthSets = State.currentSession.filter(
            s => s.type !== 3
        ).length;

        // Приблизительное время занятия (минуты)
        const AVG_SET_TIME = 2.5; // мин на один силовой подход
        const sessionMinutes = Math.round(
            cardioMins + strengthSets * AVG_SET_TIME
        );

        // ---------- БОНУС КАЛОРИЙ ЗА ВРЕМЯ В ЗАЛЕ ----------
        const baseMET = 3.0;
        const bodyWeight = State.profile?.weight || 80;
        const sessionKcalBonus =
            (baseMET * 3.5 * bodyWeight / 200) * sessionMinutes;
        const totalKcal = Math.round(totalKcalRaw + sessionKcalBonus);
        // -------------------------------------------------

        const record = {
            date: Date.now(),
            dateStr: new Date().toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "short"
            }),
            vol: totalVol,
            kcal: totalKcal,
            xp: totalXP,
            time: sessionMinutes,
            type: sessionType
        };

        // ---------- Сравнение с предыдущей тренировкой ----------
        let diffPercent = 0;
        let diffType = "neutral";

        if (State.history.length > 0) {
            const prev = State.history.find(h => h.type === sessionType);
            if (prev) {
                const currVal =
                    sessionType === "cardio" ? record.time : record.vol;
                const prevVal =
                    sessionType === "cardio" ? prev.time : prev.vol;
                if (prevVal > 0) {
                    diffPercent = ((currVal - prevVal) / prevVal) * 100;
                    diffType = Math.abs(diffPercent) <= 3
                        ? "neutral"
                        : diffPercent > 0
                        ? "pos"
                        : "neg";
                }
            }
        }

        // Обновляем глобальное состояние
        State.history.unshift(record);
        State.calcTotalXP(); // гарантируем консистентность XP
        State.currentSession = [];
        State.save();

        UI.showResult(record, totalXP, diffType, diffPercent);
        UI.renderAll();
    },

    // -----------------------------------------------------------------
    //  Удаление отдельного подхода из текущей сессии
    // -----------------------------------------------------------------
    deleteSet(id) {
        State.currentSession = State.currentSession.filter(
            s => s.id !== id
        );
        State.save();
        UI.renderSession();
        UI.updateNavBadge();
    },

    // -----------------------------------------------------------------
    //  Удаление записи из истории
    // -----------------------------------------------------------------
    deleteHistoryItem(index) {
        if (confirm("Удалить запись из истории? Прогресс будет пересчитан.")) {
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