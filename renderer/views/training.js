// Entraînement d'un cours, jusqu'à le valider.
// Règles (choix de Marine) :
// - une série longue : au moins MIN questions ;
// - chaque erreur ajoute une question, et la question ratée revient un peu plus tard ;
// - 5 erreurs d'affilée : la fiche du cours s'ouvre par-dessus, pour la relire ;
// - le cours est validé après 3 bonnes réponses d'affilée, une fois la longueur atteinte.
import { h, clear, modal, md } from '../lib/ui.js';
import { recordAnswer, pickQuestions } from '../lib/pick.js';
import * as tts from '../lib/tts.js';
import { mascot } from '../lib/mascot.js';
import { icon } from '../lib/icons.js';
import { poolFor } from './activities.js';

export const MIN = 12;
export const STREAK = 3;
export const MAX_FAILS = 5;
const REQUEUE = 3; // une question ratée revient après 3 autres

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

function questionText(q) {
  const parts = String(q.q).split(/_{3,}/);
  const out = [];
  parts.forEach((p, i) => {
    out.push(p);
    if (i < parts.length - 1) out.push(h('span', { class: 'gap' }));
  });
  return out;
}

// Mélange les réponses à chaque passage.
function prep(q) {
  const order = q.choices.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { ...q, choices: order.map((i) => q.choices[i]), a: order.indexOf(q.a) };
}

// La fiche du cours (texte et exemples), réutilisée dans la page et dans la popup.
export function lessonSheet(l) {
  const examples = (l.examples || []).map((ex) => h('div', { class: 'example' },
    h('button', { class: 'speak-btn', title: 'Écouter', onclick: () => tts.speak(ex.en) }, icon('play', 14)),
    h('div', {}, h('div', { class: 'en' }, ex.en), h('div', { class: 'fr' }, ex.fr))));
  return [
    h('div', { class: 'lesson-body', html: md(l.body) }),
    examples.length ? h('div', { style: { marginTop: '14px' } }, h('h3', {}, 'Exemples à écouter'), examples) : null,
  ];
}

export async function runTraining(ctx, l, { onDone = null } = {}) {
  const pool = await poolFor(ctx, l.cat, l.tags);
  if (!pool.length) { ctx.toast('Pas encore de questions pour ce cours.'); return null; }

  let queue = (await pickQuestions(pool, pool.length)).map(prep);
  let q = null;
  let asked = 0;
  let correct = 0;
  let target = MIN;
  let streak = 0;
  let fails = 0;
  let results = [];
  let answered = false;
  let done = false;
  let popup = null;
  let keyHandler = null;
  let lastId = null;

  return new Promise((resolve) => {
    const m = modal(['S\'entraîner : ', l.title], {
      wide: true,
      onClose: () => {
        tts.stop();
        if (popup) popup.close();
        document.removeEventListener('keydown', keyHandler);
        window.__teachTraining = null;
        resolve({ validated: done, asked, correct });
      },
    });

    // Pour l'autotest : lire l'état et la bonne réponse sans toucher à l'écran.
    window.__teachTraining = {
      state: () => ({ asked, correct, target, streak, fails, done, popup: !!popup }),
      good: () => q && q.a,
      closePopup: () => popup && popup.close(),
    };

    keyHandler = (e) => {
      if (popup || done) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const btns = [...m.body.querySelectorAll('.choice')];
      let i = LETTERS.indexOf(e.key.toUpperCase());
      if (i < 0 && /^[1-5]$/.test(e.key)) i = Number(e.key) - 1;
      if (!answered && i >= 0 && btns[i]) { btns[i].click(); e.preventDefault(); return; }
      if (answered && (e.key === 'Enter' || e.key === ' ')) {
        const next = m.body.querySelector('[data-next]');
        if (next) { next.click(); e.preventDefault(); }
      }
    };
    document.addEventListener('keydown', keyHandler);

    async function nextQuestion() {
      if (!queue.length) {
        // Toutes les questions sont passées : on repart sur un nouveau tirage, sans répéter la dernière.
        queue = (await pickQuestions(pool, pool.length)).map(prep);
        if (queue.length > 1 && queue[0].id === lastId) queue.push(queue.shift());
      }
      return queue.shift();
    }

    function progress() {
      const dots = [];
      for (let i = 0; i < Math.max(target, results.length + 1); i++) {
        let c = '';
        if (i < results.length) c = results[i] ? 'ok' : 'bad';
        else if (i === results.length) c = 'cur';
        dots.push(h('i', { class: c }));
      }
      return h('div', { class: 'q-progress' }, dots);
    }

    function streakBox() {
      const pips = [];
      for (let i = 0; i < STREAK; i++) pips.push(h('i', { class: i < streak ? 'on' : '' }));
      return h('div', { class: 'streak-box' }, h('span', {}, 'Bonnes réponses d\'affilée'), h('span', { class: 'pips' }, pips));
    }

    async function show() {
      answered = false;
      q = await nextQuestion();
      lastId = q.id;
      clear(m.body);
      if (asked === 0) {
        m.body.appendChild(h('p', { class: 'small muted', style: { marginTop: 0 } },
          `Au moins ${MIN} questions. Chaque erreur en ajoute une, et la question ratée revient plus tard. `
          + `Le cours est validé après ${STREAK} bonnes réponses d'affilée. Après ${MAX_FAILS} erreurs de suite, la fiche du cours s'ouvre pour la relire.`));
      }
      m.body.appendChild(progress());
      m.body.appendChild(h('div', { class: 'row small muted', style: { marginBottom: '8px', justifyContent: 'space-between' } },
        h('span', {}, `Question ${asked + 1}`, q.level ? h('span', { class: 'tag', style: { marginLeft: '8px' } }, q.level) : null),
        streakBox()));

      if (q.audio) {
        const play = h('button', { class: 'btn', onclick: () => tts.speak(q.audio, { rate: 0.92 }) }, icon('play', 14), 'Écouter');
        const slow = h('button', { class: 'btn ghost', onclick: () => tts.speak(q.audio, { rate: 0.75 }) }, icon('slow', 16), 'Plus lentement');
        m.body.appendChild(h('div', { class: 'row', style: { marginBottom: '14px' } }, play, slow));
        setTimeout(() => tts.speak(q.audio, { rate: 0.92 }), 250);
      }
      m.body.appendChild(h('div', { class: 'q-text' }, questionText(q)));
      const box = h('div', { class: 'choices' });
      q.choices.forEach((c, i) => box.appendChild(h('button', { class: 'choice', onclick: () => answer(i) }, h('span', { class: 'k' }, LETTERS[i]), c)));
      m.body.appendChild(box);
    }

    function answer(i) {
      if (answered) return;
      answered = true;
      const ok = i === q.a;
      [...m.body.querySelectorAll('.choice')].forEach((b, k) => {
        b.disabled = true;
        if (k === q.a) b.classList.add('ok');
        else if (k === i) b.classList.add('bad');
      });
      asked++;
      results.push(ok);
      recordAnswer(q.id, ok);
      if (ok) {
        correct++;
        streak++;
        fails = 0;
        ctx.award(l.cat, 10, `q:${q.id}`, { quiet: true });
      } else {
        streak = 0;
        fails++;
        target++; // une question de plus
        queue.splice(Math.min(REQUEUE, queue.length), 0, prep(q)); // et celle-ci revient plus tard
      }
      const validated = asked >= target && streak >= STREAK;

      m.body.appendChild(h('div', { class: `explain ${ok ? 'ok' : 'bad'}` },
        h('b', {}, ok ? 'Bonne réponse ! +10' : `Raté. La bonne réponse est ${LETTERS[q.a]} : ${q.choices[q.a]}`),
        q.ex ? h('div', { style: { marginTop: '6px' } }, q.ex) : null,
        q.audio ? h('div', { class: 'script' }, `Transcription : « ${q.audio} »`) : null,
        !ok ? h('div', { class: 'small', style: { marginTop: '6px' } }, 'Une question de plus, et celle-ci reviendra.') : null));

      const next = h('button', { class: 'btn primary', 'data-next': '1', style: { marginTop: '16px' }, onclick: () => (validated ? finish() : show()) },
        validated ? 'Voir le résultat' : ['Question suivante', icon('arrowRight', 16)]);
      m.body.appendChild(next);
      // Rafraîchit la barre et les réussites d'affilée.
      m.body.querySelector('.q-progress').replaceWith(progress());
      m.body.querySelector('.streak-box').replaceWith(streakBox());
      next.focus();
      m.body.parentElement.scrollTop = m.body.parentElement.scrollHeight;

      if (fails >= MAX_FAILS) openSheet();
    }

    // 5 erreurs de suite : la fiche du cours s'ouvre par-dessus.
    function openSheet() {
      fails = 0;
      popup = modal(['Relis le cours : ', l.title], { wide: true, onClose: () => { popup = null; } });
      popup.body.append(
        h('p', { class: 'small muted', style: { marginTop: 0 } }, `${MAX_FAILS} erreurs d'affilée : prends le temps de relire la fiche, puis reprends l'entraînement.`),
        ...lessonSheet(l),
        h('div', { class: 'row', style: { marginTop: '18px' } },
          h('button', { class: 'btn primary', onclick: () => popup.close() }, 'J\'ai relu, je reprends')));
    }

    async function finish() {
      done = true;
      const ref = `lesson:${l.id}`;
      const first = (await ctx.api.countToday(ref)) === 0;
      if (first) await ctx.award('lesson', 20, ref, { quiet: true });
      const doneMap = (await ctx.api.getItem('lessonsDone')) || {};
      doneMap[l.id] = Date.now();
      await ctx.api.setItem('lessonsDone', doneMap);
      const pts = correct * 10 + (first ? 20 : 0);
      ctx.toast(`Cours validé ! +${pts} points`, 'ok');

      clear(m.body);
      const cat = mascot({ size: 96, mood: ['clin-oeil', 'contente'] });
      cat.style.margin = '6px auto 0';
      m.body.append(
        progress(),
        cat,
        h('div', { class: 'result-big' }, 'Cours validé !'),
        h('p', { style: { textAlign: 'center' } }, `${correct} bonnes réponses sur ${asked} questions, et ${STREAK} d'affilée pour finir.`),
        h('p', { class: 'muted', style: { textAlign: 'center' } },
          first ? `${pts} points gagnés, dont 20 pour la validation.` : `${pts} points gagnés (la validation du jour était déjà comptée).`),
        h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '16px' } },
          h('button', { class: 'btn primary', 'data-next': '1', onclick: () => m.close() }, 'Fermer')));
      if (onDone) onDone();
    }

    show();
  });
}
