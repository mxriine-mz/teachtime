'use strict';
// Voix anglaise neuronale locale : Kokoro-82M (licence Apache 2.0) via kokoro-js + ONNX Runtime, sur le CPU.
// Le modèle (~310 Mo) est téléchargé une seule fois, puis tout se fait sur le PC : aucun texte ne part sur Internet.
const fs = require('fs');
const path = require('path');

const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';

// Voix proposées (accent britannique ou américain). Les autres voix de Kokoro sont de moindre qualité.
const VOICES = [
  { id: 'bf_emma', name: 'Emma', accent: 'britannique', gender: 'femme' },
  { id: 'bm_george', name: 'George', accent: 'britannique', gender: 'homme' },
  { id: 'bf_isabella', name: 'Isabella', accent: 'britannique', gender: 'femme' },
  { id: 'bm_fable', name: 'Fable', accent: 'britannique', gender: 'homme' },
  { id: 'af_heart', name: 'Heart', accent: 'américain', gender: 'femme' },
  { id: 'af_bella', name: 'Bella', accent: 'américain', gender: 'femme' },
  { id: 'am_michael', name: 'Michael', accent: 'américain', gender: 'homme' },
  { id: 'am_fenrir', name: 'Fenrir', accent: 'américain', gender: 'homme' },
];
const DEFAULT_VOICE = 'bf_emma';

let cacheDirs = [];
let tts = null;
let loading = null;
let lastError = null;
const cache = new Map(); // phrases déjà dites : pas besoin de les recalculer
const CACHE_MAX = 300;

function init(...dirs) {
  cacheDirs = dirs.filter(Boolean);
}

function modelPath(d) {
  return path.join(d, ...MODEL.split('/'));
}

function pickCacheDir() {
  for (const d of cacheDirs) if (fs.existsSync(modelPath(d))) return d;
  return cacheDirs[0];
}

function isDownloaded() {
  return cacheDirs.some((d) => fs.existsSync(path.join(modelPath(d), 'onnx')));
}

// kokoro-js embarque sa propre version de Transformers.js : on règle le dossier du modèle sur celle-là.
function transformersOfKokoro() {
  // require.resolve('kokoro-js') pointe vers kokoro-js/dist/kokoro.cjs.
  const base = path.dirname(path.dirname(require.resolve('kokoro-js')));
  return require(path.join(base, 'node_modules', '@huggingface', 'transformers', 'dist', 'transformers.node.cjs'));
}

async function get() {
  if (tts) return tts;
  if (!loading) {
    loading = (async () => {
      const t = transformersOfKokoro();
      t.env.cacheDir = pickCacheDir();
      t.env.allowLocalModels = false;
      const { KokoroTTS } = require('kokoro-js');
      // fp32 : trois fois plus rapide que q8 sur le CPU (≈ 0,4 s pour un mot, 1 s pour une phrase), au prix de ~310 Mo.
      tts = await KokoroTTS.from_pretrained(MODEL, { dtype: 'fp32', device: 'cpu', session_options: { intraOpNumThreads: require('os').cpus().length } });
      lastError = null;
      return tts;
    })().catch((e) => {
      loading = null;
      lastError = String(e.message || e);
      throw e;
    });
  }
  return loading;
}

function warmup() {
  return get();
}

function status() {
  return { ready: !!tts, loading: !!loading && !tts, downloaded: isDownloaded(), error: lastError, model: MODEL, voices: VOICES, defaultVoice: DEFAULT_VOICE };
}

// Renvoie { sampleRate, samples: Float32Array }.
async function speak(text, voice = DEFAULT_VOICE, speed = 1) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 600);
  if (!clean) return null;
  const v = VOICES.some((x) => x.id === voice) ? voice : DEFAULT_VOICE;
  const s = Math.max(0.5, Math.min(1.5, Number(speed) || 1));
  const key = `${v}|${s.toFixed(2)}|${clean}`;
  if (cache.has(key)) return cache.get(key);
  const model = await get();
  const audio = await model.generate(clean, { voice: v, speed: s });
  const out = { sampleRate: audio.sampling_rate, samples: audio.audio };
  cache.set(key, out);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return out;
}

module.exports = { init, warmup, status, speak, MODEL, VOICES, DEFAULT_VOICE };
