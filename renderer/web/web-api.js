// Version web de TEAch Time (iPad, iPhone, Safari) : remplace le pont Electron (preload.js).
// Mêmes fonctions que window.api sur le PC, mais :
//  - les données sont gardées dans le navigateur, et synchronisées avec la base en ligne (Supabase) si on est connectée ;
//  - pas de verrou (Safari ne peut pas bloquer un iPhone) : le quota et les points restent ;
//  - la voix anglaise est celle d'iOS, la reconnaissance vocale tourne dans Safari (Whisper).
/* global TTCloud */

const LS = {
  get(k) { try { const v = localStorage.getItem(k); return v === null ? null : JSON.parse(v); } catch { return null; } },
  set(k, v) { try { if (v === null || v === undefined) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn('stockage plein ?', e); } },
};

function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');

// ---------- Données de cet appareil ----------
let deviceId = LS.get('tt.device');
if (!deviceId) { deviceId = `web-${rid().slice(0, 10)}`; LS.set('tt.device', deviceId); }
let own = LS.get('tt.own') || { events: [], items: {} };
const settings = LS.get('tt.settings') || { mode: null, voice: null }; // mode : 'cloud' | 'local' | null
const saveOwn = () => LS.set('tt.own', own);
const saveSettings = () => LS.set('tt.settings', settings);

// ---------- Base en ligne ----------
const cloudStorage = { get: (k) => LS.get(`tt.cloud.${k}`), set: (k, v) => LS.set(`tt.cloud.${k}`, v) };
let cloudCfg = LS.get('tt.cloudcfg');
const fromLink = TTCloud.decodeLink(location.hash);
if (fromLink) {
  cloudCfg = fromLink;
  LS.set('tt.cloudcfg', cloudCfg);
  history.replaceState(null, '', location.pathname + location.search); // on retire la clé de la barre d'adresse
}
let cloud = null;
const makeCloud = () => { cloud = cloudCfg ? TTCloud.create({ url: cloudCfg.url, key: cloudCfg.key, storage: cloudStorage }) : null; };
makeCloud();
let remote = cloud ? cloud.cache() : { events: [], items: {} };
const sync = { status: cloud && cloud.user() ? 'ok' : 'off', at: LS.get('tt.cloud.at'), error: null };

// ---------- Fusion (comme lib/store.js sur le PC) ----------
function allEvents() {
  const m = new Map();
  for (const e of remote.events) m.set(e.id, e);
  for (const e of own.events) m.set(e.id, e);
  return [...m.values()];
}
function mergedItem(key) {
  const a = own.items[key];
  const b = remote.items[key];
  if (a && b) return a.u >= b.u ? a : b;
  return a || b || null;
}
function getItem(key) { const it = mergedItem(key); return it && !it.deleted ? it.v : null; }
function pointsOn(day = dayKey()) { let s = 0; for (const e of allEvents()) if (e.day === day && e.kind !== 'unlock') s += e.pts || 0; return s; }
function byDay() { const m = {}; for (const e of allEvents()) if (e.kind !== 'unlock') m[e.day] = (m[e.day] || 0) + (e.pts || 0); return m; }
function quota() { const q = Number(getItem('settings:quota')); return q >= 50 && q <= 2000 ? q : 300; }
function streak(q) {
  const m = byDay();
  const d = new Date();
  let n = 0;
  for (let i = (m[dayKey(d)] || 0) >= q ? 0 : 1; ; i++) {
    if ((m[dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - i))] || 0) >= q) n++;
    else break;
  }
  return n;
}
function history14() {
  const m = byDay();
  const d = new Date();
  const out = [];
  for (let i = 13; i >= 0; i--) { const k = dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - i)); out.push({ day: k, pts: m[k] || 0 }); }
  return out;
}

function getState() {
  const today = dayKey();
  const q = quota();
  const points = pointsOn(today);
  const user = cloud ? cloud.user() : null;
  return {
    platform: 'web',
    setupDone: settings.mode === 'local' || (settings.mode === 'cloud' && !!user),
    today,
    points,
    quota: q,
    dailyQuota: q,
    remaining: Math.max(0, q - points),
    locked: false,
    lockArmed: false,
    unlockedToday: allEvents().some((e) => e.day === today && e.kind === 'unlock'),
    streak: streak(q),
    history: history14(),
    voice: settings.voice,
    playerSprite: true,
    dev: false,
    storage: { deviceId, otherDevices: 0, driveDir: null },
    cloud: { configured: !!cloud, url: cloud ? cloud.url : null, user, mode: settings.mode, ...sync },
  };
}

const listeners = new Set();
const emit = () => { const s = getState(); listeners.forEach((cb) => { try { cb(s); } catch (e) { console.error(e); } }); };

let syncTimer = null;
let syncing = null;
async function doSync() {
  if (!cloud || !cloud.user() || settings.mode !== 'cloud') return;
  if (syncing) return syncing;
  if (!navigator.onLine) { sync.status = 'offline'; emit(); return; }
  sync.status = 'syncing';
  syncing = (async () => {
    try {
      remote = await cloud.sync(own);
      sync.status = 'ok';
      sync.error = null;
      sync.at = Date.now();
      LS.set('tt.cloud.at', sync.at);
    } catch (e) {
      sync.status = 'error';
      sync.error = String(e.message || e);
      if (!cloud.user()) { settings.mode = null; saveSettings(); }
    } finally {
      syncing = null;
      emit();
    }
  })();
  return syncing;
}
function scheduleSync(ms = 2500) { clearTimeout(syncTimer); syncTimer = setTimeout(doSync, ms); }
setInterval(doSync, 60000);
window.addEventListener('online', () => doSync());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') doSync(); });
if (settings.mode === 'cloud') setTimeout(doSync, 500);

// ---------- Reconnaissance vocale : Whisper dans un « worker » (Safari) ----------
let worker = null;
let wid = 0;
const pending = new Map();
const stt = { ready: false, loading: false, error: null, progress: 0 };
function sttWorker() {
  if (!worker) {
    worker = new Worker(new URL('./stt-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'progress') { stt.progress = m.progress; return; }
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      if (m.ok) { stt.ready = true; stt.loading = false; stt.error = null; if (m.device) stt.device = m.device; } else { stt.loading = false; stt.error = m.error; }
      p(m);
    };
  }
  return worker;
}
const ask = (msg, transfer) => new Promise((resolve) => { const id = ++wid; pending.set(id, resolve); sttWorker().postMessage({ id, ...msg }, transfer || []); });

// ---------- window.api ----------
window.api = {
  platform: 'web',
  getState: async () => getState(),
  addPoints: async (kind, pts, ref) => {
    const n = Math.max(0, Math.min(200, Number(pts) || 0));
    own.events.push({ id: rid(), t: Date.now(), day: dayKey(), kind: String(kind || 'activity'), pts: n, ref: ref ? String(ref) : null, dev: deviceId });
    saveOwn();
    scheduleSync();
    const s = getState();
    listeners.forEach((cb) => cb(s));
    return s;
  },
  countToday: async (ref) => { const d = dayKey(); return allEvents().filter((e) => e.day === d && e.ref === ref).length; },

  getItem: async (key) => getItem(String(key)),
  setItem: async (key, value) => { own.items[String(key)] = { v: value, u: Date.now() }; saveOwn(); scheduleSync(); return true; },
  delItem: async (key) => { own.items[String(key)] = { v: null, u: Date.now(), deleted: true }; saveOwn(); scheduleSync(); return true; },
  listItems: async (prefix) => {
    const keys = new Set([...Object.keys(own.items), ...Object.keys(remote.items)]);
    const out = [];
    for (const k of keys) if (k.startsWith(prefix)) { const v = getItem(k); if (v !== null) out.push({ key: k, value: v }); }
    return out;
  },

  content: async (name) => {
    if (!/^[a-z0-9_-]+$/i.test(name)) throw new Error('nom de contenu invalide');
    const r = await fetch(`content/${name}.json`);
    if (!r.ok) throw new Error(`contenu ${name} introuvable`);
    return r.json();
  },

  // Réglages : sur le web, seul le quota compte (pas de verrou ni de code).
  updateSettings: async (_code, patch = {}) => {
    if (patch.dailyQuota !== undefined) {
      const q = Math.max(50, Math.min(2000, parseInt(patch.dailyQuota, 10) || 300));
      own.items['settings:quota'] = { v: q, u: Date.now() };
      saveOwn();
      scheduleSync(500);
    }
    emit();
    return { ok: true };
  },
  setVoice: async (voice) => { settings.voice = voice ? String(voice) : null; saveSettings(); return true; },
  setBlockerColors: async () => true,
  checkCode: async () => false,
  emergencyUnlock: async () => ({ ok: false }),
  setup: async () => ({ ok: false, error: 'Pas d\'assistant sur la version web.' }),
  hide: async () => true,

  // Base en ligne.
  cloudStatus: async () => getState().cloud,
  cloudConnect: async ({ url, key, email, password }) => {
    try {
      if (url && key) { cloudCfg = { url: String(url).trim(), key: String(key).trim() }; LS.set('tt.cloudcfg', cloudCfg); makeCloud(); }
      if (!cloud) return { ok: false, error: 'Adresse et clé de la base manquantes.' };
      await cloud.signIn(email, password);
      settings.mode = 'cloud';
      saveSettings();
      await doSync();
      return { ok: sync.status !== 'error', error: sync.error };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  },
  cloudLogout: async () => { if (cloud) cloud.signOut(); remote = { events: [], items: {} }; settings.mode = null; saveSettings(); emit(); return true; },
  cloudSync: async () => { await doSync(); return getState().cloud; },
  cloudLink: async () => (cloudCfg ? `${location.origin}${location.pathname}#${TTCloud.encodeLink(cloudCfg)}` : null),
  cloudConfig: async () => (cloudCfg ? { url: cloudCfg.url, hasKey: true } : null),
  useLocal: async () => { settings.mode = 'local'; saveSettings(); emit(); return true; },

  // Reconnaissance vocale.
  sttStatus: async () => ({ ...stt, downloaded: stt.ready, model: 'Xenova/whisper-base.en' }),
  sttWarmup: async () => { if (!stt.ready && !stt.loading) { stt.loading = true; ask({ cmd: 'warmup' }); } return { ...stt }; },
  transcribe: async (samples) => {
    const f32 = samples instanceof Float32Array ? samples : new Float32Array(samples);
    if (f32.length < 1600) return { ok: true, text: '' };
    let sum = 0;
    for (let i = 0; i < f32.length; i++) sum += f32[i] * f32[i];
    if (Math.sqrt(sum / f32.length) < 0.004) return { ok: true, text: '' }; // silence : Whisper inventerait « you »
    stt.loading = !stt.ready;
    const copy = new Float32Array(f32);
    const r = await ask({ cmd: 'transcribe', samples: copy }, [copy.buffer]);
    return r.ok ? { ok: true, text: r.text } : { ok: false, error: r.error };
  },

  onState: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
};
