'use strict';
// Progression partagée entre plusieurs PC.
// Chaque PC écrit UNIQUEMENT son propre fichier devices/<id>.json : aucun conflit
// de synchronisation Google Drive. On lit les fichiers des autres PC pour fusionner.
//  - events : points gagnés et déblocages, fusionnés par union (id unique)
//  - items  : objets (textes, listes, statistiques), le plus récent gagne
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const APP_DIR = 'TeachTime';

let localDir = null; // <userData>/data
let driveDir = null; // <X>:\Mon Drive\TeachTime, ou null
let deviceId = null;
let own = { deviceId: null, events: [], items: {} };
let others = {}; // deviceId -> { events, items }
let remote = { events: [], items: {} }; // base en ligne (Supabase) : tous les appareils du compte
let saveTimer = null;
let useDriveFlag = true;

function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${j}`;
}

// Cherche le lecteur Google Drive pour ordinateur (« Mon Drive » ou « My Drive »).
function findDrive() {
  for (let c = 67; c <= 90; c++) { // C..Z
    const letter = String.fromCharCode(c);
    for (const name of ['Mon Drive', 'My Drive']) {
      const p = `${letter}:\\${name}`;
      try {
        if (fs.statSync(p).isDirectory()) return path.join(p, APP_DIR);
      } catch { /* lecteur absent */ }
    }
  }
  return null;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function init(userDataDir, id, { useDrive = true, driveOverride = null } = {}) {
  deviceId = id;
  localDir = path.join(userDataDir, 'data');
  fs.mkdirSync(localDir, { recursive: true });
  const loaded = readJson(path.join(localDir, `${id}.json`));
  own = loaded && loaded.deviceId === id
    ? { deviceId: id, events: loaded.events || [], items: loaded.items || {} }
    : { deviceId: id, events: [], items: {} };
  useDriveFlag = useDrive && !driveOverride;
  driveDir = driveOverride || (useDrive ? findDrive() : null);
  others = {};
  refresh();
}

// Relit les fichiers des autres PC (et retente de trouver le Drive s'il n'était pas monté).
function refresh() {
  if (driveDir === null && useDriveFlag) driveDir = findDrive();
  if (!driveDir) return;
  const dir = path.join(driveDir, 'devices');
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    mirror();
    return;
  }
  const next = {};
  for (const f of files) {
    const id = f.slice(0, -5);
    if (id === deviceId) continue;
    const d = readJson(path.join(dir, f));
    if (d) next[id] = { events: d.events || [], items: d.items || {} };
  }
  others = next;
  // Copie vers le Drive si elle manque (premier lancement après montage du Drive).
  try {
    fs.statSync(path.join(dir, `${deviceId}.json`));
  } catch {
    mirror();
  }
}

function writeLocal() {
  const file = path.join(localDir, `${deviceId}.json`);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(own), 'utf8');
  fs.renameSync(tmp, file);
}

function mirror() {
  if (!driveDir) return;
  try {
    const dir = path.join(driveDir, 'devices');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${deviceId}.json`), JSON.stringify(own), 'utf8');
  } catch { /* Drive indisponible : on réessaiera au prochain enregistrement */ }
}

function save() {
  writeLocal();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(mirror, 1500);
}

function flush() {
  clearTimeout(saveTimer);
  writeLocal();
  mirror();
}

// Union par identifiant : un même gain peut venir du Drive et de la base en ligne.
function allEvents() {
  const m = new Map();
  for (const e of remote.events) m.set(e.id, e);
  for (const o of Object.values(others)) for (const e of o.events) m.set(e.id, e);
  for (const e of own.events) m.set(e.id, e);
  return [...m.values()];
}

function addEvent({ kind, pts = 0, ref = null }) {
  const ev = {
    id: crypto.randomBytes(8).toString('hex'),
    t: Date.now(),
    day: dayKey(),
    kind,
    pts: Math.max(0, Math.round(pts)),
    ref,
    dev: deviceId,
  };
  own.events.push(ev);
  save();
  return ev;
}

function pointsOn(day = dayKey()) {
  let sum = 0;
  for (const e of allEvents()) if (e.day === day && e.kind !== 'unlock') sum += e.pts || 0;
  return sum;
}

function unlockedOn(day = dayKey()) {
  return allEvents().some((e) => e.day === day && e.kind === 'unlock');
}

// Nombre d'événements déjà notés aujourd'hui pour une référence (limite anti-répétition).
function countToday(ref, day = dayKey()) {
  return allEvents().filter((e) => e.day === day && e.ref === ref).length;
}

function pointsByDay(days = 14) {
  const map = {};
  for (const e of allEvents()) {
    if (e.kind === 'unlock') continue;
    map[e.day] = (map[e.day] || 0) + (e.pts || 0);
  }
  const out = [];
  const d = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i);
    const k = dayKey(x);
    out.push({ day: k, pts: map[k] || 0 });
  }
  return out;
}

// Jours d'affilée où le quota est atteint (aujourd'hui compte s'il est déjà atteint).
function streak(quota) {
  const map = {};
  for (const e of allEvents()) {
    if (e.kind === 'unlock') continue;
    map[e.day] = (map[e.day] || 0) + (e.pts || 0);
  }
  const d = new Date();
  let n = 0;
  let i = (map[dayKey(d)] || 0) >= quota ? 0 : 1;
  for (;; i++) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i);
    if ((map[dayKey(x)] || 0) >= quota) n++;
    else break;
  }
  return n;
}

function mergedItem(key) {
  let best = own.items[key] || null;
  const r = remote.items[key];
  if (r && (!best || r.u > best.u)) best = r;
  for (const o of Object.values(others)) {
    const it = o.items[key];
    if (it && (!best || it.u > best.u)) best = it;
  }
  return best;
}

function getItem(key) {
  const it = mergedItem(key);
  return it && !it.deleted ? it.v : null;
}

function setItem(key, value) {
  own.items[key] = { v: value, u: Date.now() };
  save();
}

function delItem(key) {
  own.items[key] = { v: null, u: Date.now(), deleted: true };
  save();
}

function listItems(prefix) {
  const keys = new Set([...Object.keys(own.items), ...Object.keys(remote.items)]);
  for (const o of Object.values(others)) for (const k of Object.keys(o.items)) keys.add(k);
  const out = [];
  for (const k of keys) {
    if (!k.startsWith(prefix)) continue;
    const v = getItem(k);
    if (v !== null) out.push({ key: k, value: v });
  }
  return out;
}

// Base en ligne : ce que cet appareil doit envoyer, et ce qui est arrivé d'ailleurs.
// Tout ce que ce PC connaît en dehors de la base en ligne : ses données et celles venues du Drive (autres PC).
function ownData() {
  const m = new Map();
  for (const o of Object.values(others)) for (const e of o.events) m.set(e.id, e);
  for (const e of own.events) m.set(e.id, e);
  const items = {};
  for (const src of [...Object.values(others).map((o) => o.items), own.items]) {
    for (const [k, it] of Object.entries(src)) if (it && (!items[k] || it.u > items[k].u)) items[k] = it;
  }
  return { events: [...m.values()], items };
}

function setRemote(data) {
  remote = data && data.events ? data : { events: [], items: {} };
}

// Totaux de toute l'histoire, pour la page Profil : points par jour et par matière.
function stats() {
  const byDay = {};
  const byKind = {};
  const unlockDays = [];
  for (const e of allEvents()) {
    if (e.kind === 'unlock') { unlockDays.push(e.day); continue; }
    byDay[e.day] = (byDay[e.day] || 0) + (e.pts || 0);
    byKind[e.kind] = (byKind[e.kind] || 0) + (e.pts || 0);
  }
  return { byDay, byKind, unlockDays };
}

function info() {
  return { driveDir, localDir, deviceId, otherDevices: Object.keys(others).length };
}

module.exports = {
  init, refresh, flush, dayKey, addEvent, pointsOn, unlockedOn, countToday,
  pointsByDay, streak, stats, getItem, setItem, delItem, listItems, info, ownData, setRemote,
};
