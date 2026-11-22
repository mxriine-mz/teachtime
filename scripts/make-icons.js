'use strict';
// Convertit assets/icon-teachtime.svg en PNG (256, 64, 32, 16) et en .ico pour le raccourci Windows.
// Usage : npx electron scripts/make-icons.js
const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const assets = path.join(__dirname, '..', 'assets');
const svg = fs.readFileSync(path.join(assets, 'icon-teachtime.svg'), 'utf8');

// Fichier .ico contenant des PNG (format accepté par Windows depuis Vista).
function writeIco(file, pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;
  pngs.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  fs.writeFileSync(file, Buffer.concat([header, dir, ...pngs.map((p) => p.data)]));
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 256, height: 256, show: false, frame: false, transparent: true,
    webPreferences: { offscreen: true },
  });
  let frame = null;
  win.webContents.on('paint', (_e, _d, img) => { frame = img; });
  const html = `<html><body style="margin:0;background:transparent;overflow:hidden">${svg}</body></html>`;
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  await new Promise((r) => setTimeout(r, 800));
  win.webContents.invalidate();
  await new Promise((r) => setTimeout(r, 300));
  if (!frame) throw new Error('aucune image reçue');
  const base = frame.resize({ width: 256, height: 256, quality: 'best' });
  const sizes = [256, 64, 32, 16];
  const pngs = sizes.map((size) => {
    const img = size === 256 ? base : base.resize({ width: size, height: size, quality: 'best' });
    const data = img.toPNG();
    fs.writeFileSync(path.join(assets, `icon-${size}.png`), data);
    return { size, data };
  });
  writeIco(path.join(assets, 'icon-teachtime.ico'), pngs);

  // Icônes de la version web (écran d'accueil iPhone et iPad) : carré plein, iOS arrondit lui-même.
  const big = new BrowserWindow({ width: 512, height: 512, show: false, frame: false, webPreferences: { offscreen: true } });
  let bigFrame = null;
  big.webContents.on('paint', (_e, _d, img) => { bigFrame = img; });
  const square = svg.replace(/width="256" height="256"/, 'width="512" height="512"').replace(/rx="56"/, 'rx="0"');
  await big.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<html><body style="margin:0;background:#2B2F36;overflow:hidden">${square}</body></html>`)}`);
  await new Promise((r) => setTimeout(r, 800));
  big.webContents.invalidate();
  await new Promise((r) => setTimeout(r, 300));
  if (!bigFrame) throw new Error('aucune image reçue (512)');
  const b512 = bigFrame.resize({ width: 512, height: 512, quality: 'best' });
  fs.writeFileSync(path.join(assets, 'icon-512.png'), b512.toPNG());
  fs.writeFileSync(path.join(assets, 'icon-180.png'), b512.resize({ width: 180, height: 180, quality: 'best' }).toPNG());

  console.log('Icônes créées :', sizes.map((s) => `icon-${s}.png`).join(', '), '+ icon-teachtime.ico, icon-512.png, icon-180.png');
  app.exit(0);
}).catch((e) => { console.error(e); app.exit(1); });
