// Reconnaissance vocale de la version web : Whisper base.en (Transformers.js + ONNX Runtime en WebAssembly).
// Le modèle (~80 Mo) est téléchargé une fois puis gardé par Safari ; le son reste sur l'appareil.
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';

env.allowLocalModels = false;
env.useBrowserCache = true;

const MODEL = 'Xenova/whisper-base.en';
let pipe = null;
let loading = null;

const progress = (p) => { if (p.status === 'progress' && p.total) self.postMessage({ type: 'progress', progress: Math.round((p.loaded / p.total) * 100) }); };
let device = 'wasm';

// Carte graphique (WebGPU) si Safari la propose : bien plus rapide. Sinon WebAssembly sur le processeur.
async function load() {
  if (self.navigator && self.navigator.gpu) {
    try {
      const adapter = await self.navigator.gpu.requestAdapter();
      if (adapter) {
        const p = await pipeline('automatic-speech-recognition', MODEL, { device: 'webgpu', dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' }, progress_callback: progress });
        device = 'webgpu';
        return p;
      }
    } catch (e) { console.warn('WebGPU indisponible, passage en WebAssembly', e); }
  }
  device = 'wasm';
  return pipeline('automatic-speech-recognition', MODEL, { dtype: 'q8', device: 'wasm', progress_callback: progress });
}

function get() {
  if (pipe) return Promise.resolve(pipe);
  // Une seconde de silence transcrite d'avance : la carte graphique prépare ses calculs une fois pour toutes.
  if (!loading) loading = load().then(async (p) => { try { await p(new Float32Array(16000)); } catch { /* sans gravité */ } pipe = p; return p; }).catch((e) => { loading = null; throw e; });
  return loading;
}

self.onmessage = async (e) => {
  const { id, cmd, samples } = e.data;
  try {
    if (cmd === 'warmup') {
      await get();
      self.postMessage({ id, ok: true, device });
    } else if (cmd === 'transcribe') {
      const p = await get();
      const long = samples.length > 16000 * 28;
      const out = await p(samples, long ? { chunk_length_s: 30, stride_length_s: 5 } : {});
      self.postMessage({ id, ok: true, text: String(out.text || '').replace(/\s+/g, ' ').trim() });
    }
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
