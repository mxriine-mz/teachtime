// Oral : séances de phrases (validées à 3 réussites d'affilée), jeux de rôle, réponse libre.
// La voix est neuronale et locale (Kokoro), ta voix est transcrite sur le PC par Whisper.
import { h, clear, shuffle } from '../lib/ui.js';
import * as tts from '../lib/tts.js';
import { compare, normalize } from '../lib/diff.js';
import { startRecording } from '../lib/audio.js';
import { recordAnswer, pickQuestions } from '../lib/pick.js';
import { icon } from '../lib/icons.js';

const OK_SCORE = 80; // une phrase est réussie à partir de 80 %
const STREAK = 3;
const SESSION = 5; // phrases par séance

// Pour l'autotest : simule ce que Whisper a entendu, sans micro.
let fakeSay = null;
window.__teachSay = (text) => (fakeSay ? fakeSay(text) : false);

// Enregistre une réponse orale et renvoie le texte entendu (et le son, pour se réécouter).
function recorder({ maxMs, onText, label = 'Parler' }) {
  const meter = h('div', { class: 'level-meter' }, h('div'));
  const status = h('span', { class: 'small muted' });
  const btn = h('button', { class: 'btn primary' }, icon('mic', 16), label);
  let rec = null;
  fakeSay = (text) => { onText(text, null); return true; };
  btn.addEventListener('click', async () => {
    if (rec) { rec.stop(); return; }
    tts.stop();
    try {
      rec = await startRecording({ maxMs, onLevel: (v) => { meter.firstChild.style.width = `${v * 100}%`; } });
    } catch (e) { status.textContent = `Micro indisponible : ${e.message}`; return; }
    window.api.sttWarmup();
    btn.replaceChildren(icon('stop', 14), 'Stop');
    btn.className = 'btn rec';
    status.textContent = 'Je t\'écoute… Clique sur Stop quand tu as fini.';
    const audio = await rec.finished;
    rec = null;
    meter.firstChild.style.width = '0';
    btn.replaceChildren(icon('mic', 16), label);
    btn.className = 'btn primary';
    btn.disabled = true;
    status.textContent = 'Transcription…';
    const r = await window.api.transcribe(audio);
    btn.disabled = false;
    status.textContent = '';
    if (!r.ok) { status.textContent = `Erreur : ${r.error}`; return; }
    if (!r.text) { status.textContent = 'Rien entendu, réessaie plus près du micro.'; return; }
    onText(r.text, audio);
  });
  return {
    el: h('div', { class: 'row' }, btn, meter, status),
    stop: () => rec && rec.stop(),
    disable: (on) => { btn.disabled = on; },
  };
}

// ---------- 1. Séance de phrases ----------
// Chaque phrase revient jusqu'à 3 réussites d'affilée (80 % ou plus), entrecoupée des autres.
// Une phrase ratée revient juste après la suivante. On peut se réécouter puis écouter le modèle.
export async function phraseSession(ctx, mount) {
  const data = await ctx.content('speaking');
  const items = (await pickQuestions(data.sentences, SESSION)).map((s) => ({ s, streak: 0, fails: 0, done: false }));
  let queue = shuffle(items);
  let cur = null;
  let last = null;
  let attempts = 0;
  let gained = 0;
  const missed = new Map(); // mot raté -> nombre de fois
  let stopper = null;

  window.__teachOral = { state: () => ({ attempts, left: items.filter((x) => !x.done).length, streak: cur ? cur.streak : null, done: !items.some((x) => !x.done) }), expected: () => (cur ? cur.s.en : null) };

  const pick = () => {
    const left = queue.filter((x) => !x.done);
    if (!left.length) return null;
    const x = left.find((y) => y !== last) || left[0];
    queue.splice(queue.indexOf(x), 1);
    return x;
  };

  const header = () => {
    const pips = [];
    for (let i = 0; i < STREAK; i++) pips.push(h('i', { class: cur && i < cur.streak ? 'on' : '' }));
    return [
      h('div', { class: 'q-progress' }, items.map((x) => h('i', { class: x.done ? 'ok' : x === cur ? 'cur' : '' }))),
      h('div', { class: 'row small muted', style: { marginBottom: '10px', justifyContent: 'space-between' } },
        h('span', {}, `${items.filter((x) => x.done).length} / ${items.length} phrases validées`),
        h('div', { class: 'streak-box' }, h('span', {}, 'Cette phrase'), h('span', { class: 'pips' }, pips))),
    ];
  };

  const next = () => {
    cur = pick();
    if (!cur) return finish();
    last = cur;
    draw();
  };

  const draw = () => {
    clear(mount);
    const s = cur.s;
    const line = h('div', { class: 'sentence' }, s.en);
    const heard = h('div', { class: 'heard' });
    const fb = h('div', { style: { marginTop: '10px', minHeight: '30px' } });
    const after = h('div', { class: 'row', style: { marginTop: '12px' } });
    let answered = false;
    stopper = recorder({
      maxMs: 15000,
      onText: async (text, audio) => {
        if (answered) return;
        answered = true;
        stopper.disable(true);
        attempts++;
        const c = compare(s.en, text);
        clear(line).append(...c.tokens.map((t) => [h('span', { class: t.ok ? 'ok' : 'miss' }, t.text), ' ']).flat());
        heard.textContent = `Entendu : « ${text} »`;
        const ok = c.score >= OK_SCORE;
        recordAnswer(s.id, ok);
        c.tokens.filter((t) => !t.ok).forEach((t) => { const w = t.text.replace(/[^A-Za-z']/g, ''); if (w) missed.set(w, (missed.get(w) || 0) + 1); });
        if (ok) {
          cur.streak++;
          gained += 5;
          ctx.award('speak', 5, `say:${s.id}`, { quiet: true });
          if (cur.streak >= STREAK) cur.done = true;
          else queue.splice(Math.min(2, queue.length), 0, cur);
        } else {
          cur.streak = 0;
          cur.fails++;
          queue.splice(Math.min(1, queue.length), 0, cur);
        }
        mount.querySelector('.q-progress').replaceWith(header()[0]);
        mount.querySelectorAll('.streak-box .pips i').forEach((p, i) => p.classList.toggle('on', i < cur.streak));
        clear(fb).append(h('span', { class: `tag ${ok ? 'ok' : c.score >= 50 ? 'warn' : 'bad'}` }, `${c.score} %`), ' ',
          ok ? (cur.done ? 'Phrase validée !' : 'Très bien ! +5. Elle reviendra encore.') : 'Pas encore : les mots en rouge sont à retravailler. La phrase revient juste après la suivante.');
        clear(after).append(
          audio ? h('button', { class: 'btn', onclick: () => tts.playRecording(audio) }, icon('play', 14), 'Me réécouter') : null,
          h('button', { class: 'btn', onclick: () => tts.speak(s.en, { rate: 0.85 }) }, icon('play', 14), 'Écouter le modèle'),
          h('div', { class: 'spacer' }),
          h('button', { class: 'btn primary', 'data-next': '1', onclick: next }, 'Suivant', icon('arrowRight', 16)));
      },
    });
    mount.append(
      ...header(),
      line,
      h('p', { class: 'muted', style: { marginTop: '6px' } }, s.fr),
      h('div', { class: 'row', style: { margin: '14px 0' } },
        h('button', { class: 'btn', onclick: () => tts.speak(s.en, { rate: 0.95 }) }, icon('play', 14), 'Écouter'),
        h('button', { class: 'btn ghost', onclick: () => tts.speak(s.en, { rate: 0.7 }) }, icon('slow', 16), 'Plus lentement')),
      stopper.el, heard, fb, after);
    tts.speak(s.en, { rate: 0.95 });
  };

  const finish = () => {
    clear(mount);
    const top = [...missed.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
    ctx.toast(`Séance d'oral terminée ! +${gained} points`, 'ok');
    mount.append(
      h('div', { class: 'result-big' }, 'Toutes les phrases sont validées !'),
      h('p', { style: { textAlign: 'center' } }, `${items.length} phrases, ${attempts} essais, ${gained} points.`),
      top.length ? h('p', { style: { textAlign: 'center' } }, 'Mots à retravailler : ', h('b', {}, top.join(', '))) : h('p', { style: { textAlign: 'center' } }, 'Aucun mot raté, bravo !'),
      h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '14px' } },
        h('button', { class: 'btn primary', onclick: () => phraseSession(ctx, mount) }, 'Nouvelle séance')));
  };

  clear(mount).append(
    h('h3', { style: { marginTop: 0 } }, `Séance de ${SESSION} phrases`),
    h('p', { class: 'muted' }, `Écoute la phrase, puis dis-la. Elle est réussie à ${OK_SCORE} % ou plus. Chaque phrase revient, mélangée aux autres, jusqu'à ${STREAK} réussites d'affilée. Après chaque essai, tu peux te réécouter puis écouter le modèle.`),
    h('button', { class: 'btn primary big', onclick: next }, 'Commencer'));
  return () => { if (stopper) stopper.stop(); tts.stop(); };
}

// ---------- 2. Jeux de rôle ----------
// La voix joue l'autre personne. Ta réponse est validée si elle contient un mot de chaque groupe de mots-clés.
function checkKeys(turn, text) {
  const words = normalize(text);
  const flat = ` ${words.join(' ')} `;
  const missing = (turn.keys || []).filter((group) => !group.some((k) => flat.includes(` ${normalize(k).join(' ')} `)));
  const enough = words.length >= (turn.minWords || 3);
  return { ok: !missing.length && enough, missing, enough, count: words.length };
}

async function roleplayList(ctx, mount) {
  const all = (await ctx.content('roleplays')) || [];
  const done = (await ctx.api.getItem('roleplaysDone')) || {};
  clear(mount).append(
    h('p', { class: 'muted', style: { marginTop: 0 } }, 'La voix joue l\'autre personne. Réponds à l\'oral : ta réponse est validée si elle contient les mots attendus. Si tu bloques, demande un exemple de réponse.'),
    h('div', { class: 'grid c3' }, all.map((r) => h('div', { class: 'card click', onclick: () => roleplay(ctx, mount, r) },
      h('div', { class: 'row' }, h('span', { class: 'tag' }, r.level || 'B1'), done[r.id] ? h('span', { class: 'tag ok' }, icon('check', 12), 'fait') : null),
      h('h3', { style: { marginTop: '8px' } }, r.title),
      h('p', { class: 'small muted' }, r.intro)))));
}

let rpStopper = null;
async function roleplay(ctx, mount, r) {
  ctx.activity(`Jeu de rôle : ${r.title}`);
  let t = 0;
  let tries = 0;
  let gained = 0;
  const chat = h('div', { class: 'chat' });
  const zone = h('div');
  window.__teachOral = { state: () => ({ turn: t, total: r.turns.length, tries, done: t >= r.turns.length }), expected: () => (r.turns[t] ? r.turns[t].model : null) };

  const bubble = (who, text, sub) => {
    const b = h('div', { class: `bubble-line ${who}` }, h('div', { class: 'b' },
      who === 'npc' ? h('button', { class: 'speak-btn', title: 'Réécouter', onclick: () => tts.speak(text) }, icon('play', 12)) : null,
      h('span', {}, text), sub ? h('div', { class: 'small muted' }, sub) : null));
    chat.append(b);
    b.scrollIntoView({ block: 'nearest' });
  };

  const turnView = () => {
    clear(zone);
    if (t >= r.turns.length) return end();
    const turn = r.turns[t];
    tries = 0;
    bubble('npc', turn.npc);
    tts.speak(turn.npc);
    const fr = h('p', { class: 'small muted', style: { display: 'none' } }, turn.fr);
    const fb = h('div', { style: { marginTop: '10px' } });
    const model = h('div', { style: { display: 'none', marginTop: '8px' } },
      h('div', { class: 'explain' }, h('b', {}, 'Exemple : '), turn.model, ' ',
        h('button', { class: 'speak-btn', onclick: () => tts.speak(turn.model, { rate: 0.9 }) }, icon('play', 12))));
    const skip = h('button', { class: 'btn ghost', style: { display: 'none' }, onclick: () => { bubble('me', turn.model, 'passé, sans points'); t++; turnView(); } }, 'Passer');
    rpStopper = recorder({
      maxMs: 30000,
      label: 'Répondre',
      onText: (text) => {
        tries++;
        const c = checkKeys(turn, text);
        if (c.ok) {
          bubble('me', text);
          gained += 5;
          ctx.award('speak', 5, `rp:${r.id}`, { quiet: true });
          t++;
          setTimeout(turnView, 400);
          return;
        }
        const what = !c.enough ? `Fais une phrase un peu plus longue (au moins ${turn.minWords || 3} mots).` : 'Il manque une partie de la réponse attendue. Relis la consigne.';
        clear(fb).append(h('div', { class: 'explain bad' }, h('b', {}, 'Pas encore. '), what, h('div', { class: 'small', style: { marginTop: '4px' } }, `Entendu : « ${text} »`)));
        if (tries >= 2) model.style.display = '';
        if (tries >= 3) skip.style.display = '';
      },
    });
    zone.append(
      h('div', { class: 'task' }, h('b', {}, 'À toi : '), turn.task),
      h('div', { class: 'row', style: { margin: '8px 0 12px' } },
        h('button', { class: 'btn ghost', onclick: () => { fr.style.display = fr.style.display ? '' : 'none'; } }, 'Traduction'),
        h('button', { class: 'btn ghost', onclick: () => { model.style.display = ''; } }, 'Exemple de réponse'),
        skip),
      fr, rpStopper.el, fb, model);
  };

  const end = async () => {
    const ref = `roleplay:${r.id}`;
    const first = (await ctx.api.countToday(ref)) === 0;
    if (first) { gained += 20; await ctx.award('speak', 20, ref, { quiet: true }); }
    const done = (await ctx.api.getItem('roleplaysDone')) || {};
    done[r.id] = Date.now();
    await ctx.api.setItem('roleplaysDone', done);
    ctx.toast(`Conversation terminée ! +${gained} points`, 'ok');
    zone.append(
      h('div', { class: 'result-big', style: { fontSize: '30px' } }, 'Conversation terminée !'),
      h('p', { style: { textAlign: 'center' } }, `${gained} points${first ? ', dont 20 pour la conversation complète' : ''}.`),
      h('div', { class: 'row', style: { justifyContent: 'center' } },
        h('button', { class: 'btn primary', onclick: () => roleplayList(ctx, mount) }, 'Autres jeux de rôle')));
  };

  clear(mount).append(
    h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: () => { tts.stop(); roleplayList(ctx, mount); } }, icon('arrowLeft', 16), 'Jeux de rôle'), h('span', { class: 'tag' }, r.level || 'B1')),
    h('h2', { style: { margin: '12px 0 4px' } }, r.title),
    h('p', { class: 'muted' }, r.intro),
    chat, zone);
  turnView();
}

// ---------- Série du Quartier (habitant de l'oral) et réponse libre ----------
// Une série de phrases à répéter. Utilisée par l'écran Oral et par le jeu.
export async function repeatSession(ctx, mount, { count = 5, onDone } = {}) {
  const data = await ctx.content('speaking');
  const sentences = await pickQuestions(data.sentences, count);
  let i = 0;
  let total = 0;
  let stopper = null;

  const draw = () => {
    clear(mount);
    if (i >= sentences.length) {
      mount.append(h('div', { class: 'result-big' }, `+${total}`), h('p', { style: { textAlign: 'center' } }, 'points gagnés à l\'oral.'),
        h('div', { class: 'row', style: { justifyContent: 'center' } }, h('button', { class: 'btn primary', onclick: async () => { const more = await pickQuestions(data.sentences, count); sentences.splice(0, sentences.length, ...more); i = 0; total = 0; draw(); } }, 'Encore 5 phrases'), onDone ? h('button', { class: 'btn', onclick: onDone }, 'Fermer') : null));
      return;
    }
    const s = sentences[i];
    let attempts = 0;
    const line = h('div', { class: 'sentence' }, s.en);
    const heard = h('div', { class: 'heard' });
    const fb = h('div', { style: { marginTop: '10px', minHeight: '30px' } });
    const nextBtn = h('button', { class: 'btn', onclick: () => { i++; draw(); } }, 'Phrase suivante', icon('arrowRight', 16));
    stopper = recorder({
      maxMs: 15000,
      onText: async (text) => {
        attempts++;
        const c = compare(s.en, text);
        clear(line).append(...c.tokens.map((t) => [h('span', { class: t.ok ? 'ok' : 'miss' }, t.text), ' ']).flat());
        heard.textContent = `Entendu : « ${text} »`;
        let pts = 0;
        if (attempts <= 3) pts = c.score >= 80 ? 15 : c.score >= 50 ? 5 : 0;
        recordAnswer(s.id, c.score >= 80);
        clear(fb);
        if (pts) { total += pts; await ctx.award('speak', pts, `say:${s.id}`, { quiet: true }); }
        fb.append(h('span', { class: `tag ${c.score >= 80 ? 'ok' : c.score >= 50 ? 'warn' : 'bad'}` }, `${c.score} %`), ' ',
          c.score >= 80 ? `Très bien ! +${pts}` : c.score >= 50 ? `Presque. +${pts}. Réécoute les mots en rouge et réessaie.` : 'Réécoute la phrase et réessaie.',
          attempts > 3 ? ' (plus de points après 3 essais)' : '');
      },
    });
    mount.append(
      h('p', { class: 'muted' }, `Phrase ${i + 1} / ${sentences.length}${s.level ? ` · ${s.level}` : ''}`),
      line,
      h('p', { class: 'muted', style: { marginTop: '6px' } }, s.fr),
      h('div', { class: 'row', style: { margin: '14px 0' } },
        h('button', { class: 'btn', onclick: () => tts.speak(s.en, { rate: 0.9 }) }, icon('play', 14), 'Écouter'),
        h('button', { class: 'btn ghost', onclick: () => tts.speak(s.en, { rate: 0.7 }) }, icon('slow', 16), 'Plus lentement')),
      stopper.el, heard, fb,
      h('div', { class: 'row', style: { marginTop: '14px' } }, nextBtn));
    tts.speak(s.en, { rate: 0.9 });
  };
  draw();
  return () => { if (stopper) stopper.stop(); tts.stop(); };
}

async function freeTalk(ctx, mount) {
  const data = await ctx.content('speaking');
  const prompts = shuffle(data.prompts);
  let i = 0;
  let stopper = null;
  const draw = () => {
    clear(mount);
    const p = prompts[i % prompts.length];
    const ref = `talk:${p.id}`;
    const out = h('div', { style: { marginTop: '12px' } });
    stopper = recorder({
      maxMs: 90000,
      label: 'Répondre',
      onText: async (text) => {
        const n = text.split(/\s+/).filter(Boolean).length;
        const min = p.minWords || 25;
        const already = await ctx.api.countToday(ref);
        let pts = 0;
        if (n >= min && !already) { pts = 20; await ctx.award('speak', pts, ref, { quiet: true }); }
        clear(out).append(
          h('div', { class: 'card' }, h('p', { class: 'small muted' }, 'Ce que Whisper a compris :'), h('p', { style: { fontSize: '17px' } }, text)),
          h('p', { style: { marginTop: '10px' } }, h('span', { class: `tag ${n >= min ? 'ok' : 'warn'}` }, `${n} mots`), ' ',
            n >= min ? (pts ? `Bravo, +${pts} points.` : 'Bien ! (points déjà gagnés sur ce sujet aujourd\'hui)') : `Vise au moins ${min} mots pour gagner 20 points.`),
          h('p', { class: 'small muted' }, 'Relis la transcription : si un mot a été mal compris, c\'est souvent un mot à mieux prononcer.'));
      },
    });
    mount.append(
      h('div', { class: 'sentence' }, p.en),
      h('p', { class: 'muted', style: { marginTop: '6px' } }, p.fr),
      p.hints ? h('p', { class: 'small' }, 'Pistes : ', p.hints.join(' · ')) : null,
      h('div', { class: 'row', style: { margin: '14px 0' } }, h('button', { class: 'btn', onclick: () => tts.speak(p.en) }, icon('play', 14), 'Écouter la question'), h('button', { class: 'btn ghost', onclick: () => { i++; draw(); } }, icon('shuffle', 16), 'Autre sujet')),
      stopper.el, out);
  };
  draw();
  return () => { if (stopper) stopper.stop(); };
}

export async function render(root, ctx, params = {}) {
  const mode = params.mode || 'session';
  const st = await ctx.api.sttStatus();
  const mount = h('div', { class: 'card' });
  const tab = (k, label) => h('button', { class: mode === k ? 'active' : '', onclick: () => ctx.go('speak', { mode: k }) }, label);
  root.append(
    h('h1', {}, 'Oral'),
    h('p', { class: 'sub' }, ctx.state && ctx.state.platform === 'web' ? 'L\'analyse de ta voix tourne sur cet appareil : le son n\'est envoyé nulle part.' : 'La voix anglaise et l\'analyse de ta voix tournent sur ce PC. Rien n\'est envoyé sur Internet.'),
    !st.ready ? h('p', { class: 'small muted' }, 'Le premier enregistrement prend quelques secondes de plus : le modèle se charge.') : '', // root.append écrirait « null » en toutes lettres
    h('div', { class: 'tabs' },
      tab('session', 'Séance de phrases'),
      tab('roleplay', 'Jeux de rôle'),
      tab('free', 'Répondre à une question'),
      h('button', { onclick: () => ctx.go('memorize') }, 'Réciter un de mes textes')),
    mount);
  ctx.api.sttWarmup();
  if (mode === 'free') return freeTalk(ctx, mount);
  if (mode === 'roleplay') { await roleplayList(ctx, mount); return () => { if (rpStopper) rpStopper.stop(); tts.stop(); }; }
  return phraseSession(ctx, mount);
}