'use strict';
// Statut Discord (Rich Presence) : « Joue à TEAch Time », ce que Marine fait en ce moment et ses points du jour.
// On parle à l'appli Discord du PC par son tube nommé local : rien ne passe par Internet ici,
// et sans Discord ouvert il ne se passe rien (nouvel essai toutes les 30 secondes tant que la fenêtre est ouverte).
// L'identifiant de l'application Discord (public) est lu dans le .env : TEACHTIME_DISCORD_APP_ID.
const net = require('net');
const fs = require('fs');

const OP = { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 };
const RETRY_MS = 30_000;

let clientId = null;
let pipes = [];
let sock = null;
let ready = false;
let connecting = false;
let retryTimer = null;
let enabled = true;
let visible = false;
let wanted = null; // activité voulue (sans les horodatages)
let lastSent = null; // JSON de la dernière activité envoyée, pour ne pas renvoyer la même
let started = Date.now();
let nonce = 0;
let buf = Buffer.alloc(0);
let lastError = null;

function readAppId(file) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*TEACHTIME_DISCORD_APP_ID\s*=\s*['"]?(\d{15,25})['"]?\s*$/);
      if (m) return m[1];
    }
  } catch { /* pas de .env */ }
  return null;
}

// opts : { envFile, appId (tests), pipe (tests : chemin exact du tube) }
function init({ envFile = null, appId = null, pipe = null, on = true } = {}) {
  clientId = appId || (envFile ? readAppId(envFile) : null);
  enabled = on !== false;
  if (pipe) pipes = [pipe];
  else if (process.platform === 'win32') pipes = Array.from({ length: 10 }, (_, i) => `\\\\?\\pipe\\discord-ipc-${i}`);
  else {
    const dir = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || '/tmp';
    pipes = Array.from({ length: 10 }, (_, i) => `${dir.replace(/\/$/, '')}/discord-ipc-${i}`);
  }
}

function encode(op, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const head = Buffer.alloc(8);
  head.writeInt32LE(op, 0);
  head.writeInt32LE(body.length, 4);
  return Buffer.concat([head, body]);
}

function send(op, payload) {
  if (!sock) return false;
  try { sock.write(encode(op, payload)); return true; } catch { return false; }
}

function teardown(err) {
  if (err) lastError = String(err.message || err);
  ready = false;
  connecting = false;
  lastSent = null;
  buf = Buffer.alloc(0);
  if (sock) { try { sock.destroy(); } catch { /* rien */ } }
  sock = null;
  scheduleRetry();
}

function scheduleRetry() {
  clearTimeout(retryTimer);
  retryTimer = null;
  if (target()) retryTimer = setTimeout(flush, RETRY_MS);
}

function onData(chunk) {
  buf = Buffer.concat([buf, chunk]);
  while (buf.length >= 8) {
    const op = buf.readInt32LE(0);
    const len = buf.readInt32LE(4);
    if (buf.length < 8 + len) return;
    let msg = null;
    try { msg = JSON.parse(buf.subarray(8, 8 + len).toString('utf8')); } catch { /* trame illisible */ }
    buf = buf.subarray(8 + len);
    if (op === OP.PING) send(OP.PONG, msg);
    else if (op === OP.CLOSE) { teardown(msg && msg.message ? msg.message : 'Discord a fermé la connexion'); return; }
    else if (op === OP.FRAME && msg) {
      if (msg.evt === 'READY') { ready = true; lastError = null; flush(); }
      else if (msg.evt === 'ERROR') lastError = (msg.data && msg.data.message) || 'erreur Discord';
    }
  }
}

// Essaie les tubes discord-ipc-0 à 9 l'un après l'autre.
function connect(i = 0) {
  if (i >= pipes.length) { connecting = false; lastError = 'Discord n\'est pas ouvert'; scheduleRetry(); return; }
  connecting = true;
  const s = net.createConnection(pipes[i]);
  let opened = false;
  s.once('connect', () => {
    opened = true;
    sock = s;
    connecting = false;
    s.on('data', onData);
    s.on('close', () => { if (sock === s) teardown(); });
    send(OP.HANDSHAKE, { v: 1, client_id: clientId });
  });
  s.on('error', (e) => {
    if (!opened) { s.destroy(); connect(i + 1); } else if (sock === s) teardown(e);
  });
}

function target() {
  return clientId && enabled && visible ? wanted : null;
}

function flush() {
  if (!clientId) return;
  const t = target();
  if (!sock) {
    if (t && !connecting) { clearTimeout(retryTimer); retryTimer = null; connect(0); }
    return;
  }
  if (!ready) return;
  const activity = t ? { ...t, timestamps: { start: Math.floor(started / 1000) }, instance: false } : null;
  const json = JSON.stringify(activity);
  if (json === lastSent) return;
  lastSent = json;
  send(OP.FRAME, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity }, nonce: String(++nonce) });
  // Plus rien à montrer : on referme le tube (Discord retire le statut).
  if (!t) setTimeout(() => { if (!target() && sock) { const s = sock; sock = null; ready = false; lastSent = null; try { s.end(); } catch { /* rien */ } } }, 300);
}

const clip = (s) => {
  const t = String(s || '').trim();
  if (!t) return undefined;
  return t.length < 2 ? `${t} ` : t.slice(0, 128);
};

// activity : { details, state, image, imageText } ou null pour retirer le statut.
function setActivity(a) {
  wanted = a ? {
    details: clip(a.details),
    state: clip(a.state),
    assets: a.image ? { large_image: a.image, large_text: clip(a.imageText) } : undefined,
  } : null;
  flush();
}

function setVisible(v) {
  if (!!v === visible) return;
  visible = !!v;
  if (visible) started = Date.now(); // le chrono repart quand la fenêtre revient
  flush();
}

function setEnabled(v) {
  enabled = !!v;
  flush();
}

function status() {
  return { configured: !!clientId, enabled, connected: ready, error: ready ? null : lastError };
}

function shutdown() {
  clearTimeout(retryTimer);
  wanted = null;
  if (sock && ready) send(OP.FRAME, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity: null }, nonce: String(++nonce) });
  if (sock) { try { sock.end(); } catch { /* rien */ } }
  sock = null;
  ready = false;
}

module.exports = { init, setActivity, setVisible, setEnabled, status, shutdown, encode, OP };
