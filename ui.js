'use strict';
/** -------------------------------------------------------------
 *  UI – функции отрисовки и взаимодействия
 * ------------------------------------------------------------- */
const UI = {
    /** ---------------------------------------------------------
     *  Экранирование пользовательского ввода (для innerHTML)
     * --------------------------------------------------------- */
    _esc(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    },

    /** ---------------------------------------------------------
     *  BackButton‑handler Telegram‑WebApp (одна ссылка)
     * --------------------------------------------------------- */
    _currentHandler: null,

    /** ---------------------------------------------------------
     *  Человекочитаемые подписи интенсивности кардио
     * --------------------------------------------------------- */
    _CARDIO_INTENSITY_LABELS: {
        "3":  "Лёгкая",
        "5":  "Лёгкая",
        "6":  "Средняя",
        "7":  "Средняя",
        "9":  "Тяжёлая",
        "11": "Очень тяжёлая"
    },

    /** ---------------------------------------------------------
     *  Показ/скрытие экранов
     * --------------------------------------------------------- */
    showScreen(id) {
        document.querySelectorAll(".screen").forEach(s => {
            s.classList.remove("active-screen", "hidden");
        });

        const screen = document.getElementById(id);
        if (screen) screen.classList.add("active-screen");

        // BackButton handling
        try {
            const tg = window.Telegram?.WebApp;
            if (tg && tg.BackButton) {
                const bb = tg.BackButton;

                // Убираем старый обработчик
                if (this._currentHandler) {
                    try { bb.offClick(this._currentHandler); } catch (_) {}
                    this._currentHandler = null;
                }

                if (id === "main-app" || id === "screen-onboarding") {
                    bb.hide();
                } else {
                    this._currentHandler = () => {
                        if (document.getElementById("screen-result")
                            .classList.contains("active-screen")) {
                            UI.closeResult();
                        } else if (document.getElementById("screen-profile-setup")
                            .classList.contains("active-screen")) {
                            State.profile ? UI.showScreen("main-app")
                                          : UI.showScreen("screen-onboarding");
                        } else {
                            UI.showScreen("main-app");
                        }
                    };
                    bb.onClick(this._currentHandler);
                    bb.show();
                }
            }
        } catch (e) {
            console.warn("BackButton error:", e);
        }
    },

    /** ---------------------------------------------------------
     *  Формы ввода при онбординге
     * --------------------------------------------------------- */
    renderSetupInputs() {
        const container = document.getElementById("setup-inputs-container");
        if (!container) return;
        container.innerHTML = `
            <div class="input-row">
                <div class="input-group">
                    <label class="input-label">Вес (кг)</label>
                    <input type="number" id="setup-weight"
                           placeholder="80" inputmode="decimal" aria-label="Вес в килограммах">
                </div>
                <div class="input-group">
                    <label class="input-label">Рост (см)</label>
                    <input type="number" id="setup-height"
                           placeholder="175" inputmode="numeric" aria-label="Рост в сантиметрах">
                </div>
            </div>
            <div class="input-row">
                <div class="input-group">
                    <label class="input-label">Возраст</label>
                    <input type="number" id="setup-age"
                           placeholder="25" inputmode="numeric" aria-label="Возраст">
                </div>
                <div class="input-group">
                    <label class="input-label">Пол</label>
                    <select id="setup-gender" aria-label="Пол">
                        <option value="male">Мужчина</option>
                        <option value="female">Женщина</option>
                    </select>
                </div>
            </div>

            <label class="input-label">Цель</label>
            <select id="setup-goal" aria-label="Цель тренировок">
                <option value="strength">Сила</option>
                <option value="muscle">Масса</option>
                <option value="health">Здоровье</option>
                <option value="fatloss">Похудение</option>
            </select>
        `;
    },

    /** ---------------------------------------------------------
     *  Переключение табов
     * --------------------------------------------------------- */
    switchTab(tabId, navEl) {
        document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active-tab"));
        const tab = document.getElementById(tabId);
        if (tab) tab.classList.add("active-tab");

        document.querySelectorAll(".nav-item").forEach(n => {
            n.classList.remove("active");
            n.setAttribute("aria-selected", "false");
        });
        if (navEl) {
            navEl.classList.add("active");
            navEl.setAttribute("aria-selected", "true");
        }

        window.scrollTo({ top: 0, behavior: "smooth" });

        if (tabId === "tab-hero") this.renderHero();
        if (tabId === "tab-train") this.renderSession();
        if (tabId === "tab-stats") this.renderHistory();
        if (tabId === "tab-settings") this.fillProfileInputs();
    },

    /** ---------------------------------------------------------
     *  Заполнение списка категорий (один раз)
     * --------------------------------------------------------- */
    populateCategories() {
        const catSelect = document.getElementById("select-cat");
        if (!catSelect) return;

        catSelect.innerHTML = Object.entries(DB.CATS)
            .map(([k, v]) => `<option value="${k}">${this._esc(v)}</option>`)
            .join("");
        catSelect.selectedIndex = 0;

        this._fillExerciseSelect();    // сразу показываем упражнения первой категории
    },

    /** ---------------------------------------------------------
     *  Обновление списка упражнений (по выбранной категории)
     * --------------------------------------------------------- */
    updateExList() {
        this._fillExerciseSelect();
    },

    /** ---------------------------------------------------------
     *  Внутренний метод – заполняет <select id="select-ex">
     * --------------------------------------------------------- */
    _fillExerciseSelect() {
        const catSelect = document.getElementById("select-cat");
        const exSelect = document.getElementById("select-ex");
        if (!catSelect || !exSelect) return;

        const cat = catSelect.value;
        const list = DB.EXERCISES[cat] || [];

        exSelect.innerHTML = list
            .map((ex, idx) => `<option value="${idx}">${this._esc(ex[0])}</option>`)
            .join("");
        exSelect.selectedIndex = 0;

        this.adaptInputs();
    },

    /** ---------------------------------------------------------
     *  Адаптация полей ввода под тип упражнения
     * --------------------------------------------------------- */
    adaptInputs() {
        const catSelect = document.getElementById("select-cat");
        const exSelect = document.getElementById("select-ex");
        if (!catSelect || !exSelect) return;

        const cat = catSelect.value;
        const exIdx = parseInt(exSelect.value, 10);
        const exData = DB.EXERCISES[cat]?.[exIdx];
        if (!exData) return;

        const [name, type, , flags = {}] = exData;
        const {
            optionalWeight = false,
            doubleWeight   = false,
            mach           = false,
            uni            = false
        } = flags;

        // ---- PR‑бэйдж ----
        const prEl = document.getElementById("pr-display");
        const prRecord = State.personalRecords?.[name]?.w ?? 0;
        if (prEl) {
            if (type !== 3 && prRecord > 0) {
                prEl.textContent = `🏆 PR: ${prRecord} кг`;
                prEl.classList.add("visible");
            } else {
                prEl.classList.remove("visible");
            }
        }

        // ---- Хинты ----
        const hintContainer = document.getElementById("hints-container");
        const hints = [];
        if (doubleWeight) hints.push("🏋️‍♂️ Вводи вес одной гантели (будет удвоен).");
        if (optionalWeight) hints.push("⚖️ Дополнительный вес не обязателен.");
        if (uni) hints.push("🦵 Упражнение на одну сторону.");
        if (mach) hints.push("🤖 Тренажёр – вес тела не учитывается.");
        if (type === 1 || name === "Планка") hints.push("⚖️ Вес тела учитывается.");

        hintContainer.innerHTML = "";
        hints.forEach(txt => {
            const div = document.createElement("div");
            div.className = "hint-block visible";
            div.textContent = txt;
            hintContainer.appendChild(div);
        });
        if (hints.length > 2) {
            hintContainer.style.maxHeight = "120px";
            hintContainer.style.overflowY = "auto";
        } else {
            hintContainer.style.maxHeight = "";
            hintContainer.style.overflowY = "";
        }

        // ---- Показ/скрытие блоков ввода ----
        const strengthBlock = document.getElementById("input-container-strength");
        const cardioBlock   = document.getElementById("input-container-cardio");

        strengthBlock.classList.toggle("hidden", type === 3);
        cardioBlock.classList.toggle("hidden", type !== 3);

        const wInput = document.getElementById("input-w");
        const rInput = document.getElementById("input-r");
        const cardioIntensity = document.getElementById("input-cardio-intensity");
        const cardioTime = document.getElementById("input-cardio-time");

        if (type === 3) {
            wInput.disabled = true;
            rInput.disabled = true;
            cardioIntensity.disabled = false;
            cardioTime.disabled = false;
        } else {
            wInput.disabled = false;
            rInput.disabled = false;
            cardioIntensity.disabled = true;
            cardioTime.disabled = true;
        }

        // ---- Текст подписи полей ----
        const textW = document.getElementById("text-w-label");
        const labelR = document.getElementById("label-r");
        if (textW) {
            if (doubleWeight) textW.textContent = "Вес одной гантели (кг)";
            else textW.textContent = (type === 2 || type === 1) ? "Доп. вес (кг)" : "Вес (кг)";
        }
        if (labelR) labelR.textContent = type === 2 ? "Время (сек)" : "Повторы";

        // ---- Очистка полей при смене упражнения ----
        if (State.lastExName !== name) {
            if (wInput) wInput.value = "";
            if (rInput) rInput.value = "";
            if (cardioTime) cardioTime.value = "";
        }

        // ---- Кардио‑интенсивность (читаем подписи) ----
        if (type === 3) {
            const iSelect = document.getElementById("input-cardio-intensity");
            const coeffMap = DB.MET_CARDIO[name] ?? {};
            const keys = Object.keys(coeffMap);
            if (keys.length === 0) {
                // fallback – простая шкала от 3 до 11
                iSelect.innerHTML = [3, 6, 9, 11]
                    .map(v => `<option value="${v}" ${v===3?"selected":""}>${v}</option>`)
                    .join("");
            } else {
                iSelect.innerHTML = keys
                    .map((val, idx) => {
                        const label = this._CARDIO_INTENSITY_LABELS[val] ?? val;
                        return `<option value="${val}" ${idx===0?"selected":""}>${label}</option>`;
                    })
                    .join("");
            }
            // Если пользователь оставил «старое» значение – ставим первое
            const current = iSelect.value;
            if (!keys.includes(String(current))) iSelect.value = keys[0] || "3";
        }

        // ---- Фокус ввода (нежный UX) ----
        setTimeout(() => {
            if (type === 3) cardioTime?.focus();
            else if (rInput && !rInput.disabled) rInput.focus();
        }, 100);
    },

    /** ---------------------------------------------------------
     *  Текущая сессия (вкладка «Зал»)
     * --------------------------------------------------------- */
    renderSession() {
        const curBlock = document.getElementById("current-session-block");
        if (State.currentSession.length > 0) {
            curBlock.classList.remove("hidden");
            const curXP = State.currentSession.reduce((a, c) => a + c.xp, 0);
            document.getElementById("session-title")
                .textContent = `Сейчас: +${Math.round(curXP)} XP`;

            const html = State.currentSession.map(s => `
                <div class="list-item">
                    <div>
                        <b>${this._esc(s.name)}</b>
                        <div style="font-size:12px; opacity:0.7">
                            ${s.type === 3 ? s.r + " мин" :
                              (s.type === 2 ? s.r + " сек" :
                               (s.w > 0 ? s.w + " кг × " : "") + s.r)}
                        </div>
                    </div>
                    <div style="text-align:right; display:flex; align-items:center;">
                        <span style="color:var(--gold); font-weight:bold">+${s.xp} XP</span>
                        ${s.isPR ? '<span class="diff-badge diff-pos">PR +25</span>' : ''}
                        <div class="del-btn"
                             data-action="deleteSet"
                             data-args='["${s.id}"]' aria-label="Удалить сет">✕</div>
                    </div>
                </div>`).join("");
            document.getElementById("current-list").innerHTML = html;
        } else {
            curBlock.classList.add("hidden");
        }
    },

    /** ---------------------------------------------------------
     *  История тренировок
     * --------------------------------------------------------- */
    renderHistory() {
        const list = document.getElementById("history-list");
        if (State.history.length === 0) {
            list.innerHTML = '<div class="empty-state">Пока пусто…</div>';
            return;
        }

        const html = State.history.map((h, i) => {
            const emoji = h.type === "cardio" ? "🏃" : "🏋️‍♂️";
            const detail = h.type === "cardio" ? `${h.time} мин` : `${h.vol} кг`;
            return `
                <div class="list-item">
                    <div>
                        <div style="font-weight:600">${emoji} ${this._esc(h.dateStr)}</div>
                        <div style="font-size:12px; opacity:0.7">${detail}</div>
                    </div>
                    <div style="text-align:right">
                        <div style="color:var(--gold); font-weight:bold">+${Math.round(h.xp)} XP</div>
                        <div style="font-size:10px; opacity:0.5; color:var(--red); margin-top:4px;"
                             data-action="deleteHistoryItem"
                             data-args='[${i}]' aria-label="Удалить запись из истории">удалить</div>
                    </div>
                </div>`;
        }).join("");
        list.innerHTML = html;
    },

    /** ---------------------------------------------------------
     *  Герой (уровень, XP, параметры)
     * --------------------------------------------------------- */
    renderHero() {
        if (!State.profile) return;

        const totalXP = State.totalXP;
        let rank = "Яйцо", icon = "🥚", next = 500, lvl = 1;
        for (let i = 0; i < DB.LEVELS.length; i++) {
            if (totalXP >= DB.LEVELS[i].xp) {
                rank = DB.LEVELS[i].rank;
                icon = DB.LEVELS[i].icon;
                lvl  = i + 1;
            } else {
                next = DB.LEVELS[i].xp;
                break;
            }
        }
        if (totalXP >= DB.LEVELS[DB.LEVELS.length - 1].xp) next = "MAX";

        document.getElementById("main-char-icon").textContent = icon;
        document.getElementById("main-char-rank").textContent = rank;
        document.getElementById("stat-lvl").textContent = lvl;
        document.getElementById("stat-xp").textContent = Math.round(totalXP).toLocaleString();
        document.getElementById("stat-count").textContent = State.history.length;
        document.getElementById("main-char-xp").textContent = `${Math.floor(totalXP)} XP`;
        document.getElementById("main-char-next").textContent = (next === "MAX") ? "MAX" : `Цель: ${next}`;

        // Прогресс‑бар
        let prevXP = 0;
        for (let i = 0; i < DB.LEVELS.length; i++) {
            if (totalXP >= DB.LEVELS[i].xp) prevXP = DB.LEVELS[i].xp;
            else break;
        }
        const progress = (next === "MAX") ? 100 : ((totalXP - prevXP) / (next - prevXP)) * 100;
        document.getElementById("xp-fill").style.width = `${Math.max(0, Math.min(100, progress))}%`;

        document.getElementById("hero-details")
                .textContent = `${State.profile.weight} кг • ${State.profile.height} см • ${State.profile.age} лет`;
    },

    /** ---------------------------------------------------------
     *  Полный рендер
     * --------------------------------------------------------- */
    renderAll() {
        this.renderHero();
        this.renderHistory();
        this.renderSession();
        this.updateNavBadge();
    },

    /** ---------------------------------------------------------
     *  Показ результата
     * --------------------------------------------------------- */
    showResult(record, sessionXP, diffType, diffPercent) {
        document.getElementById("res-xp").textContent = `+${Math.round(sessionXP)}`;
        const volText = record.type === "cardio"
            ? `${record.time} мин`
            : `${record.vol}`;
        document.getElementById("res-vol").textContent = volText;
        document.getElementById("res-kcal").textContent = record.kcal;
        document.getElementById("res-epoc").textContent = record.epoc || 0;
        document.getElementById("res-time").textContent = record.time;

        const labelEl = document.getElementById('res-label');
        if (labelEl) labelEl.textContent = record.type === 'cardio' ? 'Время (мин)' : 'Объём (кг)';

        const praise = DB.PRAISE[Math.floor(Math.random() * DB.PRAISE.length)];
        document.getElementById("res-header-praise").textContent = praise;

        const goal = State.profile?.goal || "health";
        const tips = DB.TIPS[goal] ?? DB.TIPS["health"];
        if (Array.isArray(tips) && tips.length) {
            const tip = tips[Math.floor(Math.random() * tips.length)];
            document.getElementById("res-tip").innerHTML = "💡 " + this._esc(tip);
        } else {
            document.getElementById("res-tip").innerHTML = "";
        }

        const badge = document.getElementById('res-diff-badge');
        badge.className = "diff-badge hidden";
        if (diffType !== "neutral") {
            const metric = record.type === 'cardio' ? 'время' : 'объём';
            badge.classList.add(diffType === "pos" ? "diff-pos" : "diff-neg");
            badge.textContent = `${diffType === "pos" ? "▲" : "▼"} ${Math.abs(diffPercent).toFixed(1)}% (${metric})`;
            badge.classList.remove("hidden");
        }

        if (record.epoc) {
            UI.showToast(`⚡ После тренировки сгорит ещё ${record.epoc} kcal (EPOC).`);
        }

        try {
            const tg = window.Telegram?.WebApp;
            if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
        } catch (_) {}

        this.showScreen("screen-result");
    },

    /** ---------------------------------------------------------
     *  Закрытие результата
     * --------------------------------------------------------- */
    closeResult() {
        this.showScreen("main-app");
        const trainNavBtn = document.querySelectorAll(".nav-item")[1];
        this.switchTab("tab-train", trainNavBtn);
    },

    /** ---------------------------------------------------------
     *  Обновление бейджа в навигации
     * --------------------------------------------------------- */
    updateNavBadge() {
        const badge = document.getElementById("workout-badge");
        if (State.currentSession.length > 0) {
            badge.classList.remove("hidden");
            badge.setAttribute("aria-label", `Текущая тренировка: ${State.currentSession.length} наборов`);
        } else {
            badge.classList.add("hidden");
            badge.removeAttribute("aria-label");
        }
    },

    /** ---------------------------------------------------------
     *  Заполнение полей профиля в настройках
     * --------------------------------------------------------- */
    fillProfileInputs() {
        if (!State.profile) return;
        const w = document.getElementById("prof-weight");   if (w) w.value = State.profile.weight;
        const h = document.getElementById("prof-height");   if (h) h.value = State.profile.height;
        const a = document.getElementById("prof-age");      if (a) a.value = State.profile.age;
        const g = document.getElementById("prof-gender");   if (g) g.value = State.profile.gender;
        const gl = document.getElementById("prof-goal");    if (gl) gl.value = State.profile.goal;
    },

    /** ---------------------------------------------------------
     *  Тост‑сообщения (toast) – с очисткой предыдущего таймаута
     * --------------------------------------------------------- */
    _toastTimeout: null,
    showToast(msg) {
        const t = document.getElementById("toast");
        t.textContent = msg;
        t.classList.remove("hidden");
        t.classList.add("visible");
        t.setAttribute("role", "alert");
        if (this._toastTimeout) clearTimeout(this._toastTimeout);
        this._toastTimeout = setTimeout(() => {
            t.classList.remove("visible");
            t.classList.add("hidden");
            this._toastTimeout = null;
        }, 3000);
    },

    /** ---------------------------------------------------------
     *  Применение темы Telegram
     * --------------------------------------------------------- */
    applyTelegramTheme() {
        const tg = window.Telegram?.WebApp;
        if (!tg) return;
        const p = tg.themeParams || {};

        const root = document.documentElement;
        root.style.setProperty("--tg-bg", p.bg_color || "#121212");
        root.style.setProperty("--tg-text", p.text_color || "#ffffff");
        root.style.setProperty("--tg-hint", p.hint_color || "#9ca3af");
        root.style.setProperty("--tg-link", p.link_color || "#3b82f6");
        root.style.setProperty("--tg-btn", p.button_color || "#3b82f6");
        root.style.setProperty("--tg-btn-text", p.button_text_color || "#ffffff");
        root.style.setProperty("--tg-secondary", p.secondary_bg_color || "#1f2937");
    }
};