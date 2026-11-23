import { h, todayKey } from '../lib/ui.js';
import { CATS, startQuiz } from './activities.js';
import { mascot } from '../lib/mascot.js';
import { icon } from '../lib/icons.js';
import { drawPreview, PLACES, usePlayerSprite } from './game.js';
import { profileName } from './profile.js';

// Carte du Quartier : aperçu en pixel art, habitants vus aujourd'hui, bouton.
async function quartierCard(ctx) {
  await usePlayerSprite(ctx);
  const visited = (await ctx.api.getItem(`game:${todayKey()}`)) || {};
  const places = PLACES();
  const seen = places.filter((p) => visited[p.id]).length;
  // Recadrage : la rangée du haut (Bibliothèque, Tour de l'horloge, Marché), la rue et la place.
  const banner = drawPreview(h('canvas', { class: 'q-banner', title: 'Entrer dans le Quartier' }), { crop: { x: 2, y: 1, w: 36, h: 13 } });
  banner.addEventListener('click', () => ctx.go('game'));
  const people = h('div', { class: 'q-people' }, places.map((p) => {
    const ic = p.cat === 'speak' ? 'mic' : CATS[p.cat].icon;
    const label = p.cat === 'speak' ? 'Oral' : CATS[p.cat].label;
    return h('div', { class: `q-person${visited[p.id] ? ' done' : ''}`, title: `${p.npc} · ${p.name} · ${label}${visited[p.id] ? ' (vu aujourd\'hui)' : ''}` },
      icon(ic, 17), visited[p.id] ? h('span', { class: 'q-check' }, icon('check', 10)) : null);
  }));
  return h('div', { class: 'card quartier-card' },
    banner,
    h('div', { class: 'q-body' },
      h('div', { class: 'row', style: { alignItems: 'baseline' } },
        h('h2', { style: { margin: 0 } }, 'Le Quartier'),
        h('div', { class: 'spacer' }),
        h('span', { class: 'small muted' }, seen === places.length ? 'Tous les habitants vus aujourd\'hui' : `${seen} / ${places.length} habitants vus aujourd'hui`)),
      h('p', { class: 'muted', style: { margin: '6px 0 12px' } }, 'Six habitants, six matières : chacun te pose 4 questions.'),
      h('div', { class: 'row', style: { justifyContent: 'space-between' } },
        people,
        h('button', { class: 'btn primary', onclick: () => ctx.go('game') }, icon('map', 16), 'Entrer'))));
}

function greeting() {
  const hr = new Date().getHours();
  if (hr < 5) return 'Bonne nuit';
  if (hr < 18) return 'Bonjour';
  return 'Bonsoir';
}

function timeToLock(s) {
  const now = new Date();
  const lock = new Date(now.getFullYear(), now.getMonth(), now.getDate(), s.lockHour, s.lockMinute);
  const diff = lock - now;
  if (diff <= 0) return null;
  const hh = Math.floor(diff / 3600_000);
  const mm = Math.floor((diff % 3600_000) / 60_000);
  return hh ? `${hh} h ${String(mm).padStart(2, '0')}` : `${mm} min`;
}

async function dueCounts(ctx) {
  const today = todayKey();
  const texts = await ctx.api.listItems('text:');
  const lists = await ctx.api.listItems('vlist:');
  // Un texte encore en apprentissage n'est pas « à réviser » : il suit son parcours.
  const dueTexts = texts.filter((t) => (!t.value.path || t.value.path.learned) && (t.value.srs?.due || today) <= today).length;
  let dueCards = 0;
  // Les mots jamais vus (sans date) ne comptent pas : ils ne sont pas « à revoir ».
  for (const l of lists) for (const c of l.value.cards || []) if (c.due && c.due <= today) dueCards++;
  return { dueTexts, dueCards, nTexts: texts.length, nLists: lists.length };
}

export async function render(root, ctx) {
  const s = await ctx.refresh();
  const done = s.points >= s.quota;
  const left = timeToLock(s);
  const due = await dueCounts(ctx);
  const name = await profileName(ctx);

  let status;
  if (s.locked) status = `Le verrou est actif : il te manque ${s.remaining} points.`;
  else if (done) status = 'Quota du jour atteint. Tout ce que tu fais maintenant, c\'est du bonus.';
  else if (s.unlockedToday) status = 'Tu as utilisé le code d\'urgence aujourd\'hui.';
  else if (s.platform === 'web') status = `Encore ${s.remaining} points pour atteindre le quota du jour.`;
  else if (!s.lockArmed) status = `Le verrou est en pause : il s'activera quand tu le décideras, dans les Réglages. Encore ${s.remaining} points pour le quota.`;
  else if (s.setupDay === s.today) status = `Jour d'essai : découvre la plateforme. Dès demain, le verrou s'active à ${String(s.lockHour).padStart(2, '0')} h s'il manque des points.`;
  else if (left) status = `Il te reste ${left} avant le verrou de ${String(s.lockHour).padStart(2, '0')} h. Encore ${s.remaining} points.`;
  else status = `Encore ${s.remaining} points.`;

  const max = Math.max(s.quota, ...s.history.map((d) => d.pts));
  const days = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  const chart = h('div', { class: 'chart' }, s.history.map((d) => {
    const [y, m, j] = d.day.split('-').map(Number);
    const dow = new Date(y, m - 1, j).getDay();
    return h('div', { class: 'col', title: `${d.day} : ${d.pts} points` },
      h('div', { class: `b ${d.pts >= s.quota ? 'met' : ''}`, style: { height: `${Math.max(3, (d.pts / max) * 100)}%` } }),
      h('span', {}, days[dow]));
  }));

  const quick = Object.entries(CATS).map(([cat, c]) => h('div', { class: 'card click', onclick: () => startQuiz(ctx, cat) },
    h('div', { class: 'card-ico' }, icon(c.icon, 24)),
    h('h3', { style: { marginTop: '6px' } }, c.label),
    h('div', { class: 'small muted' }, '4 questions · jusqu\'à 50 points')));

  root.append(
    h('div', { class: 'row', style: { gap: '20px', marginBottom: '22px', flexWrap: 'nowrap' } },
      mascot({ size: 112, alone: true, mood: done ? ['clin-oeil', 'contente', 'clin-oeil'] : 'random' }),
      h('div', {},
        h('h1', {}, `${greeting()} ${name} !`),
        h('div', { class: 'bubble', style: { display: 'inline-block', marginTop: '4px' } }, status))),
    h('div', { class: 'grid c4' },
      h('div', { class: 'card stat' }, h('b', {}, `${s.points}`), h('span', {}, `points sur ${s.quota} aujourd'hui`)),
      h('div', { class: 'card stat' }, h('b', { class: 'streak' }, icon('flame', 26), `${s.streak}`), h('span', {}, 'jours d\'affilée au quota')),
      h('div', { class: 'card stat' }, h('b', {}, `${due.dueTexts}`), h('span', {}, 'textes à réviser aujourd\'hui')),
      h('div', { class: `card stat${due.dueCards ? ' click' : ''}`, title: due.dueCards ? 'Lancer la révision du jour' : null, onclick: due.dueCards ? () => ctx.go('vocab', { review: 1 }) : null },
        h('b', {}, `${due.dueCards}`), h('span', {}, 'mots de vocabulaire à revoir'))),
    h('div', { class: 'grid c2', style: { marginTop: '16px' } },
      await quartierCard(ctx),
      h('div', { class: 'card chart-card' },
        h('h2', {}, 'Tes 14 derniers jours'),
        chart,
        h('p', { class: 'small muted', style: { marginTop: '8px' } }, 'Barres en couleur : les jours où le quota est atteint.'))),
    h('h2', { style: { marginTop: '26px' } }, 'Une série rapide'),
    h('div', { class: 'grid c4' }, quick.slice(0, 4)),
    h('div', { class: 'grid c4', style: { marginTop: '16px' } },
      quick[4],
      h('div', { class: 'card click', onclick: () => ctx.go('speak') }, h('div', { class: 'card-ico' }, icon('mic', 24)), h('h3', { style: { marginTop: '6px' } }, 'Oral'), h('div', { class: 'small muted' }, 'Répéter après moi · 15 points par phrase')),
      h('div', { class: 'card click', onclick: () => ctx.go('memorize') }, h('div', { class: 'card-ico' }, icon('pencil', 24)), h('h3', { style: { marginTop: '6px' } }, 'Mes devoirs'), h('div', { class: 'small muted' }, due.nTexts ? `${due.nTexts} texte(s) enregistré(s)` : 'Ajoute un texte à apprendre')),
      h('div', { class: 'card click', onclick: () => ctx.go('vocab') }, h('div', { class: 'card-ico' }, icon('cards', 24)), h('h3', { style: { marginTop: '6px' } }, 'Mes listes'), h('div', { class: 'small muted' }, due.nLists ? `${due.nLists} liste(s) de vocabulaire` : 'Ajoute une liste de mots'))),
  );
}
