'use strict';
// Test de la synchronisation entre deux PC via un faux dossier Google Drive.
// Usage : node scripts/test-store.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const store = require('../lib/store');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teachtime-store-'));
const drive = path.join(root, 'drive', 'TeachTime');
const pcA = path.join(root, 'pcA');
const pcB = path.join(root, 'pcB');
const opts = { useDrive: false, driveOverride: drive };
const sleep = (ms) => { const end = Date.now() + ms; while (Date.now() < end) { /* attente active courte */ } };

let ok = 0;
const t = (name, fn) => { fn(); ok++; console.log('OK  ', name); };

// PC A : 120 points et un texte.
store.init(pcA, 'aaa', opts);
store.addEvent({ kind: 'quiz', pts: 120, ref: 'q:g01' });
store.setItem('text:1', { title: 'v1' });
store.flush();
t('A voit ses 120 points', () => assert.strictEqual(store.pointsOn(), 120));

// PC B : voit les points de A, en ajoute 200, modifie le texte plus tard.
store.init(pcB, 'bbb', opts);
t('B voit les points de A', () => assert.strictEqual(store.pointsOn(), 120));
t('B voit le texte de A', () => assert.strictEqual(store.getItem('text:1').title, 'v1'));
sleep(5);
store.addEvent({ kind: 'speak', pts: 200, ref: 'say:s01' });
store.setItem('text:1', { title: 'v2' });
store.setItem('vlist:9', { title: 'liste B' });
store.flush();
t('B : total 320', () => assert.strictEqual(store.pointsOn(), 320));

// Retour sur A : fusion.
store.init(pcA, 'aaa', opts);
t('A : total fusionné 320', () => assert.strictEqual(store.pointsOn(), 320));
t('A : la version la plus récente du texte gagne', () => assert.strictEqual(store.getItem('text:1').title, 'v2'));
t('A : voit la liste créée sur B', () => assert.strictEqual(store.listItems('vlist:').length, 1));
sleep(5);
store.delItem('vlist:9');
store.flush();
t('A : suppression prise en compte', () => assert.strictEqual(store.listItems('vlist:').length, 0));

// Le déblocage d'urgence fait sur B vaut aussi sur A.
store.init(pcB, 'bbb', opts);
t('B : la suppression faite sur A est visible', () => assert.strictEqual(store.getItem('vlist:9'), null));
store.addEvent({ kind: 'unlock', pts: 0, ref: 'code' });
store.flush();
store.init(pcA, 'aaa', opts);
t('A : déblocage de B visible', () => assert.strictEqual(store.unlockedOn(), true));
t('A : le déblocage ne rapporte pas de points', () => assert.strictEqual(store.pointsOn(), 320));
t('chaque PC n\'écrit que son fichier', () => assert.deepStrictEqual(fs.readdirSync(path.join(drive, 'devices')).sort(), ['aaa.json', 'bbb.json']));

// Drive absent : rien ne plante, la progression reste locale.
store.init(path.join(root, 'pcC'), 'ccc', { useDrive: false });
store.addEvent({ kind: 'quiz', pts: 10 });
store.flush();
t('sans Drive : progression locale', () => assert.strictEqual(store.pointsOn(), 10));

fs.rmSync(root, { recursive: true, force: true });
console.log(`\n${ok} vérifications réussies.`);
