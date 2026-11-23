'use strict';
const {
  app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, session, powerMonitor, protocol, net,
} = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
const { execFile } = require('child_process');

// Schéma app:// : modules ES, contexte sécurisé (micro) et aucune page extérieure.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function registerAppProtocol() {
  const root = path.join(__dirname, 'renderer');
  protocol.handle('app', (req) => {
    const url = new URL(req.url);
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    // Le logo vit dans assets/, à côté de renderer/.
    const base = rel.startsWith('assets/') ? path.join(__dirname) : root;
    const file = path.normalize(path.join(base, rel));
    if (!file.startsWith(base + path.sep)) return new Response('Interdit', { status: 403 });
    if (base !== root && !file.startsWith(path.join(__dirname, 'assets') + path.sep)) return new Response('Interdit', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

const config = require('./lib/config');
const store = require('./lib/store');
const stt = require('./lib/stt');
const voice = require('./lib/voice');
const cloud = require('./lib/cloud');

const ARGV = process.argv;
const BACKGROUND = ARGV.includes('--background');
const SELFTEST = ARGV.find((a) => a.startsWith('--selftest'));
const DEV = process.env.TEACHTIME_DEV === '1' || !!SELFTEST;

// En autotest : dossier de données temporaire, pour ne jamais toucher aux vraies données.
if (SELFTEST) {
  app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'teachtime-selftest-')));
}

// L'autotest tourne à côté de la vraie app sans la déranger.
if (!SELFTEST && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  start();
}

let win = null;
let tray = null;
let locked = false;
let blockers = [];
let quitting = false;
let lastRefresh = 0;

function contentDir() {
  return path.join(__dirname, 'content');
}

// ---------- État envoyé à l'interface ----------
function getState() {
  const c = config.publicView();
  const today = store.dayKey();
  const points = store.pointsOn(today);
  return {
    ...c,
    today,
    points,
    quota: c.dailyQuota,
    remaining: Math.max(0, c.dailyQuota - points),
    locked,
    unlockedToday: store.unlockedOn(today),
    streak: store.streak(c.dailyQuota),
    history: store.pointsByDay(14),
    storage: store.info(),
    // Personnage dessiné par Marine, s'il existe (sinon le jeu garde le dessin par défaut).
    playerSprite: fs.existsSync(path.join(__dirname, 'assets', 'sprites', 'joueuse.png')),
    dev: DEV,
    platform: 'desktop',
    cloud: cloud.status(),
  };
}

function pushState() {
  if (win && !win.isDestroyed()) win.webContents.send('state', getState());
  updateTray();
}

// ---------- Règle du verrou ----------
function shouldLock(now = new Date()) {
  const c = config.get();
  if (!c.setupDone) return false;
  if (!c.lockArmed) return false; // verrou en pause jusqu'au feu vert
  const day = store.dayKey(now);
  if (c.setupDay === day) return false; // le jour de l'installation, pas de verrou
  const minutes = now.getHours() * 60 + now.getMinutes();
  const after = minutes >= c.lockHour * 60 + c.lockMinute;
  return after && store.pointsOn(day) < c.dailyQuota && !store.unlockedOn(day);
}

function tick() {
  if (Date.now() - lastRefresh > 60_000) {
    store.refresh();
    lastRefresh = Date.now();
  }
  const want = shouldLock();
  if (want && !locked) lock();
  else if (!want && locked) unlock();
  else pushState();
}

function lock() {
  locked = true;
  ensureWindow();
  if (!SELFTEST) {
    win.setSkipTaskbar(true);
    win.setKiosk(true);
    win.setAlwaysOnTop(true, 'screen-saver');
    win.show();
    win.focus();
    coverOtherScreens();
  }
  pushState();
}

function unlock() {
  locked = false;
  if (win && !win.isDestroyed() && !SELFTEST) {
    win.setKiosk(false);
    win.setAlwaysOnTop(false);
    win.setSkipTaskbar(false);
  }
  for (const b of blockers) if (!b.isDestroyed()) b.destroy();
  blockers = [];
  pushState();
}

// Fenêtres sombres sur les écrans secondaires pendant le verrou.
function coverOtherScreens() {
  for (const b of blockers) if (!b.isDestroyed()) b.destroy();
  blockers = [];
  const main = screen.getDisplayMatching(win.getBounds());
  for (const d of screen.getAllDisplays()) {
    if (d.id === main.id) continue;
    const b = new BrowserWindow({
      ...d.bounds, frame: false, show: false, focusable: false, skipTaskbar: true,
      alwaysOnTop: true, backgroundColor: '#2b2f36', closable: false, resizable: false,
      webPreferences: { sandbox: true },
    });
    b.setAlwaysOnTop(true, 'screen-saver');
    // Les écrans couverts prennent les couleurs du thème choisi.
    const c = config.get().blockerColors || {};
    const q = new URLSearchParams({ bg: c.bg || '#2b2f36', ink: c.ink || '#d9dde3', accent: c.accent || '#3fa796' });
    b.loadURL(`app://teachtime/blocker.html?${q}`);
    b.once('ready-to-show', () => b.showInactive());
    b.on('close', (e) => { if (locked) e.preventDefault(); });
    blockers.push(b);
  }
}

// ---------- Fenêtre ----------
function ensureWindow() {
  if (win && !win.isDestroyed()) return win;
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'TEAch Time',
    backgroundColor: '#f4f5f6', // fond du thème Ardoise
    autoHideMenuBar: true,
    icon: appIcon(256),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      offscreen: !!SELFTEST, // autotest : rendu hors écran, rien ne s'affiche
    },
  });
  win.setMenu(null);
  win.loadURL('app://teachtime/index.html');

  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    if (!locked) win.hide(); // fermer = rester en arrière-plan
  });
  win.on('minimize', () => { if (locked) setTimeout(() => win.restore(), 50); });
  win.on('blur', () => {
    if (locked && !SELFTEST) setTimeout(() => { if (locked) { win.show(); win.focus(); } }, 200);
  });
  win.on('leave-full-screen', () => { if (locked && !SELFTEST) win.setKiosk(true); });
  win.webContents.on('render-process-gone', () => {
    if (!win.isDestroyed()) win.reload();
  });
  // Pas de navigation hors de l'app.
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://teachtime/')) e.preventDefault(); });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  return win;
}

function showWindow() {
  ensureWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

// ---------- Icône ----------
// La tasse de thé de assets/ (créée par « npm run icons »), sinon une icône de secours dessinée en code.
function appIcon(size) {
  const file = (s) => path.join(__dirname, 'assets', `icon-${s}.png`);
  const img = nativeImage.createFromPath(file(size));
  if (img.isEmpty()) return makeIcon(size);
  const big = nativeImage.createFromPath(file(size * 2));
  if (!big.isEmpty()) img.addRepresentation({ scaleFactor: 2, buffer: big.toPNG() });
  return img;
}

function makeIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const r = size * 0.22;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const cx = Math.min(x, size - 1 - x);
      const cy = Math.min(y, size - 1 - y);
      let inside = true;
      if (cx < r && cy < r) inside = (r - cx) ** 2 + (r - cy) ** 2 <= r * r;
      if (!inside) continue;
      // secours si les PNG manquent : fond graphite + « W » vert d'eau
      let [R, G, B] = [43, 47, 54];
      const u = x / size;
      const v = y / size;
      const inW = v > 0.28 && v < 0.74 && (
        Math.abs(u - (0.22 + (v - 0.28) * 0.28)) < 0.06
        || Math.abs(u - (0.5 - (v - 0.28) * 0.28)) < 0.06
        || Math.abs(u - (0.5 + (v - 0.28) * 0.28)) < 0.06
        || Math.abs(u - (0.78 - (v - 0.28) * 0.28)) < 0.06
      );
      if (inW) [R, G, B] = [79, 193, 174];
      buf[i] = B; buf[i + 1] = G; buf[i + 2] = R; buf[i + 3] = 255; // BGRA
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

function updateTray() {
  if (!tray) return;
  const s = getState();
  const items = [
    { label: `Aujourd'hui : ${s.points} / ${s.quota} points`, enabled: false },
    { label: locked ? 'Verrou actif' : !s.lockArmed ? 'Verrou en pause' : (s.points >= s.quota ? 'Quota atteint' : `Verrou à ${String(s.lockHour).padStart(2, '0')} h ${String(s.lockMinute).padStart(2, '0')}`), enabled: false },
    { type: 'separator' },
    { label: 'Ouvrir TEAch Time', click: showWindow },
  ];
  if (DEV) items.push({ type: 'separator' }, { label: 'Quitter (dév.)', click: () => { quitting = true; app.quit(); } });
  tray.setContextMenu(Menu.buildFromTemplate(items));
  tray.setToolTip(`TEAch Time : ${s.points} / ${s.quota} points`);
}

// ---------- Démarrage automatique ----------
function launchCommand() {
  const exe = process.execPath;
  const args = app.isPackaged ? ['--background'] : [app.getAppPath(), '--background'];
  return { exe, args };
}

function applyAutostart(on) {
  if (DEV) return Promise.resolve({ skipped: true });
  const { exe, args } = launchCommand();
  // Ancienne entrée au nom par défaut (« electron.app.Electron ») : on la retire.
  app.setLoginItemSettings({ openAtLogin: false, path: exe, args, name: 'electron.app.Electron' });
  app.setLoginItemSettings({ openAtLogin: !!on, path: exe, args, name: 'TEAch Time' });
  return new Promise((resolve) => {
    const cb = (err) => resolve({ ok: !err, error: err ? String(err.message || err) : null });
    if (on) {
      const tr = `"${exe}" ${args.map((a) => `"${a}"`).join(' ')}`;
      execFile('schtasks', ['/Create', '/F', '/SC', 'MINUTE', '/MO', '5', '/TN', 'TeachTime-relance', '/TR', tr], { windowsHide: true }, cb);
    } else {
      execFile('schtasks', ['/Delete', '/F', '/TN', 'TeachTime-relance'], { windowsHide: true }, cb);
    }
  });
}

// ---------- Contenus ----------
const contentCache = {};
function loadContent(name) {
  if (!/^[a-z0-9_-]+$/i.test(name)) throw new Error('nom de contenu invalide');
  if (!contentCache[name]) {
    contentCache[name] = JSON.parse(fs.readFileSync(path.join(contentDir(), `${name}.json`), 'utf8'));
  }
  return contentCache[name];
}

// ---------- IPC ----------
function registerIpc() {
  ipcMain.handle('state:get', () => getState());

  ipcMain.handle('points:add', (_e, { kind, pts, ref }) => {
    const n = Math.max(0, Math.min(200, Number(pts) || 0));
    store.addEvent({ kind: String(kind || 'activity'), pts: n, ref: ref ? String(ref) : null });
    cloud.schedule();
    tick();
    return getState();
  });
  ipcMain.handle('points:countToday', (_e, ref) => store.countToday(String(ref)));

  ipcMain.handle('items:get', (_e, key) => store.getItem(String(key)));
  ipcMain.handle('items:set', (_e, key, value) => { store.setItem(String(key), value); cloud.schedule(); return true; });
  ipcMain.handle('items:del', (_e, key) => { store.delItem(String(key)); cloud.schedule(); return true; });

  // Base en ligne (Supabase), partagée avec la version web.
  ipcMain.handle('cloud:status', () => cloud.status());
  ipcMain.handle('cloud:connect', (_e, p) => cloud.connect(p || {}).then((r) => { pushState(); return r; }));
  ipcMain.handle('cloud:google', () => cloud.google().then((r) => { pushState(); if (r.ok) showWindow(); return r; }));
  ipcMain.handle('cloud:logout', () => { cloud.logout(); pushState(); return true; });
  ipcMain.handle('cloud:sync', () => cloud.run().then((s) => { pushState(); return s; }));
  ipcMain.handle('cloud:link', (_e, webUrl) => cloud.link(String(webUrl || '')));
  ipcMain.handle('items:list', (_e, prefix) => store.listItems(String(prefix)));

  ipcMain.handle('content:get', (_e, name) => loadContent(String(name)));

  ipcMain.handle('setup:done', async (_e, { code, lockHour, lockMinute, dailyQuota, autostart }) => {
    if (config.get().setupDone) return { ok: false, error: 'Déjà configuré.' };
    if (!code || String(code).length < 4) return { ok: false, error: 'Le code doit faire au moins 4 caractères.' };
    config.setCode(String(code));
    config.update({
      setupDone: true,
      setupDay: store.dayKey(),
      lockHour: clampInt(lockHour, 0, 23, 18),
      lockMinute: clampInt(lockMinute, 0, 59, 0),
      dailyQuota: clampInt(dailyQuota, 50, 2000, 300),
      autostart: autostart !== false,
    });
    const auto = await applyAutostart(config.get().autostart);
    tick();
    return { ok: true, autostart: auto };
  });

  ipcMain.handle('code:check', (_e, code) => config.checkCode(String(code || '')));

  ipcMain.handle('lock:emergency', (_e, code) => {
    if (!config.checkCode(String(code || ''))) return { ok: false };
    store.addEvent({ kind: 'unlock', pts: 0, ref: 'code' });
    store.flush();
    tick();
    return { ok: true };
  });

  ipcMain.handle('settings:update', async (_e, { code, patch }) => {
    if (!config.checkCode(String(code || ''))) return { ok: false, error: 'Code incorrect.' };
    const p = patch || {};
    const next = {};
    if (p.lockHour !== undefined) next.lockHour = clampInt(p.lockHour, 0, 23, 18);
    if (p.lockMinute !== undefined) next.lockMinute = clampInt(p.lockMinute, 0, 59, 0);
    if (p.dailyQuota !== undefined) next.dailyQuota = clampInt(p.dailyQuota, 50, 2000, 300);
    if (p.autostart !== undefined) next.autostart = !!p.autostart;
    if (p.lockArmed !== undefined) next.lockArmed = !!p.lockArmed;
    config.update(next);
    if (p.newCode) {
      if (String(p.newCode).length < 4) return { ok: false, error: 'Le nouveau code doit faire au moins 4 caractères.' };
      config.setCode(String(p.newCode));
    }
    let auto = null;
    if (p.autostart !== undefined) auto = await applyAutostart(next.autostart);
    tick();
    return { ok: true, autostart: auto };
  });

  // Préférence sans enjeu : pas besoin du code.
  ipcMain.handle('settings:voice', (_e, voice) => { config.update({ voice: voice ? String(voice) : null }); return true; });

  // Couleurs du thème pour les écrans couverts pendant le verrou (valeurs CSS simples uniquement).
  ipcMain.handle('appearance:blocker', (_e, c) => {
    const ok = (v) => (typeof v === 'string' && /^(#[0-9a-f]{3,8}|color-mix\([^;{}<>]{1,120}\))$/i.test(v.trim()) ? v.trim() : null);
    const next = { bg: ok(c && c.bg), ink: ok(c && c.ink), accent: ok(c && c.accent) };
    const prev = config.get().blockerColors || {};
    if (next.bg !== prev.bg || next.ink !== prev.ink || next.accent !== prev.accent) config.update({ blockerColors: next });
    return true;
  });

  ipcMain.handle('stt:status', () => stt.status());
  ipcMain.handle('stt:warmup', () => stt.warmup().then(() => stt.status(), (e) => ({ ...stt.status(), error: String(e.message || e) })));
  ipcMain.handle('stt:transcribe', async (_e, samples) => {
    const f32 = samples instanceof Float32Array ? samples : new Float32Array(samples);
    try {
      return { ok: true, text: await stt.transcribe(f32) };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  });

  // Voix anglaise neuronale (Kokoro), calculée sur le PC.
  ipcMain.handle('voice:status', () => voice.status());
  ipcMain.handle('voice:warmup', () => voice.warmup().then(() => voice.status(), (e) => ({ ...voice.status(), error: String(e.message || e) })));
  ipcMain.handle('voice:speak', async (_e, text, id, speed) => {
    try {
      const out = await voice.speak(String(text || ''), String(id || ''), Number(speed) || 1);
      return out ? { ok: true, sampleRate: out.sampleRate, samples: out.samples } : { ok: false, error: 'texte vide' };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  });

  ipcMain.handle('app:hide', () => { if (!locked && win) win.hide(); return true; });
}

function clampInt(v, min, max, def) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

// ---------- Démarrage ----------
function start() {
  app.on('second-instance', (_e, argv) => {
    if (argv.includes('--background')) { tick(); return; }
    showWindow();
  });

  app.whenReady().then(async () => {
    config.init(app.getPath('userData'));
    store.init(app.getPath('userData'), config.get().deviceId, { useDrive: !SELFTEST });
    // Modèles : dossier de l'utilisateur (téléchargés au premier usage), dossier du projet, ou TEACHTIME_MODELS (tests).
    stt.init(path.join(app.getPath('userData'), 'models'), path.join(__dirname, 'models'), process.env.TEACHTIME_MODELS || null);
    voice.init(path.join(app.getPath('userData'), 'models'), path.join(__dirname, 'models'), process.env.TEACHTIME_MODELS || null);
    cloud.init(app.getPath('userData'), { store, config, onChange: () => pushState(), envFile: SELFTEST ? null : path.join(__dirname, '.env') });
    lastRefresh = Date.now();
    registerAppProtocol();

    session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'media'));
    session.defaultSession.setPermissionCheckHandler((_wc, perm) => perm === 'media');

    registerIpc();

    if (SELFTEST) {
      require('./scripts/selftest').run({ app, ensureWindow, getState, shouldLock, tick, config, store, stt, isLocked: () => locked });
      return;
    }

    app.setAppUserModelId('TEAch Time');
    // Remet à jour l'entrée de démarrage (nom, chemin) à chaque lancement.
    if (config.get().setupDone && config.get().autostart) applyAutostart(true);

    tray = new Tray(appIcon(16));
    tray.on('click', showWindow);
    updateTray();

    ensureWindow();
    if (!BACKGROUND || !config.get().setupDone) {
      win.once('ready-to-show', () => showWindow());
    }

    // La voix se charge en arrière-plan (1 s si le modèle est déjà là), pour que la première phrase parte vite.
    setTimeout(() => voice.warmup().catch(() => {}), 3000);

    setInterval(tick, 20_000);
    setInterval(() => cloud.run(), 60_000);
    setTimeout(() => cloud.run(), 4000);
    powerMonitor.on('resume', () => { lastRefresh = 0; tick(); });
    powerMonitor.on('unlock-screen', () => tick());
    tick();
  });

  app.on('before-quit', (e) => {
    if (locked && !DEV) { e.preventDefault(); return; }
    quitting = true;
    try { store.flush(); } catch { /* rien */ }
  });
  app.on('window-all-closed', (e) => e.preventDefault());
}
