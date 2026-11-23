'use strict';
// Réglages propres à ce PC (heure du verrou, quota, code d'urgence haché).
// Rangés dans le dossier userData d'Electron, jamais dans le dépôt.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULTS = {
  setupDone: false,
  setupDay: null,
  lockHour: 18,
  lockMinute: 0,
  dailyQuota: 300,
  autostart: true,
  // Le verrou reste en pause tant que Marine n'a pas donné son feu vert (Réglages, avec le code).
  lockArmed: false,
  codeSalt: null,
  codeHash: null,
  deviceId: null,
  voice: null,
  discord: true, // statut Discord (Rich Presence) quand la fenêtre est ouverte
};

let file = null;
let data = { ...DEFAULTS };

function init(userDataDir) {
  file = path.join(userDataDir, 'config.json');
  try {
    data = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    data = { ...DEFAULTS };
  }
  if (!data.deviceId) {
    data.deviceId = crypto.randomBytes(6).toString('hex');
    save();
  }
}

function save() {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function get() {
  return data;
}

function update(patch) {
  data = { ...data, ...patch };
  save();
}

function hash(code, salt) {
  return crypto.scryptSync(String(code), salt, 32).toString('hex');
}

function setCode(code) {
  const salt = crypto.randomBytes(16).toString('hex');
  update({ codeSalt: salt, codeHash: hash(code, salt) });
}

function checkCode(code) {
  if (!data.codeHash || !data.codeSalt) return false;
  const a = Buffer.from(hash(code, data.codeSalt), 'hex');
  const b = Buffer.from(data.codeHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Ce que l'interface a le droit de voir (jamais le hash).
function publicView() {
  const { setupDone, setupDay, lockHour, lockMinute, dailyQuota, autostart, lockArmed, deviceId, voice, discord } = data;
  return { setupDone, setupDay, lockHour, lockMinute, dailyQuota, autostart, lockArmed, deviceId, voice, discord };
}

module.exports = { init, get, update, setCode, checkCode, publicView };
