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
vm.runInThisContext(fs.readFileSync(CORE, 'utf8'), { filename: CORE });
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
  const c = config.get().cloud;
  cloud = c && c.url && c.key ? TTCloud.create({ url: c.url, key: c.key, storage, fetch: globalThis.fetch }) : null;
  if (cloud && cloud.user()) { store.setRemote(cloud.cache()); sync.status = 'ok'; sync.at = data.at || null; }
  else { store.setRemote(null); sync.status = 'off'; }
}

function init(userDataDir, { store: s, config: c, onChange: cb }) {
  store = s;
  config = c;
  onChange = cb || onChange;
  file = path.join(userDataDir, 'cloud.json');
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')) || {}; } catch { data = {}; }
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
    const cur = config.get().cloud || {};
    const next = { url: String(url || cur.url || '').trim(), key: String(key || cur.key || '').trim() };
    if (!next.url || !next.key) return { ok: false, error: 'Adresse et clé de la base manquantes.' };
    config.update({ cloud: next });
    make();
    await cloud.signIn(email, password);
    const st = await run();
    return { ok: st.status !== 'error', error: st.error };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

function logout() {
  if (cloud) cloud.signOut();
  store.setRemote(null);
  sync.status = 'off';
  onChange();
  return true;
}

function link(webUrl) {
  const c = config.get().cloud;
  return c && c.url && c.key ? `${webUrl}#${TTCloud.encodeLink(c)}` : null;
}

function status() {
  const c = config.get().cloud;
  return { configured: !!cloud, url: c ? c.url : null, user: cloud ? cloud.user() : null, mode: cloud && cloud.user() ? 'cloud' : null, ...sync };
}

module.exports = { init, run, schedule, connect, logout, link, status };
