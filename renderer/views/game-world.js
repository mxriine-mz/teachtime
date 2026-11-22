// Le Quartier : construction du monde et dessin en pixel art (tout est dessiné en code).
// Tuiles de 16 px. Les sprites sont préparés une fois, avec un contour sombre, puis réutilisés.

export const T = 16;
export const W = 40;
export const H = 28;
export const PW = W * T;
export const PH = H * T;

const OUTLINE = '#2a2633';

export const STATIONS = [
  { id: 'grammar', cat: 'grammar', kind: 'library', name: 'Bibliothèque', npc: 'Iris', role: 'la bibliothécaire', x: 4, y: 3, w: 6, h: 4,
    roof: '#6a4bd8', wall: '#efe3c8', trim: '#4b3696', door: '#7a4b2a', icon: 'book',
    look: { sheet: 'assets/sprites/habitants/grammar.png', hair: '#2b1d14', shirt: '#6a4bd8', skin: '#f1c7a0', pants: '#3a3550', style: 'long', acc: ['glasses', 'cardigan'] },
    line: 'Hi Marine ! Je classe les règles de grammaire par ordre alphabétique. Tu réponds à 4 questions ?' },
  { id: 'conj', cat: 'conj', kind: 'tower', name: 'Tour de l\'horloge', npc: 'M. Tock', role: 'l\'horloger', x: 18, y: 2, w: 4, h: 5,
    roof: '#d98a12', wall: '#e3d6bf', trim: '#9a5f0a', door: '#6b4426', icon: 'clock',
    look: { sheet: 'assets/sprites/habitants/conj.png', hair: '#d9d9d9', shirt: '#f2ece0', skin: '#e8b98f', pants: '#4a3b2c', style: 'short', acc: ['mustache', 'vest', 'bowtie'], vest: '#8a5a2b' },
    line: 'Tic, tac ! Chaque verbe a son temps. On vérifie 4 conjugaisons ?' },
  { id: 'vocab', cat: 'vocab', kind: 'market', name: 'Marché', npc: 'Malik', role: 'le marchand', x: 30, y: 3, w: 6, h: 4,
    roof: '#1f9d6b', wall: '#f3ead6', trim: '#156f4b', door: '#7a4b2a', icon: 'apple',
    look: { sheet: 'assets/sprites/habitants/vocab.png', hair: '#111111', shirt: '#1f9d6b', skin: '#a8764f', pants: '#2e3a5c', style: 'cap', cap: '#1f9d6b', acc: ['apron'] },
    line: 'Welcome ! J\'ai des mots tout frais ce matin. On en teste 4 ?' },
  { id: 'listening', cat: 'listening', kind: 'radio', name: 'Radio du quartier', npc: 'Nova', role: 'l\'animatrice radio', x: 4, y: 15, w: 6, h: 4,
    roof: '#2b7bd6', wall: '#e6ecf3', trim: '#1c5aa3', door: '#3d4a5c', icon: 'radio',
    look: { sheet: 'assets/sprites/habitants/listening.png', hair: '#e0567a', shirt: '#2b7bd6', skin: '#f3d0b0', pants: '#2f3542', style: 'bun', acc: ['headphones'] },
    line: 'On air ! Écoute bien l\'émission et réponds à mes 4 questions.' },
  { id: 'general', cat: 'general', kind: 'tea', name: 'Salon de thé', npc: 'Rosa', role: 'la maîtresse du salon de thé', x: 17, y: 15, w: 6, h: 4,
    roof: '#e0a07a', wall: '#fffbf5', trim: '#b9764f', door: '#8a5a32', icon: 'cup',
    look: { sheet: 'assets/sprites/habitants/general.png', hair: '#7a3b12', shirt: '#f59fa6', skin: '#d9a27a', pants: '#6b5242', style: 'bun', acc: ['apron'] },
    line: 'Fancy a cup of tea ? Le temps qu\'il infuse, 4 petites questions d\'anglais général.' },
  { id: 'speak', cat: 'speak', kind: 'theatre', name: 'Théâtre', npc: 'Jules', role: 'le metteur en scène', x: 30, y: 15, w: 6, h: 4,
    roof: '#b5363f', wall: '#efe2d0', trim: '#7d1f27', door: '#8e1c26', icon: 'mask',
    look: { sheet: 'assets/sprites/habitants/speak.png', hair: '#f0c64a', shirt: '#3a3550', skin: '#f1c7a0', pants: '#26222f', style: 'beret', cap: '#b5363f', acc: ['scarf'] },
    line: 'Lights on ! Répète mes répliques le plus fidèlement possible. 3 phrases, 15 points chacune.' },
];

export const BOARD = { x: 15, y: 11 };
export const FOUNTAIN = { x: 18, y: 11, w: 4, h: 3 };
// Le personnage de Marine : grand chapeau brun à feuille, longs cheveux châtain foncé, yeux verts,
// débardeur blanc, jean large, bottes marron.
export const PLAYER_LOOK = {
  hair: '#5a2d2d', skin: '#f2c19a', eyes: '#4aa860', shirt: '#f3f0ea', pants: '#5b7fb0', shoes: '#5a3524',
  hat: '#d9826a', hatSpot: '#f2b39a', style: 'long', acc: ['hat', 'tank', 'baggy'],
};

export function npcPos(s) {
  return { x: (s.x + s.w / 2) * T + 18, y: (s.y + s.h) * T + 11 };
}

// ---------- Outils ----------
export function hash(x, y, s = 0) {
  let n = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function px(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
function disc(g, cx, cy, r, c) {
  g.fillStyle = c;
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y) + 0.3);
    g.fillRect(cx - half, cy + y, half * 2 + 1, 1);
  }
}
function ellipseFill(g, cx, cy, rx, ry, c) {
  g.fillStyle = c;
  for (let y = -ry; y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    g.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
  }
}
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// Fontaine : centre du bassin en coordonnées monde, et origine du sprite.
// by : centre du bassin, aligné sur le centre de la place (rosace concentrique).
export const FTN = { cx: 320, by: 196, ox: 284, oy: 146 };
function sprite(w, h, draw) { const c = canvas(w, h); draw(c.getContext('2d')); return c; }

// Ajoute un contour d'1 px autour des pixels non transparents.
function outlined(src, color = OUTLINE) {
  const sil = canvas(src.width, src.height);
  const sg = sil.getContext('2d');
  sg.drawImage(src, 0, 0);
  sg.globalCompositeOperation = 'source-in';
  sg.fillStyle = color;
  sg.fillRect(0, 0, sil.width, sil.height);
  const out = canvas(src.width + 2, src.height + 2);
  const g = out.getContext('2d');
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) g.drawImage(sil, dx, dy);
  g.drawImage(src, 1, 1);
  return out;
}

// ---------- Monde ----------
let WORLD = null;

export function world() {
  if (WORLD) return WORLD;
  const tiles = Array.from({ length: H }, () => Array(W).fill('G'));
  const solid = Array.from({ length: H }, () => Array(W).fill(false));
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const set = (x, y, t, s = null) => { if (!inside(x, y)) return; tiles[y][x] = t; if (s !== null) solid[y][x] = s; };
  const rect = (x0, y0, w, h, t, s = null) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, t, s); };

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) { tiles[y][x] = 'D'; solid[y][x] = true; }
  }
  rect(2, 8, W - 4, 2, 'P'); rect(2, 20, W - 4, 2, 'P');
  rect(2, 10, 2, 10, 'P'); rect(W - 4, 10, 2, 10, 'P');
  rect(14, 10, 12, 5, 'S');
  rect(6, 11, 5, 3, 'W', true);
  for (let y = 11; y <= 13; y++) for (let x = 28; x <= 35; x++) if (hash(x, y, 1) > 0.45) set(x, y, 'F');
  // Petites allées jusqu'aux portes.
  for (const s of STATIONS) {
    const cx = Math.floor(s.x + s.w / 2);
    set(cx - 1, s.y + s.h, 'P'); set(cx, s.y + s.h, 'P');
  }

  const trees = [];
  const addTree = (x, y, kind) => { trees.push({ x, y, kind }); if (inside(x, y)) solid[y][x] = true; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (tiles[y][x] !== 'D') continue;
    const r = hash(x, y, 7);
    if (r > 0.12) addTree(x, y, r > 0.82 ? 'pine' : r > 0.74 ? 'autumn' : 'round');
  }
  for (const [x, y] of [[12, 11], [12, 13], [27, 12], [12, 4], [14, 5], [24, 4], [26, 5], [12, 17], [14, 16], [25, 16], [27, 17]]) addTree(x, y, hash(x, y, 9) > 0.7 ? 'pine' : 'round');
  // Hautes herbes au sud : on s'y enfonce jusqu'à la taille.
  rect(15, 23, 10, 3, 'L'); rect(4, 23, 6, 2, 'L'); rect(30, 23, 5, 2, 'L');
  for (let y = 22; y <= 25; y++) {
    for (let x = 2; x < W - 2; x++) {
      if (tiles[y][x] === 'L') continue;
      const r = hash(x, y, 2);
      if (r > 0.86) addTree(x, y, hash(x, y, 3) > 0.6 ? 'pine' : hash(x, y, 4) > 0.75 ? 'autumn' : 'round');
      else if (r > 0.68) set(x, y, 'F');
    }
  }
  for (let x = 2; x < W - 2; x++) if (hash(x, 2, 3) > 0.7 && tiles[2][x] === 'G') set(x, 2, 'F');

  // Décor : [type, x, y, solide]
  const decor = [];
  const add = (type, x, y, isSolid = true) => { decor.push({ type, x, y }); if (isSolid && inside(x, y)) solid[y][x] = true; };
  for (const [x, y] of [[13, 7], [27, 7], [13, 19], [27, 19], [14, 10], [25, 10], [14, 14], [25, 14], [5, 10], [35, 19]]) add('lamp', x, y);
  add('bench', 16, 14); add('bench', 23, 14);
  add('planter', 24, 11); add('planter', 24, 13); add('planter', 15, 13);
  for (let x = 28; x <= 35; x++) { if (x !== 31 && x !== 32) { add('fence', x, 10); add('fence', x, 14); } }
  add('crate', 30, 7); add('crate', 31, 7, true);
  add('table', 17, 19); add('table', 22, 19);
  add('bush', 3, 7, true); add('bush', 11, 19, true); add('bush', 36, 7, true); add('bush', 28, 19, true);
  add('sign', 11, 7, true);

  WORLD = { tiles, solid, trees, decor };
  return WORLD;
}

// ---------- Sol (préparé une fois) ----------
const isGreen = (t) => t === 'G' || t === 'F' || t === 'D' || t === 'L';

// Herbe à motif régulier (touffes en quinconce), façon RPG en pixel art.
function grassTile(g, X, Y, x, y, kind) {
  const dark = kind === 'D';
  const tall = kind === 'L';
  const base = dark ? '#4c9a3c' : tall ? '#5aaa3e' : ((x + y) % 2 ? '#7acb55' : '#76c651');
  px(g, X, Y, T, T, base);
  const blade = dark ? '#3c8231' : tall ? '#468e31' : '#5bab3d';
  const hi = dark ? '#62b24c' : '#a2dc76';
  const off = (x + y) % 2 ? 0 : 4;
  for (const [a, b] of [[2 + off, 4], [10 - off, 12]]) {
    px(g, X + a, Y + b, 1, 2, blade); px(g, X + a + 2, Y + b - 1, 1, 3, blade); px(g, X + a + 4, Y + b, 1, 2, blade);
    px(g, X + a + 2, Y + b - 1, 1, 1, hi);
  }
  if (!dark && !tall && hash(x, y, 12) > 0.82) { px(g, X + 12, Y + 3, 1, 1, '#ffffff'); px(g, X + 4, Y + 10, 1, 1, '#ffe46b'); }
}

function drawGround(g, w) {
  const { tiles } = w;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = tiles[y][x];
      const X = x * T;
      const Y = y * T;
      if (t === 'G' || t === 'F' || t === 'D' || t === 'L') grassTile(g, X, Y, x, y, t);
      if (t === 'P') {
        px(g, X, Y, T, T, '#d8b98b');
        for (let i = 0; i < 4; i++) {
          const a = 1 + Math.floor(hash(x, y, 80 + i) * 12);
          const b = 1 + Math.floor(hash(x, y, 90 + i) * 12);
          px(g, a + X, b + Y, 3, 2, '#e6cda4'); px(g, a + X, b + Y + 2, 3, 1, '#bf9f70');
        }
        // Bords adoucis vers l'herbe.
        const edge = (nx, ny, fn) => { if (nx >= 0 && ny >= 0 && nx < W && ny < H && isGreen(tiles[ny][nx])) fn(); };
        edge(x, y - 1, () => { px(g, X, Y, T, 1, '#b99a6a'); for (let i = 0; i < T; i += 3) px(g, X + i + Math.floor(hash(x, y, 100 + i) * 2), Y, 2, 1 + Math.floor(hash(x, y, 120 + i) * 2), '#5aa646'); });
        edge(x, y + 1, () => { px(g, X, Y + T - 1, T, 1, '#b99a6a'); for (let i = 0; i < T; i += 3) px(g, X + i, Y + T - 1 - Math.floor(hash(x, y, 140 + i) * 2), 2, 2, '#5aa646'); });
        edge(x - 1, y, () => { px(g, X, Y, 1, T, '#b99a6a'); for (let i = 0; i < T; i += 3) px(g, X, Y + i, 1 + Math.floor(hash(x, y, 160 + i) * 2), 2, '#5aa646'); });
        edge(x + 1, y, () => { px(g, X + T - 1, Y, 1, T, '#b99a6a'); for (let i = 0; i < T; i += 3) px(g, X + T - 2 + Math.floor(hash(x, y, 180 + i) * 1.5), Y + i, 2, 2, '#5aa646'); });
      }
      if (t === 'S') {
        // Pavés en quinconce.
        for (let r = 0; r < 2; r++) {
          for (let c = -1; c < 2; c++) {
            const bx = X + c * 8 + (r % 2 ? 4 : 0) + ((y % 2) ? 4 : 0);
            const by = Y + r * 8;
            const v = hash(Math.floor(bx / 8), Math.floor(by / 8), 200);
            const base = v > 0.66 ? '#d6cfc2' : v > 0.33 ? '#cdc5b7' : '#c4bcae';
            const x0 = Math.max(X, bx); const x1 = Math.min(X + T, bx + 8);
            if (x1 <= x0) continue;
            px(g, x0, by, x1 - x0, 8, '#a9a193');
            px(g, x0 + (x0 === bx ? 1 : 0), by + 1, x1 - x0 - (x0 === bx ? 1 : 0) - (x1 === bx + 8 ? 1 : 0), 6, base);
            if (x0 === bx) px(g, x0 + 1, by + 1, 3, 1, '#e3ddd2');
          }
        }
      }
      if (t === 'W') {
        px(g, X, Y, T, T, '#3b8ad1');
        if (hash(x, y, 210) > 0.5) px(g, X + 3, Y + 5, 8, 4, '#4796da');
        const land = (nx, ny) => nx >= 0 && ny >= 0 && nx < W && ny < H && tiles[ny][nx] !== 'W';
        if (land(x, y - 1)) { px(g, X, Y, T, 3, '#b8b0a3'); px(g, X, Y + 3, T, 1, '#2d6aa8'); for (let i = 0; i < T; i += 4) px(g, X + i, Y, 3, 2, '#cfc8bc'); }
        if (land(x, y + 1)) { px(g, X, Y + T - 3, T, 3, '#b8b0a3'); for (let i = 0; i < T; i += 4) px(g, X + i + 1, Y + T - 2, 3, 2, '#9e968a'); }
        if (land(x - 1, y)) { px(g, X, Y, 3, T, '#b8b0a3'); px(g, X + 3, Y, 1, T, '#2d6aa8'); }
        if (land(x + 1, y)) { px(g, X + T - 3, Y, 3, T, '#b8b0a3'); }
        if (hash(x, y, 220) > 0.6) {
          const lx = X + 5 + Math.floor(hash(x, y, 221) * 5);
          const ly = Y + 6 + Math.floor(hash(x, y, 222) * 4);
          disc(g, lx, ly, 2, '#3f9a46'); px(g, lx, ly - 2, 2, 2, '#3b8ad1');
          if (hash(x, y, 223) > 0.5) px(g, lx - 1, ly - 1, 2, 2, '#ffd3e0');
        }
      }
    }
  }
  drawPlaza(g);
}

// ---------- Sprites ----------
const ICONS = {
  book: (g, cx, cy) => { px(g, cx - 5, cy - 3, 5, 7, '#6a4bd8'); px(g, cx, cy - 3, 5, 7, '#8b74ff'); px(g, cx - 4, cy - 2, 3, 5, '#fff'); px(g, cx + 1, cy - 2, 3, 5, '#fff'); },
  clock: (g, cx, cy) => { disc(g, cx, cy, 4, '#3a3550'); disc(g, cx, cy, 3, '#fff'); px(g, cx, cy - 2, 1, 3, '#3a3550'); px(g, cx, cy, 2, 1, '#3a3550'); },
  apple: (g, cx, cy) => { disc(g, cx, cy + 1, 3, '#e53b3b'); px(g, cx - 1, cy - 1, 1, 1, '#ff8a8a'); px(g, cx, cy - 4, 1, 2, '#7a4b2a'); px(g, cx + 1, cy - 4, 2, 1, '#3f9a3f'); },
  radio: (g, cx, cy) => { px(g, cx - 5, cy - 1, 10, 6, '#2b7bd6'); disc(g, cx - 2, cy + 2, 1, '#fff'); px(g, cx + 1, cy + 1, 3, 1, '#fff'); px(g, cx + 3, cy - 5, 1, 4, '#3a3550'); },
  cup: (g, cx, cy) => { px(g, cx - 6, cy + 4, 12, 1, '#6b5242'); px(g, cx - 4, cy - 1, 7, 5, '#e0a07a'); px(g, cx - 4, cy - 1, 7, 1, '#7a3e14'); px(g, cx + 3, cy, 2, 1, '#b9611f'); px(g, cx + 4, cy + 1, 1, 1, '#b9611f'); px(g, cx + 3, cy + 2, 2, 1, '#b9611f'); px(g, cx - 2, cy - 4, 1, 2, '#d8cfc4'); px(g, cx, cy - 5, 1, 3, '#d8cfc4'); },
  mask: (g, cx, cy) => { disc(g, cx, cy, 4, '#ffd666'); px(g, cx - 2, cy - 1, 1, 1, '#3a3550'); px(g, cx + 2, cy - 1, 1, 1, '#3a3550'); px(g, cx - 2, cy + 2, 5, 1, '#3a3550'); },
};

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// Bâtiment : renvoie le sprite et ses sources de lumière (fenêtres, appliques, enseignes) en coordonnées monde.
// Toit à débord avec faîtage, poteaux d'angle, soubassement en pierre, fenêtres à rideaux et rebord fleuri,
// porte encadrée (cintrée pour la bibliothèque, la tour et le théâtre), applique, pots de fleurs, paillasson.
function buildingSprite(s) {
  const bw = s.w * T;
  const bh = s.h * T;
  const OX = 7;
  const OY = s.kind === 'tower' ? 24 : s.kind === 'radio' ? 22 : 16;
  const lights = [];
  const W2 = (x, y) => ({ x: s.x * T - OX + x, y: s.y * T - OY + y });
  const spr = sprite(bw + OX * 2, bh + OY + 4, (g) => {
    const roofH = Math.round(bh * (s.kind === 'tower' ? 0.3 : 0.46));
    const wallY = OY + roofH;
    const wallH = bh - roofH;
    const base = OY + bh;

    // ----- Murs -----
    px(g, OX, wallY, bw, wallH, s.wall);
    const dark = shade(s.wall, -0.09);
    if (s.kind === 'library' || s.kind === 'theatre') {
      for (let y = wallY + 3; y < base - 5; y += 4) {
        px(g, OX, y, bw, 1, dark);
        for (let x = OX + ((Math.floor(y / 4)) % 2 ? 0 : 4); x < OX + bw; x += 8) px(g, x, y - 3, 1, 3, dark);
      }
    } else if (s.kind === 'tower') {
      for (let y = wallY; y < base - 5; y += 5) {
        for (let x = OX + (Math.floor(y / 5) % 2 ? 0 : 4); x < OX + bw; x += 8) px(g, x, y, 7, 4, shade(s.wall, hash(x, y, 300) * 0.08 - 0.04));
      }
    } else {
      for (let x = OX + 4; x < OX + bw; x += 5) px(g, x, wallY, 1, wallH, dark);
    }
    px(g, OX, wallY, 2, wallH, shade(s.wall, -0.2));
    px(g, OX + bw - 2, wallY, 2, wallH, shade(s.wall, -0.26));
    px(g, OX + 2, wallY, 1, wallH, shade(s.wall, 0.18));
    // Soubassement en pierre.
    px(g, OX, base - 5, bw, 5, '#a8a196');
    for (let x = OX; x < OX + bw; x += 6) { px(g, x, base - 5, 5, 2, '#bdb6aa'); px(g, x + 3, base - 2, 5, 2, '#b3ac9f'); }
    px(g, OX, base - 5, bw, 1, '#d2cbbf');

    // ----- Toit -----
    if (s.kind === 'tower') {
      const top = OY - 12;
      const hgt = roofH + 12;
      for (let i = 0; i <= hgt; i++) {
        const half = Math.round((i / hgt) * (bw / 2 + 5));
        const y = top + i;
        px(g, OX + bw / 2 - half, y, half * 2, 1, i % 4 === 0 ? shade(s.roof, -0.2) : s.roof);
        px(g, OX + bw / 2 - half, y, Math.max(1, Math.floor(half * 0.5)), 1, shade(s.roof, 0.18));
      }
      px(g, OX - 5, wallY, bw + 10, 2, shade(s.roof, -0.45));
      px(g, OX + bw / 2 - 1, OY - 20, 2, 9, '#7a6a55');
      px(g, OX + bw / 2 - 4, OY - 17, 8, 1, '#7a6a55');
      px(g, OX + bw / 2 - 1, OY - 21, 2, 1, '#ffd666');
    } else {
      px(g, OX - 5, OY, bw + 10, roofH + 2, s.roof);
      for (let r = 0, y = OY + 2; y < OY + roofH; y += 4, r++) {
        px(g, OX - 5, y + 3, bw + 10, 1, shade(s.roof, -0.2));
        for (let x = OX - 5 + (r % 2 ? 3 : 0); x < OX + bw + 5; x += 6) { px(g, x, y, 1, 3, shade(s.roof, -0.12)); px(g, x + 1, y, 3, 1, shade(s.roof, 0.2)); }
      }
      const third = Math.max(2, Math.floor(roofH / 3));
      px(g, OX - 5, OY + 2, bw + 10, third, 'rgba(255,255,255,.13)');
      px(g, OX - 5, OY + roofH + 2 - third, bw + 10, third, 'rgba(0,0,0,.10)');
      px(g, OX - 5, OY, bw + 10, 2, shade(s.roof, 0.32));
      px(g, OX - 5, OY + roofH + 1, bw + 10, 2, shade(s.roof, -0.45));
      px(g, OX, wallY + 3, bw, 3, 'rgba(0,0,0,.16)');
    }

    // ----- Cheminée, antenne -----
    if (s.kind === 'library' || s.kind === 'tea') {
      const cx = OX + bw - 18;
      px(g, cx, OY - 9, 7, 13, '#9c5a43'); px(g, cx - 1, OY - 10, 9, 2, '#6f3f30');
      for (let y = OY - 7; y < OY + 3; y += 3) px(g, cx, y, 7, 1, '#7d4636');
      px(g, cx, OY - 8, 2, 11, '#b56f55');
    }
    if (s.kind === 'radio') {
      const ax = OX + bw - 16;
      px(g, ax, OY - 20, 1, 24, '#5d6470'); px(g, ax + 6, OY - 20, 1, 24, '#5d6470');
      for (let y = OY - 18; y < OY + 4; y += 5) { px(g, ax, y, 7, 1, '#7d8592'); px(g, ax + 1, y + 1, 1, 1, '#7d8592'); px(g, ax + 5, y + 1, 1, 1, '#7d8592'); }
      px(g, ax + 2, OY - 22, 3, 2, '#e04040');
      lights.push({ type: 'wall', ...W2(ax + 3, OY - 21) });
    }

    // ----- Porte -----
    const dx = OX + bw / 2 - 6;
    const dy = base - 19;
    const arched = s.kind === 'library' || s.kind === 'tower' || s.kind === 'theatre';
    px(g, dx - 2, dy - 2, 16, 21, s.trim);
    px(g, dx - 2, dy - 2, 16, 1, shade(s.trim, 0.25));
    px(g, dx, dy, 12, 17, s.door);
    for (let x = dx + 3; x < dx + 12; x += 3) px(g, x, dy, 1, 17, shade(s.door, -0.15));
    px(g, dx, dy, 2, 17, shade(s.door, 0.15));
    px(g, dx + 9, dy + 9, 2, 2, '#ffd666');
    if (arched) {
      for (const [x, y, w] of [[dx - 2, dy - 2, 3], [dx - 2, dy - 1, 1], [dx + 11, dy - 2, 3], [dx + 13, dy - 1, 1]]) px(g, x, y, w, 1, s.wall);
      px(g, dx, dy, 2, 1, s.trim); px(g, dx + 10, dy, 2, 1, s.trim);
    }
    px(g, dx - 3, base - 1, 18, 2, '#d8d1c5'); px(g, dx - 3, base + 1, 18, 1, '#b9b2a6');
    px(g, dx - 1, base + 1, 14, 2, '#b5564a'); px(g, dx, base + 1, 12, 1, '#c96a5d');
    if (s.kind === 'theatre') {
      px(g, dx, dy, 12, 17, '#b51f2c');
      for (let x = dx + 1; x < dx + 12; x += 3) px(g, x, dy, 1, 17, '#8e1621');
      px(g, dx, dy, 12, 2, '#ffd666');
    }
    // Applique à côté de la porte.
    if (s.kind !== 'market') {
      px(g, dx + 15, dy + 2, 4, 5, '#3a3d45'); px(g, dx + 16, dy + 3, 2, 3, '#ffe9a3');
      lights.push({ type: 'wall', ...W2(dx + 17, dy + 4) });
    }

    // ----- Fenêtres -----
    const curtain = shade(s.trim, 0.35);
    const win = (wx, wy, ww = 12, wh = 11, arch = false, shutters = false) => {
      px(g, wx - 1, wy - 1, ww + 2, wh + 2, '#5a4632');
      px(g, wx, wy, ww, wh, '#a9d6f2');
      px(g, wx, wy, ww, Math.floor(wh / 2), '#cbeafc');
      for (let i = 0; i < 4; i++) px(g, wx + 3 + i, wy + 1 + i, 1, 1, '#ffffff');
      px(g, wx + Math.floor(ww / 2), wy, 1, wh, '#5a4632');
      px(g, wx, wy + Math.floor(wh / 2), ww, 1, '#5a4632');
      px(g, wx, wy, 2, wh, curtain); px(g, wx + ww - 2, wy, 2, wh, curtain); px(g, wx, wy, ww, 2, curtain);
      if (arch) { px(g, wx - 1, wy - 1, 2, 1, s.wall); px(g, wx - 1, wy, 1, 1, s.wall); px(g, wx + ww - 1, wy - 1, 2, 1, s.wall); px(g, wx + ww, wy, 1, 1, s.wall); }
      px(g, wx - 2, wy + wh + 1, ww + 4, 2, '#ebe4d6');
      px(g, wx - 1, wy + wh + 3, ww + 2, 3, '#8a5a32'); px(g, wx - 1, wy + wh + 3, ww + 2, 1, '#a8703f');
      for (let i = 0; i < 5; i++) {
        const c = ['#f25f5c', '#ffd23f', '#ff9f43', '#c77dff', '#ffffff'][(i + s.x) % 5];
        px(g, wx + i * 3 - 1, wy + wh + 1, 2, 2, '#3c9447'); px(g, wx + i * 3, wy + wh, 2, 2, c);
      }
      if (shutters) {
        for (const sx of [wx - 5, wx + ww + 2]) {
          px(g, sx, wy - 1, 3, wh + 2, s.trim);
          for (let y = wy; y < wy + wh; y += 2) px(g, sx, y, 3, 1, shade(s.trim, -0.2));
        }
      }
      lights.push({ type: 'window', ...W2(wx, wy), w: ww, h: wh });
    };
    const winY = wallY + 6;

    if (s.kind === 'market') {
      // Étal sous un auvent rayé, cagettes de fruits.
      const ay = wallY + 1;
      for (let x = OX - 3; x < OX + bw + 3; x += 4) { px(g, x, ay, 4, 7, (x / 4) % 2 ? '#ffffff' : '#1f9d6b'); px(g, x, ay + 7, 4, 1, (x / 4) % 2 ? '#dcdcdc' : '#156f4b'); }
      for (let x = OX - 3; x < OX + bw + 3; x += 4) px(g, x + 1, ay + 8, 2, 1, (x / 4) % 2 ? '#ffffff' : '#1f9d6b');
      const cy = ay + 13;
      for (const cx of [OX + 4, OX + bw - 24]) {
        px(g, cx, cy, 20, 8, '#9c6b3f'); px(g, cx, cy, 20, 1, '#c08a55'); px(g, cx, cy + 4, 20, 1, '#7a4f2a');
        for (let i = 0; i < 7; i++) disc(g, cx + 2 + i * 3, cy - 1, 1, ['#e53b3b', '#ff9f43', '#7cc463', '#ffd23f'][(i + cx) % 4]);
      }
      lights.push({ type: 'wall', ...W2(OX + bw / 2, ay + 4) });
    } else if (s.kind === 'theatre') {
      for (const [wx, col] of [[OX + 6, '#ffd666'], [OX + bw - 20, '#8bd3ff']]) {
        px(g, wx - 1, winY - 2, 16, 19, '#5a4632'); px(g, wx, winY - 1, 14, 17, col);
        disc(g, wx + 7, winY + 5, 4, '#b5363f'); px(g, wx + 5, winY + 4, 1, 1, '#3a3550'); px(g, wx + 9, winY + 4, 1, 1, '#3a3550');
        px(g, wx + 2, winY + 11, 10, 1, '#3a3550'); px(g, wx + 3, winY + 13, 8, 1, '#3a3550');
      }
      const my = dy - 8;
      px(g, OX + bw / 2 - 16, my, 32, 6, '#3a3550'); px(g, OX + bw / 2 - 16, my, 32, 1, '#57506f');
      for (let i = 0; i < 8; i++) {
        px(g, OX + bw / 2 - 14 + i * 4, my + 2, 2, 2, '#ffe08a');
        lights.push({ type: 'bulb', ...W2(OX + bw / 2 - 14 + i * 4, my + 2), i });
      }
    } else if (s.kind === 'tower') {
      disc(g, OX + bw / 2, wallY + 10, 10, '#3a3550');
      disc(g, OX + bw / 2, wallY + 10, 8, '#fffaf0');
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; px(g, Math.round(OX + bw / 2 + Math.cos(a) * 7), Math.round(wallY + 10 + Math.sin(a) * 7), 1, 1, '#9a8f7a'); }
      px(g, OX + bw / 2, wallY + 4, 1, 7, '#3a3550'); px(g, OX + bw / 2, wallY + 10, 5, 1, '#3a3550');
      lights.push({ type: 'clock', ...W2(OX + bw / 2, wallY + 10) });
      win(OX + bw / 2 - 4, wallY + 24, 8, 8, true);
    } else {
      const shutters = s.kind === 'tea' || s.kind === 'radio';
      win(OX + 8, winY, 12, 11, s.kind === 'library', shutters);
      win(OX + bw - 20, winY, 12, 11, s.kind === 'library', shutters);
      if (s.kind === 'library') { px(g, dx - 7, wallY + 4, 3, wallH - 9, '#f6f1e6'); px(g, dx + 16, wallY + 4, 3, wallH - 9, '#f6f1e6'); px(g, dx - 7, wallY + 4, 1, wallH - 9, '#ffffff'); px(g, dx + 16, wallY + 4, 1, wallH - 9, '#ffffff'); }
      if (s.kind === 'tea') {
        const ay = wallY + 1;
        for (let x = OX - 3; x < OX + bw + 3; x += 4) px(g, x, ay, 4, 4, (x / 4) % 2 ? '#ffffff' : '#e0a07a');
        for (let x = OX - 3; x < OX + bw + 3; x += 4) px(g, x + 1, ay + 4, 2, 1, (x / 4) % 2 ? '#ffffff' : '#e0a07a');
      }
    }

    // ----- Pots de fleurs -----
    if (s.kind !== 'market') {
      for (const x of [dx - 9, dx + 15]) {
        if (s.kind !== 'tower' && x === dx + 15) continue; // l'applique occupe déjà ce côté
        px(g, x, base - 6, 6, 6, '#c0603a'); px(g, x, base - 6, 6, 1, '#d97d55'); px(g, x + 4, base - 5, 2, 5, '#9c4a2c');
        disc(g, x + 3, base - 9, 3, '#3c9447'); px(g, x + 1, base - 11, 2, 2, '#f25f5c'); px(g, x + 4, base - 10, 2, 2, '#ffd23f');
      }
    }

    // ----- Enseigne suspendue -----
    if (s.kind !== 'tower') {
      const sx = OX + bw / 2 - 10;
      const sy = s.kind === 'theatre' ? wallY + 1 : wallY + 4;
      px(g, sx + 3, sy - 3, 1, 3, '#5a4632'); px(g, sx + 16, sy - 3, 1, 3, '#5a4632');
      px(g, sx - 1, sy - 1, 22, 14, '#5a3a20');
      px(g, sx, sy, 20, 12, '#fff4d6'); px(g, sx, sy, 20, 1, '#ffffff');
      ICONS[s.icon](g, sx + 10, sy + 6);
    }
  });
  return { canvas: outlined(spr), wx: s.x * T - OX - 1, wy: s.y * T - OY - 1, baseY: (s.y + s.h) * T, lights };
}

// Arbre « en bulles » : grappes de feuillage ombrées (lumière en haut à gauche).
function bubblyTree(pal) {
  return sprite(30, 36, (g) => {
    px(g, 13, 23, 5, 11, '#7a4b2a'); px(g, 13, 23, 1, 11, '#5e3a20'); px(g, 17, 23, 1, 11, '#5e3a20');
    px(g, 11, 33, 3, 2, '#6b4426'); px(g, 17, 33, 3, 2, '#6b4426');
    const clusters = [[15, 9, 8], [8, 15, 6], [22, 15, 6], [10, 21, 6], [20, 21, 6], [15, 17, 8]];
    for (const [x, y, r] of clusters) disc(g, x + 1, y + 1, r, pal.dark);
    for (const [x, y, r] of clusters) disc(g, x, y, r, pal.mid);
    for (const [x, y, r] of clusters) disc(g, x - 2, y - 2, Math.max(2, r - 4), pal.light);
    for (let i = 0; i < 10; i++) px(g, 6 + Math.floor(hash(i, 1, 410) * 18), 4 + Math.floor(hash(i, 2, 410) * 18), 1, 1, pal.spark);
    for (let i = 0; i < 8; i++) px(g, 8 + Math.floor(hash(i, 3, 410) * 16), 12 + Math.floor(hash(i, 4, 410) * 12), 2, 1, pal.dark);
  });
}

const TREE = {
  round: () => bubblyTree({ dark: '#2c7a3a', mid: '#43a34b', light: '#6fcf5c', spark: '#b2ee8f' }),
  autumn: () => bubblyTree({ dark: '#a8461f', mid: '#d9733a', light: '#f2a250', spark: '#ffd08a' }),
  pine: () => sprite(24, 38, (g) => {
    px(g, 10, 30, 4, 7, '#6b4426'); px(g, 10, 30, 1, 7, '#4f311b');
    for (let k = 0; k < 3; k++) {
      const top = 2 + k * 9;
      for (let i = 0; i < 13; i++) {
        const half = Math.round(2 + i * (0.62 + k * 0.08));
        px(g, 12 - half, top + i, half * 2, 1, '#2f7a45');
        px(g, 12, top + i, half, 1, '#245f36');
        if (i > 1) px(g, 12 - half, top + i, 2, 1, '#4c9f5c');
      }
      px(g, 12 - 4, top + 12, 8 + k * 2, 1, '#1e5230');
      px(g, 9, top + 4, 2, 1, '#7cc48a');
    }
  }),
};

const DECOR = {
  lamp: () => sprite(8, 24, (g) => {
    px(g, 3, 6, 2, 16, '#3a3d45'); px(g, 1, 21, 6, 2, '#3a3d45');
    px(g, 1, 1, 6, 6, '#3a3d45'); px(g, 2, 2, 4, 4, '#ffe9a3'); px(g, 2, 0, 4, 1, '#3a3d45');
  }),
  bench: () => sprite(16, 10, (g) => {
    px(g, 1, 2, 14, 2, '#9c6b3f'); px(g, 1, 5, 14, 2, '#b07a48'); px(g, 2, 7, 2, 3, '#5e3a20'); px(g, 12, 7, 2, 3, '#5e3a20');
  }),
  fence: () => sprite(16, 11, (g) => {
    px(g, 1, 1, 3, 10, '#f3ead6'); px(g, 12, 1, 3, 10, '#f3ead6'); px(g, 0, 3, 16, 2, '#e6dcc4'); px(g, 0, 7, 16, 2, '#e6dcc4');
    px(g, 1, 1, 3, 1, '#ffffff'); px(g, 12, 1, 3, 1, '#ffffff');
  }),
  crate: () => sprite(16, 12, (g) => {
    px(g, 1, 4, 14, 8, '#9c6b3f'); px(g, 1, 4, 14, 1, '#c08a55'); px(g, 1, 8, 14, 1, '#7a4f2a');
    for (let i = 0; i < 5; i++) disc(g, 3 + i * 2.5 | 0, 3, 1, ['#e53b3b', '#ff9f43', '#e53b3b', '#7cc463', '#ffd23f'][i]);
  }),
  table: () => sprite(18, 14, (g) => {
    px(g, 0, 7, 3, 6, '#b07a48'); px(g, 15, 7, 3, 6, '#b07a48');
    disc(g, 9, 6, 5, '#fff7ec'); px(g, 4, 6, 11, 2, '#f59fa6'); px(g, 8, 8, 2, 5, '#6b5242');
    px(g, 7, 3, 3, 2, '#ffffff'); px(g, 10, 4, 1, 1, '#ffffff');
  }),
  bush: () => sprite(16, 12, (g) => {
    disc(g, 5, 7, 5, '#2f7d3a'); disc(g, 11, 7, 5, '#2f7d3a'); disc(g, 8, 5, 5, '#3c9447'); disc(g, 7, 4, 2, '#57b25a');
    px(g, 4, 6, 1, 1, '#e53b3b'); px(g, 11, 5, 1, 1, '#e53b3b'); px(g, 9, 8, 1, 1, '#e53b3b');
  }),
  sign: () => sprite(16, 16, (g) => {
    px(g, 7, 6, 2, 10, '#7a4b2a'); px(g, 1, 2, 14, 6, '#c8a06a'); px(g, 1, 2, 14, 1, '#e0bd86');
    px(g, 3, 4, 7, 1, '#5a3a20'); px(g, 12, 3, 2, 3, '#5a3a20');
  }),
  board: () => sprite(16, 16, (g) => {
    px(g, 2, 9, 2, 7, '#5a3a20'); px(g, 12, 9, 2, 7, '#5a3a20');
    px(g, 0, 1, 16, 10, '#7a4b2a'); px(g, 1, 2, 14, 8, '#c8a06a');
    px(g, 3, 3, 4, 5, '#fff'); px(g, 9, 4, 4, 4, '#ffd666'); px(g, 4, 4, 2, 1, '#999'); px(g, 4, 6, 2, 1, '#999');
  }),
  // Grand bassin ovale, colonne, vasque, et une tasse de thé au sommet d'où jaillit l'eau.
  fountain: () => sprite(72, 68, (g) => {
    const cx = 36;
    const by = FTN.by - FTN.oy; // 50
    ellipseFill(g, cx, by + 4, 30, 14, '#8f8aa3');
    for (let x = cx - 28; x <= cx + 28; x += 6) {
      const yy = by + 4 + Math.round(14 * Math.sqrt(Math.max(0, 1 - ((x - cx) / 30) ** 2)));
      px(g, x, yy - 4, 1, 4, '#7a7590');
    }
    ellipseFill(g, cx, by, 30, 14, '#c3bed1');
    ellipseFill(g, cx, by - 1, 29, 12, '#d9d5e3');
    ellipseFill(g, cx, by, 26, 11, '#a7a1b6');
    ellipseFill(g, cx, by + 1, 25, 10, '#3b8ad1');
    ellipseFill(g, cx, by + 3, 21, 7, '#3480c6');
    for (const [x, y] of [[-12, 4], [8, 6], [15, 2], [-4, 7], [-17, 1]]) px(g, cx + x, by + y, 1, 1, '#ffd23f');
    // Colonne.
    px(g, cx - 4, by - 24, 8, 25, '#b9b4c7'); px(g, cx - 4, by - 24, 2, 25, '#d9d5e3'); px(g, cx + 2, by - 24, 2, 25, '#8f8aa3');
    px(g, cx - 5, by - 8, 10, 2, '#a7a1b6'); px(g, cx - 5, by - 1, 10, 2, '#a7a1b6');
    // Vasque.
    ellipseFill(g, cx, by - 22, 13, 5, '#8f8aa3');
    ellipseFill(g, cx, by - 24, 13, 4, '#c3bed1');
    ellipseFill(g, cx, by - 24, 10, 2, '#4796da');
    // Tasse sur sa soucoupe.
    px(g, cx - 1, by - 27, 2, 3, '#b9b4c7');
    ellipseFill(g, cx, by - 27, 6, 1, '#f4efe6');
    px(g, cx - 4, by - 35, 9, 8, '#fffbf5'); px(g, cx - 4, by - 35, 9, 1, '#ffffff');
    px(g, cx - 3, by - 35, 7, 1, '#7a3e14');
    px(g, cx - 4, by - 32, 9, 2, '#e0a07a');
    px(g, cx + 3, by - 35, 1, 8, '#e8e1d6');
    px(g, cx + 5, by - 33, 2, 1, '#f4efe6'); px(g, cx + 6, by - 32, 1, 2, '#f4efe6'); px(g, cx + 5, by - 30, 2, 1, '#f4efe6');
  }),
  // Jardinière en pierre fleurie.
  planter: () => sprite(16, 16, (g) => {
    px(g, 2, 8, 12, 7, '#a7a1b6'); px(g, 1, 7, 14, 2, '#c3bed1'); px(g, 2, 13, 12, 2, '#8f8aa3');
    px(g, 3, 9, 1, 4, '#d9d5e3');
    disc(g, 8, 5, 5, '#3c9447'); disc(g, 6, 4, 2, '#57b25a');
    for (const [x, y, c] of [[4, 4, '#f25f5c'], [9, 2, '#ffd23f'], [11, 5, '#ffffff'], [6, 7, '#c77dff'], [10, 7, '#ff9f43']]) { px(g, x, y, 2, 2, c); px(g, x, y, 1, 1, '#fff6c2'); }
  }),
};

// ---------- Personnages ----------
// Personnages « ferme cosy » 16 × 30 (deux cases de haut) : tête généreuse, cheveux volumineux, yeux en couleur,
// bras le long du corps, contour coloré (teinte plus foncée de chaque couleur, pas de trait noir).
// Lettres : h/L/H cheveux, s/S peau, e pupille, E iris, r joues, m bouche, n col, c/C haut, k ceinture,
// p/P/j bas (base, ombre, reflet), o/O chaussures, + couvre-chefs et accessoires (voir col plus bas).
const FRONT = [
  '.....hhhhhh.....',
  '...hhhhhhhhhh...',
  '..hhhLLhhhhhhh..',
  '..hhLhhhhhhhHh..',
  '.hhhhhhhhhhhhHh.',
  '.hhhhhhhhhhhhHh.',
  '.hhhsshhhsshhHh.',
  '.hhssssssssssHh.',
  '.hsseesssseessh.',
  '.hssEEssssEEsSh.',
  'shsrrssssssrrsHs',
  '..sssssSssssss..',
  '...ssssmmssss...',
  '....ssssssss....',
  '......ssss......',
  '....ccnnnncc....',
  '...cccnnnnccc...',
  '..ccccccccccCc..',
  '.ccCccccccccCcc.',
  '.ccCccccccccCcc.',
  '.ccCccccccccCcc.',
  '.ss.cccccccc.ss.',
  '....kkkkkkkk....',
  '....pppppppp....',
  '....ppp..ppp....',
  '....ppp..ppp....',
  '....PPP..PPP....',
  '....PPP..PPP....',
  '...oooo..oooo...',
  '...OOOO..OOOO...',
];
const BACK_ROWS = {
  6: '.hhhhhhhhhhhhHh.', 7: '.hhLhhhhhhhhhHh.', 8: '.hhhhhhhhhhhhHh.', 9: '.hhhhhhhhhhhHhh.',
  10: 'shhhhhhhhhhhhhHs', 11: '..hhhhhhhhhhhh..', 12: '...hhhhhhhhhh...', 13: '....ssssssss....',
  15: '....cccccccc....', 16: '...cccccccccc...',
};
const SIDE_ROWS = {
  6: '.ssshhhhhhhhhHh.', 7: '.sssssshhhhhhHh.', 8: '.seessssshhhhhh.', 9: '.sEEssssShhhhhh.',
  10: 'ssrssssssshhhhh.', 11: '.sssssssshhhhh..', 12: '..ssmssssshhh...', 13: '...ssssssshh....',
  14: '.....ssss.......', 15: '.....ccnccc.....', 16: '....cccnccccc...', 17: '....cccCcccc....',
  18: '....cccCcccc....', 19: '....cccCcccc....', 20: '....cccCcccc....', 21: '....ssccccc.....',
  22: '....kkkkkkk.....', 23: '....ppppppp.....', 24: '.....ppppp......', 25: '.....ppppp......',
  26: '.....PPPPP......', 27: '.....PPPPP......', 28: '....oooooo......', 29: '....OOOOOO......',
};
const WALK_FRONT = [
  null,
  { 27: '....PPP..oooo...', 28: '...oooo..OOOO...', 29: '...OOOO.........' },
  { 27: '...oooo..PPP....', 28: '...OOOO..oooo...', 29: '.........OOOO...' },
];
const WALK_SIDE = [
  null,
  { 24: '....pp..ppp.....', 25: '...pp....ppp....', 26: '...PP.....PPP...', 27: '...PP.....PPP...', 28: '..ooo.....oooo..', 29: '..OOO.....OOOO..' },
  null,
];

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

// Contour coloré : chaque pixel vide qui touche le personnage prend la teinte foncée du pixel voisin.
function selOut(src, grid, col) {
  const w = src.width;
  const h = src.height;
  const out = canvas(w + 2, h + 2);
  const g = out.getContext('2d');
  const at = (x, y) => (y >= 0 && y < h && x >= 0 && x < w ? grid[y][x] : '.');
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      if (at(x, y) !== '.') continue;
      const nb = [at(x, y + 1), at(x + 1, y), at(x - 1, y), at(x, y - 1)].find((c) => c !== '.' && col[c]);
      if (nb) px(g, x + 1, y + 1, 1, 1, shade(col[nb], -0.55));
    }
  }
  g.drawImage(src, 1, 1);
  return out;
}

// Grille de lettres et couleurs d'un personnage (réutilisée par le générateur de planche modèle).
export function charGrid(look, dir, frame, blink = false) {
  let rows = FRONT.map((r) => r.split(''));
  const side = dir === 'left' || dir === 'right';
  const up = dir === 'up';
  const front = !side && !up;
  const put = (map) => { for (const [i, r] of Object.entries(map)) rows[Number(i)] = r.split(''); };
  const set = (r, x, ch) => { if (rows[r] && x >= 0 && x < 16) rows[r][x] = ch; };
  const fill = (r0, r1, x0, x1, ch) => { for (let r = r0; r <= r1; r++) for (let x = x0; x <= x1; x++) set(r, x, ch); };
  const acc = look.acc || [];
  if (up) put(BACK_ROWS);
  if (side) put(SIDE_ROWS);
  const walk = (side ? WALK_SIDE : WALK_FRONT)[frame];
  if (walk) put(walk);
  // Bras qui se balancent.
  if (front && frame === 1) { set(21, 1, '.'); set(21, 2, '.'); set(22, 1, 's'); set(22, 2, 's'); }
  if (front && frame === 2) { set(21, 13, '.'); set(21, 14, '.'); set(22, 13, 's'); set(22, 14, 's'); }
  // Clignement des yeux.
  if (blink && front) for (const x of [4, 5, 10, 11]) { set(8, x, 's'); set(9, x, 'e'); }
  if (blink && side) { set(8, 2, 's'); set(8, 3, 's'); set(9, 2, 'e'); set(9, 3, 'e'); }

  // Coiffures.
  const st = look.style || 'short';
  if (st === 'long') {
    if (up) { fill(11, 20, 2, 13, 'h'); fill(11, 20, 4, 4, 'H'); fill(11, 20, 11, 11, 'H'); fill(21, 21, 3, 12, 'H'); }
    else if (side) { fill(10, 19, 9, 13, 'h'); fill(10, 19, 13, 13, 'H'); fill(20, 20, 10, 12, 'H'); }
    else { fill(10, 19, 0, 1, 'h'); fill(10, 19, 14, 15, 'h'); fill(11, 19, 0, 0, 'H'); fill(11, 19, 15, 15, 'H'); fill(20, 20, 0, 1, 'H'); fill(20, 20, 14, 15, 'H'); }
  }
  if (st === 'cap') {
    put({ 0: '.....kkkkkk.....', 1: '...kkkkkkkkkk...', 2: '..kkkKkkkkKkkk..', 3: '..kkkkkkkkkkkk..' });
    rows[4] = (up ? '.kkkkkkkkkkkkkk.' : side ? 'KKKKKKkkkkkkkk..' : '.KKKKKKKKKKKKKK.').split('');
  }
  if (st === 'beret') put({ 0: '.......kkkkk....', 1: '...kkkkkkkkkkk..', 2: '..kkkkkkkkkkkkk.', 3: '..kKkkkkkkkkkkK.' });
  // (Le grand chapeau bombé est posé tout à la fin, il remplace le haut des cheveux.)

  // Accessoires (vue de face ou de gauche ; la vue de droite est un miroir).
  if (acc.includes('glasses') && !up) {
    if (front) { fill(7, 7, 3, 6, 'g'); fill(7, 7, 9, 12, 'g'); for (const x of [3, 6, 9, 12]) fill(8, 9, x, x, 'g'); set(8, 7, 'g'); set(8, 8, 'g'); }
    else { fill(7, 7, 1, 4, 'g'); fill(8, 9, 1, 1, 'g'); fill(8, 9, 4, 4, 'g'); }
  }
  if (acc.includes('cardigan') && front) fill(16, 21, 6, 9, 'n');
  if (acc.includes('mustache') && !up) { if (front) fill(12, 12, 5, 10, 'u'); else fill(12, 12, 1, 4, 'u'); }
  if (acc.includes('vest')) {
    if (front) { fill(17, 21, 3, 6, 'w'); fill(17, 21, 9, 12, 'w'); set(18, 7, 'o'); set(20, 7, 'o'); }
    else if (side) fill(16, 21, 4, 10, 'w'); else fill(15, 21, 3, 12, 'w');
  }
  if (acc.includes('bowtie') && front) { set(15, 6, 'x'); set(15, 9, 'x'); set(15, 7, 'X'); set(15, 8, 'X'); }
  if (acc.includes('apron') && !up) {
    if (front) { fill(17, 25, 4, 11, 'a'); fill(25, 25, 4, 11, 'A'); fill(20, 20, 6, 9, 'A'); set(15, 5, 'a'); set(16, 5, 'a'); set(15, 10, 'a'); set(16, 10, 'a'); }
    else fill(17, 25, 3, 6, 'a');
  }
  if (acc.includes('headphones')) { fill(1, 1, 4, 11, 'q'); if (side) fill(8, 10, 9, 10, 'q'); else { fill(8, 10, 0, 1, 'q'); fill(8, 10, 14, 15, 'q'); } }
  if (acc.includes('scarf')) {
    if (side) fill(14, 15, 3, 10, 'f');
    else { fill(14, 15, 4, 11, 'f'); fill(15, 15, 4, 11, 'F'); if (front) fill(16, 19, 10, 11, 'F'); }
  }
  if (acc.includes('backpack')) {
    if (up) { fill(15, 22, 4, 11, 'z'); fill(17, 17, 4, 11, 'Z'); fill(15, 15, 4, 11, 'Z'); }
    else if (side) fill(15, 22, 10, 13, 'z');
    else { fill(16, 20, 4, 4, 'z'); fill(16, 20, 11, 11, 'z'); }
  }
  // Débardeur : épaules et bras nus, deux bretelles.
  if (acc.includes('tank')) {
    if (front) {
      fill(15, 16, 3, 12, 's'); set(15, 5, 'c'); set(16, 5, 'c'); set(15, 10, 'c'); set(16, 10, 'c');
      fill(16, 16, 4, 11, 'c'); set(16, 4, 's'); set(16, 11, 's'); fill(16, 16, 6, 9, 'c');
      fill(18, 20, 1, 2, 's'); fill(18, 20, 13, 14, 's'); fill(17, 17, 2, 2, 's'); fill(17, 17, 13, 13, 's');
    } else if (side) { fill(15, 15, 5, 10, 's'); fill(17, 21, 4, 5, 's'); }
    else {
      // De dos : les épaules ne se voient que si les cheveux ne les cachent pas.
      if (st !== 'long') { fill(15, 15, 4, 11, 's'); set(15, 5, 'c'); set(15, 10, 'c'); }
      fill(17, 20, 1, 1, 's'); fill(17, 20, 14, 14, 's');
    }
  }
  // Jean large avec reflet.
  if (acc.includes('baggy')) {
    // Seulement jusqu'au genou : le bas des jambes reste celui de la marche.
    if (front) {
      fill(24, 25, 3, 6, 'p'); fill(24, 25, 9, 12, 'p'); fill(26, 26, 3, 6, 'P'); fill(26, 26, 9, 12, 'P'); fill(23, 25, 4, 4, 'j'); fill(23, 25, 10, 10, 'j');
      if (!walk) { fill(27, 27, 2, 6, 'P'); fill(27, 27, 9, 13, 'P'); } // le bas du jean s'évase
    }
    else if (side && !walk) { fill(24, 26, 4, 10, 'p'); fill(26, 26, 4, 10, 'P'); fill(23, 25, 5, 5, 'j'); }
  }

  if (st === 'bun' && !acc.includes('hat')) rows = ['......hhhh......'.split(''), '.....hLhhHh.....'.split(''), ...rows];
  // Grand chapeau bombé à large bord tombant, tacheté de clair, avec une petite pousse verte.
  if (acc.includes('hat')) {
    const HAT = [
      '....vv..........',
      '....vkkkkkkk....',
      '...kkkQkkkkkk...',
      '..kkQkkkkkQkkk..',
      '.kkkkkQkkkkkkkk.',
      '.kQkkkkkkkkQkkk.',
      'kkkkkkkkkkkkkkkk',
      'KKKKKKKKKKKKKKKK',
      'K.hhhhhhhhhhhh.K',
    ];
    rows = [...HAT.map((r) => r.split('')), ...rows.slice(7)];
  }
  if (dir === 'right') rows = rows.map((r) => [...r].reverse());

  const hair = look.hair;
  const dark = luminance(hair) < 0.22;
  const shirt = look.shirt;
  const pants = look.pants || '#4a5a7a';
  const shoes = look.shoes || '#6b4428';
  const hat = look.hat || '#c8875a';
  const col = {
    h: hair, L: shade(hair, dark ? 0.35 : 0.28), H: dark ? shade(hair, 0.12) : shade(hair, -0.26),
    s: look.skin, S: shade(look.skin, -0.12), e: '#2e221c', E: look.eyes || '#5a3a2a', r: '#f19b8a', m: '#b96b5a', n: '#f3ead8',
    c: shirt, C: shade(shirt, -0.2), k: shade(pants, -0.45), p: pants, P: shade(pants, -0.25), j: shade(pants, 0.25),
    o: shoes, O: shade(shoes, -0.3),
    K: shade(look.cap || hat, -0.25), Q: look.hatSpot || shade(hat, 0.3), v: '#6fae4f', Y: shade(hat, -0.4),
    g: '#8a80b0', u: shade(hair, -0.12), w: look.vest || shade(shirt, -0.3), x: '#c0392b', X: '#8e2a20',
    a: '#f4efe6', A: '#d9d0c1', q: '#2f3542', f: '#d64545', F: '#a83232', z: '#8a5a32', Z: '#6b4426',
  };
  col.k = acc.includes('hat') ? hat : look.cap || col.k;
  // La ceinture garde sa couleur foncée même avec un chapeau : on la traite à part.
  const grid = rows.map((r, y) => r.map((ch) => (ch === 'k' && y >= 20 ? 'b' : ch)));
  col.b = shade(pants, -0.45);
  return { grid, col };
}

const charCache = new Map();
function charSprite(look, dir, frame, blink = false) {
  const sh = look.sheet === true ? PLAYER_SHEET : look.sheet ? SHEETS.get(look.sheet) : null;
  if (sh) {
    if (blink && dir === 'down' && frame === 0 && sh.blink) return sh.blink;
    return sh[dir][frame] || sh[dir][0];
  }
  const key = `${JSON.stringify(look)}|${dir}|${frame}|${blink ? 1 : 0}`;
  if (charCache.has(key)) return charCache.get(key);
  const { grid, col } = charGrid(look, dir, frame, blink);
  const raw = sprite(16, grid.length, (g) => grid.forEach((r, y) => r.forEach((ch, x) => { if (ch !== '.' && col[ch]) px(g, x, y, 1, 1, col[ch]); })));
  const out = selOut(raw, grid, col);
  charCache.set(key, out);
  return out;
}

// ---------- Personnages dessinés en planche (assets/sprites/joueuse.png et habitants/) ----------
// Planche de 3 colonnes (debout, pas 1, pas 2) × 4 lignes (face, profil gauche, profil droit, dos),
// cases deux fois plus hautes que larges. Une 4e colonne facultative donne le clin d'oeil de face.
// Les pixels presque transparents (le guide pâle de la planche modèle) sont ignorés.
// Si la ligne « profil droit » est vide, on retourne le profil gauche en miroir.
let PLAYER_SHEET = null;
const SHEETS = new Map();
export function resetPlayerSheet() { PLAYER_SHEET = null; }
export function playerSheetInfo() {
  return PLAYER_SHEET ? { w: PLAYER_SHEET.down[0].width, h: PLAYER_SHEET.down[0].height } : null;
}
export async function loadPlayerSheet(url) {
  if (PLAYER_SHEET) return true;
  const sheet = await readSheet(url);
  if (!sheet) return false;
  PLAYER_SHEET = sheet;
  return true;
}
export function sheetInfo(url) {
  const s = SHEETS.get(url);
  return s ? { w: s.down[0].width, h: s.down[0].height, blink: !!s.blink } : null;
}
// Planche d'un habitant : look.sheet vaut son chemin.
export async function loadSheet(url) {
  if (SHEETS.has(url)) return true;
  const sheet = await readSheet(url);
  if (sheet) SHEETS.set(url, sheet);
  return !!sheet;
}
async function readSheet(url) {
  const img = new Image();
  img.src = url.startsWith('data:') ? url : `${url}?v=${Date.now()}`;
  try { await img.decode(); } catch { return null; }
  const ch = Math.floor(img.height / 4);
  const cols = Math.max(3, Math.min(4, Math.round(img.width / (ch / 2))));
  const cw = Math.floor(img.width / cols);
  if (cw < 8 || ch < 8) return null;
  const full = canvas(img.width, img.height);
  const fg = full.getContext('2d');
  fg.drawImage(img, 0, 0);
  const data = fg.getImageData(0, 0, img.width, img.height);
  for (let i = 3; i < data.data.length; i += 4) if (data.data[i] < 128) data.data[i] = 0; else data.data[i] = 255;
  fg.putImageData(data, 0, 0);
  const cell = (col, row, mirror = false) => {
    const c = canvas(cw, ch);
    const g = c.getContext('2d');
    if (mirror) { g.translate(cw, 0); g.scale(-1, 1); }
    g.drawImage(full, col * cw, row * ch, cw, ch, 0, 0, cw, ch);
    return c;
  };
  const empty = (c) => !c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v);
  const rows = ['down', 'left', 'right', 'up'];
  const sheet = {};
  rows.forEach((dir, r) => { sheet[dir] = [0, 1, 2].map((k) => cell(k, r)); });
  if (sheet.right.every(empty)) sheet.right = [0, 1, 2].map((k) => cell(k, 1, true));
  // Une case vide reprend la pose « debout » de la même ligne.
  for (const dir of rows) for (let k = 1; k < 3; k++) if (empty(sheet[dir][k])) sheet[dir][k] = sheet[dir][0];
  if (empty(sheet.down[0])) return null;
  if (cols > 3) {
    const b = cell(3, 0);
    if (!empty(b)) sheet.blink = b;
  }
  return sheet;
}

export function drawChar(g, cx, feetY, look, { dir = 'down', frame = 0, bob = 0, blink = false } = {}) {
  g.fillStyle = 'rgba(40,30,20,.24)';
  g.beginPath(); g.ellipse(Math.round(cx), Math.round(feetY) + 1, 6, 2, 0, 0, Math.PI * 2); g.fill();
  const spr = charSprite(look, dir, frame, blink);
  g.drawImage(spr, Math.round(cx - spr.width / 2), Math.round(feetY - spr.height + 2 + bob));
}

export function portraitCanvas(look) {
  const spr = charSprite(look, 'down', 0);
  const c = canvas(spr.width + 2, spr.height + 2);
  c.getContext('2d').drawImage(spr, 1, 1);
  return c;
}

// ---------- Préparation ----------
let ASSETS = null;
export function assets() {
  if (ASSETS) return ASSETS;
  const w = world();
  const ground = canvas(PW, PH);
  const gg = ground.getContext('2d');
  drawGround(gg, w);
  // Ombre portée des bâtiments (lumière venant du haut à gauche).
  gg.fillStyle = 'rgba(20,30,20,.20)';
  for (const s of STATIONS) {
    gg.fillRect((s.x + s.w) * T, s.y * T + 12, 5, s.h * T - 9);
    gg.fillRect(s.x * T + 5, (s.y + s.h) * T + 1, s.w * T, 3);
  }
  const trees ={ round: outlined(TREE.round()), autumn: outlined(TREE.autumn()), pine: outlined(TREE.pine()) };
  const decor = Object.fromEntries(Object.entries(DECOR).map(([k, f]) => [k, outlined(f())]));
  const buildings = STATIONS.map((s) => ({ s, ...buildingSprite(s) }));
  const lights = [];
  buildings.forEach((b) => lights.push(...b.lights));
  for (const d of w.decor) if (d.type === 'lamp') lights.push({ type: 'lamp', x: d.x * T + 8, y: d.y * T - 6 });
  // Entités fixes, triées à l'affichage avec les personnages.
  const statics = [];
  for (const t of w.trees) {
    const spr = trees[t.kind];
    statics.push({ baseY: t.y * T + 15, img: spr, x: t.x * T + 8 - spr.width / 2, y: t.y * T + 16 - spr.height + 2, shadow: true, cx: t.x * T + 8 });
  }
  for (const d of w.decor) {
    const spr = decor[d.type];
    statics.push({ baseY: d.y * T + 14, img: spr, x: d.x * T + 8 - spr.width / 2, y: d.y * T + 16 - spr.height });
  }
  statics.push({ baseY: (BOARD.y + 1) * T - 1, img: decor.board, x: BOARD.x * T - 1, y: BOARD.y * T - 1 });
  statics.push({ baseY: FTN.by + 12, img: decor.fountain, x: FTN.ox - 1, y: FTN.oy - 1, fountain: true });
  lights.push({ type: 'pool', x: FTN.cx, y: FTN.by + 1 }, { type: 'pool-small', x: FTN.cx, y: FTN.by - 24 });
  for (const b of buildings) statics.push({ baseY: b.baseY, img: b.canvas, x: b.wx, y: b.wy });
  ASSETS = { ground, statics, lights, buildings };
  return ASSETS;
}

// ---------- Lumière selon l'heure ----------
export function ambient(date = new Date()) {
  const hr = date.getHours() + date.getMinutes() / 60;
  const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, t))));
  const DAY = [255, 255, 255];
  const GOLD = [255, 222, 186];
  const DUSK = [190, 150, 190];
  const NIGHT = [78, 92, 160];
  let mul;
  if (hr >= 7 && hr < 16.5) mul = null;
  else if (hr >= 16.5 && hr < 18.5) mul = lerp(DAY, GOLD, (hr - 16.5) / 2);
  else if (hr >= 18.5 && hr < 19.5) mul = lerp(GOLD, DUSK, hr - 18.5);
  else if (hr >= 19.5 && hr < 21) mul = lerp(DUSK, NIGHT, (hr - 19.5) / 1.5);
  else if (hr >= 21 || hr < 5.5) mul = NIGHT;
  else mul = lerp(NIGHT, DAY, (hr - 5.5) / 1.5);
  const lightsOn = hr >= 18.5 || hr < 6.5;
  const night = hr >= 20 || hr < 5.5;
  return { mul, lightsOn, night, day: !mul };
}

// ---------- Rendu d'une image du monde ----------
// g : contexte à la taille du monde. dyn : { time, chars: [{x,y,look,dir,frame,bob}], markers: [{x,y}], particles, light }
export function renderWorld(g, dyn) {
  const A = assets();
  const time = dyn.time || 0;
  g.imageSmoothingEnabled = false;
  g.drawImage(A.ground, 0, 0);

  // Tuiles animées : vagues, fleurs qui se balancent, hautes herbes.
  const w = world();
  const sway = (x, y) => (Math.sin(time / 520 + x * 0.9 + y * 0.6) > 0.2 ? 1 : 0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = w.tiles[y][x];
    const X = x * T;
    const Y = y * T;
    if (t === 'W') {
      for (let k = 0; k < 2; k++) {
        const off = Math.floor((time / 140 + hash(x, y, 93 + k) * 16) % 16);
        const wy = Y + 5 + k * 6;
        px(g, X + off, wy, 3, 1, '#9ad2f8'); px(g, X + ((off + 2) % 16), wy - 1, 2, 1, '#cfeafd');
      }
    } else if (t === 'F') {
      const cols = ['#f25f5c', '#ffd23f', '#ffffff', '#c77dff', '#ff9f43'];
      for (let i = 0; i < 3; i++) {
        const fx = X + 2 + Math.floor(hash(x, y, 30 + i) * 11);
        const fy = Y + 3 + Math.floor(hash(x, y, 50 + i) * 9);
        const c = cols[Math.floor(hash(x, y, 70 + i) * cols.length)];
        const s = sway(x + i, y);
        px(g, fx, fy + 2, 1, 3, '#3f8a34'); px(g, fx + 1, fy + 3, 1, 1, '#5aa646');
        px(g, fx - 1 + s, fy, 3, 1, c); px(g, fx + s, fy - 1, 1, 3, c); px(g, fx + s, fy, 1, 1, '#fff6c2');
      }
    } else if (t === 'L') {
      drawTallGrass(g, X, Y, sway(x, y), 0);
    }
  }

  // Ombres au sol des arbres.
  g.fillStyle = 'rgba(0,0,0,.16)';
  for (const e of A.statics) if (e.shadow) { g.beginPath(); g.ellipse(e.cx + 2, e.baseY + 1, 10, 3, 0, 0, Math.PI * 2); g.fill(); }

  // Entités triées par profondeur.
  const ents = A.statics.map((e) => ({ y: e.baseY, draw: () => {
    g.drawImage(e.img, Math.round(e.x), Math.round(e.y));
    if (e.fountain) drawFountainWater(g, time);
  } }));
  for (const c of dyn.chars || []) ents.push({ y: c.y, draw: () => drawChar(g, c.x, c.y, c.look, c) });
  // Pigeons au sol (triés avec le reste) ; ceux qui volent passent par-dessus tout.
  updatePigeons(time, dyn.player || null);
  for (const p of PIGEONS) if (p.mode === 'idle' || p.mode === 'land') ents.push({ y: p.y, draw: () => drawPigeon(g, p, time) });
  ents.sort((a, b) => a.y - b.y).forEach((e) => e.draw());
  for (const p of PIGEONS) if (p.mode === 'fly') drawPigeon(g, p, time);

  // Dans les hautes herbes, on s'enfonce jusqu'à la taille : on redessine les herbes devant.
  for (const c of dyn.chars || []) {
    const tx = Math.floor(c.x / T);
    const ty = Math.floor((c.y - 2) / T);
    if (tx < 0 || tx >= W || ty < 0 || ty >= H || w.tiles[ty][tx] !== 'L') continue;
    drawTallGrass(g, Math.round(c.x) - 7, Math.round(c.y) - 6, sway(tx, ty), 2);
  }

  // Fumée de la cheminée du salon de thé.
  const tea = A.buildings.find((b) => b.s.kind === 'tea');
  if (tea) {
    const sx = tea.wx + 1 + 5 + tea.s.w * T - 16 + 3;
    const sy = tea.wy + 1 + 14 - 9;
    for (let i = 0; i < 5; i++) {
      const p = ((time * 0.00035) + i / 5) % 1;
      g.fillStyle = `rgba(235,235,240,${0.55 * (1 - p)})`;
      g.beginPath(); g.arc(sx + Math.sin(p * 6 + i) * 3 + p * 6, sy - p * 26, 2 + p * 4, 0, Math.PI * 2); g.fill();
    }
  }

  // Papillons le jour, lucioles la nuit.
  const amb = dyn.light === false ? { mul: null, lightsOn: false, night: false, day: true } : (dyn.ambient || ambient());
  if (dyn.particles !== false && amb.day) {
    for (let i = 0; i < 7; i++) {
      const bx = (28 + (i % 4) * 2.2) * T + Math.sin(time / 900 + i * 2) * 26;
      const by = (11.2 + (i % 3) * 0.9) * T + Math.cos(time / 700 + i) * 10;
      const flap = Math.floor(time / 120 + i) % 2;
      const col = ['#ffffff', '#ffd23f', '#ff9fc6', '#8bd3ff'][i % 4];
      px(g, bx - 2, by - (flap ? 1 : 0), 2, flap ? 2 : 1, col); px(g, bx + 1, by - (flap ? 1 : 0), 2, flap ? 2 : 1, col); px(g, bx, by, 1, 2, '#3a3550');
    }
  }

  // « ! » au-dessus des habitants pas encore vus.
  for (const m of dyn.markers || []) {
    const by = Math.round(m.y - 38 + (Math.sin(time / 260) > 0 ? -1 : 0));
    const bx = Math.round(m.x);
    px(g, bx - 4, by - 9, 9, 11, OUTLINE); px(g, bx - 3, by - 8, 7, 9, '#ffffff'); px(g, bx - 1, by + 2, 3, 1, OUTLINE); px(g, bx, by + 2, 1, 2, OUTLINE);
    px(g, bx, by - 7, 1, 4, '#e8573d'); px(g, bx, by - 2, 1, 1, '#e8573d');
  }

  // Lumière du soir et de la nuit.
  if (dyn.light !== false && amb.mul) {
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = `rgb(${amb.mul.join(',')})`;
    g.fillRect(0, 0, PW, PH);
    g.globalCompositeOperation = 'source-over';
    if (amb.lightsOn) {
      for (const l of A.lights) {
        if (l.type === 'window') px(g, l.x, l.y, l.w, l.h, 'rgba(255,214,130,.92)');
        if (l.type === 'bulb' && Math.floor(time / 300 + l.i) % 3) px(g, l.x, l.y, 2, 1, '#fff2b0');
        if (l.type === 'lamp') px(g, l.x - 2, l.y - 3, 4, 4, '#fff2b0');
        if (l.type === 'wall') px(g, l.x - 1, l.y - 1, 2, 3, '#fff2b0');
      }
      g.globalCompositeOperation = 'lighter';
      for (const l of A.lights) {
        const r = l.type === 'lamp' ? 30 : l.type === 'window' ? 18 : l.type === 'clock' ? 14 : l.type === 'wall' ? 16 : l.type === 'pool' ? 34 : l.type === 'pool-small' ? 14 : 7;
        const cx = l.type === 'window' ? l.x + l.w / 2 : l.x;
        const cy = l.type === 'window' ? l.y + l.h / 2 : l.y;
        const grd = g.createRadialGradient(cx, cy, 1, cx, cy, r);
        // Le bassin s'éclaire en bleu de l'intérieur, le reste en lumière chaude.
        const pool = l.type === 'pool' || l.type === 'pool-small';
        grd.addColorStop(0, pool ? 'rgba(110,200,255,.38)' : l.type === 'lamp' ? 'rgba(255,200,120,.55)' : 'rgba(255,190,110,.35)');
        grd.addColorStop(1, pool ? 'rgba(110,200,255,0)' : 'rgba(255,190,110,0)');
        g.fillStyle = grd;
        g.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      if (amb.night && dyn.particles !== false) {
        for (let i = 0; i < 22; i++) {
          const fx = ((hash(i, 1, 500) * 34 + 3) * T) + Math.sin(time / 1300 + i * 1.7) * 18;
          const fy = ((hash(i, 2, 500) * 22 + 3) * T) + Math.cos(time / 1700 + i) * 12;
          const a = 0.35 + 0.35 * Math.sin(time / 300 + i * 2);
          g.fillStyle = `rgba(200,255,140,${a})`;
          g.fillRect(Math.round(fx), Math.round(fy), 1, 1);
          const gg = g.createRadialGradient(fx, fy, 0, fx, fy, 5);
          gg.addColorStop(0, `rgba(180,255,120,${a * 0.5})`); gg.addColorStop(1, 'rgba(180,255,120,0)');
          g.fillStyle = gg; g.fillRect(fx - 5, fy - 5, 10, 10);
        }
      }
      g.globalCompositeOperation = 'source-over';
    }
  }
}

// Hautes herbes : deux rangées de touffes. mode 0 = tuile entière, mode 1 = rangée de devant seulement.
function drawTallGrass(g, X, Y, s, mode) {
  const tuft = (bx, by) => {
    px(g, bx, by + 2, 5, 5, '#3d8a2e');
    px(g, bx, by + 6, 5, 1, '#2f6e25');
    px(g, bx + 1, by + 2, 1, 3, '#5fb443'); px(g, bx + 3, by + 2, 1, 3, '#5fb443');
    px(g, bx + 1 + s, by + 1, 3, 1, '#5fb443');
    px(g, bx + 2 + s, by, 1, 1, '#9bdb6c'); px(g, bx + s, by + 1, 1, 1, '#9bdb6c'); px(g, bx + 4 + s, by + 1, 1, 1, '#7cc95a');
  };
  if (mode === 2) { for (const bx of [0, 5, 10]) tuft(X + bx, Y); return; } // devant un personnage
  if (mode === 0) for (const bx of [0, 5, 10]) tuft(X + bx, Y + 1);
  for (const bx of [1, 6, 11]) tuft(X + bx, Y + 8);
}

// Eau de la fontaine : jet au-dessus de la tasse, arcs qui retombent dans la vasque,
// rideaux d'eau jusqu'au bassin, ronds dans l'eau et reflets qui scintillent.
function drawFountainWater(g, time) {
  const cx = FTN.cx;
  const by = FTN.by;
  const cupTop = by - 36;
  // Jet central.
  const jh = 7 + Math.round(Math.sin(time / 180) * 1.5);
  px(g, cx - 1, cupTop - jh, 2, jh, '#cfeafd'); px(g, cx, cupTop - jh, 1, jh, '#ffffff');
  // Arcs qui retombent dans la vasque.
  for (let i = 0; i < 16; i++) {
    const p = ((time * 0.0011 + i / 16) % 1);
    const side = i % 2 ? 1 : -1;
    const x = cx + side * (1 + p * 10);
    const y = cupTop - jh + 1 - Math.sin(p * Math.PI) * 4 + p * p * (by - 24 - (cupTop - jh)) ;
    px(g, Math.round(x), Math.round(y), 1, 1, i % 3 ? '#e3f4ff' : '#ffffff');
  }
  // Rideaux d'eau du bord de la vasque jusqu'au bassin.
  for (const side of [-1, 1]) {
    const x = cx + side * 12 - (side > 0 ? 1 : 0);
    for (let y = by - 22; y < by - 2; y++) {
      const k = (y - Math.floor(time / 55)) % 5;
      px(g, x, y, 2, 1, k === 0 ? '#ffffff' : 'rgba(190,228,250,.85)');
    }
    // Ronds dans l'eau là où le rideau tombe.
    for (let r = 0; r < 2; r++) {
      const p = ((time / 900) + r / 2) % 1;
      const rx = Math.round(2 + p * 7);
      const ry = Math.max(1, Math.round(1 + p * 2));
      g.strokeStyle = `rgba(200,235,255,${0.75 * (1 - p)})`;
      g.lineWidth = 1;
      g.beginPath(); g.ellipse(x + 1, by - 1, rx, ry, 0, 0, Math.PI * 2); g.stroke();
    }
  }
  // Petites vagues et reflets dans le bassin.
  for (let i = 0; i < 4; i++) {
    const off = ((time / 90 + i * 13) % 34) - 17;
    px(g, Math.round(cx - 20 + i * 11 + off * 0.3), by + 4 + (i % 2) * 3, 4, 1, '#7fc0f2');
  }
  for (let i = 0; i < 7; i++) {
    if (Math.sin(time / 210 + i * 2.3) > 0.82) px(g, cx - 20 + Math.floor(hash(i, 5, 600) * 40), by - 3 + Math.floor(hash(i, 6, 600) * 10), 1, 1, '#ffffff');
  }
  // Eau de la vasque qui frémit.
  px(g, cx - 8 + (Math.floor(time / 200) % 4) * 3, by - 24, 3, 1, '#9ad2f8');
}

// ---------- Pigeons de la place ----------
const PIGEONS = [
  { hx: 16.8 * T, hy: 12.6 * T }, { hx: 22.6 * T, hy: 11.1 * T }, { hx: 23.2 * T, hy: 13.7 * T }, { hx: 17.4 * T, hy: 13.8 * T },
].map((p, i) => ({ ...p, i, mode: 'idle', x: p.hx, y: p.hy, alt: 0, t: 0, back: 0, face: i % 2 ? 1 : -1 }));
let pigeonClock = null;

function updatePigeons(time, player) {
  const dt = pigeonClock === null ? 0 : Math.min(0.05, (time - pigeonClock) / 1000);
  pigeonClock = time;
  for (const p of PIGEONS) {
    if (p.mode === 'idle' && player && Math.hypot(player.x - p.x, player.y - p.y) < 30) {
      p.mode = 'fly';
      p.vx = (p.x - player.x >= 0 ? 1 : -1) * (40 + p.i * 6);
      p.face = p.vx > 0 ? 1 : -1;
      p.t = 0;
    }
    if (p.mode === 'fly') {
      p.t += dt; p.x += p.vx * dt; p.alt += 46 * dt; p.y -= 8 * dt;
      if (p.t > 1.4) { p.mode = 'away'; p.back = time + 5000 + p.i * 1500; }
    } else if (p.mode === 'away' && time > p.back && (!player || Math.hypot(player.x - p.hx, player.y - p.hy) > 50)) {
      p.mode = 'land'; p.x = p.hx; p.y = p.hy; p.alt = 40; p.t = 0;
    } else if (p.mode === 'land') {
      p.alt = Math.max(0, p.alt - 50 * dt);
      if (!p.alt) p.mode = 'idle';
    }
  }
}

function drawPigeon(g, p, time) {
  if (p.mode === 'away') return;
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const air = p.alt > 0.5;
  g.fillStyle = 'rgba(0,0,0,.18)';
  g.beginPath(); g.ellipse(x, y + 1, Math.max(1, 3 - p.alt / 20), 1, 0, 0, Math.PI * 2); g.fill();
  const yy = y - Math.round(p.alt);
  const f = p.face;
  const peck = !air && Math.sin(time / 260 + p.i * 1.7) > 0.55 ? 1 : 0;
  px(g, x - 3, yy - 4, 6, 3, '#9aa0aa');
  px(g, x - 3, yy - 2, 6, 1, '#7d8590');
  px(g, x - 3 * f - (f > 0 ? 1 : 0), yy - 4, 2, 2, '#8b929c');
  const hx = x + (f > 0 ? 2 : -4);
  px(g, hx, yy - 6 + peck, 2, 2, '#7d8590');
  px(g, hx + (f > 0 ? 0 : 1), yy - 4 + peck, 1, 1, '#5fa37a');
  px(g, hx + (f > 0 ? 2 : -1), yy - 5 + peck, 1, 1, '#e8b04a');
  px(g, hx + (f > 0 ? 1 : 0), yy - 6 + peck, 1, 1, '#2a2230');
  if (air) {
    const up = Math.floor(time / 90) % 2;
    px(g, x - 4, yy - (up ? 7 : 4), 3, 2, '#b4bac3'); px(g, x + 1, yy - (up ? 7 : 4), 3, 2, '#b4bac3');
  } else {
    px(g, x - 1, yy - 1, 1, 1, '#e08a6a'); px(g, x + 1, yy - 1, 1, 1, '#e08a6a');
  }
}

// ---------- Place : bordure, rosace en mosaïque, ombre du bassin ----------
function drawPlaza(g) {
  const x0 = 14 * T; const x1 = 26 * T; const y0 = 10 * T; const y1 = 15 * T;
  // La rosace reste au centre de la place, quelle que soit la hauteur de la fontaine.
  const ry = (y0 + y1) / 2;
  for (let y = y0 + 3; y < y1 - 3; y++) {
    for (let x = x0 + 3; x < x1 - 3; x++) {
      const dx = x - FTN.cx;
      const dy = (y - ry) * 1.9;
      const d = Math.hypot(dx, dy);
      let c = null;
      if (d >= 39 && d < 42) c = '#e8e1d4';
      else if (d >= 42 && d < 44.5) c = '#a39b8d';
      else if (d >= 44.5 && d < 55) { const a = Math.atan2(dy, dx); c = (Math.floor((a + Math.PI) / (Math.PI / 8)) % 2) ? '#d8ccb2' : '#c9c1b2'; if (Math.abs(d - 50) < 0.6) c = '#b3aa9b'; }
      else if (d >= 55 && d < 57.5) c = '#a39b8d';
      else if (d >= 57.5 && d < 60) c = '#e8e1d4';
      if (c) px(g, x, y, 1, 1, c);
    }
  }
  // Bordure de pierres sombres.
  px(g, x0, y0, x1 - x0, 3, '#9d9587'); px(g, x0, y1 - 3, x1 - x0, 3, '#9d9587');
  px(g, x0, y0, 3, y1 - y0, '#9d9587'); px(g, x1 - 3, y0, 3, y1 - y0, '#9d9587');
  for (let x = x0; x < x1; x += 6) { px(g, x, y0, 1, 3, '#8a8274'); px(g, x, y1 - 3, 1, 3, '#8a8274'); }
  for (let y = y0; y < y1; y += 6) { px(g, x0, y, 3, 1, '#8a8274'); px(g, x1 - 3, y, 3, 1, '#8a8274'); }
  px(g, x0, y0, x1 - x0, 1, '#bdb5a7');
  // Ombre du bassin sur les pavés.
  g.fillStyle = 'rgba(30,30,40,.18)';
  g.beginPath(); g.ellipse(FTN.cx + 3, FTN.by + 6, 31, 12, 0, 0, Math.PI * 2); g.fill();
}

export function isSolidTile(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
  return world().solid[ty][tx];
}
