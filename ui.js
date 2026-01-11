/** -------------------------------------------------------------
 *  UI – функции отрисовки и взаимодействия
 * ------------------------------------------------------------- */
const UI = {
    /** ---------------------------------------------------------
     *  Экранирование пользовательского ввода (для innerHTML)
     * --------------------------------------------------------- */
    _esc(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    /** ---------------------------------------------------------
     *  Ссылка на текущий обработчик BackButton (Telegram)
     * --------------------------------------------------------- */
    _backHandler: null,

    // -----------------------------------------------------------------
    //  Показ/скрытие экранов
    // -----------------------------------------------------------------
    showScreen(id) {
        // Скрываем только экраны (управляем через .active-screen)
        document.querySelectorAll('.screen').forEach(s => {
            s.classList.remove('active-screen');
        });

        const screen = document.getElementById(id);
        if (screen) screen.classList.add('active-screen');

        // ---------- BackButton handling ----------
        try {
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.BackButton) {
                const bb = window.Telegram.WebApp.BackButton;

                // отписываем старый обработчик, если он есть
                if (this._backHandler) {
                    try { bb.offClick(this._backHandler); } catch (e) { console.warn(e); }
                    this._backHandler = null;
                }

                // Показываем/скрываем кнопку в зависимости от экрана
                if (id === 'main-app' || id === 'screen-onboarding') {
                    bb.hide();
                } else {
                    const handler = () => {
                        // Если открыт результат – закрываем его
                        if (document.getElementById('screen-result')
                                .classList.contains('active-screen')) {
                            UI.closeResult();
                        } else if (document.getElementById('screen-profile-setup')
                                .classList.contains('active-screen')) {
                            // На этапе онбординга: если профиль уже есть – возвращаемся в главный
                            if (State.profile) UI.showScreen('main-app');
                            else UI.showScreen('screen-onboarding');
                        } else {
                            UI.showScreen('main-app');
                        }
                    };
                    this._backHandler = handler;
                    bb.onClick(handler);
                    bb.show();
                }
            }
        } catch (e) {
            console.warn('BackButton error:', e);
        }
    },

    // -----------------------------------------------------------------
    //  Формы ввода в onboarding
    // -----------------------------------------------------------------
    renderSetupInputs() {
        const container = document.getElementById('setup-inputs-container');
        if (!container) return;
        container.innerHTML = `
            <div class="input-row">
                <div class="input-group">
                    <label class="input-label">Вес (кг)</label>
                    <input type="number" id="setup-weight" placeholder="80" inputmode="decimal">
                </div>
                <div class="input-group">
                    <label class="input-label">Рост (см)</label>
                    <input type="number" id="setup-height" placeholder="175" inputmode="numeric">
                </div>
            </div>
            <div class="input-row">
                <div class="input-group">
                    <label class="input-label">Возраст</label>
                    <input type="number" id="setup-age" placeholder="25" inputmode="numeric">
                </div>
                <div class="input-group">
                    <label class="input-label">Пол</label>
                    <select id="setup-gender">
                        <option value="male">Мужчина</option>
                        <option value="female">Женщина</option>
                    </select>
                </div>
            </div>
            <label class="input-label">Цель</label>
            <select id="setup-goal">
                <option value="strength">Сила</option>
                <option value="muscle">Масса</option>
                <option value="health">Здоровье</option>
                <option value="fatloss">Похудение</option>
            </select>
        `;
    },

    // -----------------------------------------------------------------
    //  Переключение табов
    // -----------------------------------------------------------------
    switchTab(tabId, navEl) {
        document.querySelectorAll('.tab-content')
                .forEach(t => t.classList.remove('active-tab'));
        const tab = document.getElementById(tabId);
        if (tab) tab.classList.add('active-tab');

        document.querySelectorAll('.nav-item')
                .forEach(n => n.classList.remove('active'));
        if (navEl) navEl.classList.add('active');

        if (tabId === 'tab-hero')   this.renderHero();
        if (tabId === 'tab-stats')  this.renderHistory();
        if (tabId === 'tab-settings') this.fillProfileInputs();
    },

    // -----------------------------------------------------------------
    //  Обновление списка упражнений
    // -----------------------------------------------------------------
    updateExList() {
        const catSelect = document.getElementById('select-cat');
        if (!catSelect) return;

        // Перезаполняем категории каждый раз (это проще поддерживать)
        catSelect.innerHTML = Object.entries(DB.CATS)
            .map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

        const cat = catSelect.value;
        const exSelect = document.getElementById('select-ex');
        const exList = DB.EXERCISES[cat] || [];

        exSelect.innerHTML = exList
            .map((ex, idx) => `<option value="${idx}">${ex[0]}</option>`).join('');
        exSelect.selectedIndex = 0;
        this.adaptInputs();
    },

    // -----------------------------------------------------------------
    //  Адаптация вводов под тип упражнения
    // -----------------------------------------------------------------
    adaptInputs() {
        const catSelect = document.getElementById('select-cat');
        const exSelect = document.getElementById('select-ex');
        if (!catSelect || !exSelect) return;

        const cat = catSelect.value;
        const exIdx = parseInt(exSelect.value, 10);
        if (!DB.EXERCISES[cat] || !DB.EXERCISES[cat][exIdx]) return;

        const [name, type, , flags = {}] = DB.EXERCISES[cat][exIdx];
        const f = flags;

        // ---------- PR‑бэйдж ----------
        const prEl = document.getElementById('pr-display');
        const currentPR = State.personalRecords?.[name] ?? 0;
        if (prEl) {
            if (type !== 3 && currentPR > 0) {
                prEl.textContent = `🏆 PR: ${currentPR}кг`;
                prEl.classList.add('visible');
            } else {
                prEl.classList.remove('visible');
            }
        }

        // ---------- Хинты ----------
        const hintContainer = document.getElementById('hints-container');
        const hints = [];
        if (f.db)   hints.push('🏋️‍♂️ Вводи вес одной гантели.');
        if (f.uni)  hints.push('🦵 Упражнение на одну сторону.');
        if (f.mach) hints.push('🤖 Тренажёр. Вес тела не влияет.');
        if (type === 1 || name === 'Планка') hints.push('⚖️ Свой вес учитывается!');

        // Чистый способ без innerHTML → защита от XSS
        hintContainer.innerHTML = '';                      // очищаем
        hints.forEach(txt => {
            const div = document.createElement('div');
            div.className = 'hint-block visible';
            div.textContent = txt;
            hintContainer.appendChild(div);
        });

        // ---------- Показ/скрытие блоков ввода ----------
        const strBlock    = document.getElementById('input-container-strength');
        const cardioBlock = document.getElementById('input-container-cardio');

        if (type === 3) { // Кардио
            strBlock.classList.add('hidden');
            cardioBlock.classList.remove('hidden');

            const iSelect = document.getElementById('input-cardio-intensity');
            let iMap = {3: 'Лайт', 6: 'Средне', 9: 'Тяжело', 11: 'Максимум'};
            if (name === 'Ходьба') iMap = {3: 'Прогулка', 5: 'Бодрый шаг', 7: 'В гору'};
            iSelect.innerHTML = Object.entries(iMap)
                .map(([val, txt], idx) => `<option value="${val}" ${idx === 0 ? 'selected' : ''}>${txt}</option>`)
                .join('');
        } else { // Силовые
            cardioBlock.classList.add('hidden');
            strBlock.classList.remove('hidden');

            const textW = document.getElementById('text-w-label');
            const lR    = document.getElementById('label-r');
            if (textW) textW.textContent = (type === 2 || type === 1) ? 'Доп. вес (кг)' : 'Вес (кг)';
            if (lR)    lR.textContent    = (type === 2) ? 'Время (сек)' : 'Повторы';
        }

        // Если сменилось упражнение – чистим вводы
        if (State.lastExName !== name) {
            const wInput = document.getElementById('input-w');
            const rInput = document.getElementById('input-r');
            if (wInput) wInput.value = '';
            if (rInput) rInput.value = '';
            const cardioTime = document.getElementById('input-cardio-time');
            if (cardioTime) cardioTime.value = '';
        }
    },

    // -----------------------------------------------------------------
    //  Отрисовка текущей сессии (вкладка «Зал»)
    // -----------------------------------------------------------------
    renderSession() {
        const curBlock = document.getElementById('current-session-block');
        if (State.currentSession.length > 0) {
            curBlock.classList.remove('hidden');
            const curXP = State.currentSession.reduce((a, c) => a + c.xp, 0);
            document.getElementById('session-title')
                    .textContent = `Сейчас: +${Math.round(curXP)} XP`;

            const listHTML = State.currentSession.map(s => `
                <div class="list-item">
                    <div>
                        <b>${this._esc(s.name)}</b>
                        <div style="font-size:12px; opacity:0.7">
                            ${s.type === 3 ? s.r + ' мин' :
                              (s.type === 2 ? s.r + ' сек' :
                               (s.w > 0 ? s.w + 'кг × ' : '') + s.r)}
                        </div>
                    </div>
                    <div style="text-align:right; display:flex; align-items:center;">
                        <span style="color:var(--gold); font-weight:bold">+${s.xp} XP</span>
                        <div class="del-btn"
                             data-action="deleteSet"
                             data-args='["${s.id}"]'>✕</div>
                    </div>
                </div>`).join('');
            document.getElementById('current-list').innerHTML = listHTML;
        } else {
            curBlock.classList.add('hidden');
        }
    },

    // -----------------------------------------------------------------
    //  История тренировок
    // -----------------------------------------------------------------
    renderHistory() {
        const list = document.getElementById('history-list');
        if (State.history.length === 0) {
            list.innerHTML = '<div class="empty-state">Пока пусто...</div>';
            return;
        }

        const html = State.history.map((h, i) => {
            const emoji  = h.type === 'cardio' ? '🏃' : '🏋️‍♂️';
            const detail = h.type === 'cardio' ? `${h.time} мин` : `${h.vol} кг`;
            return `
                <div class="list-item">
                    <div>
                        <div style="font-weight:600">${emoji} ${this._esc(h.dateStr)}</div>
                        <div style="font-size:12px; opacity:0.7">${detail}</div>
                    </div>
                    <div style="text-align:right">
                        <div style="color:var(--gold); font-weight:bold">+${Math.round(h.xp)}</div>
                        <div style="font-size:10px; opacity:0.5; color:var(--red); margin-top:4px;"
                             data-action="deleteHistoryItem"
                             data-args='[${i}]'>удалить</div>
                    </div>
                </div>`;
        }).join('');
        list.innerHTML = html;
    },

    // -----------------------------------------------------------------
    //  Рендер героя (уровень, XP, персонаж)
    // -----------------------------------------------------------------
    renderHero() {
        if (!State.profile) return;

        const totalXP = State.totalXP;
        let rank  = 'Яйцо',
            icon  = '🥚',
            next  = 500,
            lvl   = 1;

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
        if (totalXP >= DB.LEVELS[DB.LEVELS.length - 1].xp) next = 'MAX';

        document.getElementById('main-char-icon').textContent = icon;
        document.getElementById('main-char-rank').textContent = rank;
        document.getElementById('stat-lvl').textContent      = lvl;
        document.getElementById('stat-xp').textContent      = Math.round(totalXP).toLocaleString();
        document.getElementById('stat-count').textContent   = State.history.length;
        document.getElementById('main-char-xp').textContent = `${Math.floor(totalXP)} XP`;
        document.getElementById('main-char-next').textContent = (next === 'MAX') ? 'MAX' : `Цель: ${next}`;

        // Прогресс‑бар
        let prevXP = 0;
        for (let i = 0; i < DB.LEVELS.length; i++) {
            if (totalXP >= DB.LEVELS[i].xp) prevXP = DB.LEVELS[i].xp;
            else break;
        }
        const progress = (next === 'MAX')
            ? 100
            : ((totalXP - prevXP) / (next - prevXP)) * 100;
        document.getElementById('xp-fill').style.width = `${Math.max(0, Math.min(100, progress))}%`;

        document.getElementById('hero-details')
                .textContent = `${State.profile.weight}кг • ${State.profile.height}см • ${State.profile.age} лет`;
    },

    // -----------------------------------------------------------------
    //  Полный рендер (герой + история + сессия)
    // -----------------------------------------------------------------
    renderAll() {
        this.renderHero();
        this.renderHistory();
        this.renderSession();
        this.updateNavBadge();
    },

    // -----------------------------------------------------------------
    //  Показ результата после завершения тренировки
    // -----------------------------------------------------------------
    showResult(record, sessionXP, diffType, diffPercent) {
        document.getElementById('res-xp').textContent = `+${Math.round(sessionXP)}`;

        const volText = record.type === 'cardio' ? `${record.time} мин` : `${record.vol}`;
        document.getElementById('res-vol').textContent = volText;

        document.getElementById('res-kcal').textContent = record.kcal;
        document.getElementById('res-time').textContent = record.time;

        const praise = DB.PRAISE[Math.floor(Math.random() * DB.PRAISE.length)];
        document.getElementById('res-header-praise').textContent = praise;

        const tipsArr = DB.TIPS[State.profile.goal] || DB.TIPS['health'];
        document.getElementById('res-tip')
                .innerHTML = '💡 ' + this._esc(tipsArr[Math.floor(Math.random() * tipsArr.length)]);

        const badge = document.getElementById('res-diff-badge');
        badge.className = 'diff-badge hidden';
        if (diffType !== 'neutral') {
            badge.classList.add(diffType === 'pos' ? 'diff-pos' : 'diff-neg');
            badge.textContent = (diffType === 'pos' ? '▲' : '▼') + ` ${Math.abs(diffPercent).toFixed(1)}%`;
            badge.classList.remove('hidden');
        }

        try {
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
        } catch (e) { /* ignore */ }

        this.showScreen('screen-result');
    },

    // -----------------------------------------------------------------
    //  Закрытие экрана результата
    // -----------------------------------------------------------------
    closeResult() {
        this.showScreen('main-app');
        const trainNavBtn = document.querySelectorAll('.nav-item')[1];
        this.switchTab('tab-train', trainNavBtn);
    },

    // -----------------------------------------------------------------
    //  Обновление бейджа в навигации (кружок «Зал»)
    // -----------------------------------------------------------------
    updateNavBadge() {
        const badge = document.getElementById('workout-badge');
        if (State.currentSession.length > 0) badge.classList.remove('hidden');
        else badge.classList.add('hidden');
    },

    // -----------------------------------------------------------------
    //  Заполнение полей профиля в настройках
    // -----------------------------------------------------------------
    fillProfileInputs() {
        if (!State.profile) return;
        const w = document.getElementById('prof-weight');   if (w) w.value = State.profile.weight;
        const h = document.getElementById('prof-height');   if (h) h.value = State.profile.height;
        const a = document.getElementById('prof-age');        if (a) a.value = State.profile.age;
        const g = document.getElementById('prof-gender');    if (g) g.value = State.profile.gender;
        const gl = document.getElementById('prof-goal');    if (gl) gl.value = State.profile.goal;
    },

    // -----------------------------------------------------------------
    //  Тост‑сообщения
    // -----------------------------------------------------------------
    showToast(msg) {
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.classList.remove('hidden');
        t.classList.add('visible');
        setTimeout(() => {
            t.classList.remove('visible');
            t.classList.add('hidden');
        }, 3000);
    }
};