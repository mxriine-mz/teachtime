// Choix des questions : on favorise celles jamais vues et celles ratées la dernière fois.
import { shuffle } from './ui.js';

export async function loadStats() {
  return (await window.api.getItem('qstats')) || {};
}

export async function recordAnswer(id, correct) {
  const stats = await loadStats();
  const s = stats[id] || { seen: 0, wrong: 0, last: null };
  s.seen += 1;
  if (!correct) s.wrong += 1;
  s.last = correct ? 1 : 0;
  s.t = Date.now();
  stats[id] = s;
  await window.api.setItem('qstats', stats);
}

function weight(s) {
  if (!s) return 3; // jamais vue
  let w = 1 / (1 + s.seen * 0.5);
  if (s.last === 0) w += 3; // ratée la dernière fois
  else if (s.wrong > 0) w += 0.6;
  // Pas deux fois de suite dans la même heure.
  if (s.t && Date.now() - s.t < 3600_000) w *= 0.2;
  return w;
}

export function pickWeighted(pool, n, stats) {
  const items = shuffle(pool).map((q) => ({ q, w: weight(stats[q.id]) }));
  const out = [];
  while (out.length < n && items.length) {
    const total = items.reduce((t, x) => t + x.w, 0);
    let r = Math.random() * total;
    let k = 0;
    for (; k < items.length - 1; k++) { r -= items[k].w; if (r <= 0) break; }
    out.push(items[k].q);
    items.splice(k, 1);
  }
  return out;
}

export async function pickQuestions(pool, n = 4) {
  return pickWeighted(pool, n, await loadStats());
}
