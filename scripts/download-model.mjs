// Télécharge le modèle Whisper base.en (~80 Mo) dans ./models, une seule fois.
// Usage : npm run model
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline, env } from '@huggingface/transformers';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
env.cacheDir = path.join(root, 'models');
env.allowLocalModels = false;

console.log('Téléchargement de Xenova/whisper-base.en dans', env.cacheDir);
const t0 = Date.now();
const asr = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base.en', {
  dtype: 'q8',
  device: 'cpu',
  progress_callback: (p) => {
    if (p.status === 'done') console.log('  fichier prêt :', p.file);
  },
});
// Petit essai sur une seconde de silence pour vérifier que le modèle se charge.
const out = await asr(new Float32Array(16000));
console.log(`Modèle prêt en ${((Date.now() - t0) / 1000).toFixed(1)} s. Essai sur du silence : « ${out.text.trim()} »`);
