// Lancement des séries de questions par catégorie (utilisé par l'accueil, les cours et le jeu).
import { runQuiz } from './quiz.js';
import { pickQuestions } from '../lib/pick.js';
import { icon } from '../lib/icons.js';

export const CATS = {
  grammar: { label: 'Grammaire', icon: 'bookOpen', color: '#5b3fd3' },
  vocab: { label: 'Vocabulaire', icon: 'cards', color: '#1f9d6b' },
  conj: { label: 'Conjugaison', icon: 'clock', color: '#d98a12' },
  listening: { label: 'Écoute', icon: 'headphones', color: '#2b7bd6' },
  general: { label: 'Anglais général', icon: 'chat', color: '#c2417a' },
};

export async function poolFor(ctx, cat, tags = null) {
  let pool;
  if (cat === 'listening') pool = await ctx.content('listening');
  else pool = (await ctx.content('questions'))[cat] || [];
  if (tags && tags.length) {
    const tagged = pool.filter((q) => (q.tags || []).some((t) => tags.includes(t)));
    if (tagged.length >= 4) return tagged;
  }
  return pool;
}

export async function startQuiz(ctx, cat, { tags = null, title = null, header = null, onClose = null } = {}) {
  const pool = await poolFor(ctx, cat, tags);
  const qs = await pickQuestions(pool, 4);
  if (!qs.length) { ctx.toast('Pas encore de questions ici.'); return null; }
  return runQuiz(ctx, {
    title: title || [icon(CATS[cat].icon, 20), CATS[cat].label],
    kind: cat,
    questions: qs,
    header,
    onClose,
    onAgain: async () => pickQuestions(pool, 4),
  });
}
