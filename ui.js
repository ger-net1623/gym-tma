const UI = {
    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
        document.getElementById(id).classList.add('active-screen');
        if (id === 'main-app') {
            window.Telegram.WebApp.BackButton.hide();
        } else {
            window.Telegram.WebApp.BackButton.show();
            window.Telegram.WebApp.BackButton.onClick(() => {
                if(document.getElementById('screen-result').classList.contains('active-screen')) {
                    this.closeResult();
                } else {
                    this.showScreen('main-app');
                }
            });
        }
    },

    switchTab(tabId, navEl) {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active-tab'));
        document.getElementById(tabId).classList.add('active-tab');
        
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        if(navEl) navEl.classList.add('active');
    },

    updateExList() {
        const catSelect = document.getElementById('select-cat');
        // Если категории еще не заполнены
        if (catSelect.options.length === 0) {
             catSelect.innerHTML = Object.entries(DB.CATS).map(([key, val]) => 
                `<option value="${key}">${val}</option>`
             ).join('');
        }

        const cat = catSelect.value;
        const exSelect = document.getElementById('select-ex');
        exSelect.innerHTML = DB.EXERCISES[cat].map((ex, idx) => `<option value="${idx}">${ex[0]}</option>`).join('');
        exSelect.value = 0; 
        this.adaptInputs(); 
    },

    adaptInputs() {
        const cat = document.getElementById('select-cat').value;
        const exIdx = document.getElementById('select-ex').value;
        const [name, type, mult, flags] = DB.EXERCISES[cat][exIdx];
        const f = flags || {};

        // Отображение PR
        const prEl = document.getElementById('pr-display');
        const currentPR = State.personalRecords[name] || 0;
        if (type !== 3 && currentPR > 0) {
            prEl.innerText = `🏆 PR: ${currentPR}кг`;
            prEl.classList.add('visible');
        } else {
            prEl.classList.remove('visible');
        }

        // Подсказки
        const hintContainer = document.getElementById('hints-container');
        let hintsHTML = '';
        if (f.db) hintsHTML += `<div class="hint-block visible">🏋️‍♂️ Вводи вес одной гантели.</div>`;
        if (f.uni) hintsHTML += `<div class="hint-block visible">🦵 Упражнение на одну сторону.</div>`;
        if (f.mach) hintsHTML += `<div class="hint-block visible">🤖 Тренажер. Вес тела не влияет.</div>`;
        if (type === 1 || name === "Планка") hintsHTML += `<div class="hint-block visible">⚖️ Свой вес учитывается!</div>`;
        hintContainer.innerHTML = hintsHTML;

        // Поля ввода
        const strBlock = document.getElementById('input-container-strength');
        const cardioBlock = document.getElementById('input-container-cardio');
        
        // Сброс полей только если упражнение сменилось
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

        document.getElementById('main-char-icon').innerText = icon;
        document.getElementById('main-char-rank').innerText = rank;
        document.getElementById('stat-lvl').innerText = lvl;
        document.getElementById('stat-xp').innerText = Math.round(totalXP).toLocaleString();
        document.getElementById('stat-count').innerText = State.history.length;
        document.getElementById('main-char-xp').innerText = `${Math.floor(totalXP)} XP`;
        document.getElementById('main-char-next').innerText = (next === "MAX") ? "MAX" : `Цель: ${next}`;
        
        // Прогресс бар
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
        
        // Детали профиля
        if (State.profile) {
            document.getElementById('hero-details').innerText = 
                `${State.profile.weight}кг • ${State.profile.height}см • ${State.profile.age} лет`;
        }
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

        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        this.showScreen('screen-result');
    },

    closeResult() {
        this.showScreen('main-app');
        this.switchTab('tab-stats', document.querySelectorAll('.nav-item')[2]);
    },

    updateNavBadge() {
        const badge = document.getElementById('workout-badge');
        if(State.currentSession.length > 0) badge.classList.remove('hidden');
        else badge.classList.add('hidden');
    },

    fillProfileInputs() {
        if(!State.profile) return;
        document.getElementById('prof-weight').value = State.profile.weight;
        document.getElementById('prof-height').value = State.profile.height;
        document.getElementById('prof-age').value = State.profile.age;
        document.getElementById('prof-gender').value = State.profile.gender;
        document.getElementById('prof-goal').value = State.profile.goal;
    },
    
    showToast(msg) {
        const t = document.getElementById('toast');
        t.innerText = msg;
        t.style.display = 'block';
        setTimeout(() => t.style.display = 'none', 3000);
    }
};