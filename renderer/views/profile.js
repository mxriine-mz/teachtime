// Page Profil : avatar de Marine, niveau, chiffres, avancement par partie, calendrier et badges.
import { h, modal, todayKey } from '../lib/ui.js';
import { icon } from '../lib/icons.js';
import { mascot } from '../lib/mascot.js';
import { CATS } from './activities.js';
import { usePlayerSprite } from './game.js';
import { playerPortrait } from './game-world.js';

export const DEFAULT_NAME = 'Marine';

export async function profileName(ctx) {
  const p = (await ctx.api.getItem('profile')) || {};
  return (p.name || '').trim() || DEFAULT_NAME;
}

// Niveau n atteint à 150 × n × (n − 1) points : 300 pour le 2, 900 pour le 3, 13 500 pour le 10.
const need = (n) => 150 * n * (n - 1);
export function levelOf(total) {
  let n = 1;
  while (need(n + 1) <= total) n++;
  return { n, from: need(n), to: need(n + 1) };
}
const TITLES = [[17, 'Grande maîtresse du thé'], [12, 'Salon de thé'], [8, 'Théière'], [5, 'Tasse fumante'], [3, 'Infusion'], [1, 'Feuille de thé']];
const titleOf = (n) => TITLES.find(([min]) => n >= min)[1];

const KINDS = {
  ...Object.fromEntries(Object.entries(CATS).map(([k, c]) => [k, { label: c.label, icon: c.icon }])),
  lesson: { label: 'Cours', icon: 'book' },
  memorize: { label: 'Mémoriser', icon: 'pencil' },
  speak: { label: 'Oral', icon: 'mic' },
};

const nf = new Intl.NumberFormat('fr-FR');
const fmt = (n) => nf.format(n);

function parseDay(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function longDate(k) {
  const d = parseDay(k);
  const s = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return d.getDate() === 1 ? s.replace(/^1 /, '1er ') : s;
}
const jours = (n) => (n > 1 ? 'jours' : 'jour');

// Meilleure série de jours au quota, et nombre total de jours au quota.
function streaks(byDay, quota) {
  const days = Object.keys(byDay).filter((k) => byDay[k] >= quota).sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const k of days) {
    const d = parseDay(k);
    run = prev && Math.round((d - prev) / 86400000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { best, met: days.length };
}

// ---------- Avatar ----------
function avatar(ctx) {
  const box = h('div', { class: 'pf-avatar' });
  const pic = playerPortrait();
  if (!pic) {
    box.append(mascot({ size: 120, alone: true, mood: 'random' }));
    return { el: box, stop: () => {} };
  }
  const S = 5;
  const cv = h('canvas', { width: pic.still.width * S, height: pic.still.height * S, 'aria-label': 'Ton avatar' });
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  const draw = (img) => { g.clearRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height); };
  draw(pic.still);
  box.append(h('div', { class: 'pf-ground' }), cv);
  // Un clin d'oeil de temps en temps, jamais à intervalle fixe.
  let timer = null;
  const loop = () => {
    timer = setTimeout(() => {
      if (pic.blink) { draw(pic.blink); setTimeout(() => draw(pic.still), 160); }
      loop();
    }, 2500 + Math.random() * 3500);
  };
  loop();
  return { el: box, stop: () => clearTimeout(timer) };
}

function editName(ctx, current, onDone) {
  const m = modal('Ton prénom');
  const input = h('input', { type: 'text', value: current, maxlength: 30, autocomplete: 'off' });
  const save = async () => {
    const name = input.value.trim().slice(0, 30);
    const p = (await ctx.api.getItem('profile')) || {};
    await ctx.api.setItem('profile', { ...p, name: name || DEFAULT_NAME });
    m.close();
    onDone();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  m.body.append(
    h('p', { class: 'muted' }, 'Il s\'affiche sur l\'accueil et sur ton profil.'),
    input,
    h('div', { class: 'row', style: { marginTop: '14px' } },
      h('button', { class: 'btn primary', onclick: save }, 'Enregistrer'),
      h('button', { class: 'btn', onclick: m.close }, 'Annuler')));
  input.focus();
  input.select();
}

// ---------- Blocs ----------
function progressRow(ic, label, value, max, detail) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return h('div', { class: 'pf-prog' },
    h('div', { class: 'pf-prog-ico' }, icon(ic, 20)),
    h('div', { class: 'pf-prog-body' },
      h('div', { class: 'row', style: { gap: '6px' } },
        h('b', {}, label), h('div', { class: 'spacer' }),
        h('span', { class: 'pf-prog-num' }, max ? `${fmt(value)} / ${fmt(max)}` : fmt(value))),
      max ? h('div', { class: 'bar' }, h('div', { class: `fill${pct >= 100 ? ' done' : ''}`, style: { width: `${pct}%` } })) : null,
      detail ? h('div', { class: 'small muted', style: { marginTop: '5px' } }, detail) : null));
}

function heatmap(byDay, quota, weeks = 18) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Lundi de la semaine en cours, puis on recule.
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const start = new Date(monday);
  start.setDate(monday.getDate() - (weeks - 1) * 7);
  const cells = [];
  const months = [];
  let lastMonth = -1;
  let lastLabel = -9;
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const x = new Date(start);
      x.setDate(start.getDate() + w * 7 + d);
      if (d === 0) {
        const mo = x.getMonth();
        const show = mo !== lastMonth && w - lastLabel >= 3 && !(w === 0 && x.getDate() > 22);
        months.push(show ? x.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '') : '');
        if (show) lastLabel = w;
        lastMonth = mo;
      }
      if (x > today) { cells.push(h('i', { class: 'pf-day future' })); continue; }
      const k = todayKey(x);
      const p = byDay[k] || 0;
      const lv = p === 0 ? 0 : p < quota / 3 ? 1 : p < quota ? 2 : p < quota * 2 ? 3 : 4;
      cells.push(h('i', { class: `pf-day l${lv}${k === todayKey(today) ? ' today' : ''}`, title: `${longDate(k)} : ${fmt(p)} points` }));
    }
  }
  const cols = { gridTemplateColumns: `repeat(${weeks}, var(--cell))` };
  const legend = [0, 1, 2, 3, 4].map((lv) => h('i', { class: `pf-day l${lv}` }));
  return h('div', { class: 'pf-heat' },
    h('div', { class: 'pf-heat-wrap' },
      h('div', { class: 'pf-heat-days' }, ['L', '', 'M', '', 'V', '', 'D'].map((t) => h('span', {}, t))),
      h('div', {},
        h('div', { class: 'pf-heat-months', style: cols }, months.map((t) => h('span', {}, t))),
        h('div', { class: 'pf-heat-grid', style: cols }, cells))),
    h('div', { class: 'row small muted', style: { gap: '5px', marginTop: '10px' } },
      'Moins', ...legend, 'Plus', h('div', { class: 'spacer' }), `Case pleine : quota de ${quota} points atteint`));
}

// Autant de semaines que la carte en contient (un an au plus), mesuré une fois la carte affichée.
function weeksFor(card) {
  const step = window.matchMedia('(max-width: 600px)').matches ? 16 : 18; // case + espace
  const inner = card.clientWidth - 40 - 26; // marges de la carte et colonne des jours
  return Math.max(13, Math.min(53, Math.floor((inner + 3) / step)));
}

function kindBars(byKind) {
  const rows = Object.entries(byKind).filter(([, v]) => v > 0);
  const merged = {};
  for (const [k, v] of rows) { const key = KINDS[k] ? k : 'other'; merged[key] = (merged[key] || 0) + v; }
  const list = Object.entries(merged).sort((a, b) => b[1] - a[1]);
  if (!list.length) return h('p', { class: 'muted' }, 'Pas encore de points : lance une série depuis l\'accueil.');
  const max = list[0][1];
  return h('div', { class: 'pf-kinds' }, list.map(([k, v]) => {
    const meta = KINDS[k] || { label: 'Autres', icon: 'star' };
    return h('div', { class: 'pf-kind' },
      h('span', { class: 'pf-kind-label' }, icon(meta.icon, 16), meta.label),
      h('div', { class: 'pf-kind-bar' }, h('div', { style: { width: `${Math.max(3, (v / max) * 100)}%` } })),
      h('span', { class: 'pf-kind-num' }, fmt(v)));
  }));
}

function badgeTile(b) {
  const got = b.value >= b.goal;
  return h('div', { class: `pf-badge${got ? ' got' : ''}`, title: got ? 'Débloqué' : `${fmt(Math.min(b.value, b.goal))} / ${fmt(b.goal)}` },
    h('div', { class: 'pf-badge-ico' }, icon(got ? b.icon : 'lock', 22)),
    h('b', {}, b.title),
    h('span', { class: 'small muted' }, b.hint),
    got ? null : h('div', { class: 'bar', style: { marginTop: '8px' } }, h('div', { class: 'fill', style: { width: `${Math.min(100, (b.value / b.goal) * 100)}%` } })));
}

// ---------- Page ----------
export async function render(root, ctx) {
  const s = await ctx.refresh();
  await usePlayerSprite(ctx);
  const [st, name, lessons, lessonsDone, lists, texts, roleplays, rpDone, qstats] = await Promise.all([
    ctx.api.stats ? ctx.api.stats() : { byDay: {}, byKind: {}, unlockDays: [] },
    profileName(ctx),
    ctx.content('lessons'),
    ctx.api.getItem('lessonsDone'),
    ctx.api.listItems('vlist:'),
    ctx.api.listItems('text:'),
    ctx.content('roleplays'),
    ctx.api.getItem('roleplaysDone'),
    ctx.api.getItem('qstats'),
  ]);

  const total = Object.values(st.byDay).reduce((a, b) => a + b, 0);
  const lv = levelOf(total);
  const { best, met } = streaks(st.byDay, s.quota);
  const days = Object.keys(st.byDay).filter((k) => st.byDay[k] > 0).sort();
  const since = days[0] || s.setupDay || s.today;

  const nLessons = (lessons || []).length;
  const nLessonsDone = Object.keys(lessonsDone || {}).filter((id) => (lessons || []).some((l) => l.id === id)).length;
  let acquired = 0; let learning = 0; let nWords = 0;
  for (const l of lists) for (const c of l.value.cards || []) {
    nWords++;
    if ((c.box || 0) >= 2) acquired++;
    else if (c.due) learning++;
  }
  const nTexts = texts.length;
  const learnedTexts = texts.filter((t) => t.value.path ? t.value.path.learned : !!t.value.srs).length;
  const nRp = (roleplays || []).length;
  const nRpDone = Object.keys(rpDone || {}).length;
  let answers = 0; let wrong = 0;
  for (const q of Object.values(qstats || {})) { answers += q.seen || 0; wrong += q.wrong || 0; }
  const success = answers ? Math.round(((answers - wrong) / answers) * 100) : null;

  const av = avatar(ctx);
  const cl = s.cloud || {};
  const online = cl.user && (s.platform !== 'web' || cl.mode === 'cloud');
  const account = online
    ? [icon('check', 15), ' Compte en ligne : ', h('b', {}, cl.user.email || '')]
    : [icon('monitor', 15), ' Progression gardée sur cet appareil'];

  const badges = [
    { icon: 'cup', title: 'Première tasse', hint: 'Atteindre le quota un jour', value: met, goal: 1 },
    { icon: 'flame', title: 'Une semaine', hint: '7 jours d\'affilée au quota', value: best, goal: 7 },
    { icon: 'flame', title: 'Un mois', hint: '30 jours d\'affilée au quota', value: best, goal: 30 },
    { icon: 'star', title: '1 000 points', hint: 'Au total, depuis le début', value: total, goal: 1000 },
    { icon: 'star', title: '10 000 points', hint: 'Au total, depuis le début', value: total, goal: 10000 },
    { icon: 'book', title: 'Studieuse', hint: 'Valider 5 cours', value: nLessonsDone, goal: 5 },
    { icon: 'bookOpen', title: 'Tous les cours', hint: `Valider les ${nLessons} cours`, value: nLessonsDone, goal: Math.max(1, nLessons) },
    { icon: 'cards', title: '50 mots', hint: '50 mots de vocabulaire acquis', value: acquired, goal: 50 },
    { icon: 'cards', title: '200 mots', hint: '200 mots de vocabulaire acquis', value: acquired, goal: 200 },
    { icon: 'pencil', title: 'Par coeur', hint: 'Apprendre un texte en entier', value: learnedTexts, goal: 1 },
    { icon: 'chat', title: 'Bavarde', hint: `Finir les ${nRp} jeux de rôle`, value: nRpDone, goal: Math.max(1, nRp) },
    { icon: 'check', title: 'Bonne élève', hint: '500 réponses aux questions', value: answers, goal: 500 },
  ];
  const nGot = badges.filter((b) => b.value >= b.goal).length;

  const pct = Math.round(((total - lv.from) / (lv.to - lv.from)) * 100);
  const heatCard = h('div', { class: 'card', style: { marginTop: '16px' } }, h('h2', {}, 'Ton calendrier'));
  root.append(
    h('div', { class: 'card pf-hero' },
      av.el,
      h('div', { class: 'pf-id' },
        h('div', { class: 'row', style: { gap: '8px' } },
          h('h1', { style: { margin: 0 } }, name),
          h('button', { class: 'btn ghost pf-edit', title: 'Changer de prénom', 'aria-label': 'Changer de prénom', onclick: () => editName(ctx, name, () => ctx.go('profile')) }, icon('pencil', 15))),
        h('div', { class: 'pf-level' }, h('span', { class: 'pf-lv' }, `Niveau ${lv.n}`), titleOf(lv.n)),
        h('div', { class: 'bar pf-xp' }, h('div', { class: 'fill', style: { width: `${pct}%` } })),
        h('div', { class: 'small muted' }, `${fmt(total - lv.from)} / ${fmt(lv.to - lv.from)} points pour le niveau ${lv.n + 1}`),
        h('div', { class: 'pf-meta small' },
          h('span', {}, icon('clock', 15), ` Première séance le ${longDate(since)}`),
          h('span', {}, ...account)))),
    h('div', { class: 'grid c4', style: { marginTop: '16px' } },
      h('div', { class: 'card stat' }, h('b', {}, fmt(total)), h('span', {}, 'points en tout')),
      h('div', { class: 'card stat' }, h('b', {}, fmt(met)), h('span', {}, `${jours(met)} au quota`)),
      h('div', { class: 'card stat' }, h('b', { class: 'streak' }, icon('flame', 26), `${s.streak}`), h('span', {}, `${jours(s.streak)} d'affilée en ce moment`)),
      h('div', { class: 'card stat' }, h('b', {}, fmt(best)), h('span', {}, `${jours(best)}, ta meilleure série`))),
    h('div', { class: 'grid c2', style: { marginTop: '16px' } },
      h('div', { class: 'card' },
        h('h2', {}, 'Ton avancement'),
        h('div', { class: 'stack' },
          progressRow('book', 'Cours validés', nLessonsDone, nLessons, null),
          progressRow('cards', 'Mots acquis', acquired, nWords, nWords ? `${fmt(learning)} en cours d'apprentissage, sur ${lists.length} listes` : 'Ouvre une liste dans Vocabulaire pour commencer'),
          progressRow('pencil', 'Textes appris par coeur', learnedTexts, nTexts, nTexts ? null : 'Ajoute un texte dans Mémoriser'),
          progressRow('chat', 'Jeux de rôle terminés', nRpDone, nRp, null),
          progressRow('check', 'Réponses aux questions', answers, 0, success == null ? 'Aucune question pour l\'instant' : `${success} % de bonnes réponses`))),
      h('div', { class: 'card' },
        h('h2', {}, 'Tes points par partie'),
        kindBars(st.byKind))),
    heatCard,
    h('div', { class: 'row', style: { marginTop: '26px', alignItems: 'baseline' } },
      h('h2', { style: { margin: 0 } }, 'Tes badges'),
      h('span', { class: 'muted small' }, `${nGot} / ${badges.length} débloqués`)),
    h('div', { class: 'grid c4 pf-badges', style: { marginTop: '12px' } }, badges.map(badgeTile)),
  );
  const heat = heatmap(st.byDay, s.quota, weeksFor(heatCard));
  heatCard.append(heat);
  heat.scrollLeft = heat.scrollWidth; // aujourd'hui à droite, toujours visible
  window.__teachProfile = { total, level: lv.n, best, met, acquired, nLessonsDone, nGot };
  return () => av.stop();
}
