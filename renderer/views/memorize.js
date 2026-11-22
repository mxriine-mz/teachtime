// Mémoriser un texte (devoirs, oral à préparer).
// Parcours guidé (choix de Marine) : le texte est découpé en blocs de 2 ou 3 phrases, appris bloc par bloc
// puis cumulés (bloc 1, bloc 2, blocs 1 et 2, bloc 3, blocs 1 à 3…). Chaque bloc passe par des étapes
// de plus en plus dures ; une étape est validée à 85 %, sinon on la refait. Une fois le texte su,
// les révisions espacées demandent de le réciter en entier. Les exercices restent accessibles librement.
import { h, clear, uid, todayKey, addDays, modal } from '../lib/ui.js';
import * as tts from '../lib/tts.js';
import { icon } from '../lib/icons.js';
import { words, sentences, listenStep, gapsStep, orderStep, typeStep, reciteStep } from './memo-steps.js';

const LADDER = [1, 3, 7, 14, 30]; // jours avant la révision suivante
const PASS = 85;

const MODES = [
  ['path', 'Parcours'],
  ['read', 'Écouter'],
  ['hide', 'Texte à trous'],
  ['letters', 'Premières lettres'],
  ['order', 'Remettre dans l\'ordre'],
  ['type', 'Écrire de mémoire'],
  ['recite', 'Réciter au micro'],
];

const STEP_LABEL = {
  listen: 'Écouter et lire',
  gaps20: 'Texte à trous, 20 % des mots',
  gaps50: 'Texte à trous, 50 % des mots',
  gaps80: 'Texte à trous, 80 % des mots',
  letters: 'Premières lettres',
  order: 'Remettre dans l\'ordre',
  type: 'Écrire de mémoire',
  recite: 'Réciter au micro',
};
const CHUNK_STEPS = ['listen', 'gaps20', 'gaps50', 'gaps80', 'letters', 'order'];
const CUMUL_STEPS = ['letters', 'type', 'recite'];
const SINGLE_STEPS = ['listen', 'gaps20', 'gaps50', 'gaps80', 'letters', 'order', 'type', 'recite'];

// Blocs de 2 ou 3 phrases (une trentaine de mots au plus).
export function chunkText(body) {
  const groups = [];
  let cur = [];
  let n = 0;
  for (const s of sentences(body)) {
    cur.push(s);
    n += words(s).length;
    if (cur.length >= 3 || n >= 28) { groups.push(cur.join(' ')); cur = []; n = 0; }
  }
  if (cur.length) {
    if (groups.length && n < 8) groups[groups.length - 1] += ` ${cur.join(' ')}`;
    else groups.push(cur.join(' '));
  }
  return groups.length ? groups : [String(body).trim()];
}

// Étapes du parcours : bloc 1, puis pour chaque bloc suivant, le bloc seul puis le cumul.
export function plan(body) {
  const g = chunkText(body);
  if (g.length === 1) return [{ label: 'Le texte', text: g[0], steps: SINGLE_STEPS }];
  const units = [{ label: 'Bloc 1', text: g[0], steps: CHUNK_STEPS }];
  for (let k = 1; k < g.length; k++) {
    units.push({ label: `Bloc ${k + 1}`, text: g[k], steps: CHUNK_STEPS });
    units.push({ label: k === g.length - 1 ? 'Tout le texte' : `Blocs 1 à ${k + 1}`, text: g.slice(0, k + 1).join(' '), steps: CUMUL_STEPS });
  }
  return units;
}

function bodyKey(body) {
  let x = 0;
  for (const c of String(body)) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  return `${String(body).length}-${x}`;
}

function freshPath(body) {
  return { key: bodyKey(body), unit: 0, step: 0, learned: false };
}

async function saveText(ctx, t) {
  await ctx.api.setItem(`text:${t.id}`, t);
}

// Révision espacée après une récitation ou une écriture du texte entier.
async function review(ctx, t, score) {
  const srs = t.srs || { reps: 0, due: todayKey() };
  if (score >= PASS) srs.reps = Math.min(LADDER.length - 1, (srs.reps || 0) + 1);
  else if (score < 60) srs.reps = 0;
  srs.due = addDays(todayKey(), LADDER[srs.reps || 0]);
  t.srs = srs;
  await saveText(ctx, t);
  return srs.due;
}

// Points plafonnés par texte et par jour.
async function awardCapped(ctx, ref, pts, maxTimes = 2) {
  if (pts <= 0) return 0;
  const n = await ctx.api.countToday(ref);
  if (n >= maxTimes) return 0;
  await ctx.award('memorize', pts, ref, { quiet: true });
  return pts;
}

const frDate = (d) => d.split('-').reverse().slice(0, 2).join('/');

export async function render(root, ctx, params = {}) {
  if (params.id) {
    const t = await ctx.api.getItem(`text:${params.id}`);
    if (t) return practice(root, ctx, t, params.mode || 'path');
  }
  if (params.edit !== undefined) return editor(root, ctx, params.edit ? await ctx.api.getItem(`text:${params.edit}`) : null);
  return list(root, ctx);
}

async function list(root, ctx) {
  const today = todayKey();
  const texts = (await ctx.api.listItems('text:')).map((x) => x.value).sort((a, b) => (a.srs?.due || '').localeCompare(b.srs?.due || ''));
  const tagOf = (t) => {
    const p = t.path;
    if (p && !p.learned) {
      const units = plan(t.body);
      const done = units.slice(0, p.unit).reduce((n, u) => n + u.steps.length, 0) + p.step;
      const total = units.reduce((n, u) => n + u.steps.length, 0);
      return h('span', { class: 'tag' }, done ? `apprentissage ${Math.round((done / total) * 100)} %` : 'à apprendre');
    }
    const due = (t.srs?.due || today) <= today;
    return due ? h('span', { class: 'tag warn' }, 'à réviser') : h('span', { class: 'tag ok' }, `su · révision le ${frDate(t.srs.due)}`);
  };
  root.append(
    h('div', { class: 'row' },
      h('div', {}, h('h1', {}, 'Mémoriser'), h('p', { class: 'sub', style: { marginBottom: 0 } }, 'Colle un texte à apprendre (devoir, présentation orale, dialogue). Il est découpé en petits blocs et appris pas à pas, jusqu\'à le réciter par cœur.')),
      h('div', { class: 'spacer' }),
      h('button', { class: 'btn primary big', onclick: () => ctx.go('memorize', { edit: '' }) }, icon('plus', 18), 'Nouveau texte')),
    texts.length
      ? h('div', { class: 'grid c3', style: { marginTop: '22px' } }, texts.map((t) => h('div', { class: 'card click', onclick: () => ctx.go('memorize', { id: t.id }) },
        h('div', { class: 'row' }, tagOf(t)),
        h('h3', { style: { marginTop: '8px' } }, t.title),
        h('p', { class: 'small muted' }, `${words(t.body).length} mots · ${chunkText(t.body).length} bloc${chunkText(t.body).length > 1 ? 's' : ''}`))))
      : h('div', { class: 'card empty', style: { marginTop: '22px' } }, 'Aucun texte pour l\'instant. Ajoute ton premier devoir à apprendre.'),
  );
}

function editor(root, ctx, t) {
  const title = h('input', { type: 'text', value: t?.title || '', placeholder: 'Ex. : Présentation de mon stage' });
  const body = h('textarea', { placeholder: 'Colle ici le texte en anglais…', style: { minHeight: '280px' } });
  body.value = t?.body || '';
  const err = h('p', { class: 'small', style: { color: 'var(--bad)', minHeight: '20px' } });
  const save = async () => {
    if (!title.value.trim() || words(body.value).length < 3) { err.textContent = 'Il faut un titre et au moins quelques mots.'; return; }
    const item = t || { id: uid(), created: Date.now(), srs: { reps: 0, due: todayKey() } };
    item.title = title.value.trim();
    // Texte modifié : le parcours repart du début.
    if (!t || item.body !== body.value.trim()) item.path = freshPath(body.value.trim());
    item.body = body.value.trim();
    await saveText(ctx, item);
    ctx.go('memorize', { id: item.id });
  };
  const del = async () => {
    const m = modal('Supprimer ce texte ?');
    m.body.append(h('p', {}, `« ${t.title} » sera retiré de tes textes, sur tous tes PC.`),
      h('div', { class: 'row' },
        h('button', { class: 'btn danger', onclick: async () => { await ctx.api.delItem(`text:${t.id}`); m.close(); ctx.go('memorize'); } }, 'Supprimer'),
        h('button', { class: 'btn', onclick: m.close }, 'Annuler')));
  };
  clear(root).append(
    h('button', { class: 'btn ghost', onclick: () => ctx.go('memorize') }, icon('arrowLeft', 16), 'Mes textes'),
    h('h1', { style: { marginTop: '14px' } }, t ? 'Modifier le texte' : 'Nouveau texte'),
    h('div', { class: 'card', style: { maxWidth: '860px' } },
      h('label', { class: 'field' }, h('span', {}, 'Titre'), title),
      h('label', { class: 'field' }, h('span', {}, 'Texte en anglais'), body),
      h('p', { class: 'small muted' }, 'Si tu modifies le texte, son parcours d\'apprentissage repart du début.'),
      err,
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: save }, 'Enregistrer'), t ? h('button', { class: 'btn danger', onclick: del }, 'Supprimer') : null)));
  title.focus();
}

// Mots ratés par étape, gardés le temps de la session (ils restent cachés au tour suivant).
const missedByStep = new Map();

async function renderPath(area, ctx, t) {
  clear(area);
  tts.stop();
  const units = plan(t.body);
  if (!t.path || t.path.key !== bodyKey(t.body)) { t.path = freshPath(t.body); await saveText(ctx, t); }
  const p = t.path;
  window.__teachMemo = { state: () => ({ unit: p.unit, step: p.step, units: units.length, stepId: units[p.unit] ? units[p.unit].steps[p.step] : null, learned: p.learned, due: t.srs?.due }) };

  if (p.learned) return renderReview(area, ctx, t, units);

  const u = units[p.unit];
  const stepId = u.steps[p.step];
  const totalSteps = units.reduce((n, x) => n + x.steps.length, 0);
  const doneSteps = units.slice(0, p.unit).reduce((n, x) => n + x.steps.length, 0) + p.step;

  // Carte du parcours : blocs, puis étapes du bloc en cours.
  const map = h('div', { class: 'path-map' }, units.map((x, i) => h('span', { class: `path-unit ${i < p.unit ? 'done' : i === p.unit ? 'cur' : ''}` }, i < p.unit ? icon('check', 12) : null, x.label)));
  const stepsRow = h('div', { class: 'path-steps' }, u.steps.map((s, i) => h('span', { class: `path-step ${i < p.step ? 'done' : i === p.step ? 'cur' : ''}` }, `${i + 1}. ${STEP_LABEL[s]}`)));
  const zone = h('div', { style: { marginTop: '14px' } });
  const fb = h('div', { style: { marginTop: '12px' } });

  const advance = async () => {
    p.step++;
    if (p.step >= u.steps.length) { p.unit++; p.step = 0; }
    if (p.unit >= units.length) {
      p.learned = true;
      t.learnedAt = t.learnedAt || Date.now();
      // Première révision demain, puis 3, 7, 14 et 30 jours si elles sont réussies.
      t.srs = { reps: 0, due: addDays(todayKey(), LADDER[0]) };
      const due = t.srs.due;
      if ((await ctx.api.countToday(`memo:${t.id}:learned`)) === 0) await ctx.award('memorize', 30, `memo:${t.id}:learned`, { quiet: true });
      ctx.toast(`Texte su ! +30 points · révision le ${frDate(due)}`, 'ok');
    }
    await saveText(ctx, t);
    renderPath(area, ctx, t);
  };

  const onDone = async (score) => {
    clear(fb);
    if (stepId === 'listen') { advance(); return; }
    if (score >= PASS) {
      missedByStep.delete(`${t.id}:${p.unit}:${p.step}`);
      const got = await awardCapped(ctx, `memo:${t.id}:path`, 10, 20);
      fb.append(h('div', { class: 'explain ok' }, h('b', {}, `Étape validée ! ${got ? '+10' : ''}`),
        h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn primary', 'data-next': '1', onclick: advance }, 'Étape suivante', icon('arrowRight', 16)))));
    } else {
      fb.append(h('div', { class: 'explain bad' }, h('b', {}, `Pas encore : il faut ${PASS} %. `), stepId.startsWith('gaps') || stepId === 'letters' ? 'Les mots ratés restent cachés au prochain tour.' : 'Relis le bloc, puis recommence.',
        h('div', { class: 'row', style: { marginTop: '10px' } },
          h('button', { class: 'btn', onclick: () => { clear(zone); clear(fb); showText(); } }, icon('eye', 16), 'Revoir le texte'),
          h('button', { class: 'btn primary', 'data-next': '1', onclick: () => renderPath(area, ctx, t) }, 'Recommencer l\'étape'))));
    }
    fb.scrollIntoView({ block: 'nearest' });
  };

  const showText = () => {
    zone.append(h('div', { class: 'memo-text' }, u.text), h('div', { class: 'row', style: { marginTop: '10px' } },
      h('button', { class: 'btn', onclick: () => tts.speak(u.text, { rate: 0.9 }) }, icon('play', 14), 'Écouter'),
      h('button', { class: 'btn primary', onclick: () => renderPath(area, ctx, t) }, 'Recommencer l\'étape')));
  };

  const missed = missedByStep.get(`${t.id}:${p.unit}:${p.step}`) || new Set();
  missedByStep.set(`${t.id}:${p.unit}:${p.step}`, missed);

  if (stepId === 'listen') listenStep(zone, u.text, { onDone });
  else if (stepId === 'gaps20') gapsStep(zone, u.text, { pct: 20, onDone, missed });
  else if (stepId === 'gaps50') gapsStep(zone, u.text, { pct: 50, onDone, missed });
  else if (stepId === 'gaps80') gapsStep(zone, u.text, { pct: 80, onDone, missed });
  else if (stepId === 'letters') gapsStep(zone, u.text, { pct: 100, letters: true, onDone, missed });
  else if (stepId === 'order') orderStep(zone, u.text, { onDone });
  else if (stepId === 'type') typeStep(zone, u.text, { onDone });
  else if (stepId === 'recite') reciteStep(zone, u.text, { onDone });

  area.append(
    h('div', { class: 'card' },
      h('div', { class: 'row small muted', style: { justifyContent: 'space-between' } },
        h('span', {}, `Apprentissage : ${Math.round((doneSteps / totalSteps) * 100)} %`),
        h('span', {}, `Validation à ${PASS} % · 10 points par étape`)),
      h('div', { class: 'q-progress', style: { marginTop: '6px' } }, Array.from({ length: totalSteps }, (_, i) => h('i', { class: i < doneSteps ? 'ok' : i === doneSteps ? 'cur' : '' }))),
      map,
      h('h3', { style: { margin: '14px 0 4px' } }, `${u.label} · étape ${p.step + 1} / ${u.steps.length} : ${STEP_LABEL[stepId]}`),
      stepsRow,
      zone, fb));
}

// Texte su : révisions espacées, en récitant (ou en écrivant) le texte entier.
function renderReview(area, ctx, t, units) {
  const today = todayKey();
  const due = (t.srs?.due || today) <= today;
  const zone = h('div', { style: { marginTop: '12px' } });
  const out = h('div', { style: { marginTop: '12px' } });
  const start = () => {
    clear(zone);
    reciteStep(zone, t.body, {
      onDone: async (score) => {
        const next = await review(ctx, t, score);
        const got = await awardCapped(ctx, `memo:${t.id}:recite`, score >= 50 ? Math.round((score / 100) * 40) : 0);
        clear(out);
        if (score < 60) {
          // Trop oublié : on refait les dernières étapes sur le texte entier.
          t.path.learned = false;
          t.path.unit = units.length - 1;
          t.path.step = 0;
          await saveText(ctx, t);
          out.append(h('div', { class: 'explain bad' }, h('b', {}, `${score} % : le texte s'est un peu effacé. `), 'On reprend les dernières étapes sur le texte entier.',
            h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn primary', onclick: () => renderPath(area, ctx, t) }, 'Reprendre'))));
        } else {
          out.append(h('div', { class: `explain ${score >= PASS ? 'ok' : ''}` }, h('b', {}, score >= PASS ? 'Révision réussie ! ' : 'Pas mal. '),
            `${got ? `+${got} points. ` : ''}Prochaine révision le ${frDate(next)}.`));
        }
      },
    });
  };
  area.append(h('div', { class: 'card' },
    h('h3', { style: { marginTop: 0 } }, due ? 'Révision du jour' : 'Texte su !'),
    h('p', { class: 'muted' }, due
      ? 'Récite le texte en entier (ou écris-le si tu ne peux pas parler). À 85 % ou plus, la prochaine révision s\'éloigne.'
      : `Prochaine révision le ${frDate(t.srs.due)}. En attendant, tu peux t'entraîner avec les autres onglets ou réciter quand même.`),
    h('button', { class: 'btn primary', onclick: start }, icon('mic', 16), due ? 'Commencer la révision' : 'Réciter quand même'),
    zone, out));
  if (due) start();
}

async function practice(root, ctx, t, mode) {
  const area = h('div');
  const tabs = h('div', { class: 'tabs' }, MODES.map(([k, label]) => h('button', { class: k === mode ? 'active' : '', onclick: () => ctx.go('memorize', { id: t.id, mode: k }) }, label)));
  clear(root).append(
    h('div', { class: 'row' },
      h('button', { class: 'btn ghost', onclick: () => ctx.go('memorize') }, icon('arrowLeft', 16), 'Mes textes'),
      h('div', { class: 'spacer' }),
      h('button', { class: 'btn ghost', onclick: () => ctx.go('memorize', { edit: t.id }) }, 'Modifier')),
    h('h1', { style: { marginTop: '12px' } }, t.title),
    h('p', { class: 'sub' }, mode === 'path' ? 'Suis le parcours : chaque étape validée débloque la suivante.' : 'Entraînement libre sur le texte entier.'),
    tabs, area);

  const setBest = async (score) => { t.best = t.best || {}; t.best[mode] = Math.max(t.best[mode] || 0, score); await saveText(ctx, t); };
  const result = (score, got, due) => h('p', { style: { textAlign: 'center' } }, `${got ? `+${got} points · ` : ''}${due ? `prochaine révision le ${frDate(due)}` : ''}`);

  if (mode === 'path') await renderPath(area, ctx, t);
  if (mode === 'read') listenStep(area, t.body, { gate: false });
  if (mode === 'hide') {
    let pct = 30;
    const zone = h('div');
    const slider = h('input', { type: 'range', min: '10', max: '100', step: '10', value: String(pct), style: { width: '240px' } });
    const lbl = h('span', { class: 'small muted' }, `${pct} % des mots cachés`);
    const draw = () => { clear(zone); gapsStep(zone, t.body, { pct }); };
    slider.addEventListener('change', () => { pct = Number(slider.value); lbl.textContent = `${pct} % des mots cachés`; draw(); });
    slider.addEventListener('input', () => { lbl.textContent = `${slider.value} % des mots cachés`; });
    area.append(h('div', { class: 'row', style: { marginBottom: '12px' } }, slider, lbl, h('div', { class: 'spacer' }), h('button', { class: 'btn ghost', onclick: draw }, icon('shuffle', 16), 'Nouveau tirage')), zone);
    draw();
  }
  if (mode === 'letters') gapsStep(area, t.body, { pct: 100, letters: true });
  if (mode === 'order') orderStep(area, t.body, { onDone: async (score) => { const got = await awardCapped(ctx, `memo:${t.id}:order`, Math.round((score / 100) * 20)); area.append(result(score, got)); } });
  if (mode === 'type') typeStep(area, t.body, { onDone: async (score) => { await setBest(score); const due = await review(ctx, t, score); const got = await awardCapped(ctx, `memo:${t.id}:type`, score >= 50 ? Math.round((score / 100) * 30) : 0); area.append(result(score, got, due)); } });
  if (mode === 'recite') reciteStep(area, t.body, { onDone: async (score) => { await setBest(score); const due = await review(ctx, t, score); const got = await awardCapped(ctx, `memo:${t.id}:recite`, score >= 50 ? Math.round((score / 100) * 40) : 0); area.append(result(score, got, due)); } });

  return () => tts.stop();
}
