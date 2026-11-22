// Exercices de Mémoriser, utilisables dans le parcours guidé comme dans les onglets libres.
// Chaque exercice reçoit le texte à travailler et appelle onDone(score sur 100) quand il est noté.
// Pour l'autotest, l'exercice affiché s'enregistre dans window.__teachMemoStep : perfect() et fail() le terminent.
import { h, clear, shuffle } from '../lib/ui.js';
import * as tts from '../lib/tts.js';
import { compare } from '../lib/diff.js';
import { startRecording } from '../lib/audio.js';
import { icon } from '../lib/icons.js';

export function words(text) {
  return String(text).split(/\s+/).filter(Boolean);
}

export function sentences(text) {
  return String(text).replace(/\s+/g, ' ').trim().split(/(?<=[.!?;:])\s+/).filter((s) => s.trim());
}

// Le mot « nu » : minuscules, sans ponctuation autour, apostrophes unifiées.
export function bare(w) {
  return String(w).toLowerCase().replace(/[’‘`]/g, '\'').replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');
}

function splitWord(w) {
  const m = String(w).match(/^([^A-Za-z0-9’']*)(.*?)([^A-Za-z0-9’']*)$/);
  return m ? { pre: m[1], core: m[2], post: m[3] } : { pre: '', core: w, post: '' };
}

function register(api) {
  window.__teachMemoStep = api;
}

// ---------- Écouter et lire (surlignage), avec « répéter après moi » ----------
export function listenStep(mount, text, { onDone, doneLabel = 'Continuer', gate = true } = {}) {
  const sents = sentences(text);
  let playing = false;
  let heardOnce = false;
  const lines = sents.map((s) => h('span', { class: 'sent' }, s, ' '));
  const box = h('div', { class: 'memo-text' }, lines);
  const cont = h('button', { class: 'btn primary', disabled: gate, onclick: () => onDone && onDone(100) }, doneLabel, icon('arrowRight', 16));
  const status = h('span', { class: 'small muted' });

  const playAll = async (rate) => {
    if (playing) { tts.stop(); return; }
    playing = true;
    for (let i = 0; i < sents.length && playing; i++) {
      lines.forEach((l, k) => l.classList.toggle('cur', k === i));
      const ok = await tts.speak(sents[i], { rate });
      if (ok === false) break;
    }
    lines.forEach((l) => l.classList.remove('cur'));
    playing = false;
    heardOnce = true;
    cont.disabled = false;
  };

  // Répéter après moi : la voix lit une phrase, tu la redis, l'app note.
  const shadow = async () => {
    tts.stop();
    playing = false;
    let i = 0;
    const zone = h('div', { class: 'card', style: { marginTop: '12px' } });
    box.after(zone);
    const step = async () => {
      clear(zone);
      if (i >= sents.length) { zone.append(h('p', {}, h('b', {}, 'Bravo, tu as répété tout le texte !'))); heardOnce = true; cont.disabled = false; return; }
      lines.forEach((l, k) => l.classList.toggle('cur', k === i));
      const fb = h('div', { style: { marginTop: '8px' } });
      const rec = recordButton({
        label: 'Répéter',
        onText: (said) => {
          const c = compare(sents[i], said);
          clear(fb).append(h('span', { class: `tag ${c.score >= 80 ? 'ok' : 'warn'}` }, `${c.score} %`), ' ',
            h('span', {}, c.tokens.map((t) => [h('span', { class: t.ok ? 'ok' : 'miss' }, t.text), ' ']).flat()),
            h('div', { class: 'row', style: { marginTop: '8px' } },
              h('button', { class: 'btn', onclick: () => tts.speak(sents[i], { rate: 0.85 }) }, icon('play', 14), 'Réécouter'),
              h('button', { class: 'btn primary', onclick: () => { i++; step(); } }, c.score >= 80 ? 'Phrase suivante' : 'Passer à la suivante', icon('arrowRight', 16))));
        },
      });
      zone.append(h('p', { class: 'small muted', style: { marginTop: 0 } }, `Phrase ${i + 1} / ${sents.length} : écoute, puis répète.`), h('div', { class: 'sentence', style: { fontSize: '18px' } }, sents[i]), rec.el, fb);
      await tts.speak(sents[i], { rate: 0.9 });
    };
    step();
  };

  register({ perfect: () => onDone && onDone(100), fail: () => onDone && onDone(100), kind: 'listen' });
  mount.append(
    h('div', { class: 'row', style: { marginBottom: '12px' } },
      h('button', { class: 'btn', onclick: () => playAll(0.92) }, icon('play', 14), 'Écouter'),
      h('button', { class: 'btn ghost', onclick: () => playAll(0.72) }, icon('slow', 16), 'Plus lentement'),
      h('button', { class: 'btn ghost', onclick: shadow }, icon('mic', 16), 'Répéter après moi'),
      h('button', { class: 'btn ghost', onclick: () => { playing = false; tts.stop(); } }, icon('stop', 14), 'Stop')),
    box,
    h('div', { class: 'row', style: { marginTop: '12px' } }, onDone ? cont : null, status));
  if (gate) status.textContent = 'Écoute le texte une fois en entier pour continuer.';
  void heardOnce;
}

// ---------- Texte à trous : on tape les mots cachés ----------
// pct : part des mots cachés. letters : chaque trou montre sa première lettre.
// Les mots ratés restent cachés au tour suivant (missed est partagé entre les tours).
export function gapsStep(mount, text, { pct = 20, letters = false, onDone, missed = new Set() } = {}) {
  const W = words(text);
  const candidates = W.map((w, i) => i).filter((i) => /[A-Za-z]/.test(W[i]));
  const want = Math.max(1, Math.round((pct / 100) * candidates.length));
  const keep = candidates.filter((i) => missed.has(i));
  const hidden = new Set([...keep, ...shuffle(candidates.filter((i) => !missed.has(i))).slice(0, Math.max(0, want - keep.length))]);
  const inputs = [];
  const box = h('div', { class: 'memo-text gaps' });
  W.forEach((w, i) => {
    if (!hidden.has(i)) { box.append(h('span', { class: 'w' }, w), ' '); return; }
    const { pre, core, post } = splitWord(w);
    const inp = h('input', { type: 'text', class: 'gap-input', autocomplete: 'off', spellcheck: 'false', style: { width: `${Math.max(3, core.length) + 1.5}ch` } });
    inp.dataset.i = String(i);
    if (letters) inp.placeholder = core.slice(0, 1);
    inputs.push({ inp, i, core });
    box.append(pre, inp, post, ' ');
  });
  const fb = h('div', { style: { marginTop: '12px' } });
  let checked = false;
  inputs.forEach(({ inp }, k) => inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || (e.key === ' ' && inp.value.trim())) {
      e.preventDefault();
      if (inputs[k + 1]) inputs[k + 1].inp.focus(); else check();
    }
  }));

  const check = () => {
    if (checked) return;
    checked = true;
    let ok = 0;
    missed.clear();
    for (const { inp, i, core } of inputs) {
      const good = bare(inp.value) === bare(core);
      inp.readOnly = true;
      inp.classList.add(good ? 'ok' : 'miss');
      if (good) ok++;
      else {
        // Ta réponse barrée, puis la bonne à côté.
        missed.add(i);
        if (!inp.value.trim()) inp.value = '…';
        inp.after(h('span', { class: 'fix' }, core));
      }
    }
    const score = inputs.length ? Math.round((ok / inputs.length) * 100) : 100;
    clear(fb).append(h('p', {}, h('span', { class: `tag ${score >= 85 ? 'ok' : 'warn'}` }, `${score} %`), ` ${ok} mot${ok > 1 ? 's' : ''} sur ${inputs.length}.`));
    if (onDone) onDone(score);
  };

  register({
    kind: 'gaps',
    perfect: () => { inputs.forEach(({ inp, core }) => { inp.value = core; }); check(); },
    fail: () => { inputs.forEach(({ inp }) => { inp.value = 'zzz'; }); check(); },
  });
  mount.append(
    h('p', { class: 'small muted', style: { marginTop: 0 } }, letters
      ? 'Chaque trou montre la première lettre du mot. Tape le mot entier ; Entrée ou Espace passe au trou suivant.'
      : 'Tape les mots cachés ; Entrée ou Espace passe au trou suivant. Les majuscules et la ponctuation ne comptent pas.'),
    box,
    h('div', { class: 'row', style: { marginTop: '12px' } },
      h('button', { class: 'btn primary', onclick: check }, 'Vérifier'),
      h('button', { class: 'btn ghost', onclick: () => tts.speak(text, { rate: 0.9 }) }, icon('volume', 16), 'Indice audio')),
    fb);
  if (inputs[0]) setTimeout(() => inputs[0].inp.focus(), 50);
}

// ---------- Remettre dans l'ordre, phrase par phrase ----------
export function orderStep(mount, text, { onDone } = {}) {
  const sents = sentences(text).filter((s) => words(s).length >= 2);
  let si = 0;
  let firstTry = true;
  let good = 0;
  const area = h('div');
  mount.append(area);
  const finish = () => onDone && onDone(sents.length ? Math.round((good / sents.length) * 100) : 100);
  let current = null;
  const draw = () => {
    clear(area);
    if (si >= sents.length) { area.append(h('p', {}, h('b', {}, `${good} phrase${good > 1 ? 's' : ''} sur ${sents.length} du premier coup.`))); finish(); return; }
    const target = words(sents[si]);
    const pool = shuffle(target.map((w, i) => ({ w, i })));
    const placed = [];
    const dest = h('div', { class: 'chips' });
    const src = h('div', { class: 'chips', style: { borderStyle: 'solid', marginTop: '10px' } });
    const fb = h('p', { style: { minHeight: '24px', marginTop: '10px' } });
    const redraw = () => {
      clear(dest).append(...placed.map((p, k) => h('button', { class: 'chip placed', onclick: () => { pool.push(placed.splice(k, 1)[0]); redraw(); } }, p.w)));
      clear(src).append(...pool.map((p, k) => h('button', { class: 'chip', onclick: () => { placed.push(pool.splice(k, 1)[0]); redraw(); if (!pool.length) check(); } }, p.w)));
    };
    const check = () => {
      if (placed.map((p) => p.w).join(' ') === target.join(' ')) {
        if (firstTry) good++;
        clear(fb).append(h('b', { style: { color: 'var(--ok)' } }, firstTry ? 'Bravo, du premier coup !' : 'C\'est ça !'));
        setTimeout(() => { si++; firstTry = true; draw(); }, 700);
      } else {
        firstTry = false;
        clear(fb).append(h('b', { style: { color: 'var(--bad)' } }, 'Pas tout à fait. Clique sur les mots placés pour les retirer.'));
      }
    };
    current = { target, pool, placed, redraw, check };
    area.append(
      h('p', { class: 'muted' }, `Phrase ${si + 1} / ${sents.length}`),
      dest, src, fb,
      h('div', { class: 'row' },
        h('button', { class: 'btn ghost', onclick: () => tts.speak(sents[si]) }, icon('volume', 16), 'Indice audio'),
        h('button', { class: 'btn ghost', onclick: () => { si++; firstTry = true; draw(); } }, 'Passer')));
    redraw();
  };
  register({
    kind: 'order',
    perfect: () => { while (si < sents.length) { if (firstTry) good++; si++; firstTry = true; } draw(); },
    fail: () => { si = sents.length; good = 0; draw(); },
  });
  void current;
  draw();
}

// ---------- Écrire de mémoire ----------
export function typeStep(mount, text, { onDone } = {}) {
  const ta = h('textarea', { placeholder: 'Écris le texte de mémoire…', style: { minHeight: '180px' } });
  const out = h('div');
  const check = () => {
    const r = compare(text, ta.value);
    clear(out).append(
      h('div', { class: 'result-big' }, `${r.score} %`),
      h('div', { class: 'memo-text' }, r.tokens.map((tk) => [h('span', { class: `w ${tk.ok ? 'ok' : 'miss'}` }, tk.text), ' ']).flat()),
      h('p', { class: 'small muted', style: { marginTop: '8px' } }, 'En vert : les mots retrouvés. En rouge : les mots oubliés ou mal écrits.'));
    if (onDone) onDone(r.score);
  };
  register({ kind: 'type', perfect: () => { ta.value = text; check(); }, fail: () => { ta.value = 'nothing'; check(); } });
  mount.append(ta, h('div', { class: 'row', style: { margin: '12px 0' } }, h('button', { class: 'btn primary', onclick: check }, 'Vérifier')), out);
  setTimeout(() => ta.focus(), 50);
}

// Bouton d'enregistrement simple : un clic pour parler, un clic pour finir.
function recordButton({ label = 'Réciter', maxMs = 120000, onText }) {
  const meter = h('div', { class: 'level-meter' }, h('div'));
  const status = h('span', { class: 'small muted' });
  const btn = h('button', { class: 'btn primary' }, icon('mic', 16), label);
  let rec = null;
  window.__teachMemoSay = (said) => { onText(said); return true; };
  btn.addEventListener('click', async () => {
    if (rec) { rec.stop(); return; }
    tts.stop();
    try { rec = await startRecording({ maxMs, onLevel: (v) => { meter.firstChild.style.width = `${v * 100}%`; } }); } catch (e) { status.textContent = `Micro indisponible : ${e.message}`; return; }
    window.api.sttWarmup();
    btn.replaceChildren(icon('stop', 14), 'Terminer');
    btn.className = 'btn rec';
    status.textContent = 'Je t\'écoute…';
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
    onText(r.text);
  });
  return { el: h('div', { class: 'row' }, btn, meter, status), stop: () => rec && rec.stop() };
}

// ---------- Réciter au micro (ou écrire à la place si on ne peut pas parler) ----------
export function reciteStep(mount, text, { onDone, hint = true } = {}) {
  const out = h('div');
  const zone = h('div');
  const W = words(text);
  let hintAt = 0;
  const hintLine = h('p', { class: 'small muted', style: { minHeight: '20px' } });
  const rec = recordButton({
    onText: (said) => {
      const c = compare(text, said);
      clear(out).append(
        h('div', { class: 'result-big' }, `${c.score} %`),
        h('div', { class: 'memo-text' }, c.tokens.map((tk) => [h('span', { class: `w ${tk.ok ? 'ok' : 'miss'}` }, tk.text), ' ']).flat()),
        h('p', { class: 'heard' }, `Entendu : « ${said} »`));
      if (onDone) onDone(c.score);
    },
  });
  register({ kind: 'recite', perfect: () => window.__teachMemoSay(text), fail: () => window.__teachMemoSay('nothing at all') });
  zone.append(
    h('div', { class: 'card' },
      h('p', { class: 'muted', style: { marginTop: 0 } }, 'Clique sur « Réciter », dis le texte de mémoire, puis clique sur « Terminer ».'),
      rec.el,
      hint ? h('div', { class: 'row', style: { marginTop: '10px' } },
        h('button', { class: 'btn ghost', onclick: () => { hintAt = Math.min(W.length, hintAt + 1); hintLine.textContent = `Début : ${W.slice(0, hintAt).map((w, i) => (i < hintAt - 1 ? w : `${bare(w).slice(0, 1)}…`)).join(' ')}`; } }, 'Indice (mot suivant)'),
        h('button', { class: 'btn ghost', onclick: () => { clear(zone); typeStep(zone, text, { onDone }); } }, 'Je ne peux pas parler : écrire à la place')) : null,
      hintLine),
    out);
  mount.append(zone);
}
