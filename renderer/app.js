import { h, clear, toast, modal } from './lib/ui.js';
import * as tts from './lib/tts.js';
import { mascot } from './lib/mascot.js';
import { icon } from './lib/icons.js';
import * as theme from './lib/theme.js';

const api = window.api;
let sideCat = null; // Chaussette dans le menu : réagit aux points

const VIEWS = {
  home: () => import('./views/home.js'),
  game: () => import('./views/game.js'),
  lessons: () => import('./views/lessons.js'),
  memorize: () => import('./views/memorize.js'),
  vocab: () => import('./views/vocab.js'),
  speak: () => import('./views/speak.js'),
  profile: () => import('./views/profile.js'),
  settings: () => import('./views/settings.js'),
  setup: () => import('./views/setup.js'),
  login: () => import('./views/login.js'),
};

const contentCache = {};
let state = null;
let current = null;
let cleanup = null;
let wasLocked = false;

const ctx = {
  api,
  get state() { return state; },
  toast,
  async content(name) {
    if (!contentCache[name]) contentCache[name] = await api.content(name);
    return contentCache[name];
  },
  async award(kind, pts, ref, { quiet = false } = {}) {
    if (!pts) return state;
    const before = state ? state.points : 0;
    state = await api.addPoints(kind, pts, ref);
    renderChrome();
    if (sideCat) {
      // Réactions variées : jamais toujours la même tête.
      if (before < state.quota && state.points >= state.quota) sideCat.react(['clin-oeil', 'contente'], 2500 + Math.random() * 2500);
      else sideCat.react(Math.random() < 0.8 ? ['contente', 'clin-oeil'] : 'random');
    }
    if (!quiet) toast(`+${pts} points`, 'ok');
    return state;
  },
  async refresh() {
    state = await api.getState();
    renderChrome();
    return state;
  },
  go(view, params) { navigate(view, params); },
};

function hhmm(hh, mm) {
  return `${String(hh).padStart(2, '0')} h ${String(mm).padStart(2, '0')}`;
}

function renderChrome() {
  if (!state) return;
  const done = state.points >= state.quota;
  document.getElementById('pts').textContent = state.points;
  document.getElementById('quota').textContent = state.quota;
  const bar = document.getElementById('bar');
  bar.style.width = `${Math.min(100, (state.points / state.quota) * 100)}%`;
  bar.classList.toggle('done', done);

  const info = document.getElementById('lockinfo');
  const web = state.platform === 'web';
  const cl = state.cloud || {};
  if (!state.setupDone) info.textContent = '';
  else if (web) info.textContent = cl.mode !== 'cloud' ? 'Sur cet appareil' : cl.status === 'error' ? 'Synchro en échec' : cl.status === 'offline' ? 'Hors ligne' : cl.status === 'syncing' ? 'Synchronisation…' : 'Synchronisé';
  else if (state.locked) info.replaceChildren(icon('lock', 15), ' Verrou actif');
  else if (done) info.replaceChildren(icon('check', 15), ' Quota atteint, le PC reste libre ce soir');
  else if (state.unlockedToday) info.textContent = 'Débloqué avec le code aujourd\'hui';
  else if (!state.lockArmed) info.textContent = 'Verrou en pause';
  else if (state.setupDay === state.today) info.textContent = 'Jour d\'essai : le verrou commence demain';
  else info.textContent = `Verrou à ${hhmm(state.lockHour, state.lockMinute)} s'il manque des points`;

  const s = document.getElementById('streak');
  clear(s).append(h('b', { class: 'streak' }, icon('flame', 22), `${state.streak}`), state.streak > 1 ? 'jours d\'affilée' : 'jour d\'affilée');

  const banner = document.getElementById('lockbanner');
  banner.hidden = !state.locked;
  if (state.locked) {
    clear(banner).append(
      h('div', { class: 'msg' }, icon('cup', 18), ' It\'s tea time ! C\'est l\'heure de ton anglais. Il te manque ', h('b', {}, `${state.remaining} points`), ' pour libérer le PC.'),
      h('button', { class: 'btn ghost', style: { color: 'var(--nav-ink)', borderColor: 'color-mix(in srgb, var(--nav-ink) 45%, transparent)' }, onclick: emergency }, 'Code d\'urgence'),
    );
  }
  if (wasLocked && !state.locked && done) toast('Quota atteint, bravo ! Le PC est libre.', 'ok');
  wasLocked = state.locked;

  document.getElementById('nav').style.display = state.setupDone ? '' : 'none';
  document.getElementById('topbar').style.display = state.setupDone ? '' : 'none';
}

function emergency() {
  const m = modal('Code d\'urgence');
  const input = h('input', { type: 'password', placeholder: 'Ton code', autocomplete: 'off' });
  const err = h('p', { class: 'small', style: { color: 'var(--bad)', minHeight: '20px' } });
  const go = async () => {
    const r = await api.emergencyUnlock(input.value);
    if (r.ok) { m.close(); await ctx.refresh(); toast('Débloqué pour aujourd\'hui.'); }
    else { err.textContent = 'Code incorrect.'; input.select(); }
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  m.body.append(
    h('p', {}, 'Le code débloque le PC jusqu\'à minuit. Garde-le pour les vraies urgences : ta série de jours s\'arrête si le quota n\'est pas atteint.'),
    input, err,
    h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: go }, 'Débloquer'), h('button', { class: 'btn', onclick: m.close }, 'Annuler')),
  );
  input.focus();
}

async function navigate(view, params = {}) {
  if (!state.setupDone) view = state.platform === 'web' ? 'login' : 'setup';
  if (cleanup) { try { cleanup(); } catch { /* rien */ } cleanup = null; }
  tts.stop();
  current = view;
  document.querySelectorAll('#nav nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  const root = document.getElementById('view');
  clear(root);
  root.className = view === 'game' ? 'full' : '';
  try {
    const mod = await VIEWS[view]();
    const c = await mod.render(root, ctx, params);
    if (typeof c === 'function') cleanup = c;
  } catch (e) {
    console.error(e);
    root.append(h('div', { class: 'card' }, h('h2', {}, 'Oups, cet écran a planté'), h('p', { class: 'muted' }, String(e && e.message || e))));
  }
}

async function boot() {
  // Le thème d'abord, pour éviter un flash de couleurs.
  theme.onChange((_ap, vars) => api.setBlockerColors({ bg: vars.nav, ink: vars['nav-ink'], accent: vars['accent-2'] }));
  await theme.load(api);
  state = await api.getState();
  if (state.voice) tts.setPreferred(state.voice);
  // En haut à gauche : Chaussette dans sa tasse (choix de Marine), qui réagit aux points.
  const logo = document.querySelector('#nav .logo');
  if (logo) {
    sideCat = mascot({ size: 48 });
    sideCat.classList.add('logo');
    logo.replaceWith(sideCat);
  }
  const NAV_ICONS = { home: 'home', game: 'map', lessons: 'book', memorize: 'pencil', vocab: 'cards', speak: 'mic', profile: 'user', settings: 'gear' };
  document.querySelectorAll('#nav nav button').forEach((b) => {
    const s = b.querySelector('.ico');
    if (s) s.replaceChildren(icon(NAV_ICONS[b.dataset.view], 18));
  });
  renderChrome();
  document.querySelectorAll('#nav nav button').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.view)));
  api.onState((s) => {
    const setupChanged = state && s.setupDone !== state.setupDone;
    state = s;
    renderChrome();
    if (setupChanged) navigate('home');
  });
  window.teachtime = { navigate, ctx, theme }; // utilisé par l'autotest
  // PC pas encore connecté à la base en ligne : la page de connexion d'abord (sauf si « Plus tard »).
  let later = false;
  try { later = localStorage.getItem('tt.loginLater') === '1'; } catch { /* rien */ }
  const needLogin = state.platform !== 'web' && state.setupDone && !state.locked && !(state.cloud && state.cloud.user) && !later;
  navigate(!state.setupDone ? (state.platform === 'web' ? 'login' : 'setup') : needLogin ? 'login' : 'home');
}

boot();
