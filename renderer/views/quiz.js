// Série de questions à choix multiple, dans une fenêtre modale.
import { h, clear, modal } from '../lib/ui.js';
import { recordAnswer } from '../lib/pick.js';
import * as tts from '../lib/tts.js';
import { mascot } from '../lib/mascot.js';
import { icon } from '../lib/icons.js';

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

// Mélange les réponses pour que la bonne ne soit jamais toujours au même endroit.
function prep(q) {
  const order = q.choices.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { ...q, choices: order.map((i) => q.choices[i]), a: order.indexOf(q.a) };
}

// opts : { title, questions, kind, header?: Node, onAgain?: () => Promise<question[]>, onClose? }
// Résout avec { correct, total } quand la fenêtre est fermée.
export function runQuiz(ctx, opts) {
  return new Promise((resolve) => {
    let questions = opts.questions.map(prep);
    let idx = 0;
    let correct = 0;
    let results = [];
    let answered = false;
    let keyHandler = null;

    const m = modal(opts.title, {
      wide: false,
      onClose: () => {
        tts.stop();
        if (keyHandler) document.removeEventListener('keydown', keyHandler);
        if (opts.onClose) opts.onClose();
        resolve({ correct, total: results.length });
      },
    });

    keyHandler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const btns = [...m.body.querySelectorAll('.choice')];
      const k = e.key.toUpperCase();
      let i = LETTERS.indexOf(k);
      if (i < 0 && /^[1-5]$/.test(e.key)) i = Number(e.key) - 1;
      if (!answered && i >= 0 && btns[i]) { btns[i].click(); e.preventDefault(); return; }
      if (answered && (e.key === 'Enter' || e.key === ' ')) {
        const next = m.body.querySelector('[data-next]');
        if (next) { next.click(); e.preventDefault(); }
      }
    };
    document.addEventListener('keydown', keyHandler);

    function progress() {
      return h('div', { class: 'q-progress' }, questions.map((_, i) => {
        let c = '';
        if (i < results.length) c = results[i] ? 'ok' : 'bad';
        else if (i === idx) c = 'cur';
        return h('i', { class: c });
      }));
    }

    function show() {
      answered = false;
      const q = questions[idx];
      clear(m.body);
      if (opts.header && idx === 0 && results.length === 0) m.body.appendChild(opts.header);
      m.body.appendChild(progress());

      const meta = h('div', { class: 'row small muted', style: { marginBottom: '8px' } },
        `Question ${idx + 1} / ${questions.length}`,
        q.level ? h('span', { class: 'tag' }, q.level) : null);
      m.body.appendChild(meta);

      if (q.audio) {
        const play = h('button', { class: 'btn', onclick: () => tts.speak(q.audio, { rate: 0.92 }) }, icon('play', 14), 'Écouter');
        const slow = h('button', { class: 'btn ghost', onclick: () => tts.speak(q.audio, { rate: 0.75 }) }, icon('slow', 16), 'Plus lentement');
        m.body.appendChild(h('div', { class: 'row', style: { marginBottom: '14px' } }, play, slow));
        setTimeout(() => tts.speak(q.audio, { rate: 0.92 }), 250);
      }
      m.body.appendChild(h('div', { class: 'q-text' }, questionText(q)));

      const box = h('div', { class: 'choices' });
      q.choices.forEach((c, i) => {
        const b = h('button', { class: 'choice', onclick: () => answer(i) }, h('span', { class: 'k' }, LETTERS[i]), c);
        box.appendChild(b);
      });
      m.body.appendChild(box);
    }

    async function answer(i) {
      if (answered) return;
      answered = true;
      const q = questions[idx];
      const ok = i === q.a;
      const btns = [...m.body.querySelectorAll('.choice')];
      btns.forEach((b, k) => {
        b.disabled = true;
        if (k === q.a) b.classList.add('ok');
        else if (k === i) b.classList.add('bad');
      });
      results.push(ok);
      if (ok) correct++;
      recordAnswer(q.id, ok);
      if (ok) ctx.award(opts.kind || 'quiz', 10, `q:${q.id}`, { quiet: true });

      const ex = h('div', { class: `explain ${ok ? 'ok' : 'bad'}` },
        h('b', {}, ok ? 'Bonne réponse ! +10' : `Raté. La bonne réponse est ${LETTERS[q.a]} : ${q.choices[q.a]}`),
        q.ex ? h('div', { style: { marginTop: '6px' } }, q.ex) : null,
        q.audio ? h('div', { class: 'script' }, `Transcription : « ${q.audio} »`) : null);
      m.body.appendChild(ex);

      const last = idx === questions.length - 1;
      const next = h('button', { class: 'btn primary', 'data-next': '1', style: { marginTop: '16px' }, onclick: () => (last ? finish() : (idx++, show())) },
        last ? 'Voir le résultat' : ['Question suivante', icon('arrowRight', 16)]);
      m.body.appendChild(next);
      next.focus();
      m.body.parentElement.scrollTop = m.body.parentElement.scrollHeight;
    }

    async function finish() {
      clear(m.body);
      const total = questions.length;
      const perfect = correct === total && total >= 4;
      if (perfect) await ctx.award(opts.kind || 'quiz', 10, 'bonus', { quiet: true });
      const pts = correct * 10 + (perfect ? 10 : 0);
      ctx.toast(`+${pts} points`, pts ? 'ok' : '');
      // Pose tirée au hasard, plus joyeuse quand le score est bon.
      const moods = perfect ? ['clin-oeil', 'contente'] : correct >= total - 1 ? ['contente', 'clin-oeil', 'douce'] : ['douce', 'contente'];
      const cat = mascot({ size: 96, mood: moods });
      cat.style.margin = '6px auto 0';
      m.body.append(
        progress(),
        cat,
        h('div', { class: 'result-big' }, `${correct} / ${total}`),
        h('p', { style: { textAlign: 'center' } },
          perfect ? 'Parfait ! Bonus de 10 points.' : correct >= total - 1 ? 'Très bien, encore un effort pour le sans-faute.' : 'Relis les explications, puis retente une série.'),
        h('p', { class: 'muted', style: { textAlign: 'center' } }, `${pts} points gagnés dans cette série.`),
        h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '16px' } },
          opts.onAgain ? h('button', { class: 'btn primary', 'data-next': '1', onclick: again }, 'Encore une série') : null,
          h('button', { class: 'btn', onclick: () => m.close() }, 'Fermer')),
      );
    }

    async function again() {
      const qs = await opts.onAgain();
      if (!qs || !qs.length) { m.close(); return; }
      questions = qs.map(prep);
      idx = 0;
      correct = 0;
      results = [];
      show();
    }

    show();
  });
}
