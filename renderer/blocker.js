// Écrans couverts pendant le verrou : couleurs du thème choisi, et Chaussette qui prend une pose
// au hasard et cligne de temps en temps.
const params = new URLSearchParams(location.search);
const safe = (v, def) => (v && /^(#[0-9a-f]{3,8}|color-mix\([^;{}<>]{1,120}\))$/i.test(v) ? v : def);
document.body.style.background = safe(params.get('bg'), '#2b2f36');
document.documentElement.style.background = safe(params.get('bg'), '#2b2f36');
document.body.style.color = safe(params.get('ink'), '#d9dde3');
const small = document.querySelector('small');
if (small) small.style.color = safe(params.get('accent'), '#4fc1ae');

const POSES = ['douce', 'contente', 'clin-oeil'];
const img = document.getElementById('cat');
const src = (p) => `assets/chaussette-${p}.svg`;
let base = POSES[Math.floor(Math.random() * POSES.length)];
img.src = src(base);

function tick() {
  if (Math.random() < 0.25) {
    base = POSES.filter((p) => p !== base)[Math.floor(Math.random() * 2)];
    img.src = src(base);
  } else {
    const other = base === 'contente' ? 'douce' : 'contente';
    img.src = src(other);
    setTimeout(() => { img.src = src(base); }, 120 + Math.random() * 140);
  }
  setTimeout(tick, 1800 + Math.random() * 6000);
}
setTimeout(tick, 1500 + Math.random() * 4000);
