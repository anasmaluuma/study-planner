function loadExamDate() {
    try {
        const v = localStorage.getItem('examDate');
        if (!v) return null;
        const [y, m, d] = v.split('-').map(Number);
        return new Date(y, m - 1, d);
    } catch { return null; }
}
let EXAM_DATE = loadExamDate();

function examDiff() {
    return EXAM_DATE ? EXAM_DATE.getTime() - Date.now() : 0;
}

function updateExamLabel() {
    document.getElementById('examDateDisplay').textContent = EXAM_DATE ?
        `Exam: ${EXAM_DATE.toDateString()} (${getDaysRemaining()} days away)` :
        'Pick your exam date below to start the countdown';
}
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

let state = { subjects: {}, sessions: [] };
const STORAGE_KEY = 'studyPlannerData';

// Modules S5 (SIIA 2026-2027) : [nom, jour du cours, heures]
const DEFAULT_MODULES = [
    ['Apprentissage Automatique', 'monday', 2],
    ['Base de Données NoSQL', 'monday', 1.5],
    ['Anglais', 'tuesday', 1],
    ['Initiation à LaTeX', 'wednesday', 1],
    ['Écosystèmes Big Data', 'wednesday', 1.5],
    ['Réseaux Informatiques et IoT', 'thursday', 1.5],
    ['UML et DevOps', 'friday', 1.5]
];

function createSeedData() {
    return DEFAULT_MODULES.map(([subject, day, hours]) => ({ subject, hours, day, done: false }));
}

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            state = JSON.parse(raw);
            if (!state.subjects) state.subjects = {};
            if (!state.sessions) state.sessions = [];
        } else {
            state.sessions = createSeedData();
            saveState();
        }
    } catch {
        state = { subjects: {}, sessions: [] };
    }
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getDaysRemaining() {
    const diff = examDiff();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function updateCountdown() {
    const diff = examDiff();
    if (diff <= 0) {
        ['days', 'hours', 'minutes', 'seconds'].forEach(id => document.getElementById(id).textContent = '0');
        return;
    }
    document.getElementById('days').textContent = Math.floor(diff / (1000 * 60 * 60 * 24));
    document.getElementById('hours').textContent = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    document.getElementById('minutes').textContent = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    document.getElementById('seconds').textContent = Math.floor((diff % (1000 * 60)) / 1000);
}

// --- Pomodoro ---
const POMO_TIMES = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
const LONG_EVERY = 4;
const MODE_LABELS = { focus: 'Focus', short: 'Short Break', long: 'Long Break' };
const BASE_TITLE = document.title;
let pomo = { mode: 'focus', time: POMO_TIMES.focus, remaining: POMO_TIMES.focus, running: false, interval: null, endAt: 0, count: 0, today: 0, cycle: 0, auto: false };

function getTodayStr() {
    return new Date().toDateString();
}

function loadPomo() {
    try {
        const d = JSON.parse(localStorage.getItem('pomoData') || '{}');
        pomo.count = d.count || 0;
        pomo.today = d.date === getTodayStr() ? (d.today || 0) : 0;
        const st = JSON.parse(localStorage.getItem('pomoSettings') || '{}');
        POMO_TIMES.focus = (st.focus || 25) * 60;
        POMO_TIMES.short = (st.short || 5) * 60;
        POMO_TIMES.long = (st.long || 15) * 60;
        pomo.auto = !!st.auto;
    } catch {}
    document.getElementById('setFocus').value = POMO_TIMES.focus / 60;
    document.getElementById('setShort').value = POMO_TIMES.short / 60;
    document.getElementById('setLong').value = POMO_TIMES.long / 60;
    document.getElementById('setAuto').checked = pomo.auto;
}

function savePomo() {
    localStorage.setItem('pomoData', JSON.stringify({ count: pomo.count, today: pomo.today, date: getTodayStr() }));
}

function readPomoSettings() {
    const n = (id, def) => Math.min(120, Math.max(1, parseInt(document.getElementById(id).value) || def));
    POMO_TIMES.focus = n('setFocus', 25) * 60;
    POMO_TIMES.short = n('setShort', 5) * 60;
    POMO_TIMES.long = n('setLong', 15) * 60;
    pomo.auto = document.getElementById('setAuto').checked;
    localStorage.setItem('pomoSettings', JSON.stringify({ focus: POMO_TIMES.focus / 60, short: POMO_TIMES.short / 60, long: POMO_TIMES.long / 60, auto: pomo.auto }));
    if (!pomo.running) switchPomoMode(pomo.mode);
}

function updatePomoDisplay() {
    const m = Math.floor(pomo.remaining / 60);
    const sec = pomo.remaining % 60;
    const txt = `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    document.getElementById('timerDisplay').textContent = txt;
    document.getElementById('pomoCount').textContent = pomo.count;
    document.getElementById('pomoToday').textContent = pomo.today;
    document.getElementById('pomoCycle').textContent = `${pomo.cycle % LONG_EVERY}/${LONG_EVERY}`;
    const pct = pomo.time > 0 ? ((pomo.time - pomo.remaining) / pomo.time) * 100 : 0;
    const circumference = 628.32;
    document.getElementById('timerProgress').style.strokeDashoffset = circumference - (circumference * pct / 100);
    document.title = pomo.running ? `${txt} · ${MODE_LABELS[pomo.mode]}` : BASE_TITLE;
}

function startPomo() {
    pomo.running = true;
    pomo.endAt = Date.now() + pomo.remaining * 1000;
    document.getElementById('playBtn').innerHTML = '&#10074;&#10074;';
    clearInterval(pomo.interval);
    pomo.interval = setInterval(tickPomo, 250);
}

function pausePomo() {
    clearInterval(pomo.interval);
    pomo.running = false;
    document.getElementById('playBtn').innerHTML = '&#9654;';
    updatePomoDisplay();
}

function switchPomoMode(mode) {
    pausePomo();
    pomo.mode = mode;
    pomo.time = POMO_TIMES[mode];
    pomo.remaining = pomo.time;
    document.getElementById('phaseLabel').textContent = MODE_LABELS[mode];
    document.querySelectorAll('.pomodoro-modes button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    updatePomoDisplay();
}

function beep() {
    try {
        initAudio();
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.frequency.value = 880;
        g.gain.value = 0.15;
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start();
        o.stop(audioCtx.currentTime + 0.6);
    } catch {}
}

function notify(title, body) {
    try { new Notification(title, { body }); } catch {}
}

function finishPomo() {
    pausePomo();
    beep();
    let next = 'focus';
    if (pomo.mode === 'focus') {
        pomo.count++;
        pomo.today++;
        pomo.cycle++;
        savePomo();
        next = pomo.cycle % LONG_EVERY === 0 ? 'long' : 'short';
        notify('Focus session complete!', next === 'long' ? 'Time for a long break.' : 'Time for a short break.');
    } else {
        notify('Break over', 'Back to focus.');
    }
    switchPomoMode(next);
    if (pomo.auto) startPomo();
}

function tickPomo() {
    pomo.remaining = Math.max(0, Math.round((pomo.endAt - Date.now()) / 1000));
    updatePomoDisplay();
    if (pomo.remaining <= 0) finishPomo();
}

document.querySelectorAll('.pomodoro-modes button').forEach(btn => {
    btn.addEventListener('click', () => switchPomoMode(btn.dataset.mode));
});

document.getElementById('playBtn').addEventListener('click', () => {
    if (pomo.running) {
        pausePomo();
    } else {
        if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
        initAudio();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        startPomo();
    }
});

document.getElementById('resetPomoBtn').addEventListener('click', () => {
    pausePomo();
    pomo.remaining = pomo.time;
    updatePomoDisplay();
});

['setFocus', 'setShort', 'setLong', 'setAuto'].forEach(id => {
    document.getElementById(id).addEventListener('change', readPomoSettings);
});

loadPomo();
switchPomoMode('focus');

// --- Soundscape ---
const SOUNDS = [
    { id: 'rain', icon: '🌧', name: 'Rain' },
    { id: 'storm', icon: '⛈', name: 'Storm' },
    { id: 'ocean', icon: '🌊', name: 'Ocean' },
    { id: 'wind', icon: '🍃', name: 'Wind' },
];

let audioCtx = null;
let soundNodes = {};
let activeSound = null;
let soundGain = null;
let barIntervals = {};

function initAudio() {
    if (!audioCtx) audioCtx = new(window.AudioContext || window.webkitAudioContext)();
    if (!soundGain) {
        soundGain = audioCtx.createGain();
        soundGain.gain.value = (document.getElementById('soundVolume').value / 100) * 0.3;
        soundGain.connect(audioCtx.destination);
    }
}

function createNoiseBuffer() {
    const sr = audioCtx.sampleRate;
    const len = sr * 2;
    const buf = audioCtx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
}

function startSound(id) {
    initAudio();
    if (activeSound === id) {
        stopSound();
        return;
    }
    if (activeSound) stopSound();
    activeSound = id;

    const noise = audioCtx.createBufferSource();
    noise.buffer = createNoiseBuffer();
    noise.loop = true;

    const filter = audioCtx.createBiquadFilter();
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();

    switch (id) {
        case 'rain':
            filter.type = 'bandpass';
            filter.frequency.value = 2000;
            filter.Q.value = 0.5;
            lfo.frequency.value = 0.3;
            lfoGain.gain.value = 1500;
            lfo.connect(lfoGain);
            lfoGain.connect(filter.frequency);
            noise.connect(filter);
            filter.connect(soundGain);
            lfo.start();
            soundNodes = { noise, filter, lfo, lfoGain };
            break;
        case 'storm':
            filter.type = 'lowpass';
            filter.frequency.value = 800;
            filter.Q.value = 1;
            lfo.frequency.value = 0.08;
            lfoGain.gain.value = 400;
            lfo.connect(lfoGain);
            lfoGain.connect(filter.frequency);
            noise.connect(filter);
            filter.connect(soundGain);

            const rumble = audioCtx.createOscillator();
            rumble.type = 'sine';
            rumble.frequency.value = 60;
            const rumbleGain = audioCtx.createGain();
            rumbleGain.gain.value = 0.15;
            const rumbleLfo = audioCtx.createOscillator();
            rumbleLfo.frequency.value = 0.15;
            const rumbleMod = audioCtx.createGain();
            rumbleMod.gain.value = 0.08;
            rumbleLfo.connect(rumbleMod);
            rumbleMod.connect(rumbleGain.gain);
            rumble.connect(rumbleGain);
            rumbleGain.connect(soundGain);
            rumbleLfo.start();
            rumble.start();

            lfo.start();
            soundNodes = { noise, filter, lfo, lfoGain, rumble, rumbleGain, rumbleLfo, rumbleMod };
            break;
        case 'ocean':
            filter.type = 'bandpass';
            filter.frequency.value = 800;
            filter.Q.value = 2;
            lfo.type = 'sine';
            lfo.frequency.value = 0.1;
            lfoGain.gain.value = 600;
            lfo.connect(lfoGain);
            lfoGain.connect(filter.frequency);
            noise.connect(filter);
            filter.connect(soundGain);
            lfo.start();

            const swell = audioCtx.createGain();
            swell.gain.value = 0.4;
            const swellLfo = audioCtx.createOscillator();
            swellLfo.frequency.value = 0.05;
            const swellMod = audioCtx.createGain();
            swellMod.gain.value = 0.3;
            swellLfo.connect(swellMod);
            swellMod.connect(swell.gain);
            noise.connect(swell);
            swell.connect(soundGain);
            swellLfo.start();

            soundNodes = { noise, filter, lfo, lfoGain, swell, swellLfo, swellMod };
            break;
        case 'wind':
            filter.type = 'bandpass';
            filter.frequency.value = 3000;
            filter.Q.value = 0.3;
            lfo.type = 'sine';
            lfo.frequency.value = 0.05;
            lfoGain.gain.value = 2500;
            lfo.connect(lfoGain);
            lfoGain.connect(filter.frequency);
            noise.connect(filter);
            filter.connect(soundGain);
            lfo.start();

            const high = audioCtx.createBiquadFilter();
            high.type = 'highpass';
            high.frequency.value = 1000;
            const highLfo = audioCtx.createOscillator();
            highLfo.frequency.value = 0.12;
            const highMod = audioCtx.createGain();
            highMod.gain.value = 500;
            highLfo.connect(highMod);
            highMod.connect(high.frequency);
            noise.connect(high);
            high.connect(soundGain);
            highLfo.start();

            soundNodes = { noise, filter, lfo, lfoGain, high, highLfo, highMod };
            break;
    }

    noise.start();
    updateSoundUI();
    startBars(id);
}

function stopSound() {
    if (activeSound && soundNodes.noise) {
        try { soundNodes.noise.stop(); } catch {}
        Object.values(soundNodes).forEach(n => {
            try { if (n.stop && n !== soundNodes.noise) n.stop(); } catch {}
            try { if (n.disconnect) n.disconnect(); } catch {}
        });
    }
    soundNodes = {};
    activeSound = null;
    stopBars();
    updateSoundUI();
}

function updateSoundUI() {
    document.querySelectorAll('.sound-card').forEach(c => {
        const isActive = c.dataset.id === activeSound;
        c.classList.toggle('active', isActive);
        c.querySelector('.status').textContent = isActive ? 'Playing' : 'Off';
    });
}

function startBars(id) {
    stopBars();
    const card = document.querySelector(`.sound-card[data-id="${id}"]`);
    if (!card) return;
    const bars = card.querySelectorAll('.bars span');
    if (bars.length === 0) return;

    function animate() {
        bars.forEach(b => { b.style.height = (Math.random() * 16 + 2) + 'px'; });
    }
    animate();
    barIntervals[id] = setInterval(animate, 150);
}

function stopBars() {
    Object.keys(barIntervals).forEach(k => {
        clearInterval(barIntervals[k]);
        delete barIntervals[k];
    });
    document.querySelectorAll('.sound-card .bars span').forEach(b => b.style.height = '0');
}

function renderSounds() {
    const grid = document.getElementById('soundGrid');
    grid.innerHTML = SOUNDS.map(s => `
        <div class="sound-card" data-id="${s.id}">
            <div class="icon">${s.icon}</div>
            <div class="sname">${s.name}</div>
            <div class="status">Off</div>
            <div class="bars">${Array(5).fill(0).map(() => '<span></span>').join('')}</div>
        </div>
    `).join('');

    document.querySelectorAll('.sound-card').forEach(c => {
        c.addEventListener('click', () => startSound(c.dataset.id));
    });
}

document.getElementById('soundVolume').addEventListener('input', (e) => {
    const v = parseInt(e.target.value);
    document.getElementById('volPct').textContent = v + '%';
    if (soundGain) soundGain.gain.value = (v / 100) * 0.3;
});

renderSounds();

// --- Planner ---
function render() {
    const subjectList = document.getElementById('subjectList');
    const scheduleList = document.getElementById('scheduleList');
    const timetableGrid = document.getElementById('timetableGrid');
    const totalHoursEl = document.getElementById('totalHours');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    const totalSessions = state.sessions.length;
    const completedSessions = state.sessions.filter(s => s.done).length;
    const totalHours = state.sessions.reduce((sum, s) => sum + (s.hours || 0), 0);
    const completedHours = state.sessions.filter(s => s.done).reduce((sum, s) => sum + (s.hours || 0), 0);

    totalHoursEl.textContent = totalHours.toFixed(1);

    const pct = totalHours > 0 ? (completedHours / totalHours * 100) : 0;
    progressFill.style.width = pct + '%';
    progressText.textContent = `${completedSessions}/${totalSessions} sessions (${pct.toFixed(0)}%) complete`;

    const subjects = {};
    state.sessions.forEach(s => {
        const n = s.subject || 'Untitled';
        if (!subjects[n]) subjects[n] = { total: 0, done: 0, hours: 0, doneHours: 0 };
        subjects[n].total++;
        subjects[n].hours += s.hours || 0;
        if (s.done) {
            subjects[n].done++;
            subjects[n].doneHours += s.hours || 0;
        }
    });

    subjectList.innerHTML = Object.keys(subjects).length === 0 ?
        '<div style="color:#888;text-align:center;padding:20px;">No subjects yet. Add sessions below!</div>' :
        Object.entries(subjects).map(([name, data]) => `
            <div class="subject-card">
                <div>
                    <div class="name">${escHtml(name)}</div>
                    <div class="info">${data.done}/${data.total} sessions</div>
                </div>
                <div class="hours">${data.doneHours.toFixed(1)}h / ${data.hours.toFixed(1)}h</div>
            </div>
        `).join('');

    const byDay = {};
    DAY_KEYS.forEach(k => { byDay[k] = []; });
    state.sessions.forEach((s, i) => {
        if (byDay[s.day]) byDay[s.day].push({...s, index: i });
    });

    timetableGrid.innerHTML = DAY_NAMES.map((name, di) => {
                const key = DAY_KEYS[di];
                const sessions = byDay[key] || [];
                const dayHours = sessions.reduce((sum, s) => sum + (s.hours || 0), 0);
                return `<div class="timetable-day${sessions.length === 0 ? ' empty-day' : ''}">
            <div class="day-header">${name.slice(0, 3)}<span class="day-hours">${dayHours.toFixed(1)}h</span></div>
            <div class="day-sessions">${sessions.map(s => `
                <div class="tt-session${s.done ? ' done' : ''}" data-index="${s.index}">
                    <div class="tt-name">${escHtml(s.subject)}</div>
                    <div class="tt-hours">${s.hours}h</div>
                </div>`).join('')}
            </div></div>`;
    }).join('');

    document.querySelectorAll('.tt-session').forEach(el => {
        el.addEventListener('click', () => {
            const i = parseInt(el.dataset.index);
            state.sessions[i].done = !state.sessions[i].done;
            saveState();
            render();
        });
    });

    scheduleList.innerHTML = state.sessions.length === 0 ?
        '<div style="color:#888;text-align:center;padding:20px;">No study sessions planned yet.</div>' :
        state.sessions.map((s, i) => `
            <div class="session-item${s.done ? ' completed' : ''}">
                <div class="left">
                    <button class="toggle-btn" data-index="${i}">${s.done ? '&#10003;' : '&#9675;'}</button>
                    <span class="subject-tag">${escHtml(s.subject || 'Untitled')}</span>
                    <div class="details">${escHtml(capitalize(s.day))} &middot; ${s.hours}h</div>
                </div>
                <button class="delete-btn" data-index="${i}">&times;</button>
            </div>
        `).join('');

    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const i = parseInt(btn.dataset.index);
            state.sessions[i].done = !state.sessions[i].done;
            saveState();
            render();
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const i = parseInt(btn.dataset.index);
            state.sessions.splice(i, 1);
            saveState();
            render();
        });
    });

    updateDatalist();
    updateExamLabel();
}

function updateDatalist() {
    const subjects = [...new Set(state.sessions.map(s => s.subject))];
    document.getElementById('subjectSuggestions').innerHTML = subjects.map(s => `<option value="${escHtml(s)}">`).join('');
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

document.getElementById('addSessionBtn').addEventListener('click', () => {
    const subject = document.getElementById('sessionSubject').value.trim();
    const hours = parseFloat(document.getElementById('sessionHours').value);
    const day = document.getElementById('sessionDay').value;
    if (!subject) { alert('Enter a subject name.'); return; }
    if (!hours || hours <= 0) { alert('Enter valid hours.'); return; }
    state.sessions.push({ subject, hours, day, done: false });
    saveState();
    render();
    document.getElementById('sessionSubject').value = '';
    document.getElementById('sessionHours').value = '';
});

document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm('Delete all study data?')) {
        localStorage.removeItem(STORAGE_KEY);
        state = { subjects: {}, sessions: [] };
        render();
    }
});

loadState();
render();
updateCountdown();
setInterval(updateCountdown, 1000);

// --- Exam date picker ---
const examInput = document.getElementById('examInput');
examInput.value = localStorage.getItem('examDate') || '';
examInput.addEventListener('change', () => {
    if (examInput.value) localStorage.setItem('examDate', examInput.value);
    else localStorage.removeItem('examDate');
    EXAM_DATE = loadExamDate();
    updateExamLabel();
    updateCountdown();
});

// Enter key adds a session
['sessionSubject', 'sessionHours'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('addSessionBtn').click();
    });
});

// --- Music player ---
const audioEl = document.getElementById('audioEl');
let tracks = [];
let trackIdx = -1;

function fmtTime(t) {
    if (!isFinite(t)) return '0:00';
    return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
}

function renderPlaylist() {
    const pl = document.getElementById('playlist');
    pl.innerHTML = tracks.map((t, i) => `<div class="track${i === trackIdx ? ' active' : ''}" data-i="${i}">${escHtml(t.name)}</div>`).join('');
    pl.querySelectorAll('.track').forEach(el => el.addEventListener('click', () => playTrack(parseInt(el.dataset.i))));
}

function playTrack(i) {
    if (!tracks[i]) return;
    trackIdx = i;
    audioEl.src = tracks[i].src;
    audioEl.play().catch(() => {});
    document.getElementById('musicNow').textContent = tracks[i].name;
    renderPlaylist();
}

document.getElementById('musicFiles').addEventListener('change', e => {
    [...e.target.files].forEach(f => tracks.push({ name: f.name.replace(/\.[^.]+$/, ''), src: URL.createObjectURL(f) }));
    e.target.value = '';
    renderPlaylist();
});

document.getElementById('musicUrlBtn').addEventListener('click', () => {
    const input = document.getElementById('musicUrl');
    const url = input.value.trim();
    if (!url) return;
    tracks.push({ name: url, src: url });
    input.value = '';
    renderPlaylist();
});

document.getElementById('musicPlayBtn').addEventListener('click', () => {
    if (trackIdx < 0) { playTrack(0); return; }
    if (audioEl.paused) audioEl.play().catch(() => {});
    else audioEl.pause();
});
document.getElementById('nextBtn').addEventListener('click', () => { if (tracks.length) playTrack((trackIdx + 1) % tracks.length); });
document.getElementById('prevBtn').addEventListener('click', () => { if (tracks.length) playTrack((trackIdx - 1 + tracks.length) % tracks.length); });
audioEl.addEventListener('play', () => { document.getElementById('musicPlayBtn').innerHTML = '&#10074;&#10074;'; });
audioEl.addEventListener('pause', () => { document.getElementById('musicPlayBtn').innerHTML = '&#9654;'; });
audioEl.addEventListener('ended', () => { if (tracks.length) playTrack((trackIdx + 1) % tracks.length); });
audioEl.addEventListener('timeupdate', () => {
    document.getElementById('curTime').textContent = fmtTime(audioEl.currentTime);
    document.getElementById('durTime').textContent = fmtTime(audioEl.duration);
    document.getElementById('musicSeek').value = audioEl.duration ? (audioEl.currentTime / audioEl.duration) * 100 : 0;
});
document.getElementById('musicSeek').addEventListener('input', e => {
    if (audioEl.duration) audioEl.currentTime = (e.target.value / 100) * audioEl.duration;
});
document.getElementById('musicVol').addEventListener('input', e => { audioEl.volume = e.target.value / 100; });
audioEl.volume = 0.7;

// --- Notes ---
let notes = [];
let activeNote = null;

function loadNotes() {
    try { notes = JSON.parse(localStorage.getItem('studyNotes') || '[]'); } catch { notes = []; }
    if (notes.length) activeNote = notes[0].id;
}

function saveNotes() {
    localStorage.setItem('studyNotes', JSON.stringify(notes));
}

function renderNotes() {
    const list = document.getElementById('noteList');
    const body = document.getElementById('noteBody');
    list.innerHTML = notes.length ?
        notes.map(n => `<div class="note-item${n.id === activeNote ? ' active' : ''}" data-id="${n.id}"><span>${escHtml(n.title || 'Untitled')}</span><button class="delete-btn" data-del="${n.id}">&times;</button></div>`).join('') :
        '<div class="empty">No notes yet. Create one above.</div>';
    const cur = notes.find(n => n.id === activeNote);
    body.disabled = !cur;
    body.value = cur ? cur.body : '';
    list.querySelectorAll('.note-item').forEach(el => el.addEventListener('click', e => {
        if (e.target.dataset.del) return;
        activeNote = el.dataset.id;
        renderNotes();
    }));
    list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
        if (!confirm('Delete this note?')) return;
        notes = notes.filter(n => n.id !== b.dataset.del);
        activeNote = notes.length ? notes[0].id : null;
        saveNotes();
        renderNotes();
    }));
}

document.getElementById('addNoteBtn').addEventListener('click', () => {
    const t = document.getElementById('noteTitle');
    const id = String(Date.now());
    notes.unshift({ id, title: t.value.trim() || 'Untitled', body: '' });
    activeNote = id;
    t.value = '';
    saveNotes();
    renderNotes();
    document.getElementById('noteBody').focus();
});

document.getElementById('noteBody').addEventListener('input', e => {
    const cur = notes.find(n => n.id === activeNote);
    if (cur) { cur.body = e.target.value; saveNotes(); }
});

loadNotes();
renderNotes();