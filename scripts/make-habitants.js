// Dessine les six habitants du Quartier dans le style de la fermière de Marine
// (cases de 16 x 32, contours colorés, trois tons par matière, grands yeux à reflet).
// Sortie : assets/sprites/habitants/<id>.png, planche de 4 colonnes x 4 lignes :
// colonnes debout, pas 1, pas 2, clin d'oeil (face seulement) ; lignes face, profil gauche, profil droit, dos.
// Lancer : node scripts/make-habitants.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CW = 16;
const CH = 32;

// ---------- Couleurs ----------
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const mul = (a, f) => a.map((v) => v * f);
// Rampe de quatre tons : contour, ombre, base, lumière. Les ombres tirent vers le violet comme sur la fermière.
function ramp(base) {
  const b = hex(base);
  return {
    outline: toHex(mix(mul(b, 0.28), hex('#1c1028'), 0.45)),
    dark: toHex(mix(mul(b, 0.66), hex('#3a2050'), 0.18)),
    base: toHex(b),
    light: toHex(mix(b, hex('#fff6e8'), 0.32)),
  };
}
function skinRamp(base) {
  const b = hex(base);
  return {
    S: toHex(b),
    s: toHex(mix(mul(b, 0.86), hex('#c04a2c'), 0.22)),
    o: toHex(mix(mul(b, 0.34), hex('#3c1030'), 0.5)),
  };
}

// ---------- Gabarits (une lettre par pixel, '.' = vide) ----------
// Peau : S base, s ombre, o contour. Yeux : p sombre, w blanc, g iris, x reflet.
// Cheveux : 0 contour, 1 ombre, 2 base, 3 lumière. Haut : A contour, B ombre, D base, E lumière.
// Bas : 5 contour, 6 ombre, 7 base, 8 lumière. Chaussures : 9 contour, k base, K lumière.
// Accessoires : a contour, b ombre, c base, d lumière (couleur propre à chaque habitant).
// Deuxième accessoire : m contour, n base, r lumière.

const BODY_FRONT = [
  '................', '................', '................', '................',
  '................', '................', '................', '................',
  '................', '................', '................', '................',
  '................', '................',
  '.....oossoo.....',
  '...AABDSSDBAA...',
  '..AEDDDSSDDDBA..',
  '..AEDDDDDDDDBA..',
  '..ABDDDDDDDDBA..',
  '..osSDDDDDDSso..',
  '..oSoBBBBBBoSo..',
  '.oSSoDDDDDDoSSo.',
  '.oSsoAAAAAAosSo.',
];
const BODY_BACK = [
  '................', '................', '................', '................',
  '................', '................', '................', '................',
  '................', '................', '................', '................',
  '................', '................',
  '......oSSo......',
  '...AABDDDDBAA...',
  '..AEDDDDDDDDBA..',
  '..AEDDDDDDDDBA..',
  '..ABDDDDDDDDBA..',
  '..osSDDDDDDSso..',
  '..oSoBBBBBBoSo..',
  '.oSSoDDDDDDoSSo.',
  '.oSsoAAAAAAosSo.',
];
// Profil tourné vers la droite (le profil gauche en est le miroir).
const BODY_SIDE = [
  '................', '................', '................', '................',
  '................', '................', '................', '................',
  '................', '................', '................', '................',
  '................', '................',
  '......osSo......',
  '.....ABDDEA.....',
  '....ABDDDDEA....',
  '...AEDDDDDDA....',
  '...ABDDDDDDA....',
  '...osADDDDDA....',
  '...oSABBBBBA....',
  '...oSsADDDDA....',
  '....ooAAAAAA....',
];

// Jambes : lignes 23 à 30, pieds sur la ligne 30.
const LEGS_FRONT = [
  [ // debout
    '..oo67877876oo..', '...5788668875...', '...5887557885...', '...5787557875...',
    '...5787557875...', '...5555555555...', '...9kK9..9Kk9...', '...999....999...',
  ],
  [ // pas 1 : pied gauche levé
    '..oo67877876oo..', '...5788668875...', '...5887557885...', '...5787557875...',
    '...5555557875...', '...9kK9.55555...', '...999...9Kk9...', '..........999...',
  ],
  [ // pas 2 : pied droit levé
    '..oo67877876oo..', '...5788668875...', '...5887557885...', '...5787557875...',
    '...5787555555...', '...55555.9Kk9...', '...9kK9...999...', '...999..........',
  ],
];
const LEGS_SIDE = [
  [
    '...oo66777765...', '....567777875...', '....577856885...', '....5678657865..',
    '...56788756775..', '...56778755555..', '...5555559kK9...', '....9kkk9.......',
  ],
  [
    '...oo66777765...', '....567777875...', '...56778567885..', '...5678.567885..',
    '..56785...56785.', '..56785...567785', '..55555...555555', '.99kk9.....9kkK9',
  ],
  [
    '...oo66777765...', '....567777875...', '....5678567855..', '....56785678855.',
    '...56785.56785..', '...55555.567785.', '..99kk9..555555.', '.........9kkK9..',
  ],
];

// ---------- Têtes ----------
// Visage de face commun (lignes 10 à 13), cheveux autour.
// Profil commun (cheveux courts) : oeil en x7-9, nez en x12, menton en x6-10.
const SIDE_FACE = [
  '..02222221SSo...',
  '..02222pwgSSo...',
  '..0121sSxgSSSo..',
  '...010SSSSSo....',
  '....00osSSo.....',
  '......oSSo......',
];
const HEADS = {
  long: {
    front: [
      '................', '................', '................',
      '.....000000.....',
      '....03322210....',
      '...0332222110...',
      '..033222222110..',
      '..032222222110..',
      '.03222222222110.',
      '.03222SSSS22110.',
      '.0322ppSSpp2210.',
      '.012pwgSSgwp210.',
      '.01oSxgSSgxSo10.',
      '.012oSSSSSSo210.',
      '.0121oossoo1210.',
      '.012........210.',
      '.012........210.',
      '.01..........10.',
      '..0..........0..',
    ],
    side: [
      '................', '................', '................',
      '................', '................',
      '...03322220.....',
      '..0332222220....',
      '..03222222210...',
      '.032222222210...',
      '.032222221SSo...',
      '.032222pwgSSo...',
      '.02221sSxgSSSo..',
      '.01221oSSSSo....',
      '.012210osSSo....',
      '.012210oSSo.....',
      '.012210.........',
      '.01210..........',
      '.0110...........',
      '..00............',
    ],
    back: [
      '................', '................', '................',
      '.....000000.....',
      '....03322210....',
      '...0332222110...',
      '..033222222110..',
      '..032222222110..',
      '.03222222222110.',
      '.03222222222110.',
      '.03222222222110.',
      '.02222222222210.',
      '.02222122122210.',
      '.01221121121110.',
      '.01121121121110.',
      '.01111111111110.',
      '.01111111111110.',
      '..011111111110..',
      '...0000000000...',
    ],
  },
  short: {
    front: [
      '................', '................', '................', '................',
      '.....000000.....',
      '....03322210....',
      '...0332222110...',
      '...0322222210...',
      '..032222222110..',
      '..032SSSSSS210..',
      '..02SppSSppS20..',
      '...opwgSSgwpo...',
      '...oSxgSSgxSo...',
      '....oSSSSSSo....',
    ],
    side: [
      '................', '................', '................', '................',
      '....000000......',
      '...03322220.....',
      '..0332222220....',
      '..03222222220...',
      '..03222222110...',
      ...SIDE_FACE,
    ],
    back: [
      '................', '................', '................', '................',
      '.....000000.....',
      '....03322210....',
      '...0332222110...',
      '...0322222210...',
      '..032222222210..',
      '..032222222210..',
      '..022222222210..',
      '..012212212110..',
      '...0111111110...',
      '....00000000....',
    ],
  },
  bun: {
    front: [
      '................',
      '......0000......',
      '.....033210.....',
      '.....022110.....',
      '....00111100....',
      '...0332222110...',
      '..033222222110..',
      '..032222222110..',
      '..032222122110..',
      '..0322SSSS2210..',
      '..022ppSSpp210..',
      '..01pwgSSgwp10..',
      '...oSxgSSgxSo...',
      '....oSSSSSSo....',
    ],
    side: [
      '................',
      '..000...........',
      '.03310..........',
      '.02210..........',
      '..01100000......',
      '...03322220.....',
      '..0332222220....',
      '..03222222220...',
      '..03222222110...',
      ...SIDE_FACE,
    ],
    back: [
      '................',
      '......0000......',
      '.....033210.....',
      '.....022110.....',
      '....00111100....',
      '...0332222110...',
      '..033222222110..',
      '..032222222210..',
      '..032222222210..',
      '..022222222210..',
      '..022122122110..',
      '..012112112110..',
      '...0111111110...',
      '....00000000....',
    ],
  },
  cap: {
    front: [
      '................', '................', '................',
      '......aaaa......',
      '....aacddcaa....',
      '...acdddddcca...',
      '..acddddddccba..',
      '..abccccccbbba..',
      '.aaaaaaaaaaaaaa.',
      '..01ssssssss10..',
      '..02SppSSppS20..',
      '...opwgSSgwpo...',
      '...oSxgSSgxSo...',
      '....oSSSSSSo....',
    ],
    side: [
      '................', '................', '................',
      '....aaaaa.......',
      '...acddcca......',
      '..acdddddca.....',
      '..acddddddca....',
      '..abccccccbaaa..',
      '..0aaaaaaaaaaaa.',
      ...SIDE_FACE,
    ],
    back: [
      '................', '................', '................',
      '......aaaa......',
      '....aacddcaa....',
      '...acdddddcca...',
      '..acddddddccba..',
      '..abcccaacccba..',
      '..abbbaccabbba..',
      '..0aaaaaaaaaa0..',
      '..022222222220..',
      '..012212212110..',
      '...0111111110...',
      '....00000000....',
    ],
  },
  beret: {
    front: [
      '................', '................', '................',
      '........aa......',
      '....aaaacaaa....',
      '...acdddddcca...',
      '..acdddddddcca..',
      '..abccccccccba..',
      '..0aaaaaaaaaa0..',
      '..03222SSSS210..',
      '..022ppSSpp210..',
      '..01pwgSSgwp10..',
      '...oSxgSSgxSo...',
      '....oSSSSSSo....',
    ],
    side: [
      '................', '................', '................',
      '.......aa.......',
      '....aaacaaa.....',
      '...acddddcca....',
      '..acdddddddca...',
      '.abcccccccccba..',
      '..aaaaaaaaaaa...',
      ...SIDE_FACE,
    ],
    back: [
      '................', '................', '................',
      '........aa......',
      '....aaaacaaa....',
      '...acdddddcca...',
      '..acdddddddcca..',
      '..abccccccccba..',
      '..0aaaaaaaaaa0..',
      '..032222222210..',
      '..022222222210..',
      '..012212212110..',
      '...0111111110...',
      '....00000000....',
    ],
  },
};

// ---------- Accessoires (calques posés par-dessus) ----------
// G : monture de lunettes claire (pour ne pas cacher les yeux).
const ACC = {
  glasses: {
    front: { y: 11, rows: ['...G...GG...G...', '...G........G...', '....GGG..GGG....'] },
    side: { y: 10, rows: ['...GGGG...G.....', '..........G.....', '.......GGG......'] },
  },
  cardigan: {
    front: { y: 15, rows: ['...aab....baa...', '..adcb....bcda..', '..adcb....bcda..', '..abcb....bcba..', '..o.ab....ba.o..', '.....b....b.....', '.....b....b.....', '.....a....a.....'] },
    side: { y: 15, rows: ['.....abc........', '....abcca.......', '...adcccca......', '...abcccca......', '.....abcca......', '.....abbba......', '......abba......', '......aaaa......'] },
    back: { y: 15, rows: ['...aabccbbaa....', '..adccccccba....', '..adccccccba....', '..abccccccba....', '..o.bccccb.o....', '....bccccb......', '....bccccb......', '....aaaaaa......'] },
  },
  vest: {
    front: { y: 16, rows: ['....abc..cba....', '....adcbbcda....', '....adcccdda....', '....abcccbba....', '....abcccbba....', '....aaaaaaaa....'] },
    side: { y: 16, rows: ['.....abcca......', '.....adccca.....', '.....adccca.....', '.....abccba.....', '.....abccba.....', '.....aaaaaa.....'] },
    back: { y: 16, rows: ['....abccccba....', '....adccccba....', '....adccccba....', '....abccccba....', '....abbbbbba....', '....aaaaaaaa....'] },
  },
  bowtie: {
    front: { y: 15, rows: ['......mrrm......', '.......nn.......'] },
  },
  mustache: {
    front: { y: 13, rows: ['.....122221.....'] },
    side: { y: 12, rows: ['.........1221...'] },
  },
  apron: {
    front: { y: 16, rows: ['.....nn..nn.....', '.....mrrrrm.....', '.....mrrrrm.....', '....mrrrrrrm....', '....mnrrrrrm....', '....mnrrrrrm....', '....mnnnnnnm....', '....mrrrrrrm....', '....mnrrrrrm....', '.....mmmmmm.....'] },
    side: { y: 16, rows: ['.........n......', '.........mr.....', '.........mrm....', '.........mrrm...', '.........mnrm...', '.........mnrm...', '.........mnnm...', '.........mrrm...', '.........mnrm...', '.........mmm....'] },
    back: { y: 16, rows: ['.....n....n.....', '......n..n......', '.......nn.......', '................', '....mmmmmmmm....'] },
  },
  headphones: {
    front: { y: 5, rows: ['...mmmmmmmmmm...', '..m..........m..', '..m..........m..', '..m..........m..', '................', '.mnm........mnm.', '.mrm........mrm.', '.mnm........mnm.', '.mm..........mm.'] },
    side: { y: 4, rows: ['.....mmmmmm.....', '....m......m....', '...m........m...', '................', '................', '................', '....mmm.........', '...mrrnm........', '...mnnnm........', '....mmm.........'] },
    back: { y: 5, rows: ['...mmmmmmmmmm...', '..m..........m..', '..m..........m..', '..m..........m..', '................', '.mnm........mnm.', '.mrm........mrm.', '.mnm........mnm.', '.mm..........mm.'] },
  },
  scarf: {
    front: { y: 14, rows: ['....mmrrrrmm....', '...mnrrnnrrnm...', '....mmnrrnmm....', '......mrrm......', '......mnrm......', '......mrnm......', '......mmmm......'] },
    side: { y: 14, rows: ['.....mmrrrm.....', '....mnrrnnm.....', '.....mrnnm......', '....mrrm........', '....mnrm........', '....mmm.........'] },
    back: { y: 14, rows: ['....mmrrrrmm....', '...mnrrnnrrnm...', '....mmnnnnmm....'] },
  },
};

// ---------- Les habitants ----------
const NPCS = [
  { id: 'grammar', head: 'long', hair: '#3b2418', skin: '#f1c7a0', eyes: '#5a6fd0', shirt: '#efe7dc', pants: '#4a4570', shoes: '#5a3524',
    acc: '#6a4bd8', acc2: '#3a3550', layers: ['cardigan', 'glasses'] },
  { id: 'conj', head: 'short', hair: '#d8d4cc', skin: '#e8b98f', eyes: '#4a6a8a', shirt: '#f2ece0', pants: '#4a3b2c', shoes: '#3a2418',
    acc: '#8a5a2b', acc2: '#b5363f', layers: ['vest', 'bowtie', 'mustache'] },
  { id: 'vocab', head: 'cap', hair: '#1c1614', skin: '#a8764f', eyes: '#3a2418', shirt: '#2e8a63', pants: '#2e3a5c', shoes: '#3a2a20',
    acc: '#1f9d6b', acc2: '#f1e6cf', layers: ['apron'] },
  { id: 'listening', head: 'bun', hair: '#e0567a', skin: '#f3d0b0', eyes: '#7a4ab0', shirt: '#2b7bd6', pants: '#2f3542', shoes: '#f0ece4',
    acc: '#2b7bd6', acc2: '#3a3f4c', layers: ['headphones'] },
  { id: 'general', head: 'bun', hair: '#7a3b12', skin: '#d9a27a', eyes: '#4a7a3a', shirt: '#f59fa6', pants: '#6b5242', shoes: '#4a2c1c',
    acc: '#f59fa6', acc2: '#fff4e6', layers: ['apron'] },
  { id: 'speak', head: 'beret', hair: '#f0c64a', skin: '#f1c7a0', eyes: '#3a6a9a', shirt: '#3a3550', pants: '#26222f', shoes: '#2a1c18',
    acc: '#b5363f', acc2: '#e8b84a', layers: ['scarf'] },
];

// ---------- Assemblage ----------
const blank = () => Array.from({ length: CH }, () => Array(CW).fill('.'));
function paint(grid, rows, y0 = 0, colors = null) {
  rows.forEach((line, dy) => {
    if (line.length !== CW) throw new Error(`ligne de ${line.length} pixels : "${line}"`);
    [...line].forEach((ch, x) => { if (ch !== '.') grid[y0 + dy][x] = colors ? `${colors}:${ch}` : ch; });
  });
}
const mirror = (grid) => grid.map((r) => [...r].reverse());

function build(npc, view, step) {
  const g = blank();
  const body = view === 'front' ? BODY_FRONT : view === 'back' ? BODY_BACK : BODY_SIDE;
  paint(g, body);
  const legs = (view === 'side' ? LEGS_SIDE : LEGS_FRONT)[step];
  paint(g, legs, 23);
  // Le tablier et le gilet passent sous les cheveux, les lunettes et la moustache par-dessus.
  const under = ['cardigan', 'vest', 'apron', 'scarf', 'bowtie'];
  for (const name of npc.layers.filter((l) => under.includes(l))) {
    const a = ACC[name][view];
    if (a) paint(g, a.rows, a.y);
  }
  paint(g, HEADS[npc.head][view]);
  for (const name of npc.layers.filter((l) => !under.includes(l))) {
    const a = ACC[name][view];
    if (a) paint(g, a.rows, a.y);
  }
  return g;
}

function palette(npc) {
  const hair = ramp(npc.hair);
  const shirt = ramp(npc.shirt);
  const pants = ramp(npc.pants);
  const shoes = ramp(npc.shoes);
  const acc = ramp(npc.acc);
  const acc2 = ramp(npc.acc2);
  const skin = skinRamp(npc.skin);
  return {
    S: skin.S, s: skin.s, o: skin.o,
    p: '#1a1012', w: '#e6dcd6', g: npc.eyes, x: '#fffdfc', G: '#c9c2e6',
    0: hair.outline, 1: hair.dark, 2: hair.base, 3: hair.light,
    A: shirt.outline, B: shirt.dark, D: shirt.base, E: shirt.light,
    5: pants.outline, 6: pants.dark, 7: pants.base, 8: pants.light,
    9: shoes.outline, k: shoes.base, K: shoes.light,
    a: acc.outline, b: acc.dark, c: acc.base, d: acc.light,
    m: acc2.outline, n: acc2.base, r: acc2.light,
  };
}

// Clin d'oeil : les yeux de face se ferment (trait sombre, puis peau).
function blink(grid) {
  const g = grid.map((r) => [...r]);
  for (let y = 9; y < 14; y++) for (let x = 0; x < CW; x++) {
    if (g[y][x] === 'w' || g[y][x] === 'g') g[y][x] = y === 11 ? 'p' : 'S';
    if (g[y][x] === 'x') g[y][x] = 'S';
  }
  for (let x = 0; x < CW; x++) if (g[10][x] === 'p' && g[11][x] !== 'p') g[10][x] = 'S';
  return g;
}

// ---------- PNG minimal ----------
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

function sheetFor(npc) {
  const pal = palette(npc);
  const cols = 4;
  const W = CW * cols;
  const H = CH * 4;
  const rgba = Buffer.alloc(W * H * 4);
  const put = (grid, col, row) => grid.forEach((line, y) => line.forEach((ch, x) => {
    if (ch === '.') return;
    const c = pal[ch];
    if (!c) throw new Error(`couleur inconnue « ${ch} » pour ${npc.id}`);
    const i = ((row * CH + y) * W + col * CW + x) * 4;
    const [r, g, b] = hex(c);
    rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
  }));
  for (let step = 0; step < 3; step++) {
    const front = build(npc, 'front', step);
    const side = build(npc, 'side', step);
    put(front, step, 0);
    put(mirror(side), step, 1);
    put(side, step, 2);
    put(build(npc, 'back', step), step, 3);
    if (step === 0) put(blink(front), 3, 0);
  }
  return png(W, H, rgba);
}

// Contrôle : l'oeil tombe sur la ligne 11 de face et 10 de profil, comme sur la fermière.
for (const [name, h] of Object.entries(HEADS)) {
  const want = { front: 11, side: 10, back: -1 };
  for (const view of ['front', 'side', 'back']) {
    const row = h[view].findIndex((r) => r.includes('w'));
    if (row !== want[view]) throw new Error(`tête ${name} (${view}) : oeil en ligne ${row}`);
  }
}

const outDir = path.join(__dirname, '..', 'assets', 'sprites', 'habitants');
fs.mkdirSync(outDir, { recursive: true });
for (const npc of NPCS) {
  fs.writeFileSync(path.join(outDir, `${npc.id}.png`), sheetFor(npc));
  console.log(`habitants/${npc.id}.png`);
}
