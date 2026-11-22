import { h, clear } from '../lib/ui.js';
import { icon } from '../lib/icons.js';
import { CATS } from './activities.js';
import { runTraining, lessonSheet, MIN, STREAK } from './training.js';

export async function render(root, ctx, params = {}) {
  const lessons = await ctx.content('lessons');
  if (params.id) {
    const l = lessons.find((x) => x.id === params.id);
    if (l) return renderLesson(root, ctx, l);
  }
  const doneMap = (await ctx.api.getItem('lessonsDone')) || {};
  const order = ['grammar', 'conj', 'vocab', 'listening', 'general'];
  const groups = order.map((cat) => ({ cat, items: lessons.filter((l) => l.cat === cat) })).filter((g) => g.items.length);

  root.append(
    h('h1', {}, 'Cours'),
    h('p', { class: 'sub' }, `Des fiches courtes en français, puis un entraînement : le cours est validé après ${STREAK} bonnes réponses d'affilée.`),
    // root.append ne déplie pas les tableaux : on étale les titres et les grilles.
    ...groups.flatMap((g) => [
      h('h2', { class: 'row', style: { marginTop: '22px', gap: '8px' } }, icon(CATS[g.cat].icon, 20), CATS[g.cat].label),
      h('div', { class: 'grid c3' }, g.items.map((l) => h('div', { class: 'card click', onclick: () => ctx.go('lessons', { id: l.id }) },
        h('div', { class: 'row' }, h('span', { class: 'tag' }, l.level || 'B1'), doneMap[l.id] ? h('span', { class: 'tag ok' }, icon('check', 12), 'validé') : null),
        h('h3', { style: { marginTop: '8px' } }, l.title),
        h('p', { class: 'small muted' }, l.intro)))),
    ]),
  );
}

async function renderLesson(root, ctx, l) {
  const doneMap = (await ctx.api.getItem('lessonsDone')) || {};
  const when = doneMap[l.id] ? new Date(doneMap[l.id]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : null;

  clear(root).append(
    h('button', { class: 'btn ghost', onclick: () => ctx.go('lessons') }, icon('arrowLeft', 16), 'Tous les cours'),
    h('div', { class: 'row', style: { marginTop: '16px' } },
      h('span', { class: 'tag' }, `${CATS[l.cat].label} · ${l.level || 'B1'}`),
      when ? h('span', { class: 'tag ok' }, icon('check', 12), `validé le ${when}`) : null),
    h('h1', { style: { marginTop: '8px' } }, l.title),
    h('p', { class: 'sub' }, l.intro),
    h('div', { class: 'card' }, ...lessonSheet(l)),
    h('div', { class: 'row', style: { marginTop: '18px' } },
      h('button', {
        class: 'btn primary big',
        onclick: () => runTraining(ctx, l, { onDone: () => renderLesson(root, ctx, l) }),
      }, `S'entraîner (au moins ${MIN} questions)`)),
  );
}
