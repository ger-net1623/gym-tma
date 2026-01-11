const UI = {
    // ---------------------------------
    //  Внутренняя функция экранирования.
    //  Нужна только если в будущем появятся
    //  пользовательские названия упражнений.
    // ---------------------------------
    _esc(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    },

    // ссылка на текущий обработчик BackButton, чтобы потом отписаться
    _backHandler: null,

    showScreen(id) {
        // Скрываем все экраны
        document.querySelectorAll('.screen').forEach(s => {
            s.classList.remove('active-screen');
            s.classList.add('hidden');
        });

        const screen = document.getElementById(id);
        if (screen) {
            screen.classList.remove('hidden');
            screen.classList.add('active-screen');
        }

        // -----------  BackButton handling ----------
        try {
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.BackButton) {
                const bb = window.Telegram.WebApp.BackButton;

                if (this._backHandler) {
                    try { bb.offClick(this._backHandler); } catch (e) { console.warn(e); }
                    this._backHandler = null;
                }

                if (id === 'main-app' || id === 'screen-onboarding') {
                    bb.hide();
                } else {
                    const handler = () => {
                        if (document.getElementById('screen-result').classList.contains('active-screen')) {
                            UI.closeResult();
                        } else if (document.getElementById('screen-profile-setup').classList.contains('active-screen')) {
                            if (!State.profile) UI.showScreen('screen-onboarding');
                            else UI.showScreen('main-app');
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

    switchTab(tabId, navEl) {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active-tab'));
        const tab = document.getElementById(tabId);
        if (tab) tab.classList.add('active-tab');

        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        if (navEl) navEl.classList.add('active');

        if (tabId === 'tab-hero') this.renderHero();
        if (tabId === 'tab-stats') this.renderHistory();
        if (tabId === 'tab-settings') this.fillProfileInputs();
    },

    updateExList() {
        const catSelect = document.getElementById('select-cat');
        if (!catSelect) return;

        if (catSelect.options.length === 0) {
            catSelect.innerHTML = Object.entries(DB.CATS)
                .map(([key, val]) => `<option value="${key}">${val}</option>`)
                .join('');
        }

        const cat = catSelect.value;
        const exSelect = document.getElementById('select-ex');
        const exList = DB.EXERCISES[cat] || [];

        exSelect.innerHTML = exList
            .map((ex, idx) => `<option value="${idx}">${ex[0]}</option>`)
            .join('');
        exSelect.selectedIndex = 0;
        this.adaptInputs();
    },

    adaptInputs() {
        const catSelect = document.getElementById('select-cat');
        const exSelect = document.getElementById('select-ex');
        if (!catSelect || !exSelect) return;

        const cat = catSelect.value;
        const exIdx = parseInt(exSelect.value, 10);
        if (!DB.EXERCISES[cat] || !DB.EXERCISES[cat][exIdx]) return;

        const [name, type, , flags] = DB.EXERCISES[cat][exIdx];
        const f = flags || {};

        // PR‑бадж
        const prEl = document.getElementById('pr-display');
        const currentPR = (State.personalRecords && State.personalRecords[name]) ? State.personalRecords[name] : 0;
        if (type !== 3 && currentPR > 0) {
            prEl.textContent = `🏆 PR: ${currentPR}кг`;
            prEl.classList.add('visible');
        } else {
            prEl.classList.remove('visible');
        }

        // Хинты
        const hintContainer = document.getElementById('hints-container');
        const hints = [];
        if (f.db) hints.push('🏋️‍♂️ Вводи вес одной гантели.');
        if (f.uni) hints.push('🦵 Упражнение на одну сторону.');
        if (f.mach) hints.push('🤖 Тренажер. Вес тела не влияет.');
        if (type === 1 || name === 'Планка') hints.push('⚖️ Свой вес учитывается!');
        hintContainer.innerHTML = hints.map(t => `<div class="hint-block visible">${t}</div>`).join('');

        // Показ/скрытие блоков ввода
        const strBlock = document.getElementById('input-container-strength');
        const cardioBlock = document.getElementById('input-container-cardio');

        if (type === 3) {
            strBlock.classList.add('hidden');
            cardioBlock.classList.remove('hidden');

            const iSelect = document.getElementById('input-cardio-intensity');
            let iMap = {3: 'Лайт', 6: 'Средне', 9: 'Тяжело', 11: 'Максимум'};
            if (name === 'Ходьба') iMap = {3: 'Прогулка', 5: 'Бодрый шаг', 7: 'В гору'};
            const entries = Object.entries(iMap);
            iSelect.innerHTML = entries
                .map(([val, txt], idx) => {
                    const selected = (idx === 0) ? 'selected' : '';
                    return `<option value="${val}" ${selected}>${txt}</option>`;
                })
                .join('');
        } else {
            cardioBlock.classList.add('hidden');
            strBlock.classList.remove('hidden');

            const textW = document.getElementById('text-w-label');
            const lR = document.getElementById('label-r');
            textW.textContent = (type === 2 || type === 1) ? 'Доп. вес (кг)' : 'Вес (кг)';
            lR.textContent = (type === 2) ? 'Время (сек)' : 'Повторы';
        }

        if (State.lastExName !== name) {
            document.getElementById('input-w').value = '';
            document.getElementById('input-r').value = '';
            document.getElementById('input-cardio-time').value = '';
        }
    },

    renderSession() {
        const curBlock = document.getElementById('current-session-block');
        if (State.currentSession.length > 0) {
            curBlock.classList.remove('hidden');
            const curXP = State.currentSession.reduce((a, c) => a + c.xp, 0);
            document.getElementById('session-title').textContent = `Сейчас: +${Math.round(curXP)} XP`;

            const listHTML = State.currentSession.map(s => `
                <div class="list-item">
                    <div>
                        <b>${this._esc(s.name)}</b>
                        <div style="font-size:12px; opacity:0.7">
                            ${s.type === 3 ? s.r + ' мин' :
                              (s.type === 2 ? s.r + ' сек' : (s.w > 0 ? s.w + 'кг × ' : '') + s.r)}
                        </div>
                    </div>
                    <div style="text-align:right; display:flex; align-items:center;">
                        <span style="color:var(--gold); font-weight:bold">+${s.xp} XP</span>
                        <div class="del-btn" onclick="Logic.deleteSet('${s.id}')">✕</div>
                    </div>
                </div>`).join('');
            document.getElementById('current-list').innerHTML = listHTML;
        } else {
            curBlock.classList.add('hidden');
        }
    },

    renderHistory() {
        const list = document.getElementById('history-list');
        if (State.history.length === 0) {
            list.innerHTML = '<div class="empty-state">Пока пусто...</div>';
            return;
        }

        const html = State.history.map((h, i) => {
            const emoji = h.type === 'cardio' ? '🏃' : '🏋️‍♂️';
            const detail = h.type === 'cardio' ? `${h.time} мин` : `${h.vol} кг`;
            return `
                <div class="list-item">
                    <div>
                        <div style="font-weight:600">${emoji} ${h.dateStr}</div>
                        <div style="font-size:12px; opacity:0.7">${detail}</div>
                    </div>
                    <div style="text-align:right">
                        <div style="color:var(--gold); font-weight:bold">+${Math.round(h.xp)}</div>
                        <div style="font-size:10px; opacity:0.5; color:var(--red); margin-top:4px;"
                             onclick="Logic.deleteHistoryItem(${i})">удалить</div>
                    </div>
                </div>`;
        }).join('');
        list.innerHTML = html;
    },

    renderHero() {
        if (!State.profile) return;

        const totalXP = State.totalXP;
        let rank = 'Яйцо', icon = '🥚', next = 500, lvl = 1;

        for (let i = 0; i < DB.LEVELS.length; i++) {
            if (totalXP >= DB.LEVELS[i].xp) {
                rank = DB.LEVELS[i].rank;
                icon = DB.LEVELS[i].icon;
                lvl = i + 1;
            } else {
                next = DB.LEVELS[i].xp;
                break;
            }
        }
        if (totalXP >= DB.LEVELS[DB.LEVELS.length - 1].xp) next = 'MAX';

        document.getElementById('main-char-icon').textContent = icon;
        document.getElementById('main-char-rank').textContent = rank;
        document.getElementById('stat-lvl').textContent = lvl;
        document.getElementById('stat-xp').textContent = Math.round(totalXP).toLocaleString();
        document.getElementById('stat-count').textContent = State.history.length;
        document.getElementById('main-char-xp').textContent = `${Math.floor(totalXP)} XP`;
        document.getElementById('main-char-next').textContent = (next === 'MAX') ? 'MAX' : `Цель: ${next}`;

        let prevXP = 0;
        for (let i = 0; i < DB.LEVELS.length; i++) {
            if (totalXP >= DB.LEVELS[i].xp) prevXP = DB.LEVELS[i].xp;
            else break;
        }
        let progress = 100;
        if (next !== 'MAX') {
            progress = ((totalXP - prevXP) / (next - prevXP)) * 100;
        }
        document.getElementById('xp-fill').style.width = `${Math.max(0, Math.min(100, progress))}%`;

        document.getElementById('hero-details').textContent =
            `${State.profile.weight}кг • ${State.profile.height}см • ${State.profile.age} лет`;
    },

    renderAll() {
        this.renderHero();
        this.renderHistory();
        this.renderSession();
        this.updateNavBadge();
    },

    showResult(record, sessionXP, diffType, diffPercent) {
        document.getElementById('res-xp').textContent = `+${Math.round(sessionXP)}`;
        document.getElementById('res-vol').textContent = record.type === 'cardio' ? 'Кардио' : record.vol;
        document.getElementById('res-kcal').textContent = record.kcal;
        document.getElementById('res-time').textContent = record.time;

        const praise = DB.PRAISE[Math.floor(Math.random() * DB.PRAISE.length)];
        document.getElementById('res-header-praise').textContent = praise;

        const tipsArr = DB.TIPS[State.profile.goal] || DB.TIPS['health'];
        document.getElementById('res-tip').innerHTML = '💡 ' + tipsArr[Math.floor(Math.random() * tipsArr.length)];

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

    closeResult() {
        this.showScreen('main-app');
        const trainNavBtn = document.querySelectorAll('.nav-item')[1];
        this.switchTab('tab-train', trainNavBtn);
    },

    updateNavBadge() {
        const badge = document.getElementById('workout-badge');
        if (State.currentSession.length > 0) badge.classList.remove('hidden');
        else badge.classList.add('hidden');
    },

    fillProfileInputs() {
        if (!State.profile) return;
        const w = document.getElementById('prof-weight'); if (w) w.value = State.profile.weight;
        const h = document.getElementById('prof-height'); if (h) h.value = State.profile.height;
        const a = document.getElementById('prof-age'); if (a) a.value = State.profile.age;
        const g = document.getElementById('prof-gender'); if (g) g.value = State.profile.gender;
        const gl = document.getElementById('prof-goal'); if (gl) gl.value = State.profile.goal;
    },

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