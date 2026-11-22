'use strict';
// Génère les SVG de Chaussette (mascotte en pixel art) et le logo de TEAch Time.
// Usage : node scripts/make-chaussette.js
// Le dessin est décrit par sa moitié gauche (14 colonnes) puis copié en miroir.
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets');

const PALETTE = {
  K: '#6B5242', // contour
  M: '#A48C77', // pelage
  L: '#D2BC9F', // pelage clair
  B: '#F5ECDD', // museau crème
  D: '#7E6A58', // rayures
  P: '#F7C2BC', // intérieur des oreilles
  E: '#2E231D', // yeux
  W: '#FFFFFF', // reflet
  H: '#F59FA6', // joues et cœur
  N: '#E8958A', // nez
  C: '#FFFBF5', // tasse
  c: '#EDE3D3', // ombre de la tasse
  R: '#E0A07A', // bande de la tasse
  S: '#CDBFAC', // soucoupe
};

const BASE = [
  '......K.......',
  '......KK......',
  '......KPK.....',
  '......KPPK....',
  '......KPPMK...',
  '......KMPMDKKK',
  '......KMDMMDMD',
  '......KDMMMDMM',
  '......KDLLLLLL',
  '......KLLLLLLL', // 9  : yeux doux
  '......KDEEELLL', // 10
  '......KLWEELBB', // 11
  '......KLHHLBBN',
  '......KLLLBBKB',
  '.......KLBBBBK',
  '.......KBBKLBB',
  '.KKKKKKKKKKKKK',
  '.KCCCCCCCCCCCC',
  '.KCCCCCCCCCCCC',
  '.KRRRRRRRRRRRR',
  '.KCCCCCCCCCHHC',
  '..KCCCCCCCCHHH',
  '..KcCCCCCCCCHH',
  '...KccCCCCCCCH',
  '....KKcccccccc',
  '......KKKKKKKK',
  '..SSSSSSSSSSSS',
  '....SSSSSSSSSS',
];

const EYES = {
  douce: { 9: '......KLLLLLLL', 10: '......KDEEELLL', 11: '......KLWEELBB' },
  contente: { 9: '......KLLLLLLL', 10: '......KDLELLLL', 11: '......KLELELBB' },
};

// Anse de la tasse, à droite (colonnes 28 à 31).
const HANDLE = { 17: 'KK..', 18: 'CCK.', 19: '.KCK', 20: '.KCK', 21: 'CCK.', 22: 'KK..' };

const GRID_W = 32;
const GRID_H = BASE.length;

// Construit la grille complète. left/right : yeux de chaque côté (clin d'œil possible).
function grid(left, right = left) {
  return BASE.map((row, y) => {
    const l = EYES[left][y] || row;
    const r = EYES[right][y] || row;
    const full = l + [...r].reverse().join('') + (HANDLE[y] || '....');
    return full.padEnd(GRID_W, '.');
  });
}

// Rectangles fusionnés par ligne, pour garder des fichiers légers.
function rects(g, ox, oy, s) {
  let out = '';
  g.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (!PALETTE[ch]) { x++; continue; }
      let w = 1;
      while (row[x + w] === ch) w++;
      out += `<rect x="${ox + x * s}" y="${oy + y * s}" width="${w * s}" height="${s}" fill="${PALETTE[ch]}"/>`;
      x += w;
    }
  });
  return out;
}

function sprite(left, right) {
  const s = 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID_W * s} ${GRID_H * s}" width="${GRID_W * s}" height="${GRID_H * s}" shape-rendering="crispEdges" role="img" aria-label="Chaussette">${rects(grid(left, right), 0, 0, s)}</svg>\n`;
}

// ---------- Chaussette seule (sans tasse), assise de face ----------
// La tête reprend les 15 premières lignes de BASE (yeux compris), puis vient le corps, écrit en entier
// sur 28 colonnes. La queue s'enroule en bas à droite (colonnes 23 à 29).
const BODY = [
  '........KLLBBBBBBLLK........',
  '.......KMLBBBBBBBBLMK.......',
  '......KMMLBBBBBBBBLMMK......',
  '......KDMLBBBBBBBBLMDK......',
  '.....KMMMLBBBBBBBBLMMMK.....',
  '.....KMDMLBBBBBBBBLMDMK.....',
  '.....KMMMMLBBBBBBLMMMMK.....',
  '....KMMMMMLBBBBBBLMMMMMK....',
  '....KMDMMKBBBLLBBBKMMDMK....',
  '....KMMMMKBBBLLBBBKMMMMK....',
  '....KMMMMKBKBLLBKBKMMMMK....',
  '....KKKKKKKKKKKKKKKKKKKK....',
];
const TAIL = {
  19: { 27: 'K', 28: 'K' },
  20: { 26: 'K', 27: 'M', 28: 'D', 29: 'K' },
  21: { 26: 'K', 27: 'M', 28: 'M', 29: 'K' },
  22: { 26: 'K', 27: 'D', 28: 'M', 29: 'K' },
  23: { 26: 'K', 27: 'M', 28: 'M', 29: 'K' },
  24: { 24: 'K', 25: 'K', 26: 'M', 27: 'M', 28: 'D', 29: 'K' },
  25: { 23: 'M', 24: 'M', 25: 'D', 26: 'M', 27: 'M', 28: 'M', 29: 'K' },
  26: { 23: 'K', 24: 'K', 25: 'K', 26: 'K', 27: 'K', 28: 'K' },
};
const HEAD_ROWS = 15;

function gridSeule(left, right = left) {
  const head = grid(left, right).slice(0, HEAD_ROWS).map((r) => r.slice(0, 28).padEnd(GRID_W, '.'));
  const body = BODY.map((r) => r.padEnd(GRID_W, '.'));
  return [...head, ...body].map((row, y) => {
    const t = TAIL[y];
    if (!t) return row;
    const a = [...row];
    for (const [x, ch] of Object.entries(t)) a[Number(x)] = ch;
    return a.join('');
  });
}

function spriteSeule(left, right) {
  const s = 10;
  const g = gridSeule(left, right);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID_W * s} ${g.length * s}" width="${GRID_W * s}" height="${g.length * s}" shape-rendering="crispEdges" role="img" aria-label="Chaussette">${rects(g, 0, 0, s)}</svg>\n`;
}

// ---------- Logo : une tasse vectorielle (pas de pixel art), couleurs du thème Ardoise ----------
const LOGO = { cup: '#4FC1AE', rim: '#9BE3D6', saucer: '#2A8576', heart: '#DDF2EE', ink: '#23272E', tea: '#2A8576', muted: '#5F6670', bg: '#2B2F36' };

// Tasse fumante dans un carré de 256. steam : couleur de la vapeur selon le fond.
function cupMark(steam) {
  return `<path d="M98 86c-12-12 12-20 0-34" stroke="${steam}" stroke-width="9" fill="none" stroke-linecap="round"/>`
    + `<path d="M124 82c-13-14 13-24 0-40" stroke="${steam}" stroke-width="9" fill="none" stroke-linecap="round"/>`
    + `<path d="M150 86c-12-12 12-20 0-34" stroke="${steam}" stroke-width="9" fill="none" stroke-linecap="round"/>`
    + `<path d="M176 124h8a22 22 0 0 1 0 44h-16" fill="none" stroke="${LOGO.cup}" stroke-width="12" stroke-linecap="round"/>`
    + `<path d="M62 104h126v26c0 33-27 58-63 58s-63-25-63-58z" fill="${LOGO.cup}"/>`
    + `<rect x="62" y="104" width="126" height="10" rx="3" fill="${LOGO.rim}"/>`
    + `<path d="M125 166c-17-11-24-18-24-27a10 10 0 0 1 24-5a10 10 0 0 1 24 5c0 9-7 16-24 27z" fill="${LOGO.heart}"/>`
    + `<rect x="46" y="192" width="158" height="14" rx="7" fill="${LOGO.saucer}"/>`;
}

function icon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-label="TEAch Time">`
    + `<rect width="256" height="256" rx="56" fill="${LOGO.bg}"/>${cupMark('#D9DDE3')}</svg>\n`;
}

// Version sans fond, pour le menu (fond graphite).
function mark() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="30 24 196 196" width="196" height="196" role="img" aria-label="TEAch Time">${cupMark('#D9DDE3')}</svg>\n`;
}

// Police Fredoka (licence OFL, assets/fonts/OFL.txt) intégrée au SVG :
// le logo s'affiche pareil partout, même sans la police installée.
function fontFace() {
  const file = path.join(OUT, 'fonts', 'fredoka-latin.woff2');
  const b64 = fs.readFileSync(file).toString('base64');
  return `<defs><style>@font-face{font-family:'Fredoka';font-weight:300 700;`
    + `src:url(data:font/woff2;base64,${b64}) format('woff2');}</style></defs>`;
}

function logo() {
  const s = 6;
  const font = "Fredoka, 'Segoe UI', sans-serif";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 230" width="760" height="230" role="img" aria-label="TEAch Time, My Cup of English">`
    + fontFace()
    + `<g transform="translate(-8 -14) scale(0.94)">${cupMark('#9BA1AA')}</g>`
    + `<text x="240" y="122" font-family="${font}" font-weight="600" font-size="80" fill="${LOGO.ink}">`
    + `<tspan fill="${LOGO.tea}">TEA</tspan><tspan font-size="50">ch</tspan> Time</text>`
    + `<text x="244" y="170" font-family="${font}" font-weight="500" font-size="32" fill="${LOGO.muted}" letter-spacing="1">My Cup of English</text>`
    + `</svg>\n`;
}

const files = {
  'chaussette-douce.svg': sprite('douce', 'douce'),
  'chaussette-contente.svg': sprite('contente', 'contente'),
  'chaussette-clin-oeil.svg': sprite('douce', 'contente'),
  'chaussette-seule-douce.svg': spriteSeule('douce', 'douce'),
  'chaussette-seule-contente.svg': spriteSeule('contente', 'contente'),
  'chaussette-seule-clin-oeil.svg': spriteSeule('douce', 'contente'),
  'icon-teachtime.svg': icon(),
  'logo-mark.svg': mark(),
  'logo-teachtime.svg': logo(),
};

fs.mkdirSync(OUT, { recursive: true });
for (const [name, svg] of Object.entries(files)) {
  fs.writeFileSync(path.join(OUT, name), svg, 'utf8');
  console.log('écrit', name);
}
