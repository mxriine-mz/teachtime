// Chaussette, la mascotte. Trois poses : douce, contente (yeux « ^ »), clin d'œil.
// Rien n'est figé : la pose est tirée au hasard à chaque affichage, les réactions varient,
// et le clignement suit un rythme irrégulier.
import { h } from './ui.js';

export const POSES = ['douce', 'contente', 'clin-oeil'];

// Deux dessins : dans sa tasse, ou seule (assise, sans tasse).
const srcOf = (alone) => Object.fromEntries(POSES.map((p) => [p, `assets/chaussette-${alone ? 'seule-' : ''}${p}.svg`]));

// Précharge les poses pour éviter un trou au premier changement.
for (const alone of [false, true]) for (const s of Object.values(srcOf(alone))) { const i = new Image(); i.src = s; }

const rand = (min, max) => min + Math.random() * (max - min);

// Accepte un nom de pose, une liste de poses possibles, ou « random ».
export function pickPose(choice = 'random', avoid = null) {
  let list = choice === 'random' ? POSES : Array.isArray(choice) ? choice : [choice];
  if (avoid && list.length > 1) list = list.filter((p) => p !== avoid);
  return list[Math.floor(Math.random() * list.length)] || 'douce';
}

// Pour un clignement : on ferme les yeux si ils sont ouverts, on les ouvre s'ils sont fermés.
function blinkOf(pose) {
  if (pose === 'contente') return Math.random() < 0.5 ? 'douce' : 'clin-oeil';
  return 'contente';
}

export function mascot({ size = 128, mood = 'random', blink = true, drift = true, alone = false } = {}) {
  const SRC = srcOf(alone);
  let base = pickPose(mood);
  let reacting = false;
  const img = h('img', { class: 'mascot', src: SRC[base], alt: 'Chaussette', width: String(size), style: { width: `${size}px`, height: 'auto' } });
  const show = (p) => { img.src = SRC[p]; };
  const timers = [];
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };

  // Clignement : intervalle aléatoire, parfois un double clignement.
  const scheduleBlink = () => later(() => {
    if (!img.isConnected) return;
    if (!reacting) {
      const other = blinkOf(base);
      const dur = rand(120, 260);
      show(other);
      later(() => { if (!reacting) show(base); }, dur);
      if (Math.random() < 0.2) {
        later(() => { if (!reacting) show(other); }, dur + rand(110, 180));
        later(() => { if (!reacting) show(base); }, dur * 2 + rand(180, 260));
      }
    }
    scheduleBlink();
  }, rand(1800, 7500));

  // De temps en temps, Chaussette change de pose d'elle-même.
  const scheduleDrift = () => later(() => {
    if (!img.isConnected) return;
    if (!reacting) { base = pickPose('random', base); show(base); }
    scheduleDrift();
  }, rand(9000, 22000));

  if (blink) scheduleBlink();
  if (drift) scheduleDrift();

  // Réaction passagère (points gagnés, sans-faute…) : pose tirée parmi « choice ».
  img.react = (choice = ['contente', 'clin-oeil'], ms = rand(700, 1400)) => {
    reacting = true;
    show(pickPose(choice));
    later(() => { reacting = false; base = pickPose('random'); show(base); }, ms);
  };
  img.setMood = (choice) => { base = pickPose(choice); show(base); };
  img.stop = () => timers.forEach(clearTimeout);
  return img;
}
