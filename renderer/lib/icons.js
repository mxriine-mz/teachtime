// Icônes au trait (SVG 24×24, couleur du texte). Aucun emoji dans l'interface.
const NS = 'http://www.w3.org/2000/svg';

// Roue dentée : 8 dents régulières autour du centre (12, 12).
function gearPath(teeth = 8, rOut = 9.5, rIn = 7.2) {
  const pts = [];
  for (let k = 0; k < teeth; k++) {
    const a = (k * 2 * Math.PI) / teeth;
    for (const [da, r] of [[-0.36, rIn], [-0.2, rOut], [0.2, rOut], [0.36, rIn]]) {
      pts.push([12 + r * Math.cos(a + da), 12 + r * Math.sin(a + da)]);
    }
  }
  return `M${pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L')}z`;
}

// Chaque icône : liste de tracés. Préfixe « F: » = forme pleine, « C:x,y,r » = cercle.
const PATHS = {
  home: ['M3 11l9-7 9 7', 'M5 10v10h14V10', 'M10 20v-6h4v6'],
  map: ['M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z', 'M9 4v14', 'M15 6v14'],
  // Livre fermé avec son marque-page.
  book: ['M6 3h12v18H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M4 17a2 2 0 0 1 2-2h12', 'M9 3v7l2-1.5 2 1.5V3'],
  bookOpen: ['M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2z', 'M12 6v14'],
  pencil: ['M4 20l1-5L16 4l4 4L9 19z', 'M14 6l4 4'],
  // Deux cartes de vocabulaire : celle de derrière dépasse, celle de devant porte deux lignes.
  cards: ['M8 3h11a2 2 0 0 1 2 2v10', 'M5 7h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z', 'M7 12h6', 'M7 16h4'],
  mic: ['M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z', 'M6 11a6 6 0 0 0 12 0', 'M12 17v4', 'M9 21h6'],
  gear: [gearPath(), 'C:12,12,3'],
  lock: ['M5 11h14v10H5z', 'M8 11V8a4 4 0 0 1 8 0v3', 'M12 15v2'],
  check: ['M5 12l5 5 9-10'],
  flame: ['M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z'],
  cup: ['M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z', 'M16 10h1.5a2.5 2.5 0 0 1 0 5H16', 'M3 21h15', 'M8 3c-1 1.5 1 2.5 0 4', 'M12 3c-1 1.5 1 2.5 0 4'],
  play: ['F:M8 5l11 7-11 7z'],
  stop: ['F:M7 7h10v10H7z'],
  arrowLeft: ['M19 12H5', 'M11 6l-6 6 6 6'],
  arrowRight: ['M5 12h14', 'M13 6l6 6-6 6'],
  headphones: ['M4 15v-3a8 8 0 0 1 16 0v3', 'M4 15h3v5H5a1 1 0 0 1-1-1z', 'M20 15h-3v5h2a1 1 0 0 0 1-1z'],
  clock: ['C:12,12,9', 'M12 7v5l3 2'],
  chat: ['M4 5h16v11H9l-5 4z', 'M8 9h8', 'M8 12h5'],
  star: ['F:M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.5 2.9 1-6.1L3.1 9.5l6.1-.9z'],
  volume: ['M4 9h4l5-4v14l-5-4H4z', 'M16 9a4 4 0 0 1 0 6', 'M18.5 6.5a8 8 0 0 1 0 11'],
  slow: ['C:12,13,8', 'M12 9v4l-2 2', 'M10 2h4'],
  eye: ['M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z', 'C:12,12,3'],
  shuffle: ['M3 7h4l10 10h4', 'M3 17h4l3-3', 'M14 10l3-3h4', 'M18 4l3 3-3 3', 'M18 14l3 3-3 3'],
  plus: ['M12 5v14', 'M5 12h14'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  sun: ['C:12,12,4', 'M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'],
  moon: ['M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z'],
  monitor: ['M3 4h18v12H3z', 'M8 20h8', 'M12 16v4'],
  palette: ['M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-.6-1.5-.6-2.4c0-1 .8-1.6 1.8-1.6H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z', 'C:7.5,11,1', 'C:10,7,1', 'C:15,7.5,1'],
  reset: ['M4 12a8 8 0 1 0 2.4-5.7', 'M4 4v4h4'],
  skip: ['F:M6 5l9 7-9 7z', 'M18 5v14'],
};

export function icon(name, size = 18, cls = '') {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `i ${cls}`.trim());
  for (const d of PATHS[name] || []) {
    let el;
    if (d.startsWith('C:')) {
      const [cx, cy, r] = d.slice(2).split(',');
      el = document.createElementNS(NS, 'circle');
      el.setAttribute('cx', cx); el.setAttribute('cy', cy); el.setAttribute('r', r);
    } else {
      el = document.createElementNS(NS, 'path');
      const filled = d.startsWith('F:');
      el.setAttribute('d', filled ? d.slice(2) : d);
      if (filled) { el.setAttribute('fill', 'currentColor'); el.setAttribute('stroke', 'none'); }
    }
    svg.appendChild(el);
  }
  return svg;
}

// Icône + texte, pour les boutons et les titres.
export function withIcon(name, text, size = 18) {
  return [icon(name, size), text];
}
