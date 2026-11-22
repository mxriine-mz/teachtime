// Télécharge la voix anglaise neuronale (Kokoro, ~310 Mo) dans ./models, une seule fois, puis fait un essai.
// Usage : npm run voice
const path = require('path');
const fs = require('fs');
const voice = require('../lib/voice');

(async () => {
  const dir = path.join(__dirname, '..', 'models');
  voice.init(dir);
  console.log('Téléchargement de', voice.MODEL, 'dans', dir);
  const t0 = Date.now();
  await voice.warmup();
  console.log(`Modèle prêt en ${((Date.now() - t0) / 1000).toFixed(1)} s.`);
  for (const v of ['bf_emma', 'am_michael']) {
    const t1 = Date.now();
    const out = await voice.speak('Hello Marine, this is your daily English practice.', v, 1);
    console.log(`  ${v} : ${(out.samples.length / out.sampleRate).toFixed(1)} s d'audio en ${((Date.now() - t1) / 1000).toFixed(1)} s`);
    if (process.argv[2]) writeWav(path.join(process.argv[2], `${v}.wav`), out);
  }
})().catch((e) => { console.error('Échec :', e.message || e); process.exit(1); });

// WAV 16 bits, pour écouter l'essai si un dossier est donné.
function writeWav(file, { sampleRate, samples }) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(Math.max(-1, Math.min(1, samples[i])) * 32767 | 0, 44 + i * 2);
  fs.writeFileSync(file, buf);
}
