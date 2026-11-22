'use strict';
// Génère la planche modèle pour dessiner son propre personnage, et une image d'explication agrandie.
//   assets/sprites/modele-personnage.png              48 × 128 px : 3 poses × 4 directions, cases de 16 × 32
//   assets/sprites/modele-personnage-explications.png  la même planche agrandie, avec le nom de chaque case
// Usage : npx electron scripts/make-template.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const OUT = path.join(__dirname, '..', 'assets', 'sprites');
const CELL = { w: 16, h: 32 };

app.whenReady().then(async () => {
  // La grille du personnage actuel sert de guide pâle dans chaque case.
  const W = await import(pathToFileURL(path.join(__dirname, '..', 'renderer', 'views', 'game-world.js')).href);
  const dirs = ['down', 'left', 'right', 'up'];
  const guides = dirs.map((dir) => [0, 1, 2].map((frame) => {
    const { grid, col } = W.charGrid(W.PLAYER_LOOK, dir, frame);
    return grid.map((r) => r.map((ch) => (ch !== '.' && col[ch] ? col[ch] : null)));
  }));

  const win = new BrowserWindow({ width: 900, height: 1300, show: false, webPreferences: { offscreen: true } });
  await win.loadURL('data:text/html;charset=utf-8,<html><body></body></html>');
  const code = `(() => {
    const CW = ${CELL.w}, CH = ${CELL.h};
    const guides = ${JSON.stringify(guides)};
    // ----- Planche à dessiner (taille réelle) -----
    const sheet = document.createElement('canvas'); sheet.width = CW * 3; sheet.height = CH * 4;
    const g = sheet.getContext('2d');
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
      const grid = guides[r][c];
      const ox = c * CW, oy = r * CH + (CH - grid.length);
      // Guide pâle (ignoré par le jeu) : silhouette à 22 % d'opacité.
      g.globalAlpha = 0.22;
      grid.forEach((row, y) => row.forEach((col, x) => { if (col) { g.fillStyle = col; g.fillRect(ox + x, oy + y, 1, 1); } }));
      g.globalAlpha = 0.18; g.fillStyle = '#000000';
      g.fillRect(c * CW, r * CH + CH - 1, CW, 1);
      g.globalAlpha = 1;
    }
    // ----- Explication agrandie -----
    const S = 10, LW = 170, TH = 40;
    const ex = document.createElement('canvas'); ex.width = LW + CW * 3 * S + 20; ex.height = TH + CH * 4 * S + 20;
    const e = ex.getContext('2d');
    e.fillStyle = '#fbf6ee'; e.fillRect(0, 0, ex.width, ex.height);
    e.imageSmoothingEnabled = false;
    const rows = ['Face', 'Profil gauche', 'Profil droit', 'Dos'];
    const cols = ['Debout', 'Pas 1', 'Pas 2'];
    e.font = '600 18px Segoe UI'; e.fillStyle = '#6b5242';
    cols.forEach((t, c) => { e.textAlign = 'center'; e.fillText(t, LW + c * CW * S + CW * S / 2, 26); });
    rows.forEach((t, r) => { e.textAlign = 'right'; e.fillText(t, LW - 14, TH + r * CH * S + CH * S / 2); });
    e.font = '13px Segoe UI'; e.fillStyle = '#8c7664'; e.textAlign = 'right';
    e.fillText('(facultatif : sinon miroir', LW - 14, TH + 2 * CH * S + CH * S / 2 + 20);
    e.fillText('du profil gauche)', LW - 14, TH + 2 * CH * S + CH * S / 2 + 37);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
      const x0 = LW + c * CW * S, y0 = TH + r * CH * S;
      for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { e.fillStyle = (x + y) % 2 ? '#ffffff' : '#f1ebe0'; e.fillRect(x0 + x * S, y0 + y * S, S, S); }
    }
    e.drawImage(sheet, LW, TH, CW * 3 * S, CH * 4 * S);
    e.strokeStyle = '#c8b9a6'; e.lineWidth = 2;
    for (let r = 0; r <= 4; r++) { e.beginPath(); e.moveTo(LW, TH + r * CH * S); e.lineTo(LW + CW * 3 * S, TH + r * CH * S); e.stroke(); }
    for (let c = 0; c <= 3; c++) { e.beginPath(); e.moveTo(LW + c * CW * S, TH); e.lineTo(LW + c * CW * S, TH + CH * 4 * S); e.stroke(); }
    return { sheet: sheet.toDataURL('image/png'), ex: ex.toDataURL('image/png') };
  })()`;
  const res = await win.webContents.executeJavaScript(code);
  fs.mkdirSync(OUT, { recursive: true });
  const save = (name, url) => fs.writeFileSync(path.join(OUT, name), Buffer.from(url.split(',')[1], 'base64'));
  save('modele-personnage.png', res.sheet);
  save('modele-personnage-explications.png', res.ex);
  console.log('Planche modèle créée dans', OUT);
  app.exit(0);
}).catch((e) => { console.error(e); app.exit(1); });
