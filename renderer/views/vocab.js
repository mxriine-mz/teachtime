// Vocabulaire : listes toutes prêtes (vie quotidienne et travail, content/vocab-lists.json) et listes perso,
// séances progressives et révision du jour.
import { h, clear, shuffle, uid, todayKey, modal } from '../lib/ui.js';
import * as tts from '../lib/tts.js';
import { icon } from '../lib/icons.js';
import { runVocabSession, isDue, STEPS } from './vocab-session.js';

const SESSION = 10; // mots par séance d'une liste
const REVIEW = 20; // mots max dans la révision du jour

function parseLines(text) {
  const cards = [];
  for (const raw of String(text).split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.split(/\s*(?:;|\t|=|\s-\s|:)\s*/);
    if (m.length >= 2 && m[0] && m[1]) cards.push({ en: m[0].trim(), fr: m.slice(1).join(' ; ').trim(), box: 0, due: todayKey() });
  }
  return cards;
}

async function allLists(ctx) {
  return (await ctx.api.listItems('vlist:')).map((x) => x.value);
}

// Une liste toute prête est copiée dans tes listes à la première ouverture (pour garder ta progression sur tous tes PC).
// Si la liste du programme s'enrichit, les nouveaux mots sont ajoutés sans toucher à ta progression.
async function ensureBuiltin(ctx, def) {
  const key = `vlist:${def.id}`;
  let l = await ctx.api.getItem(key);
  if (!l) l = { id: def.id, title: def.title, builtin: true, created: Date.now(), cards: [] };
  let changed = !l.cards.length;
  for (const c of def.cards) {
    if (!l.cards.some((o) => o.en === c.en)) { l.cards.push({ ...c, box: 0, due: null }); changed = true; }
  }
  if (changed) await ctx.api.setItem(key, l);
  return l;
}

const distractorsFrom = (lists) => lists.flatMap((l) => l.cards);

// Mots d'une séance : ceux à revoir d'abord, puis les nouveaux, puis les moins sus.
function pickForList(l) {
  const today = todayKey();
  const due = shuffle(l.cards.filter((c) => isDue(c, today)));
  const fresh = l.cards.filter((c) => !c.due);
  const rest = l.cards.filter((c) => c.due && c.due > today).sort((a, b) => (a.box || 0) - (b.box || 0) || String(a.due).localeCompare(String(b.due)));
  return [...due, ...fresh, ...rest].slice(0, SESSION);
}

async function startReview(ctx, after) {
  const today = todayKey();
  const lists = await allLists(ctx);
  const items = lists.flatMap((l) => l.cards.filter((c) => isDue(c, today)).map((card) => ({ card, list: l })))
    .sort((a, b) => String(a.card.due).localeCompare(String(b.card.due)))
    .slice(0, REVIEW);
  if (!items.length) { ctx.toast('Aucun mot à revoir aujourd\'hui.'); return; }
  await runVocabSession(ctx, { title: 'Révision du jour', items: shuffle(items), distractors: distractorsFrom(lists), onEnd: after });
  if (after) after();
}

export async function render(root, ctx, params = {}) {
  if (params.id) {
    const l = await ctx.api.getItem(`vlist:${params.id}`);
    if (l) return practice(root, ctx, l, params.mode || 'session');
  }
  if (params.preset) {
    const def = ((await ctx.content('vocab-lists')) || []).find((d) => d.id === params.preset);
    if (def) { const l = await ensureBuiltin(ctx, def); return practice(root, ctx, l, 'session'); }
  }
  if (params.edit !== undefined) return editor(root, ctx, params.edit ? await ctx.api.getItem(`vlist:${params.edit}`) : null);
  await list(root, ctx);
  if (params.review) startReview(ctx, () => ctx.go('vocab'));
}

function progressLine(l) {
  const known = l.cards.filter((c) => (c.box || 0) >= 3).length;
  const seen = l.cards.filter((c) => c.due).length;
  return `${l.cards.length} mots · ${seen} vus · ${known} bien sus`;
}

async function list(root, ctx) {
  const today = todayKey();
  const lists = await allLists(ctx);
  const presets = (await ctx.content('vocab-lists')) || [];
  const mine = lists.filter((l) => !l.builtin).sort((a, b) => b.created - a.created);
  const due = lists.reduce((n, l) => n + l.cards.filter((c) => isDue(c, today)).length, 0);

  const reviewCard = h('div', { class: 'card', style: { marginTop: '18px', display: 'flex', alignItems: 'center', gap: '16px' } },
    h('div', { class: 'card-ico' }, icon('clock', 24)),
    h('div', { style: { flex: 1 } },
      h('h3', { style: { margin: 0 } }, 'Révision du jour'),
      h('p', { class: 'small muted', style: { margin: '4px 0 0' } }, due
        ? `${due} mot${due > 1 ? 's' : ''} à revoir, toutes listes confondues${due > REVIEW ? ` (les ${REVIEW} plus urgents par séance)` : ''}.`
        : 'Rien à revoir aujourd\'hui. Les mots reviennent de moins en moins souvent quand tu les connais.')),
    h('button', { class: 'btn primary', disabled: !due, onclick: () => startReview(ctx, () => ctx.go('vocab')) }, 'Réviser'));

  // Listes toutes prêtes, rangées par famille (vie quotidienne, travail).
  const presetGrid = (group) => h('div', { class: 'grid c3' }, presets.filter((d) => d.group === group).map((d) => {
    const l = lists.find((x) => x.id === d.id);
    const n = l ? l.cards.filter((c) => isDue(c, today)).length : 0;
    return h('div', { class: 'card click', onclick: () => ctx.go('vocab', { preset: d.id }) },
      h('div', { class: 'row' }, h('span', { class: 'tag' }, d.level || 'B1'),
        !l ? h('span', { class: 'tag' }, 'nouveau') : n ? h('span', { class: 'tag warn' }, `${n} à revoir`) : h('span', { class: 'tag ok' }, 'à jour')),
      h('h3', { style: { marginTop: '8px' } }, d.title),
      h('p', { class: 'small muted' }, l ? progressLine(l) : `${d.cards.length} mots`));
  }));

  const mineGrid = mine.length
    ? h('div', { class: 'grid c3' }, mine.map((l) => {
      const n = l.cards.filter((c) => isDue(c, today)).length;
      return h('div', { class: 'card click', onclick: () => ctx.go('vocab', { id: l.id }) },
        h('div', { class: 'row' }, n ? h('span', { class: 'tag warn' }, `${n} à revoir`) : h('span', { class: 'tag ok' }, 'à jour')),
        h('h3', { style: { marginTop: '8px' } }, l.title),
        h('p', { class: 'small muted' }, progressLine(l)));
    }))
    : h('div', { class: 'card empty' }, 'Aucune liste perso pour l\'instant : ajoute tes mots de cours ou de devoirs.');

  root.append(
    h('div', { class: 'row' },
      h('div', {}, h('h1', {}, 'Vocabulaire'), h('p', { class: 'sub', style: { marginBottom: 0 } }, 'Des listes toutes prêtes sur tous les sujets, et tes propres listes. Chaque mot passe par un QCM, l\'écriture et une dictée.')),
      h('div', { class: 'spacer' }),
      h('button', { class: 'btn primary big', onclick: () => ctx.go('vocab', { edit: '' }) }, icon('plus', 18), 'Nouvelle liste')),
    reviewCard,
    h('h2', { style: { marginTop: '26px' } }, 'Vie quotidienne'),
    presetGrid('quotidien'),
    h('h2', { style: { marginTop: '26px' } }, 'Travail et TOEIC'),
    presetGrid('travail'),
    h('h2', { style: { marginTop: '26px' } }, 'Mes listes'),
    mineGrid,
  );
}

function editor(root, ctx, l) {
  const title = h('input', { type: 'text', value: l?.title || '', placeholder: 'Ex. : Unité 4, au bureau' });
  const ta = h('textarea', { placeholder: 'Un mot par ligne : anglais ; français\nto schedule ; planifier\na deadline ; une date limite\nan invoice / a bill ; une facture', style: { minHeight: '260px' } });
  ta.value = l ? l.cards.map((c) => `${c.en} ; ${c.fr}`).join('\n') : '';
  const err = h('p', { class: 'small', style: { color: 'var(--bad)', minHeight: '20px' } });
  const save = async () => {
    const cards = parseLines(ta.value);
    if (!title.value.trim() || cards.length < 2) { err.textContent = 'Il faut un titre et au moins 2 lignes « anglais ; français ».'; return; }
    // On garde la progression des mots déjà connus.
    if (l) for (const c of cards) { const old = l.cards.find((o) => o.en === c.en); if (old) { c.box = old.box; c.due = old.due; } }
    const item = l || { id: uid(), created: Date.now() };
    item.title = title.value.trim();
    item.cards = cards;
    await ctx.api.setItem(`vlist:${item.id}`, item);
    ctx.go('vocab', { id: item.id });
  };
  const del = () => {
    const m = modal('Supprimer cette liste ?');
    m.body.append(h('p', {}, `« ${l.title} » sera retirée sur tous tes PC.`),
      h('div', { class: 'row' },
        h('button', { class: 'btn danger', onclick: async () => { await ctx.api.delItem(`vlist:${l.id}`); m.close(); ctx.go('vocab'); } }, 'Supprimer'),
        h('button', { class: 'btn', onclick: m.close }, 'Annuler')));
  };
  clear(root).append(
    h('button', { class: 'btn ghost', onclick: () => ctx.go('vocab') }, icon('arrowLeft', 16), 'Mes listes'),
    h('h1', { style: { marginTop: '14px' } }, l ? 'Modifier la liste' : 'Nouvelle liste'),
    h('div', { class: 'card', style: { maxWidth: '760px' } },
      h('label', { class: 'field' }, h('span', {}, 'Titre'), title),
      h('label', { class: 'field' }, h('span', {}, 'Mots (anglais ; français)'), ta),
      h('p', { class: 'small muted' }, 'Séparateurs acceptés : point-virgule, tabulation (copié depuis Excel), « = » ou « : ». Plusieurs réponses anglaises possibles : sépare-les par « / ».'),
      err,
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: save }, 'Enregistrer'), l ? h('button', { class: 'btn danger', onclick: del }, 'Supprimer') : null)));
  title.focus();
}

async function practice(root, ctx, l, mode) {
  const today = todayKey();
  const area = h('div');
  const go = (k) => (l.builtin ? ctx.go('vocab', { preset: l.id, mode: k }) : ctx.go('vocab', { id: l.id, mode: k }));
  const tabs = h('div', { class: 'tabs' }, [['session', 'Séance'], ['all', 'La liste']]
    .map(([k, label]) => h('button', { class: k === mode ? 'active' : '', onclick: () => go(k) }, label)));
  clear(root).append(
    h('div', { class: 'row' },
      h('button', { class: 'btn ghost', onclick: () => ctx.go('vocab') }, icon('arrowLeft', 16), 'Vocabulaire'),
      h('div', { class: 'spacer' }),
      l.builtin ? null : h('button', { class: 'btn ghost', onclick: () => ctx.go('vocab', { edit: l.id }) }, 'Modifier')),
    h('h1', { style: { marginTop: '12px' } }, l.title),
    h('p', { class: 'sub' }, progressLine(l)),
    tabs, area);

  if (mode === 'all') {
    area.append(h('div', { class: 'card' }, h('table', { class: 'list' },
      h('tr', {}, h('th', {}, ''), h('th', {}, 'Anglais'), h('th', {}, 'Français'), h('th', {}, 'Niveau')),
      l.cards.map((c) => h('tr', {},
        h('td', {}, h('button', { class: 'speak-btn', onclick: () => tts.speak(String(c.en).split('/')[0]) }, icon('play', 14))),
        h('td', {}, h('b', {}, c.en), c.alt && c.alt.length ? h('div', { class: 'small muted' }, `aussi : ${c.alt.join(', ')}`) : null),
        h('td', {}, c.fr),
        h('td', {}, c.box ? Array.from({ length: c.box }, () => icon('star', 14, 'star')) : (c.due ? '—' : h('span', { class: 'small muted' }, 'nouveau'))))))));
    return;
  }

  const words = pickForList(l);
  const due = l.cards.filter((c) => isDue(c, today)).length;
  const fresh = l.cards.filter((c) => !c.due).length;
  const start = async () => {
    const lists = await allLists(ctx);
    const fresh2 = (await ctx.api.getItem(`vlist:${l.id}`)) || l; // version à jour
    const picked = pickForList(fresh2);
    await runVocabSession(ctx, {
      title: ['Séance : ', l.title],
      items: picked.map((card) => ({ card, list: fresh2 })),
      distractors: distractorsFrom(lists),
      onEnd: () => {},
    });
    go('session');
  };
  area.append(h('div', { class: 'card', style: { maxWidth: '760px' } },
    h('h3', { style: { marginTop: 0 } }, `${words.length} mots dans cette séance`),
    h('p', { class: 'muted' },
      due ? `${due} à revoir aujourd'hui${fresh ? `, ${fresh} encore jamais vus` : ''}.` : fresh ? `${fresh} mots encore jamais vus.` : 'Tous les mots sont à jour : la séance reprend les moins bien sus.'),
    h('ul', { class: 'rules' },
      h('li', {}, 'QCM : le mot anglais est lu, choisis sa traduction.'),
      h('li', {}, 'Écrire : la traduction s\'affiche, écris le mot anglais.'),
      h('li', {}, 'Dictée : écoute et écris le mot.'),
      h('li', {}, `Un mot est acquis après ${STEPS} bonnes réponses d'affilée. Une erreur le renvoie au QCM.`),
      h('li', {}, '5 points par bonne réponse (30 gains max par liste et par jour).')),
    h('button', { class: 'btn primary big', onclick: start }, 'Commencer la séance')));
}
