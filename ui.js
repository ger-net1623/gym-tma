const UI = {
    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
        const screen = document.getElementById(id);
        if (screen) screen.classList.add('active-screen');
        
        try {
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.BackButton) {
                if (id === 'main-app') {
                    window.Telegram.WebApp.BackButton.hide();
                } else {
                    window.Telegram.WebApp.BackButton.show();
                    window.Telegram.WebApp.BackButton.onClick(() => {
                        if(document.getElementById('screen-result').classList.contains('active-screen')) {
                            UI.closeResult();
                        } else if (document.getElementById('screen-profile-setup').classList.contains('active-screen')) {
                             if(!State.profile) UI.showScreen('screen-onboarding');
                             else UI.showScreen('main-app');
                        }
                    });
                }
            }
        } catch(e) {
            console.warn("BackButton error", e);
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
        if(tab) tab.classList.add('active-tab');
        
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        if(navEl) navEl.classList.add('active');

        if (tabId === 'tab-hero') this.renderHero();
        if (tabId === 'tab-stats') this.renderHistory();
        if (tabId === 'tab-settings') this.fillProfileInputs();
    },

    updateExList() {
        const catSelect = document.getElementById('select-cat');
        if (!catSelect) return;

        if (catSelect.options.length === 0) {
             catSelect.innerHTML = Object.entries(DB.CATS).map(([key, val]) => 
                `<option value="${key}">${val}</option>`
             ).join('');
        }

        const cat = catSelect.value;
        const exSelect = document.getElementById('select-ex');
        const exList = DB.EXERCISES[cat] || [];
        
        exSelect.innerHTML = exList.map((ex, idx) => `<option value="${idx}">${ex[0]}</option>`).join('');
        exSelect.value = 0; 
        this.adaptInputs(); 
    },

    adaptInputs() {
        const catSelect = document.getElementById('select-cat');
        const exSelect = document.getElementById('select-ex');
        if(!catSelect || !exSelect) return;

        const cat = catSelect.value;
        const exIdx = exSelect.value;
        
        if (!DB.EXERCISES[cat] || !DB.EXERCISES[cat][exIdx]) return;

        const [name, type, mult, flags] = DB.EXERCISES[cat][exIdx];
        const f = flags || {};

        const prEl = document.getElementById('pr-display');
        const currentPR = (State.personalRecords && State.personalRecords[name]) ? State.personalRecords[name] : 0;
        
        if (type !== 3 && currentPR > 0) {
            prEl.innerText = `🏆 PR: ${currentPR}кг`;
            prEl.classList.add('visible');
        } else {
            prEl.classList.remove('visible');
        }

        const hintContainer = document.getElementById('hints-container');
        let hintsHTML = '';
        if (f.db) hintsHTML += `<div class="hint-block visible">🏋️‍♂️ Вводи вес одной гантели.</div>`;
        if (f.uni) hintsHTML += `<div class="hint-block visible">🦵 Упражнение на одну сторону.</div>`;
        if (f.mach) hintsHTML += `<div class="hint-block visible">🤖 Тренажер. Вес тела не влияет.</div>`;
        if (type === 1 || name === "Планка") hintsHTML += `<div class="hint-block visible">⚖️ Свой вес учитывается!</div>`;
        hintContainer.innerHTML = hintsHTML;

        const strBlock = document.getElementById('input-container-strength');
        const cardioBlock = document.getElementById('input-container-cardio');
        
        if (State.lastExName !== name) {
            document.getElementById('input-w').value = ''; 
            document.getElementById('input-r').value = '';
            document.getElementById('input-cardio-time').value = '';
        }

        if (type === 3) { 
            strBlock.classList.add('hidden'); 
            cardioBlock.classList.remove('hidden');
            const iSelect = document.getElementById('input-cardio-intensity');
            let iMap = {3: "Лайт", 6: "Средне", 9: "Тяжело", 11: "Максимум"};
            if (name === "Ходьба") iMap = {3: "Прогулка", 5: "Бодрый шаг", 7: "В гору"};
            iSelect.innerHTML = Object.entries(iMap).map(([val, txt]) => 
                `<option value="${val}" ${val==6?'selected':''}>${txt}</option>`
            ).join('');
        } else { 
            cardioBlock.classList.add('hidden'); 
            strBlock.classList.remove('hidden'); 
            const textW = document.getElementById('text-w-label');
            const lR = document.getElementById('label-r');
            textW.innerText = (type === 2 || type === 1) ? "Доп. вес (кг)" : "Вес (кг)";
            lR.innerText = (type === 2) ? "Время (сек)" : "Повторы";
        }
    },

    renderSession() {
        const curBlock = document.getElementById('current-session-block');
        if (State.currentSession.length > 0) {
            curBlock.classList.remove('hidden');
            let curXP = State.currentSession.reduce((a,c)=>a+c.xp,0);
            document.getElementById('session-title').innerText = `Сейчас: +${Math.round(curXP)} XP`;
            
            document.getElementById('current-list').innerHTML = State.currentSession.map(s => `
                <div class="list-item">
                    <div><b>${s.name}</b><div style="font-size:12px; opacity:0.7">${s.type===3?s.r+' мин':(s.type===2?s.r+' сек':(s.w>0?s.w+'кг × ':'')+s.r)}</div></div>
                    <div style="text-align:right; display:flex; align-items:center;">
                        <span style="color:var(--gold); font-weight:bold">+${s.xp} XP</span>
                        <div class="del-btn" onclick="Logic.deleteSet(${s.id})">✕</div>
                    </div>
                </div>`).join('');
        } else { 
            curBlock.classList.add('hidden'); 
        }
    },

    renderHistory() {
        document.getElementById('history-list').innerHTML = State.history.map((h, i) => {
            let emoji = h.type === 'cardio' ? '🏃' : '🏋️‍♂️';
            let detailText = (h.type === 'cardio') 
                ? `${h.time} мин` 
                : `${h.time} мин • ${h.vol} кг`;
            return `
            <div class="list-item">
                <div>
                    <div style="font-weight:600">${emoji} ${h.dateStr}</div>
                    <div style="font-size:12px; opacity:0.7">${detailText}</div>
                </div>
                <div style="text-align:right">
                     <div style="color:var(--gold); font-weight:bold">+${Math.round(h.xp)}</div>
                     <div style="font-size:10px; opacity:0.5; color:var(--red); margin-top:4px;" onclick="Logic.deleteHistoryItem(${i})">удалить</div>
                </div>
            </div>`;
        }).join('');
    },

    renderHero() {
        if (!State.profile) return;

        let rank = "Яйцо", icon = "🥚", next = 500, lvl = 1;
        const totalXP = State.totalXP;
        
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
        if (totalXP >= DB.LEVELS[DB.LEVELS.length-1].xp) next = "MAX";

        const iconEl = document.getElementById('main-char-icon');
        if(iconEl) iconEl.innerText = icon;
        document.getElementById('main-char-rank').innerText = rank;
        document.getElementById('stat-lvl').innerText = lvl;
        document.getElementById('stat-xp').innerText = Math.round(totalXP).toLocaleString();
        document.getElementById('stat-count').innerText = State.history.length;
        document.getElementById('main-char-xp').innerText = `${Math.floor(totalXP)} XP`;
        document.getElementById('main-char-next').innerText = (next === "MAX") ? "MAX" : `Цель: ${next}`;
        
        let prevXP = 0;
        for(let i=0; i<DB.LEVELS.length; i++) {
            if(totalXP >= DB.LEVELS[i].xp) prevXP = DB.LEVELS[i].xp;
            else break;
        }
        let progress = 100;
        if(next !== "MAX") {
            progress = ((totalXP - prevXP) / (next - prevXP)) * 100;
        }
        document.getElementById('xp-fill').style.width = `${Math.max(0, Math.min(100, progress))}%`;
        
        document.getElementById('hero-details').innerText = 
            `${State.profile.weight}кг • ${State.profile.height}см • ${State.profile.age} лет`;
    },

    renderAll() {
        this.renderHero();
        this.renderHistory();
        this.renderSession();
        this.updateNavBadge();
    },

    showResult(record, sessionXP, diffType, diffPercent) {
        document.getElementById('res-xp').innerText = `+${Math.round(sessionXP)}`;
        document.getElementById('res-vol').innerText = (record.type === 'cardio') ? "Кардио" : record.vol;
        document.getElementById('res-kcal').innerText = record.kcal; 
        document.getElementById('res-time').innerText = record.time;
        
        document.getElementById('res-header-praise').innerText = DB.PRAISE[Math.floor(Math.random() * DB.PRAISE.length)];

        const tipsArr = DB.TIPS[State.profile.goal] || DB.TIPS['health'];
        document.getElementById('res-tip').innerHTML = "💡 " + tipsArr[Math.floor(Math.random() * tipsArr.length)];

        const badge = document.getElementById('res-diff-badge');
        if (diffType !== 'neutral') {
            badge.className = 'diff-badge ' + (diffType === 'pos' ? 'diff-pos' : 'diff-neg');
            badge.innerText = (diffType === 'pos' ? '▲' : '▼') + ` ${Math.abs(diffPercent).toFixed(1)}%`;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }

        try { window.Telegram.WebApp.HapticFeedback.notificationOccurred('success'); } catch(e){}
        this.showScreen('screen-result');
    },

    closeResult() {
        this.showScreen('main-app');
        const trainNavBtn = document.querySelectorAll('.nav-item')[1];
        this.switchTab('tab-train', trainNavBtn);
    },

    updateNavBadge() {
        const badge = document.getElementById('workout-badge');
        if(State.currentSession.length > 0) badge.classList.remove('hidden');
        else badge.classList.add('hidden');
    },

    fillProfileInputs() {
        if(!State.profile) return;
        const w = document.getElementById('prof-weight'); if(w) w.value = State.profile.weight;
        const h = document.getElementById('prof-height'); if(h) h.value = State.profile.height;
        const a = document.getElementById('prof-age'); if(a) a.value = State.profile.age;
        const g = document.getElementById('prof-gender'); if(g) g.value = State.profile.gender;
        const gl = document.getElementById('prof-goal'); if(gl) gl.value = State.profile.goal;
    },
    
    showToast(msg) {
        const t = document.getElementById('toast');
        t.innerText = msg;
        t.style.display = 'block';
        setTimeout(() => t.style.display = 'none', 3000);
    }
};