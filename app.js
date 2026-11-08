'use strict';

/* ================= Stockage ================= */
const KEY = 'agenda-habitudes-v1';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function defaultState() {
  return { tasks: [], habits: [], settings: { theme: 'auto', view: 'week' } };
}
function normalize(s) {
  return {
    tasks: (Array.isArray(s.tasks) ? s.tasks : []).map(t => ({
      note: '', time: '', status: 'todo', repeat: null, remind: null, log: {}, ...t,
    })),
    habits: (Array.isArray(s.habits) ? s.habits : []).map(h => ({ days: null, log: {}, ...h })),
    settings: { ...defaultState().settings, ...(s.settings || {}) },
  };
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalize(JSON.parse(raw)) : defaultState();
  } catch { return defaultState(); }
}
let state = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* stockage indisponible */ }
}

/* ================= Dates ================= */
// ?at=2026-07-01T06:00 permet de prévisualiser une autre date/heure.
const atParam = new URLSearchParams(location.search).get('at');
const now = () => (atParam && !isNaN(new Date(atParam)) ? new Date(atParam) : new Date());

const pad = n => String(n).padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const mondayOf = d => addDays(d, -((d.getDay() + 6) % 7));
const weekday = d => (d.getDay() + 6) % 7; // 0 = lundi
const daysBetween = (a, b) => {
  const s = addDays(a, 0), e = addDays(b, 0); // minuit, pour ignorer l'heure
  return [...Array(Math.max(0, Math.round((e - s) / 864e5) + 1))].map((_, i) => addDays(s, i));
};
const todayKey = () => keyOf(now());

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const DAYS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const cap = s => s[0].toUpperCase() + s.slice(1);

let anchor = now(); // date de référence de la vue Semaine / Mois

/* ================= Ambiance : saison + mois + heure ================= */
const SEASONS = {
  hiver:     { hue: 212, sat: 34, label: 'Hiver' },
  printemps: { hue: 145, sat: 38, label: 'Printemps' },
  ete:       { hue: 38,  sat: 62, label: 'Été' },
  automne:   { hue: 22,  sat: 50, label: 'Automne' },
};
function seasonOf(d) {
  const m = d.getMonth();
  if (m === 11 || m <= 1) return 'hiver';
  if (m <= 4) return 'printemps';
  if (m <= 7) return 'ete';
  return 'automne';
}
const MONTH_SHIFT = [0, 10, 20, -16, 0, 14, -10, 0, 10, -14, 0, 12];
const DAY_KEYS = [
  { h: 0,    tint: 240, amt: .55, light: 0,   name: 'Nuit' },
  { h: 5,    tint: 250, amt: .5,  light: .1,  name: 'Nuit' },
  { h: 6.5,  tint: 340, amt: .45, light: .55, name: 'Aube' },
  { h: 9,    tint: 45,  amt: .2,  light: 1,   name: 'Matin' },
  { h: 13,   tint: 200, amt: .1,  light: 1,   name: 'Journée' },
  { h: 17,   tint: 30,  amt: .35, light: .85, name: 'Fin d\'après-midi' },
  { h: 19.5, tint: 12,  amt: .5,  light: .45, name: 'Crépuscule' },
  { h: 21.5, tint: 265, amt: .5,  light: .12, name: 'Soirée' },
  { h: 24,   tint: 240, amt: .55, light: 0,   name: 'Nuit' },
];
const lerp = (a, b, t) => a + (b - a) * t;
const lerpHue = (a, b, t) => (a + (((b - a + 540) % 360) - 180) * t + 360) % 360;
function dayPhase(d) {
  const h = d.getHours() + d.getMinutes() / 60;
  let i = 0;
  while (i < DAY_KEYS.length - 2 && h >= DAY_KEYS[i + 1].h) i++;
  const a = DAY_KEYS[i], b = DAY_KEYS[i + 1], t = (h - a.h) / (b.h - a.h);
  return { tint: lerpHue(a.tint, b.tint, t), amt: lerp(a.amt, b.amt, t), light: lerp(a.light, b.light, t), name: t < .5 ? a.name : b.name };
}

function applyTheme() {
  const d = now();
  const season = SEASONS[seasonOf(d)];
  const base = (season.hue + MONTH_SHIFT[d.getMonth()] + 360) % 360;
  const phase = dayPhase(d);
  const hue = lerpHue(base, phase.tint, phase.amt * .45);
  const root = document.documentElement;
  root.style.setProperty('--h', hue.toFixed(1));
  root.style.setProperty('--s', `${season.sat}%`);
  root.style.setProperty('--th', phase.tint.toFixed(1));
  const mode = state.settings.theme;
  const dark = mode === 'dark' || (mode === 'auto' && phase.light < .4);
  root.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]').content = `hsl(${hue.toFixed(0)} ${season.sat * .5}% ${dark ? 10 : 95}%)`;

  $('#themeBtn').textContent = { auto: 'Auto', light: 'Clair', dark: 'Sombre' }[mode];
  $('#mood').textContent = `${season.label} · ${MONTHS[d.getMonth()]} · ${phase.name}`;
  const h = d.getHours();
  $('#greeting').textContent = h < 5 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : h < 22 ? 'Bonsoir' : 'Bonne nuit';
  $('#todayLabel').textContent = `${DAYS[weekday(d)]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  $('#themeLabel').textContent = `Les couleurs suivent la saison, le mois et l'heure — ${season.label.toLowerCase()}, ${phase.name.toLowerCase()}.`;
}

/* ================= Utilitaires DOM ================= */
const $ = s => document.querySelector(s);
function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c);
  return e;
}

/* ================= Tâches (simples et récurrentes) ================= */
const REPEAT_LABEL = { daily: 'Tous les jours', weekdays: 'En semaine', weekly: 'Chaque semaine', monthly: 'Chaque mois' };

// La tâche a-t-elle lieu ce jour-là ?
function occurs(t, k) {
  if (!t.repeat) return t.date === k;
  if (!t.date || k < t.date || t.log[k] === 'skip') return false;
  const d = fromKey(k), s = fromKey(t.date);
  switch (t.repeat) {
    case 'daily': return true;
    case 'weekdays': return weekday(d) < 5;
    case 'weekly': return weekday(d) === weekday(s);
    case 'monthly': {
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return d.getDate() === Math.min(s.getDate(), last); // le 31 → dernier jour des mois courts
    }
  }
  return false;
}
const statusOf = (t, k) => (t.repeat ? (t.log[k] || 'todo') : t.status);
const byTime = (a, b) => (a.t.time || '99').localeCompare(b.t.time || '99');
const occurrencesOn = k => state.tasks.filter(t => occurs(t, k)).map(t => ({ t, k, status: statusOf(t, k) })).sort(byTime);

const NEXT = { todo: 'done', done: 'missed', missed: 'todo' };
const MARK = { todo: '', done: '✓', missed: '✕' };
const TITLE = { todo: 'À faire — cliquer pour marquer « fait »', done: 'Fait — cliquer pour marquer « pas fait »', missed: 'Pas fait — cliquer pour réinitialiser' };

function setStatus(t, k, s) {
  if (t.repeat) { if (s === 'todo') delete t.log[k]; else t.log[k] = s; }
  else t.status = s;
}
function cycleTask(id, k) {
  const t = state.tasks.find(t => t.id === id);
  if (!t) return;
  setStatus(t, k, NEXT[statusOf(t, k)] || 'done');
  save(); render();
}
function addTask(title, date = null, time = '') {
  title = title.trim();
  if (!title) return;
  state.tasks.push({ id: uid(), title, date, time, note: '', status: 'todo', repeat: null, remind: null, log: {} });
  save(); render();
}
function moveTask(id, date) {
  const t = state.tasks.find(t => t.id === id);
  if (!t || t.repeat) return;
  t.date = date;
  save(); render();
}

function taskItem({ t, k, status }) {
  const movable = !t.repeat;
  const li = el('li', {
    class: `task ${status}`, draggable: movable ? 'true' : null, dataset: { id: t.id },
    ondragstart: e => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; li.classList.add('dragging'); },
    ondragend: () => li.classList.remove('dragging'),
  },
    el('button', { class: 'check', title: TITLE[status], 'aria-label': TITLE[status], onclick: () => cycleTask(t.id, k) }, MARK[status]),
    el('span', { class: 'label', onclick: () => openTask(t.id, k) },
      (t.time || t.repeat || t.remind != null) ? el('span', { class: 'time' },
        t.time || '',
        t.repeat ? el('span', { class: 'badge', title: REPEAT_LABEL[t.repeat] }, '↻') : null,
        t.remind != null && t.time ? el('span', { class: 'badge', title: 'Rappel' }, '🔔') : null,
      ) : null,
      el('span', { class: 'text' }, t.title),
      t.note ? el('span', { class: 'note-dot', title: t.note }, '✎') : null,
    ),
  );
  return li;
}

function makeDropZone(node, getDate) {
  node.addEventListener('dragover', e => { e.preventDefault(); node.classList.add('drop'); });
  node.addEventListener('dragleave', e => { if (!node.contains(e.relatedTarget)) node.classList.remove('drop'); });
  node.addEventListener('drop', e => {
    e.preventDefault(); node.classList.remove('drop');
    const id = e.dataTransfer.getData('text/plain');
    if (id) moveTask(id, getDate());
  });
}

/* ================= Habitudes ================= */
const habitApplies = (h, d) => !h.days || h.days.includes(weekday(d));
function cycleHabit(h, k) {
  const v = h.log[k];
  if (v === undefined) h.log[k] = true;
  else if (v === true) h.log[k] = false;
  else delete h.log[k];
  save(); render();
}
function streak(h) {
  let d = now(), n = 0;
  if (h.log[keyOf(d)] !== true) d = addDays(d, -1); // la journée n'est pas finie
  for (let i = 0; i < 2000; i++, d = addDays(d, -1)) {
    if (!habitApplies(h, d)) continue;
    if (h.log[keyOf(d)] === true) n++; else break;
  }
  return n;
}
function bestStreak(h) {
  const keys = Object.keys(h.log).sort();
  if (!keys.length) return 0;
  let best = 0, cur = 0;
  for (const d of daysBetween(fromKey(keys[0]), now())) {
    if (!habitApplies(h, d)) continue;
    if (h.log[keyOf(d)] === true) best = Math.max(best, ++cur); else cur = 0;
  }
  return best;
}

/* ================= Comptage / statistiques ================= */
// Bilan d'une liste de jours : éléments prévus (tâches + habitudes) et réalisés.
function tally(days, { pastOnly = false } = {}) {
  const tk = todayKey();
  let total = 0, done = 0, tasksDone = 0, tasksTotal = 0;
  for (const d of days) {
    const k = keyOf(d);
    if (pastOnly && k > tk) continue;
    for (const o of occurrencesOn(k)) { total++; tasksTotal++; if (o.status === 'done') { done++; tasksDone++; } }
    for (const h of state.habits) if (habitApplies(h, d)) { total++; if (h.log[k] === true) done++; }
  }
  return { total, done, tasksDone, tasksTotal, pct: total ? Math.round(done / total * 100) : null };
}
const fmtPct = p => (p == null ? '—' : `${p} %`);

/* ================= Rendu ================= */
function render() {
  const view = state.settings.view;
  document.querySelectorAll('.views button').forEach(b => b.setAttribute('aria-selected', b.dataset.view === view));
  document.body.dataset.view = view;
  if (view === 'month') renderMonth();
  else if (view === 'stats') renderStats();
  else renderWeek();
  renderSide();
}

function setProgress(t, label) {
  $('#progress').hidden = false;
  $('#progressFill').style.width = `${t.pct || 0}%`;
  $('#progressText').textContent = fmtPct(t.pct ?? 0);
  $('#progress').title = `${t.done} sur ${t.total} réalisé${t.done > 1 ? 's' : ''} ${label}`;
}

function renderWeek() {
  const tk = todayKey();
  const start = mondayOf(anchor);
  const days = daysBetween(start, addDays(start, 6));
  const end = days[6];
  $('#weekLabel').textContent = start.getMonth() === end.getMonth()
    ? `${start.getDate()} – ${end.getDate()} ${MONTHS[end.getMonth()]}`
    : `${start.getDate()} ${MONTHS[start.getMonth()].slice(0, 4)}. – ${end.getDate()} ${MONTHS[end.getMonth()].slice(0, 4)}.`;
  $('#weekSub').textContent = `Semaine ${isoWeek(start)} · ${end.getFullYear()}`;
  $('#thisWeek').hidden = days.some(d => keyOf(d) === tk);
  setProgress(tally(days), 'cette semaine');

  const grid = el('div', { class: 'week' }, days.map((d, i) => {
    const k = keyOf(d);
    const occ = occurrencesOn(k);
    const done = occ.filter(o => o.status === 'done').length;
    const input = el('input', { placeholder: '+ Ajouter', maxlength: '140', 'aria-label': `Ajouter une tâche le ${DAYS[i]}` });
    const col = el('article', { class: `day${k === tk ? ' today' : ''}${k < tk ? ' past' : ''}` },
      el('div', { class: 'day-head' },
        el('span', { class: 'day-name' }, DAYS[i].slice(0, 3)),
        el('span', { class: 'day-num' }, String(d.getDate())),
      ),
      el('div', { class: 'day-meta' }, occ.length ? `${done}/${occ.length} réalisée${done > 1 ? 's' : ''}` : ''),
      el('ul', { class: 'tasks' }, occ.map(taskItem)),
      el('form', { class: 'quick-add', onsubmit: e => {
        e.preventDefault();
        const m = input.value.match(/^(\d{1,2})[h:](\d{2})?\s+(.+)$/i); // « 14h30 Sport »
        if (m) addTask(m[3], k, `${pad(+m[1] % 24)}:${m[2] || '00'}`); else addTask(input.value, k);
        requestAnimationFrame(() => document.querySelectorAll('.quick-add input')[i]?.focus());
      } }, input),
    );
    makeDropZone(col, () => k);
    return col;
  }));
  $('#view').replaceChildren(grid);
}

function renderMonth() {
  const tk = todayKey();
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  $('#weekLabel').textContent = `${cap(MONTHS[first.getMonth()])} ${first.getFullYear()}`;
  const t = tally(daysBetween(first, last));
  $('#weekSub').textContent = `${t.tasksDone} tâche${t.tasksDone > 1 ? 's' : ''} réalisée${t.tasksDone > 1 ? 's' : ''} sur ${t.tasksTotal}`;
  $('#thisWeek').hidden = first.getMonth() === now().getMonth() && first.getFullYear() === now().getFullYear();
  setProgress(t, 'ce mois-ci');

  const start = mondayOf(first);
  const cells = daysBetween(start, addDays(start, 41));
  const grid = el('div', { class: 'month' },
    DAYS.map(n => el('div', { class: 'm-head' }, n.slice(0, 3))),
    cells.map(d => {
      const k = keyOf(d);
      const occ = occurrencesOn(k);
      const hab = state.habits.filter(h => habitApplies(h, d));
      const habDone = hab.filter(h => h.log[k] === true).length;
      const shown = occ.slice(0, 3);
      return el('button', {
        class: `m-day${d.getMonth() !== first.getMonth() ? ' out' : ''}${k === tk ? ' today' : ''}${k < tk ? ' past' : ''}`,
        'aria-label': `${DAYS[weekday(d)]} ${d.getDate()} ${MONTHS[d.getMonth()]} : ${occ.length} tâche(s). Ouvrir la semaine.`,
        onclick: () => { anchor = d; state.settings.view = 'week'; save(); render(); },
        ondragover: e => e.preventDefault(),
        ondrop: e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) moveTask(id, k); },
      },
        el('span', { class: 'm-num' }, String(d.getDate())),
        el('span', { class: 'm-items' },
          shown.map(o => el('span', { class: `m-chip ${o.status}` }, o.t.time ? `${o.t.time} ` : '', o.t.title)),
          occ.length > 3 ? el('span', { class: 'm-more' }, `+${occ.length - 3}`) : null,
        ),
        el('span', { class: 'm-dots' }, occ.map(o => el('i', { class: o.status }))),
        hab.length && k <= tk ? el('span', { class: 'm-hab', title: `Habitudes : ${habDone}/${hab.length}` },
          el('i', { style: `width:${Math.round(habDone / hab.length * 100)}%` })) : null,
      );
    }),
  );
  $('#view').replaceChildren(grid);
}

function renderStats() {
  $('#weekLabel').textContent = 'Statistiques';
  $('#weekSub').textContent = 'Ce qui a été prévu jusqu\'à aujourd\'hui';
  $('#thisWeek').hidden = true;
  $('#progress').hidden = true;

  const today = now();
  const wk = tally(daysBetween(mondayOf(today), today));
  const m30 = tally(daysBetween(addDays(today, -29), today));
  const prev30 = tally(daysBetween(addDays(today, -59), addDays(today, -30)));
  const delta = m30.pct != null && prev30.pct != null ? m30.pct - prev30.pct : null;
  const best = state.habits.reduce((a, h) => Math.max(a, streak(h)), 0);

  const tile = (label, value, sub) => el('div', { class: 'tile card' },
    el('span', { class: 'tile-label' }, label), el('span', { class: 'tile-value' }, value), el('span', { class: 'tile-sub' }, sub));

  // 12 dernières semaines
  const weeks = [...Array(12)].map((_, i) => {
    const s = addDays(mondayOf(today), -7 * (11 - i));
    const e = i === 11 ? today : addDays(s, 6);
    return { s, ...tally(daysBetween(s, e)) };
  });
  // Par jour de la semaine (8 dernières semaines)
  const byDay = DAYS.map(() => ({ total: 0, done: 0 }));
  for (const d of daysBetween(addDays(today, -55), today)) {
    const t = tally([d]); byDay[weekday(d)].total += t.total; byDay[weekday(d)].done += t.done;
  }

  const bars = (items, current) => el('div', { class: 'bars' }, items.map((it, i) =>
    el('div', { class: `bar-col${i === current ? ' current' : ''}`, tabindex: '0', 'data-tip': it.tip },
      el('div', { class: 'bar-track' }, el('i', { style: `height:${it.pct || 0}%` + (it.pct == null ? ';opacity:0' : '') })),
      el('span', { class: 'bar-label' }, it.label),
    )));

  const thirty = daysBetween(addDays(today, -29), today);
  const habitRows = state.habits.map(h => {
    let tot = 0, ok = 0;
    for (const d of thirty) if (habitApplies(h, d)) { tot++; if (h.log[keyOf(d)] === true) ok++; }
    return el('div', { class: 'h-row' },
      el('div', { class: 'h-info' },
        el('span', { class: 'h-name' }, h.name),
        el('span', { class: 'h-nums' }, `${tot ? Math.round(ok / tot * 100) : 0} % · série ${streak(h)} j · record ${bestStreak(h)} j`),
      ),
      el('div', { class: 'heat' }, thirty.map(d => {
        const k = keyOf(d), v = h.log[k], on = habitApplies(h, d);
        const label = !on ? 'non prévu' : v === true ? 'fait' : v === false ? 'pas fait' : 'non renseigné';
        return el('i', { class: !on ? 'off' : v === true ? 'done' : v === false ? 'missed' : '', 'data-tip': `${d.getDate()} ${MONTHS[d.getMonth()]} : ${label}` });
      })),
    );
  });

  $('#view').replaceChildren(el('div', { class: 'stats' },
    el('div', { class: 'tiles' },
      tile('Cette semaine', fmtPct(wk.pct), `${wk.done} / ${wk.total} réalisés`),
      tile('30 derniers jours', fmtPct(m30.pct), delta == null ? 'Pas encore de comparaison' : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)} pts vs 30 j précédents`),
      tile('Tâches faites (30 j)', String(m30.tasksDone), `sur ${m30.tasksTotal} prévues`),
      tile('Meilleure série en cours', best ? `${best} j` : '—', best ? '🔥 continue comme ça' : 'Coche une habitude aujourd\'hui'),
    ),
    el('section', { class: 'card chart' },
      el('h3', {}, 'Taux de réalisation par semaine'),
      el('p', { class: 'sub' }, '12 dernières semaines · tâches et habitudes'),
      bars(weeks.map(w => ({ pct: w.pct, label: `${w.s.getDate()}/${w.s.getMonth() + 1}`,
        tip: `Semaine du ${w.s.getDate()} ${MONTHS[w.s.getMonth()]} : ${fmtPct(w.pct)} (${w.done}/${w.total})` })), 11),
    ),
    el('section', { class: 'card chart' },
      el('h3', {}, 'Tes meilleurs jours'),
      el('p', { class: 'sub' }, 'Réalisation moyenne par jour · 8 dernières semaines'),
      bars(byDay.map((b, i) => {
        const pct = b.total ? Math.round(b.done / b.total * 100) : null;
        return { pct, label: DAYS[i].slice(0, 3), tip: `${DAYS[i]} : ${fmtPct(pct)} (${b.done}/${b.total})` };
      }), weekday(today)),
    ),
    el('section', { class: 'card chart wide' },
      el('h3', {}, 'Habitudes'),
      el('p', { class: 'sub' }, '30 derniers jours · ', el('i', { class: 'lg done' }), ' fait ', el('i', { class: 'lg missed' }), ' pas fait ', el('i', { class: 'lg' }), ' non renseigné'),
      habitRows.length ? el('div', { class: 'h-list' }, habitRows) : el('p', { class: 'sub' }, 'Aucune habitude pour l\'instant.'),
    ),
  ));
}

function renderSide() {
  const tk = todayKey(), today = now();
  const inbox = state.tasks.filter(t => !t.date && !t.repeat);
  $('#todoList').replaceChildren(...inbox.map(t => taskItem({ t, k: null, status: t.status })));
  const open = inbox.filter(t => t.status === 'todo').length;
  $('#todoCount').textContent = inbox.length ? `${open} en attente` : '';

  const start = mondayOf(state.settings.view === 'week' ? anchor : today);
  const days = daysBetween(start, addDays(start, 6));
  $('#habits').replaceChildren(...state.habits.map(h => {
    const s = streak(h);
    return el('div', { class: 'habit' },
      el('div', { class: 'habit-top' },
        el('span', { class: 'habit-name', onclick: () => openHabit(h.id), title: 'Modifier' }, h.name),
        el('span', { class: 'streak', title: 'Série en cours' }, s ? `🔥 ${s} j` : '—'),
      ),
      el('div', { class: 'habit-days' }, days.map((d, i) => {
        const k = keyOf(d), v = h.log[k], on = habitApplies(h, d);
        const cls = v === true ? 'done' : v === false ? 'missed' : '';
        return el('div', { class: `hd${k === tk ? ' today' : ''}` },
          el('span', {}, DAYS_SHORT[i]),
          el('button', {
            class: `check ${cls}${on ? '' : ' off'}`,
            title: on ? `${DAYS[i]} : ${v === true ? 'fait' : v === false ? 'pas fait' : 'non renseigné'}` : 'Pas prévu ce jour',
            'aria-label': `${h.name}, ${DAYS[i]}`,
            onclick: () => cycleHabit(h, k),
          }, v === true ? '✓' : v === false ? '✕' : ''),
        );
      })),
    );
  }));
  const todayHabits = state.habits.filter(h => habitApplies(h, today));
  const todayDone = todayHabits.filter(h => h.log[tk] === true).length;
  $('#habitCount').textContent = todayHabits.length ? `${todayDone}/${todayHabits.length} aujourd'hui` : '';
}

function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 864e5 + 1) / 7);
}

/* ================= Infobulle ================= */
const tip = $('#tip');
function showTip(target) {
  const text = target?.dataset.tip;
  if (!text) { tip.hidden = true; return; }
  tip.textContent = text; tip.hidden = false;
  const r = target.getBoundingClientRect(), w = tip.offsetWidth;
  tip.style.left = `${Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8)}px`;
  tip.style.top = `${Math.max(8, r.top - tip.offsetHeight - 8)}px`;
}
document.addEventListener('mouseover', e => showTip(e.target.closest('[data-tip]')));
document.addEventListener('focusin', e => showTip(e.target.closest('[data-tip]')));
document.addEventListener('scroll', () => { tip.hidden = true; }, true);

/* ================= Rappels ================= */
const NKEY = KEY + '-notified';
let notified = {};
try { notified = JSON.parse(localStorage.getItem(NKEY) || '{}'); } catch {}

function toast(title, body) {
  const t = el('div', { class: 'toast', role: 'status' },
    el('strong', {}, '🔔 ', title), body ? el('span', {}, body) : null,
    el('button', { class: 'ghost', 'aria-label': 'Fermer', onclick: () => t.remove() }, '×'));
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 60_000);
}
async function notify(title, body, tag) {
  toast(title, body);
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) await reg.showNotification(title, { body, tag, icon: 'icon.svg', badge: 'icon.svg' });
    else new Notification(title, { body, tag, icon: 'icon.svg' });
  } catch { /* le toast suffit */ }
}
async function askNotifications() {
  if (!('Notification' in window)) { toast('Notifications indisponibles', 'Ce navigateur ne les gère pas : les rappels s\'afficheront dans l\'appli.'); return; }
  if (Notification.permission === 'default') await Notification.requestPermission();
  updateNotifBtn();
}
function updateNotifBtn() {
  const p = 'Notification' in window ? Notification.permission : 'unsupported';
  $('#notifBtn').textContent = p === 'granted' ? '🔔 Notifications activées' : p === 'denied' ? '🔕 Notifications bloquées (réglages du navigateur)' : '🔔 Activer les notifications';
  $('#notifBtn').disabled = p !== 'default';
}

function checkReminders() {
  const n = now();
  for (const off of [0, 1]) { // aujourd'hui, et demain pour les rappels « la veille »
    const k = keyOf(addDays(n, off));
    for (const o of occurrencesOn(k)) {
      const t = o.t;
      if (t.remind == null || !t.time || o.status !== 'todo') continue;
      const [hh, mm] = t.time.split(':').map(Number);
      const at = fromKey(k); at.setHours(hh, mm - t.remind, 0, 0);
      const id = `${t.id}|${k}`;
      if (n >= at && n - at < 6 * 36e5 && !notified[id]) {
        notified[id] = k;
        const start = fromKey(k); start.setHours(hh, mm, 0, 0);
        const left = Math.round((start - n) / 6e4);
        const when = left <= 0 ? `Maintenant · ${t.time}` : off ? `Demain à ${t.time}`
          : left < 60 ? `Dans ${left} min · ${t.time}` : `Aujourd'hui à ${t.time}`;
        notify(t.title, when, id);
      }
    }
  }
  // Oublie les rappels de plus d'une semaine.
  const old = keyOf(addDays(n, -7));
  for (const [id, k] of Object.entries(notified)) if (k < old) delete notified[id];
  try { localStorage.setItem(NKEY, JSON.stringify(notified)); } catch {}
}

/* ================= Dialogues ================= */
let editing = null; // { t, k }
function openTask(id, k) {
  const t = state.tasks.find(t => t.id === id);
  if (!t) return;
  editing = { t, k };
  const f = $('#taskEdit').elements;
  f.title.value = t.title; f.date.value = t.date || ''; f.time.value = t.time || ''; f.note.value = t.note || '';
  f.repeat.value = t.repeat || ''; f.remind.value = t.remind ?? '';
  f.status.value = statusOf(t, k);
  syncTaskDialog();
  $('#taskDialog').showModal();
}
function syncTaskDialog() {
  const f = $('#taskEdit').elements, rep = f.repeat.value;
  const { t, k } = editing || {};
  f.date.parentElement.firstChild.textContent = rep ? 'Commence le ' : 'Jour ';
  $('#statusLegend').textContent = rep && k ? `Réalisée le ${fromKey(k).getDate()} ${MONTHS[fromKey(k).getMonth()]} ?` : 'Réalisée ?';
  $('#skipTask').hidden = !(t?.repeat && k);
  $('#repeatHint').hidden = !rep;
  $('#repeatHint').textContent = rep ? `${REPEAT_LABEL[rep]}. Supprimer efface toute la série ; « Pas ce jour » ne retire qu'une date.` : '';
  f.remind.disabled = !f.time.value;
}
$('#taskEdit').addEventListener('input', syncTaskDialog);
$('#taskDialog').addEventListener('close', () => {
  const ed = editing; editing = null;
  if (!ed || $('#taskDialog').returnValue !== 'save') return;
  const { t } = ed;
  const f = $('#taskEdit').elements;
  const wasRepeat = t.repeat, status = f.status.value || 'todo';
  t.title = f.title.value.trim() || t.title;
  t.time = f.time.value || '';
  t.note = f.note.value.trim();
  t.repeat = f.repeat.value || null;
  t.date = f.date.value || (t.repeat ? (ed.k || todayKey()) : null);
  t.remind = f.remind.value === '' || !t.time ? null : Number(f.remind.value);
  if (t.repeat && !wasRepeat) { t.log = {}; if (t.status !== 'todo' && t.date) t.log[t.date] = t.status; }
  if (!t.repeat && wasRepeat) t.status = 'todo';
  setStatus(t, t.repeat ? (ed.k && occurs(t, ed.k) ? ed.k : t.date) : null, status);
  if (t.remind != null) askNotifications();
  save(); render(); checkReminders();
});
$('#deleteTask').addEventListener('click', () => {
  if (!editing) return;
  if (editing.t.repeat && !confirm(`Supprimer toute la série « ${editing.t.title} » ?`)) return;
  state.tasks = state.tasks.filter(t => t !== editing.t);
  editing = null; save(); render(); $('#taskDialog').close();
});
$('#skipTask').addEventListener('click', () => {
  if (!editing?.k) return;
  editing.t.log[editing.k] = 'skip';
  editing = null; save(); render(); $('#taskDialog').close();
});

let editingHabit = null;
function openHabit(id) {
  const h = state.habits.find(h => h.id === id);
  if (!h) return;
  editingHabit = h;
  $('#habitEdit').elements.name.value = h.name;
  $('#habitDays').replaceChildren(...DAYS.map((n, i) =>
    el('label', {}, el('input', { type: 'checkbox', value: i, checked: !h.days || h.days.includes(i) }), n.slice(0, 3))));
  $('#habitDialog').showModal();
}
$('#habitDialog').addEventListener('close', () => {
  const h = editingHabit; editingHabit = null;
  if (!h || $('#habitDialog').returnValue !== 'save') return;
  h.name = $('#habitEdit').elements.name.value.trim() || h.name;
  const days = [...$('#habitDays').querySelectorAll('input:checked')].map(i => +i.value);
  h.days = days.length === 7 || days.length === 0 ? null : days;
  save(); render();
});
$('#deleteHabit').addEventListener('click', () => {
  if (editingHabit && confirm(`Supprimer l'habitude « ${editingHabit.name} » et son historique ?`)) {
    state.habits = state.habits.filter(h => h !== editingHabit);
    editingHabit = null; save(); render(); $('#habitDialog').close();
  }
});

/* ================= Événements ================= */
function shift(dir) {
  if (state.settings.view === 'month') anchor = new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
  else anchor = addDays(anchor, 7 * dir);
  render();
}
$('#prevWeek').addEventListener('click', () => shift(-1));
$('#nextWeek').addEventListener('click', () => shift(1));
$('#thisWeek').addEventListener('click', () => { anchor = now(); render(); });
document.querySelectorAll('.views button').forEach(b => b.addEventListener('click', () => {
  state.settings.view = b.dataset.view; save(); render();
}));
document.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, select, dialog')) return;
  if (e.key === 'ArrowLeft') $('#prevWeek').click();
  if (e.key === 'ArrowRight') $('#nextWeek').click();
});

$('#todoForm').addEventListener('submit', e => {
  e.preventDefault(); addTask($('#todoInput').value); $('#todoInput').value = ''; $('#todoInput').focus();
});
makeDropZone($('#todoList'), () => null);

$('#habitForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#habitInput').value.trim();
  if (!name) return;
  state.habits.push({ id: uid(), name, days: null, log: {} });
  $('#habitInput').value = '';
  save(); render();
});

$('#themeBtn').addEventListener('click', () => {
  state.settings.theme = { auto: 'light', light: 'dark', dark: 'auto' }[state.settings.theme] || 'auto';
  save(); applyTheme();
});

$('#menuBtn').addEventListener('click', () => { updateNotifBtn(); $('#menuDialog').showModal(); });
$('#notifBtn').addEventListener('click', askNotifications);
$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `agenda-${todayKey()}.json` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('#importBtn').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.tasks) || !Array.isArray(data.habits)) throw new Error('format');
    if (!confirm('Remplacer les données actuelles par celles du fichier ?')) return;
    state = normalize(data);
    save(); applyTheme(); render(); $('#menuDialog').close();
  } catch { alert('Fichier invalide.'); }
});
$('#resetBtn').addEventListener('click', () => {
  if (!confirm('Effacer toutes les tâches et habitudes ? Cette action est définitive.')) return;
  state = defaultState(); save(); applyTheme(); render(); $('#menuDialog').close();
});

// Synchronise les onglets ouverts en parallèle.
window.addEventListener('storage', e => { if (e.key === KEY) { state = load(); applyTheme(); render(); } });

/* ================= Démarrage ================= */
if (!state.tasks.length && !state.habits.length && !localStorage.getItem(KEY + '-seen')) {
  const t = todayKey(), tm = keyOf(addDays(now(), 1));
  state.tasks.push(
    { id: uid(), title: 'Préparer la semaine', date: t, time: '09:00', note: '', status: 'done', repeat: null, remind: null, log: {} },
    { id: uid(), title: 'Sport', date: tm, time: '18:30', note: '', status: 'todo', repeat: 'weekly', remind: 30, log: {} },
    { id: uid(), title: 'Appeler le médecin', date: null, time: '', note: '', status: 'todo', repeat: null, remind: null, log: {} },
  );
  state.habits.push(
    { id: uid(), name: 'Boire 1,5 L d\'eau', days: null, log: { [t]: true } },
    { id: uid(), name: 'Lire 20 minutes', days: null, log: {} },
  );
  try { localStorage.setItem(KEY + '-seen', '1'); } catch {}
  save();
}

applyTheme();
render();
checkReminders();

let lastDay = todayKey();
setInterval(() => {
  checkReminders();
  const k = todayKey();
  if (k !== lastDay) { // minuit : rafraîchir « aujourd'hui »
    if (keyOf(mondayOf(anchor)) === keyOf(mondayOf(fromKey(lastDay)))) anchor = now();
    lastDay = k; render();
  }
}, 20_000);
setInterval(applyTheme, 60_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { applyTheme(); checkReminders(); render(); } });

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
