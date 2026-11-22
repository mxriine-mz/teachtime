'use strict';
// Transcription vocale locale (Whisper base.en via Transformers.js + ONNX Runtime, CPU).
// Aucun son ne quitte le PC.
const fs = require('fs');
const path = require('path');

const MODEL = 'Xenova/whisper-base.en';

let cacheDirs = [];
let pipe = null;
let loading = null;
let lastError = null;

function init(...dirs) {
  cacheDirs = dirs.filter(Boolean);
}

// Le modèle peut se trouver dans le dossier du projet (téléchargé par « npm run model »)
// ou dans userData/models (téléchargé au premier usage).
function pickCacheDir() {
  for (const d of cacheDirs) {
    if (fs.existsSync(path.join(d, ...MODEL.split('/')))) return d;
  }
  return cacheDirs[0];
}

function isDownloaded() {
  return cacheDirs.some((d) => fs.existsSync(path.join(d, ...MODEL.split('/'))));
}

async function get() {
  if (pipe) return pipe;
  if (!loading) {
    loading = (async () => {
      const t = await import('@huggingface/transformers');
      t.env.cacheDir = pickCacheDir();
      t.env.allowLocalModels = false;
      pipe = await t.pipeline('automatic-speech-recognition', MODEL, { dtype: 'q8', device: 'cpu' });
      lastError = null;
      return pipe;
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
  return { ready: !!pipe, loading: !!loading && !pipe, downloaded: isDownloaded(), error: lastError, model: MODEL };
}

async function transcribe(samples) {
  if (!samples || samples.length < 1600) return ''; // moins de 0,1 s
  // Sur du silence, Whisper invente souvent « you » : on ne transcrit pas un enregistrement vide.
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  if (Math.sqrt(sum / samples.length) < 0.004) return '';
  const p = await get();
  const long = samples.length > 16000 * 28;
  const out = await p(samples, long ? { chunk_length_s: 30, stride_length_s: 5 } : {});
  return String(out.text || '').replace(/\s+/g, ' ').trim();
}

module.exports = { init, warmup, status, transcribe, MODEL };
