'use strict';
/** -------------------------------------------------------------
 *  Logic – бизнес‑логика приложения
 * ------------------------------------------------------------- */
const Logic = {
    /** Универсальный алерт (Telegram‑WebApp если доступен) */
    showAlert(msg) {
        const tg = window.Telegram?.WebApp;
        if (tg && tg.showAlert) tg.showAlert(msg);
        else alert(msg);
    },

    /** ---------------------------------------------------------
     *  Константы
     * --------------------------------------------------------- */
    ISOMETRIC_XP_PER_SECOND: 0.2,

    /** ---------------------------------------------------------
     *  BMR – базовый метаболизм (для расчётов калорий)
     * --------------------------------------------------------- */
    _bmr({ weight, height, age, gender }) {
        const base = 10 * weight + 6.25 * height - 5 * age;
        return gender === "female" ? base - 161 : base + 5;
    },

    /** ---------------------------------------------------------
     *  Фактор нагрузки для разных групп мышц
     * --------------------------------------------------------- */
    _getMuscleFactor(catKey) {
        const factors = {
            legs:      1.5,
            back:      1.3,
            chest:     1.2,
            shoulders: 1.0,
            arms:      0.9,
            abs:       0.8,
            cardio:   1.0
        };
        return factors[catKey] ?? 1.0;
    },

    /** ---------------------------------------------------------
     *  Ккал для силовых упражнений (улучшенная MET‑модель)
     *  MET = 4.5 + 1.5 × loadFactor
     *  totalEffectiveMinutes = активные секунды + фиксированные 1.5 мин отдыха
     * --------------------------------------------------------- */
    _calcStrengthKcal({ userWeight, totalIronWeight, reps, catKey }) {
        const activeMinutes = (reps * 3) / 60;               // 3 сек на повтор
        const recoveryMinutes = 1.5;                         // время «отдыха» между подходами
        const totalEffectiveMinutes = activeMinutes + recoveryMinutes;

        const loadFactor = totalIronWeight > 0 ? totalIronWeight / userWeight : 0;
        const MET = 4.5 + 1.5 * loadFactor;                  // более «тяжёлый» MET

        const kcal = Math.round(MET * userWeight * (totalEffectiveMinutes / 60));
        return Math.max(kcal, 5); // минимум 5 kcal, чтобы не было «0»
    },

    /** ---------------------------------------------------------
     *  Ккал для кардио‑упражнений
     * --------------------------------------------------------- */
    _calcCardioKcal({ name, intensity, minutes, userWeight }) {
        const coeffs = DB.MET_CARDIO[name] ?? {};
        const MET = coeffs[intensity] ?? 6;   // fallback – умеренное кардио
        return Math.round(MET * userWeight * (minutes / 60));
    },

    /** ---------------------------------------------------------
     *  Сохранение профиля (онбординг или изменение)
     * --------------------------------------------------------- */
    saveProfile(isSetup) {
        const prefix = isSetup ? "setup-" : "prof-";
        const wInput = document.getElementById(prefix + "weight");
        const hInput = document.getElementById(prefix + "height");
        const aInput = document.getElementById(prefix + "age");
        const gInput = document.getElementById(prefix + "gender");
        const glInput = document.getElementById(prefix + "goal");

        if (!wInput || !hInput || !aInput || !gInput || !glInput) {
            return this.showAlert("Ошибка интерфейса");
        }

        const w = parseFloat(wInput.value);
        const h = parseFloat(hInput.value);
        const a = parseFloat(aInput.value);
        const gender = gInput.value;
        const goal = glInput.value;

        if ([w, h, a].some(v => Number.isNaN(v) || v <= 0)) {
            return this.showAlert("Заполни все поля корректно!");
        }

        State.profile = { weight: w, height: h, age: a, gender, goal };
        State.save();

        if (isSetup) {
            UI.showScreen("main-app");
            UI.populateCategories();               // сразу показываем упражнения
            UI.switchTab("tab-hero", document.querySelector(".nav-item"));
            UI.renderAll();
        } else {
            this.showAlert("Профиль обновлён");
            UI.renderHero();
        }
    },

    /** ---------------------------------------------------------
     *  Добавление одного подхода/сета
     * --------------------------------------------------------- */
    addSet() {
        const catSelect = document.getElementById("select-cat");
        const exSelect  = document.getElementById("select-ex");
        if (!catSelect || !exSelect) return this.showAlert("Ошибка выбора");

        const catKey = catSelect.value;
        const exIdx  = parseInt(exSelect.value, 10);
        const exerciseData = DB.EXERCISES[catKey]?.[exIdx];
        if (!exerciseData) return this.showAlert("Упражнение не найдено");

        const [name, type, , flags = {}] = exerciseData;
        const {
            optionalWeight = false,
            doubleWeight   = false,
            requiresWeight = false,
            mach           = false,
            uni            = false
        } = flags;

        const profile = State.profile;
        if (!profile) return this.showAlert("Сначала задайте профиль");

        const userWeight = Math.max(1, profile.weight);

        // ---------- элементы ввода ----------
        const wEl   = document.getElementById("input-w");
        const rEl   = document.getElementById("input-r");
        const cardioIntensityEl = document.getElementById("input-cardio-intensity");
        const cardioTimeEl      = document.getElementById("input-cardio-time");

        // ---------- кардио ----------
        if (type === 3) {
            const cardioMinutes   = parseFloat(cardioTimeEl?.value) || 0;
            if (cardioMinutes <= 0) return this.showAlert("Укажите время (мин)!");

            const intensity = parseInt(cardioIntensityEl?.value, 10) || 3;
            const kcal = this._calcCardioKcal({
                name,
                intensity,
                minutes: cardioMinutes,
                userWeight
            });
            const xp = Math.round(kcal * 0.8);   // небольшая корректировка XP

            const setObj = {
                id: Date.now() + "_" + Math.random(),
                name,
                vol: cardioMinutes,          // показываем как «объём» (минуты)
                kcal,
                xp,
                w: 0,
                r: cardioMinutes,
                type,
                epoc: 0,
                isPR: false
            };
            State.lastExName = name;
            State.currentSession.unshift(setObj);
            State.save();

            // UI‑обновление
            UI.adaptInputs();               // очистит поле времени
            cardioTimeEl.value = "";        // ОЧИСТКА
            UI.renderSession();
            UI.updateNavBadge();
            try { window.Telegram.WebApp.HapticFeedback.impactOccurred("medium"); } catch (_) {}
            return;                         // завершили кардио‑ветку
        }

        // ---------- силовые / изометрия ----------
        const inputWeight = parseFloat(wEl?.value) || 0;
        const repsOrSec   = parseFloat(rEl?.value) || 0;

        if (repsOrSec <= 0) return this.showAlert("Укажите повторения/секунды!");

        const weightMandatory = requiresWeight && !optionalWeight && !mach && type !== 1;
        if (weightMandatory && inputWeight <= 0) {
            return this.showAlert("Укажите вес!");
        }

        // Полный вес железа (с учётом doubleWeight)
        let totalIronWeight = 0;
        if (inputWeight > 0) {
            totalIronWeight = doubleWeight ? inputWeight * 2 : inputWeight;
        }

        // 2️⃣ Объём
        let volumeStats = 0;
        if (type === 2) {
            volumeStats = totalIronWeight > 0 ? totalIronWeight : 0;
        } else {
            volumeStats = totalIronWeight * repsOrSec;
        }

        // 3️⃣ Ккал (вызываем улучшенную функцию)
        const kcal = this._calcStrengthKcal({
            userWeight,
            totalIronWeight,
            reps: repsOrSec,
            catKey
        });

        // 4️⃣ EPOC (10 % от сожжённых ккал)
        const epocKcal = type === 3 ? 0 : Math.round(kcal * 0.1);

        // 5️⃣ XP (включаем учёт флага uni, а также бонус за тяжёлый вес)
        let xp = 0;
        // переменная должна быть объявлена **вынесенно**, иначе будет out‑of‑scope
        let isPR = false;

        if (type === 3) {
            xp = Math.round(kcal * 0.8);
        } else if (type === 2) {
            xp = Math.round(repsOrSec * this.ISOMETRIC_XP_PER_SECOND);
            if (totalIronWeight > 0) xp += Math.round(totalIronWeight * 0.2);
        } else {
            // эффективный вес = железо + часть собственного веса (0.3 или 0.5 при uni)
            const bodyFactor = uni ? 0.5 : 0.3;
            const effectiveWeight = totalIronWeight + (userWeight * bodyFactor);
            const workIndex = effectiveWeight * repsOrSec;
            xp = Math.round(workIndex / 40);
            if (totalIronWeight > userWeight) xp += 10;

            // ---------- PR‑логика ----------
            const prevRecord = State.personalRecords?.[name]?.w ?? 0;
            const effectivePRWeight = doubleWeight ? inputWeight * 2 : inputWeight;
            if (effectivePRWeight > prevRecord && effectivePRWeight > 0) {
                // PR ещё не был зафиксирован в текущей сессии (prevRecord из глобального state)
                // поэтому бонус выдаётся только при настоящем улучшении.
                xp += 25;
                isPR = true;
                State.personalRecords[name] = { w: effectivePRWeight, r: repsOrSec };
                UI.showToast(`🏆 Новый рекорд: ${effectivePRWeight} кг!`);
                try { window.Telegram.WebApp.HapticFeedback.notificationOccurred("success"); } catch (_) {}
            }

            if (xp < 5) xp = 5;
        }

        // 6️⃣ Сохранение сета
        State.lastExName = name;
        const setObj = {
            id: Date.now() + "_" + Math.random(),
            name,
            vol: volumeStats,
            kcal,
            xp,
            w: inputWeight,
            r: repsOrSec,
            type,
            epoc: epocKcal,
            isPR
        };
        State.currentSession.unshift(setObj);
        State.save();

        // 7️⃣ UI‑обновление
        try { window.Telegram.WebApp.HapticFeedback.impactOccurred("medium"); } catch (_) {}
        UI.adaptInputs();               // очистит поля‑повторов, оставит вес (чтобы не вводить каждый раз)
        rEl.value = "";                  // ОЧИСТКА повторов
        UI.renderSession();
        UI.updateNavBadge();
    },

    /** ---------------------------------------------------------
     *  Завершение тренировки
     * --------------------------------------------------------- */
    finishWorkout() {
        // ------- 1️⃣ Защита от пустой сессии -------
        if (State.currentSession.length === 0) {
            return this.showAlert('Пустая тренировка');
        }

        const sessionSets = State.currentSession;

        // ------- 2️⃣ Подсчёт минут кардио и «силовых» -------
        const cardioMins = sessionSets
            .filter(s => s.type === 3)
            .reduce((sum, s) => sum + s.r, 0);

        const strengthMins = sessionSets
            .filter(s => s.type !== 3)
            .reduce((sum, s) => sum + (s.r * 3) / 60, 0);   // 3 сек на повтор → 3 мин на подход

        const sessionType = cardioMins > strengthMins ? 'cardio' : 'strength';

        // ------- 3️⃣ Суммарные показатели -------
        const totalVol   = sessionSets.reduce((a, s) => a + s.vol,   0); // объём (кг‑мин или кг)
        const totalKcal  = sessionSets.reduce((a, s) => a + s.kcal,  0); // потраченные ккал
        const totalXP    = sessionSets.reduce((a, s) => a + s.xp,    0); // XP
        const totalTime  = Math.round(
            cardioMins +                                     // минуты кардио
            sessionSets.filter(s => s.type !== 3).length * 3   // 3 мин на каждый силовой сет
        );

        // ------- 4️⃣ EPOC (пост‑тренировочный расход) -------
        // Если в тренировке были любые силовые упражнения → берём 12 % от калорий;
        // если только кардио → берём более скромный коэффициент 5 %.
        const epocFactor = sessionSets.some(s => s.type !== 3) ? 0.12 : 0.05;
        const totalEPOC  = Math.round(totalKcal * epocFactor);

        // ------- 5️⃣ Формируем запись истории -------
        const record = {
            date: Date.now(),
            dateStr: new Date().toLocaleDateString('ru-RU', {
                day:   'numeric',
                month: 'short'
            }),
            vol:   totalVol,
            kcal:  totalKcal,
            xp:    totalXP,
            time:  totalTime,
            epoc:  totalEPOC,
            type:  sessionType
        };

        // ------- 6️⃣ Сравнение с предыдущей тренировкой того же типа -------
        let diffPercent = 0;
        let diffType    = 'neutral';
        const prev = State.history.find(h => h.type === sessionType);
        if (prev) {
            const curVal  = sessionType === 'cardio' ? record.time : record.vol;
            const prevVal = sessionType === 'cardio' ? prev.time  : prev.vol;
            if (prevVal > 0) {
                diffPercent = ((curVal - prevVal) / prevVal) * 100;
                if (Math.abs(diffPercent) > 2) {
                    diffType = diffPercent > 0 ? 'pos' : 'neg';
                }
            }
        }

        // ------- 7️⃣ Сохраняем в историю и очищаем текущую сессию -------
        State.history.unshift(record);
        State.calcTotalXP();          // пересчитываем общий XP
        State.currentSession = [];    // чистим текущую тренировку
        State.save();

        // ------- 8️⃣ Обновляем UI -------
        UI.showResult(record, totalXP, diffType, diffPercent);
        UI.renderAll();               // герой, история, бейдж и т.д.
    },

    /** ---------------------------------------------------------
     *  Удаление отдельного подхода
     * --------------------------------------------------------- */
    deleteSet(id) {
        const removedSet = State.currentSession.find(s => s.id === id);
        State.currentSession = State.currentSession.filter(s => s.id !== id);

        // Обновляем PR‑записи, если удалённый сет был рекордом
        if (removedSet?.isPR) {
            const exName = removedSet.name;
            const allSets = [...State.currentSession];
            let maxWeight = 0;
            const findFlags = (name) => {
                for (const catKey in DB.EXERCISES) {
                    for (const ex of DB.EXERCISES[catKey]) {
                        if (ex[0] === name) return ex[3] || {};
                    }
                }
                return {};
            };
            for (const s of allSets) {
                if (s.name !== exName) continue;
                const flags = findFlags(s.name);
                const effective = flags.doubleWeight ? s.w * 2 : s.w;
                if (effective > maxWeight) maxWeight = effective;
            }
            if (maxWeight > 0) State.personalRecords[exName] = { w: maxWeight };
            else delete State.personalRecords[exName];
        }

        State.save();
        UI.renderSession();
        UI.updateNavBadge();
    },

    /** ---------------------------------------------------------
     *  Удаление записи из истории
     * --------------------------------------------------------- */
    deleteHistoryItem(index) {
        if (confirm("Удалить запись?")) {
            State.history.splice(index, 1);
            State.calcTotalXP();
            State.save();
            UI.renderAll();
        }
    },

    /** ---------------------------------------------------------
     *  Полный «безопасный» сброс
     * --------------------------------------------------------- */
    safeReset() {
        State.safeReset();
    }
};