'use strict';
// Base en ligne (Supabase) côté PC : mêmes données que la version web (iPhone, iPad).
// L'adresse et la clé publique de la base sont dans config.json (dossier userData, jamais dans le dépôt) ;
// la session de connexion et le cache sont dans userData/cloud.json.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// cloud-core.js est un simple script partagé avec la version web (renderer/ est en modules ES) :
// on l'exécute tel quel, il se range dans globalThis.TTCloud.
const CORE = path.join(__dirname, '..', 'renderer', 'lib', 'cloud-core.js');
// « module » est masqué pour que le script se range toujours dans globalThis, quel que soit l'environnement.
vm.runInThisContext(`(function (module) {\n${fs.readFileSync(CORE, 'utf8')}\n})`, { filename: CORE })(undefined);
const TTCloud = globalThis.TTCloud;

let file = null;
let data = {};
let cloud = null;
let store = null;
let config = null;
let onChange = () => {};
let timer = null;
let busy = null;
const sync = { status: 'off', at: null, error: null };
let env = null; // adresse et clé publique lues dans le fichier .env du projet (jamais dans le dépôt)

// Lecture simple d'un fichier .env : lignes CLÉ=valeur, # pour les commentaires.
function readEnv(file) {
  try {
    const out = {};
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
    return out.TEACHTIME_SUPABASE_URL && out.TEACHTIME_SUPABASE_KEY ? { url: out.TEACHTIME_SUPABASE_URL, key: out.TEACHTIME_SUPABASE_KEY } : null;
  } catch { return null; }
}

// Le .env passe en premier ; à défaut, ce qui a été saisi dans l'app.
function baseCfg() {
  return env || config.get().cloud || null;
}

const storage = {
  get: (k) => (data[k] === undefined ? null : data[k]),
  set: (k, v) => {
    if (v === null || v === undefined) delete data[k]; else data[k] = v;
    try {
      fs.writeFileSync(`${file}.tmp`, JSON.stringify(data), 'utf8');
      fs.renameSync(`${file}.tmp`, file);
    } catch (e) { console.warn('cloud.json', e.message); }
  },
};

function make() {
  const c = baseCfg();
  cloud = c && c.url && c.key ? TTCloud.create({ url: c.url, key: c.key, storage, fetch: globalThis.fetch }) : null;
  if (cloud && cloud.user()) { store.setRemote(cloud.cache()); sync.status = 'ok'; sync.at = data.at || null; }
  else { store.setRemote(null); sync.status = 'off'; }
}

function init(userDataDir, { store: s, config: c, onChange: cb, envFile = null }) {
  store = s;
  config = c;
  onChange = cb || onChange;
  file = path.join(userDataDir, 'cloud.json');
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')) || {}; } catch { data = {}; }
  env = envFile ? readEnv(envFile) : null;
  make();
}

async function run() {
  if (!cloud || !cloud.user()) return status();
  if (busy) return busy;
  sync.status = 'syncing';
  busy = (async () => {
    try {
      store.setRemote(await cloud.sync(store.ownData()));
      sync.status = 'ok';
      sync.error = null;
      sync.at = Date.now();
      storage.set('at', sync.at);
    } catch (e) {
      sync.status = 'error';
      sync.error = String(e.message || e);
    } finally {
      busy = null;
      onChange();
    }
    return status();
  })();
  return busy;
}

function schedule(ms = 3000) {
  if (!cloud || !cloud.user()) return;
  clearTimeout(timer);
  timer = setTimeout(run, ms);
}

async function connect({ url, key, email, password }) {
  try {
    if (url && key) config.update({ cloud: { url: String(url).trim(), key: String(key).trim() } });
    if (!baseCfg()) return { ok: false, error: 'Adresse et clé de la base manquantes (fichier .env).' };
    make();
    await cloud.signIn(email, password);
    const st = await run();
    return { ok: st.status !== 'error', error: st.error };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

// Connexion avec Google sur le PC. Google refuse les fenêtres intégrées aux applications : on ouvre le navigateur
// habituel, et une petite page locale (127.0.0.1, port fixe déclaré dans Supabase) récupère les jetons au retour.
const GOOGLE_PORT = 53682;
const GOOGLE_PATH = '/teachtime-auth';
const RETURN_PAGE = `<!doctype html><meta charset="utf-8"><title>TEAch Time</title>
<body style="font:16px system-ui;background:#f4f5f6;color:#23272e;display:grid;place-items:center;height:100vh;margin:0">
<p id="m">Connexion à TEAch Time…</p>
<script>
  var h = location.hash.slice(1);
  if (h) location.replace('${GOOGLE_PATH}/done?' + h);
  else document.getElementById('m').textContent = 'Aucune réponse de Google. Tu peux fermer cet onglet et réessayer.';
</script></body>`;
const donePage = (msg) => `<!doctype html><meta charset="utf-8"><title>TEAch Time</title><body style="font:16px system-ui;background:#f4f5f6;color:#23272e;display:grid;place-items:center;height:100vh;margin:0"><p>${msg}</p></body>`;

let googlePending = null;
function google() {
  if (googlePending) return googlePending;
  if (!baseCfg()) return Promise.resolve({ ok: false, error: 'Adresse de la base manquante (fichier .env).' });
  make();
  const http = require('http');
  const { shell } = require('electron');
  const redirect = `http://127.0.0.1:${GOOGLE_PORT}${GOOGLE_PATH}`;
  googlePending = new Promise((resolve) => {
    let done = false;
    const finish = (r) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      setTimeout(() => srv.close(), 500);
      googlePending = null;
      resolve(r);
    };
    const srv = http.createServer(async (req, res) => {
      const u = new URL(req.url, redirect);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (u.pathname === GOOGLE_PATH) { res.end(RETURN_PAGE); return; }
      if (u.pathname === `${GOOGLE_PATH}/done`) {
        try {
          const user = await cloud.fromRedirect(u.searchParams);
          if (!user) throw new Error('Connexion annulée.');
          res.end(donePage('C\'est bon, tu es connectée à TEAch Time. Tu peux fermer cet onglet.'));
          const st = await run();
          finish({ ok: st.status !== 'error', error: st.error });
        } catch (e) {
          res.end(donePage(`Connexion impossible : ${String(e.message || e)}`));
          finish({ ok: false, error: String(e.message || e) });
        }
        return;
      }
      res.statusCode = 404;
      res.end('');
    });
    const timer = setTimeout(() => finish({ ok: false, error: 'Délai dépassé : recommence la connexion avec Google.' }), 5 * 60 * 1000);
    srv.on('error', (e) => finish({ ok: false, error: `Port ${GOOGLE_PORT} occupé : ${e.message}` }));
    srv.listen(GOOGLE_PORT, '127.0.0.1', () => shell.openExternal(cloud.googleUrl(redirect)));
  });
  return googlePending;
}

function logout() {
  if (cloud) cloud.signOut();
  store.setRemote(null);
  sync.status = 'off';
  onChange();
  return true;
}

function link(webUrl) {
  const c = baseCfg();
  return c && c.url && c.key ? `${webUrl}#${TTCloud.encodeLink(c)}` : null;
}

function status() {
  const c = baseCfg();
  return { configured: !!cloud, fromEnv: !!env, url: c ? c.url : null, user: cloud ? cloud.user() : null, mode: cloud && cloud.user() ? 'cloud' : null, ...sync };
}

module.exports = { init, run, schedule, connect, google, logout, link, status };
