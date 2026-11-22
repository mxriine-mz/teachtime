// Enregistrement du micro en 16 kHz mono (format attendu par Whisper).
// On enregistre à la fréquence native de l'appareil (Safari sur iPhone n'accepte pas toujours 16 kHz
// directement), puis on rééchantillonne à 16 kHz.
const TARGET = 16000;

function resample(input, from) {
  if (from === TARGET) return input;
  const ratio = from / TARGET;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    // Moyenne des échantillons couverts : filtre passe-bas simple, suffisant pour la voix.
    const a = Math.floor(i * ratio);
    const b = Math.min(input.length, Math.floor((i + 1) * ratio));
    let s = 0;
    for (let k = a; k < b; k++) s += input[k];
    out[i] = b > a ? s / (b - a) : input[a] || 0;
  }
  return out;
}

export async function startRecording({ maxMs = 15000, onLevel } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  if (ctx.state === 'suspended') await ctx.resume();
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const chunks = [];
  let stopped = false;
  let resolveDone;
  const finished = new Promise((r) => { resolveDone = r; });

  proc.onaudioprocess = (e) => {
    if (stopped) return;
    const d = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(d));
    if (onLevel) {
      let s = 0;
      for (let i = 0; i < d.length; i++) s += d[i] * d[i];
      onLevel(Math.min(1, Math.sqrt(s / d.length) * 6));
    }
  };
  src.connect(proc);
  proc.connect(ctx.destination);

  const timer = setTimeout(() => stop(), maxMs);

  async function stop() {
    if (stopped) return finished;
    stopped = true;
    clearTimeout(timer);
    try { proc.disconnect(); src.disconnect(); } catch { /* rien */ }
    stream.getTracks().forEach((t) => t.stop());
    const rate = ctx.sampleRate;
    try { await ctx.close(); } catch { /* rien */ }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const raw = new Float32Array(total);
    let o = 0;
    for (const c of chunks) { raw.set(c, o); o += c.length; }
    resolveDone(resample(raw, rate));
    return finished;
  }

  return { stop, finished };
}
