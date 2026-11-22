// Lecture à voix haute en anglais.
// 1. Voix neuronale Kokoro, calculée sur le PC (voir lib/voice.js) : accent britannique ou américain naturel.
// 2. Secours : une voix anglaise de Windows, s'il y en a une.
// Jamais de voix française pour lire de l'anglais : sans voix anglaise, on se tait plutôt que de prendre l'accent.
let preferred = null; // identifiant Kokoro (ex. « bf_emma »)
let ready = null;
let ctx = null;
let current = null; // source audio en cours
let token = 0; // chaque nouvelle phrase annule la précédente, même si elle est encore en calcul
let neuralOk = true;

export const VOICES = [
  { id: 'bf_emma', label: 'Emma (britannique, femme)' },
  { id: 'bm_george', label: 'George (britannique, homme)' },
  { id: 'bf_isabella', label: 'Isabella (britannique, femme)' },
  { id: 'bm_fable', label: 'Fable (britannique, homme)' },
  { id: 'af_heart', label: 'Heart (américaine, femme)' },
  { id: 'af_bella', label: 'Bella (américaine, femme)' },
  { id: 'am_michael', label: 'Michael (américain, homme)' },
  { id: 'am_fenrir', label: 'Fenrir (américain, homme)' },
];
export const DEFAULT_VOICE = 'bf_emma';

let preferredSystem = null; // nom d'une voix du système (iPhone, iPad)

export function setPreferred(id) {
  preferred = VOICES.some((v) => v.id === id) ? id : null;
  preferredSystem = !preferred && id ? String(id) : null;
}

export function currentSystemVoice() {
  return preferredSystem;
}

export function currentVoice() {
  return preferred || DEFAULT_VOICE;
}

function loadVoices() {
  if (!ready) {
    ready = new Promise((resolve) => {
      const v = speechSynthesis.getVoices();
      if (v.length) return resolve(v);
      speechSynthesis.addEventListener('voiceschanged', () => resolve(speechSynthesis.getVoices()), { once: true });
      setTimeout(() => resolve(speechSynthesis.getVoices()), 1500);
    });
  }
  return ready;
}

// Voix anglaises du système : Windows (secours) ou iOS (voix principale de la version web).
export async function windowsEnglishVoices() {
  const all = await loadVoices();
  return all.filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'));
}

// Voix « fantaisie » d'Apple (cloches, chuchotements…) : inutiles pour apprendre.
const NOVELTY = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Junior|Ralph|Fred|Kathy|Grandma|Grandpa|Rocko|Shelley|Flo|Eddy|Reed|Sandy)\b/i;

export async function systemVoices() {
  return (await windowsEnglishVoices()).filter((v) => !NOVELTY.test(v.name)).sort((a, b) => quality(b) - quality(a) || a.name.localeCompare(b.name));
}

// Les voix « premium » et « améliorées » d'iOS sont bien plus naturelles.
function quality(v) {
  let q = 0;
  if (/premium/i.test(v.name)) q += 4;
  if (/enhanced|amélioré/i.test(v.name)) q += 3;
  if (/en-GB/i.test(v.lang)) q += 1;
  if (/^(Daniel|Serena|Kate|Ava|Samantha|Evan|Zoe|Allison|Tom|Karen|Moira)/i.test(v.name)) q += 1;
  return q;
}

function play(samples, sampleRate, my) {
  return new Promise((resolve) => {
    if (my !== token) return resolve(false);
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const buf = ctx.createBuffer(1, samples.length, sampleRate);
    buf.copyToChannel(samples instanceof Float32Array ? samples : new Float32Array(samples), 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.onended = () => { if (current === src) current = null; resolve(true); };
    current = src;
    src.start();
  });
}

async function speakWindows(text, rate, my) {
  const en = await systemVoices();
  const voice = (preferredSystem && en.find((v) => v.name === preferredSystem)) || en.find((v) => /en-(GB|US)/i.test(v.lang)) || en[0];
  if (!voice || my !== token) return false;
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = rate;
    u.onend = () => resolve(true);
    u.onerror = () => resolve(false);
    speechSynthesis.speak(u);
  });
}

// rate : 1 = débit naturel, 0.7 = lent.
export async function speak(text, { rate = 0.95, voice = null } = {}) {
  stop();
  const my = ++token;
  const t = String(text || '').trim();
  if (!t) return false;
  if (neuralOk && window.api && window.api.voiceSpeak) {
    // Texte long : phrase par phrase, la suivante se calcule pendant que la précédente est lue.
    const parts = t.match(/[^.!?]+[.!?]*["»)]?\s*/g)?.map((s) => s.trim()).filter(Boolean) || [t];
    const id = voice || currentVoice();
    let next = window.api.voiceSpeak(parts[0], id, rate);
    for (let i = 0; i < parts.length; i++) {
      const r = await next;
      if (my !== token) return false;
      if (!r || !r.ok) {
        if (i === 0) break; // la voix neuronale ne marche pas : secours Windows
        return false;
      }
      next = i + 1 < parts.length ? window.api.voiceSpeak(parts[i + 1], id, rate) : null;
      await play(r.samples, r.sampleRate, my);
      if (my !== token) return false;
      if (i === parts.length - 1) return true;
    }
    neuralOk = false;
  }
  return speakWindows(t, rate, my);
}

export function stop() {
  token++;
  try { speechSynthesis.cancel(); } catch { /* rien */ }
  if (current) { try { current.stop(); } catch { /* déjà fini */ } current = null; }
}

// Lit un enregistrement du micro (Float32Array à 16 kHz), pour se réécouter.
export async function playRecording(samples, sampleRate = 16000) {
  stop();
  return play(samples, sampleRate, token);
}

export async function status() {
  return window.api.voiceStatus ? window.api.voiceStatus() : { ready: false };
}

// Compatibilité avec l'ancien code : « y a-t-il une voix anglaise ? »
export async function englishVoices() {
  return VOICES;
}

export async function hasEnglishVoice() {
  return true;
}
