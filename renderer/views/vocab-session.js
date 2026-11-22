// Séance de vocabulaire, sur le modèle de l'entraînement des cours.
// Chaque mot monte trois marches, une par bonne réponse :
//   1. QCM : le mot anglais (lu à voix haute), choisir le français ;
//   2. Écrire : le français, écrire l'anglais ;
//   3. Dictée : entendre l'anglais, l'écrire.
// Une erreur fait redescendre le mot à la première marche, et il revient un peu plus loin.
// Un mot est acquis après 3 bonnes réponses d'affilée ; la séance finit quand tous ses mots sont acquis.
import { h, clear, modal, shuffle, todayKey, addDays } from '../lib/ui.js';
import * as tts from '../lib/tts.js';
import { icon } from '../lib/icons.js';
import { mascot } from '../lib/mascot.js';

export const STEPS = 3;
export const BOX_DAYS = [0, 1, 3, 7, 14, 30]; // jours avant la prochaine révision, selon la boîte
const REQUEUE = 2; // un mot raté revient après 2 autres
const CAP = 30; // gains max par liste et par jour
const STEP_NAMES = ['Choisis la traduction', 'Écris le mot en anglais', 'Dictée : écris ce que tu entends'];

export function norm(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’]/g, '\'').replace(/^(to|a|an|the)\s+/, '').replace(/[^a-z0-9' -]/g, '').replace(/\s+/g, ' ').trim();
}

// Réponses acceptées : le mot, ses variantes « a / b », et les synonymes de la liste.
export function accepted(card) {
  return [card.en, ...String(card.en).split('/'), ...(card.alt || [])].map(norm).filter(Boolean);
}

// Le mot à dire ou à afficher (la première variante si « a / b »).
const say = (card) => String(card.en).split('/')[0].trim();

export function isDue(c, today = todayKey()) { return !!c.due && c.due <= today; }

// Après la séance : boîte suivante si aucun faux pas, sinon retour à la boîte 0 (revu demain).
function schedule(card, clean) {
  card.box = clean ? Math.min(BOX_DAYS.length - 1, (card.box || 0) + 1) : 0;
  card.due = addDays(todayKey(), BOX_DAYS[card.box] || 1);
}

// items : [{ card, list }]. lists : les listes concernées (sauvegardées à la fin).
// distractors : autres cartes pour fabriquer les QCM.
export function runVocabSession(ctx, { title, items, distractors = [], onEnd = null }) {
  const words = items.map((it) => ({ ...it, streak: 0, errors: 0, done: false }));
  const pool = [...new Set([...items.map((it) => it.card), ...distractors])];
  let queue = shuffle(words);
  let cur = null;
  let last = null;
  let asked = 0;
  let correct = 0;
  let answered = false;
  let finished = false;
  let gained = 0;
  let expected = null;

  return new Promise((resolve) => {
    const m = modal(title, {
      wide: true,
      onClose: async () => {
        tts.stop();
        document.removeEventListener('keydown', onKey);
        window.__teachVocab = null;
        if (!finished) await saveAll(false);
        resolve({ finished, asked, correct });
      },
    });

    window.__teachVocab = {
      state: () => ({ asked, correct, finished, left: words.filter((w) => !w.done).length, step: cur ? cur.streak : null }),
      expected: () => expected,
    };

    const onKey = (e) => {
      if (finished || !answered) return;
      if (e.key === 'Enter' || e.key === ' ') {
        const n = m.body.querySelector('[data-next]');
        if (n && document.activeElement?.tagName !== 'INPUT') { n.click(); e.preventDefault(); }
      }
    };
    document.addEventListener('keydown', onKey);

    function pick() {
      const left = queue.filter((w) => !w.done);
      if (!left.length) return null;
      // Pas deux fois le même mot de suite quand c'est possible.
      const w = left.find((x) => x !== last) || left[0];
      queue.splice(queue.indexOf(w), 1);
      return w;
    }

    function header() {
      const total = words.length;
      const done = words.filter((w) => !w.done).length;
      const dots = words.map((w) => h('i', { class: w.done ? 'ok' : w === cur ? 'cur' : '' }));
      const pips = [];
      for (let i = 0; i < STEPS; i++) pips.push(h('i', { class: cur && i < cur.streak ? 'on' : '' }));
      return [
        h('div', { class: 'q-progress' }, dots),
        h('div', { class: 'row small muted', style: { marginBottom: '8px', justifyContent: 'space-between' } },
          h('span', {}, `${total - done} / ${total} mots acquis`),
          h('div', { class: 'streak-box' }, h('span', {}, 'Ce mot'), h('span', { class: 'pips' }, pips))),
      ];
    }

    function next() {
      cur = pick();
      if (!cur) return finish();
      last = cur;
      answered = false;
      draw();
    }

    function draw() {
      clear(m.body);
      if (asked === 0) {
        m.body.appendChild(h('p', { class: 'small muted', style: { marginTop: 0 } },
          `Chaque mot passe par trois étapes : QCM, écrire, dictée. Une erreur le renvoie au QCM et il revient plus loin. `
          + `Un mot est acquis après ${STEPS} bonnes réponses d'affilée, et la séance se termine quand tous les mots sont acquis.`));
      }
      m.body.append(...header());
      const c = cur.card;
      let step = cur.streak;
      const others = shuffle(pool.filter((x) => x !== c && norm(x.fr) !== norm(c.fr))).slice(0, 3);
      if (step === 0 && others.length < 3) step = 1; // pas assez de mots pour un QCM
      m.body.appendChild(h('div', { class: 'small muted', style: { marginBottom: '6px' } }, STEP_NAMES[step]));

      if (step === 0) {
        expected = c.fr;
        const opts = shuffle([c, ...others]);
        const box = h('div', { class: 'choices' });
        opts.forEach((o) => box.appendChild(h('button', { class: 'choice', onclick: (e) => {
          if (answered) return;
          box.querySelectorAll('.choice').forEach((b) => { b.disabled = true; });
          e.currentTarget.classList.add(o === c ? 'ok' : 'bad');
          [...box.children][opts.indexOf(c)].classList.add('ok');
          answer(o === c, null);
        } }, o.fr)));
        m.body.append(
          h('div', { class: 'q-text row' }, h('button', { class: 'speak-btn', title: 'Écouter', onclick: () => tts.speak(say(c)) }, icon('play', 14)), say(c)),
          box);
        tts.speak(say(c));
        return;
      }

      // Étapes 2 et 3 : on écrit.
      expected = say(c);
      const input = h('input', { type: 'text', placeholder: 'En anglais', autocomplete: 'off', spellcheck: 'false' });
      const submit = () => { if (!answered) answer(accepted(c).includes(norm(input.value)), input); };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (answered) m.body.querySelector('[data-next]')?.click(); else submit(); } });
      if (step === 1) {
        m.body.append(h('div', { class: 'q-text' }, c.fr));
      } else {
        const play = h('button', { class: 'btn', onclick: () => tts.speak(say(c)) }, icon('play', 14), 'Réécouter');
        const slow = h('button', { class: 'btn ghost', onclick: () => tts.speak(say(c), { rate: 0.7 }) }, icon('slow', 16), 'Plus lentement');
        m.body.append(h('div', { class: 'row', style: { margin: '6px 0 14px' } }, play, slow));
        setTimeout(() => tts.speak(say(c)), 250);
      }
      m.body.append(input, h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn primary', onclick: submit }, 'Vérifier')));
      input.focus();
    }

    async function award(list) {
      const ref = `vocab:${list.id}`;
      if ((await ctx.api.countToday(ref)) >= CAP) return;
      gained += 5;
      ctx.award('vocab', 5, ref, { quiet: true });
    }

    function answer(ok, input) {
      answered = true;
      asked++;
      const c = cur.card;
      if (ok) {
        correct++;
        cur.streak++;
        award(cur.list);
        if (cur.streak >= STEPS) cur.done = true;
        else queue.splice(Math.min(REQUEUE, queue.length), 0, cur);
      } else {
        cur.errors++;
        cur.streak = 0;
        queue.splice(Math.min(REQUEUE, queue.length), 0, cur);
      }
      if (input) input.readOnly = true;
      const msg = ok
        ? (cur.done ? 'Exact ! Mot acquis.' : 'Exact ! +5')
        : `Pas tout à fait. La réponse : ${say(c)} = ${c.fr}`;
      m.body.querySelector('.q-progress').replaceWith(header()[0]);
      const pips = m.body.querySelectorAll('.streak-box .pips i');
      pips.forEach((p, i) => p.classList.toggle('on', i < cur.streak));
      const nextBtn = h('button', { class: 'btn primary', 'data-next': '1', style: { marginTop: '14px' }, onclick: next }, 'Suivant', icon('arrowRight', 16));
      m.body.append(
        h('div', { class: `explain ${ok ? 'ok' : 'bad'}` }, h('b', {}, msg),
          !ok ? h('div', { class: 'small', style: { marginTop: '6px' } }, 'Ce mot repart au QCM et reviendra un peu plus loin.') : null),
        nextBtn);
      if (!input || ok) tts.speak(say(c));
      else tts.speak(say(c), { rate: 0.85 });
      if (input) input.focus(); else nextBtn.focus();
    }

    async function saveAll(clean) {
      for (const w of words) if (w.done || !clean) {
        if (w.done) schedule(w.card, w.errors === 0);
        else if (w.errors) schedule(w.card, false);
      }
      const lists = [...new Set(words.map((w) => w.list))];
      for (const l of lists) await ctx.api.setItem(`vlist:${l.id}`, l);
    }

    async function finish() {
      finished = true;
      expected = null;
      await saveAll(true);
      clear(m.body);
      const cat = mascot({ size: 96, mood: ['clin-oeil', 'contente'] });
      cat.style.margin = '6px auto 0';
      const clean = words.filter((w) => w.errors === 0).length;
      ctx.toast(`Séance terminée ! +${gained} points`, 'ok');
      m.body.append(
        cat,
        h('div', { class: 'result-big' }, 'Tous les mots sont acquis !'),
        h('p', { style: { textAlign: 'center' } }, `${words.length} mots, ${asked} réponses, ${correct} justes. ${clean} mots sans aucune erreur : ils reviendront plus tard.`),
        h('p', { class: 'muted', style: { textAlign: 'center' } }, `Les mots ratés au moins une fois reviennent demain. ${gained} points gagnés.`),
        h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '16px' } },
          h('button', { class: 'btn primary', 'data-next': '1', onclick: () => m.close() }, 'Fermer')));
      if (onEnd) onEnd();
    }

    next();
  });
}
