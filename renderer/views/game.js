// « Le Quartier » : vue du jeu (caméra, déplacements, dialogues).
// Le monde et le dessin sont dans game-world.js.
import { h, clear, modal, todayKey } from '../lib/ui.js';
import { CATS, startQuiz } from './activities.js';
import { repeatSession } from './speak.js';
import { icon } from '../lib/icons.js';
import {
  T, PW, PH, STATIONS, BOARD, FOUNTAIN, FTN, PLAYER_LOOK, npcPos, renderWorld, portraitCanvas, isSolidTile, ambient, loadPlayerSheet, loadSheet,
} from './game-world.js';

// Si Marine a dessiné son personnage (assets/sprites/joueuse.png), le jeu l'utilise à la place du dessin par défaut.
// Les habitants ont leur planche dans assets/sprites/habitants/ ; sans elle, ils gardent le dessin en code.
export async function usePlayerSprite(ctx) {
  await Promise.all(STATIONS.map((s) => loadSheet(s.look.sheet)));
  if (!ctx.state || !ctx.state.playerSprite) return false;
  const ok = await loadPlayerSheet('assets/sprites/joueuse.png');
  if (ok) PLAYER_LOOK.sheet = true;
  return ok;
}

// ---------- Aperçu fixe (carte du Quartier sur l'accueil) ----------
export function drawPreview(target, { crop = { x: 2, y: 2, w: 36, h: 12 } } = {}) {
  const full = document.createElement('canvas');
  full.width = PW; full.height = PH;
  const chars = STATIONS.map((s) => ({ ...npcPos(s), look: s.look, dir: 'down', frame: 0 }));
  chars.push({ x: 16.5 * T, y: 9.4 * T, look: PLAYER_LOOK, dir: 'down', frame: 0 });
  renderWorld(full.getContext('2d'), { time: 0, chars, light: false, particles: false });
  target.width = crop.w * T;
  target.height = crop.h * T;
  const c = target.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.drawImage(full, crop.x * T, crop.y * T, crop.w * T, crop.h * T, 0, 0, crop.w * T, crop.h * T);
  return target;
}

// Lieux du Quartier, pour l'accueil (nom, catégorie).
export const PLACES = () => STATIONS.map((s) => ({ id: s.id, cat: s.cat, name: s.name, npc: s.npc }));

function portrait(look) {
  const c = portraitCanvas(look);
  c.style.width = `${c.width * 4}px`;
  c.style.height = `${c.height * 4}px`;
  return c;
}

const LABEL_STYLE = {
  position: 'absolute', transform: 'translate(-50%, -100%)', background: 'color-mix(in srgb, var(--nav) 90%, transparent)',
  color: 'var(--nav-ink)', padding: '2px 9px', borderRadius: '99px', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap',
  display: 'flex', alignItems: 'center', gap: '4px', pointerEvents: 'none',
};

// ---------- Vue ----------
export async function render(root, ctx) {
  await usePlayerSprite(ctx);
  const doneKey = `game:${todayKey()}`;
  let done = (await ctx.api.getItem(doneKey)) || {};

  // Image du monde (taille réelle) puis affichage zoomé à l'écran.
  const frameCv = document.createElement('canvas');
  frameCv.width = PW; frameCv.height = PH;
  const fg = frameCv.getContext('2d');

  const screen = h('canvas', { class: 'game-screen' });
  const sg = screen.getContext('2d');
  const labels = h('div', { style: { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden' } });
  const hud = h('div', { class: 'game-hud' });
  const prompt = h('div', { class: 'game-prompt', style: { display: 'none' } });
  const help = h('div', { class: 'game-help' }, 'ZQSD, WASD ou flèches : marcher · Espace : parler · clic : y aller');
  const wrap = h('div', { class: 'game-wrap', tabindex: '0' }, screen, labels, hud, prompt, help);
  root.append(wrap);

  const drawHud = () => {
    const s = ctx.state;
    clear(hud).append(
      h('div', { class: 'pill' }, 'Points : ', h('b', {}, `${s.points} / ${s.quota}`)),
      h('div', { class: 'pill' }, icon('flame', 15), ` ${s.streak}`));
  };
  drawHud();
  const unsub = ctx.api.onState(() => drawHud());

  // Étiquettes : créées une fois, repositionnées à chaque image selon la caméra.
  const tags = [];
  const buildLabels = () => {
    clear(labels);
    tags.length = 0;
    for (const s of STATIONS) {
      const el = h('div', { style: LABEL_STYLE }, s.name, done[s.id] ? icon('check', 12) : null);
      labels.append(el);
      tags.push({ el, x: (s.x + s.w / 2) * T, y: s.y * T - (s.kind === 'tower' ? 18 : s.kind === 'radio' ? 16 : 6) });
    }
    const b = h('div', { style: { ...LABEL_STYLE, color: 'var(--accent-2)' } }, 'Devoirs');
    labels.append(b);
    tags.push({ el: b, x: (BOARD.x + 0.5) * T, y: BOARD.y * T - 2 });
  };
  buildLabels();

  // Caméra : zoom entier (pixels nets), centrée sur la joueuse, bornée au monde.
  const view = { w: 0, h: 0, dpr: 1, zoom: 3, cx: 0, cy: 0 };
  const fit = () => {
    const r = wrap.getBoundingClientRect();
    view.dpr = window.devicePixelRatio || 1;
    view.w = Math.max(1, Math.round(r.width * view.dpr));
    view.h = Math.max(1, Math.round(r.height * view.dpr));
    screen.width = view.w; screen.height = view.h;
    screen.style.width = `${r.width}px`; screen.style.height = `${r.height}px`;
    view.zoom = Math.max(2, Math.round(Math.min(view.w / (22 * T), view.h / (14 * T))));
  };
  const ro = new ResizeObserver(fit);
  ro.observe(wrap);
  fit();

  const camTarget = () => {
    const vw = view.w / view.zoom;
    const vh = view.h / view.zoom;
    const clampX = (x) => (vw >= PW ? (PW - vw) / 2 : Math.max(0, Math.min(PW - vw, x)));
    const clampY = (y) => (vh >= PH ? (PH - vh) / 2 : Math.max(0, Math.min(PH - vh, y)));
    return { x: clampX(me.x - vw / 2), y: clampY(me.y - 10 - vh / 2) };
  };

  // ---------- Collisions ----------
  const npcs = STATIONS.map((s) => ({ s, ...npcPos(s), look: s.look }));
  const solids = [
    ...STATIONS.map((s) => ({ x: s.x * T - 2, y: s.y * T, w: s.w * T + 4, h: s.h * T })),
    { x: FTN.cx - 29, y: FTN.by - 12, w: 58, h: 28 }, // bassin ovale de la fontaine
    { x: BOARD.x * T, y: BOARD.y * T + 8, w: T, h: 8 },
    ...npcs.map((n) => ({ x: n.x - 4, y: n.y - 4, w: 8, h: 5 })),
  ];
  const blocked = (x, y) => {
    for (const [ox, oy] of [[-4, -3], [4, -3], [-4, 0], [4, 0]]) {
      const qx = x + ox;
      const qy = y + oy;
      if (isSolidTile(Math.floor(qx / T), Math.floor(qy / T))) return true;
      for (const r of solids) if (qx >= r.x && qx < r.x + r.w && qy >= r.y && qy < r.y + r.h) return true;
    }
    return false;
  };

  // ---------- Joueuse ----------
  const me = { x: 16.5 * T, y: 9.4 * T, dir: 'down', walking: false, t: 0 };
  const keys = new Set();
  let target = null;
  let paused = false;
  let near = null;
  window.__teachGame = { me, npcs }; // lu par l'autotest
  { const c = camTarget(); view.cx = c.x; view.cy = c.y; }

  const KEYMAP = {
    arrowup: 'u', z: 'u', w: 'u', arrowdown: 'd', s: 'd', arrowleft: 'l', q: 'l', a: 'l', arrowright: 'r', d: 'r',
  };
  const onKeyDown = (e) => {
    if (paused || document.querySelector('.overlay')) return;
    const k = KEYMAP[e.key.toLowerCase()];
    if (k) { keys.add(k); target = null; e.preventDefault(); }
    if ((e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'e') && near) { e.preventDefault(); interact(near); }
  };
  const onKeyUp = (e) => { const k = KEYMAP[e.key.toLowerCase()]; if (k) keys.delete(k); };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // Commandes tactiles (iPhone, iPad) : croix pour marcher, bouton « Parler » à côté d'un habitant.
  const touch = window.matchMedia('(pointer: coarse)').matches;
  let actBtn = null;
  if (touch) {
    const pad = h('div', { class: 'touchpad' });
    for (const [cls, k, rot] of [['up', 'u', -90], ['left', 'l', 180], ['right', 'r', 0], ['down', 'd', 90]]) {
      const b = h('button', { class: cls, 'aria-label': cls }, icon('arrowRight', 22));
      b.firstChild.style.transform = `rotate(${rot}deg)`;
      const on = (e) => { e.preventDefault(); if (paused) return; keys.add(k); target = null; b.classList.add('on'); };
      const off = (e) => { e.preventDefault(); keys.delete(k); b.classList.remove('on'); };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('pointerleave', off);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      pad.append(b);
    }
    actBtn = h('button', { class: 'touch-act', style: { display: 'none' }, onclick: () => { if (near && !paused) interact(near); } }, 'Parler');
    wrap.append(pad, actBtn);
  }

  screen.addEventListener('click', (e) => {
    if (paused) return;
    const r = screen.getBoundingClientRect();
    const wx = view.cx + ((e.clientX - r.left) * view.dpr) / view.zoom;
    const wy = view.cy + ((e.clientY - r.top) * view.dpr) / view.zoom;
    // Clic sur un lieu ou un habitant : on y va, et on parle si on est déjà à côté.
    for (const n of npcs) {
      const s = n.s;
      const onBuilding = wx >= s.x * T && wx < (s.x + s.w) * T && wy >= s.y * T - 10 && wy < (s.y + s.h) * T;
      if (onBuilding || Math.hypot(wx - n.x, wy - (n.y - 8)) < 14) {
        if (near && near.s === s) { interact(near); return; }
        target = { x: n.x, y: n.y + 12, then: n };
        return;
      }
    }
    if (Math.hypot(wx - (BOARD.x + 0.5) * T, wy - (BOARD.y + 0.5) * T) < 14) {
      target = { x: (BOARD.x + 0.5) * T, y: (BOARD.y + 1) * T + 6, then: 'board' };
      return;
    }
    target = { x: wx, y: wy };
  });

  function findNear() {
    for (const n of npcs) if (Math.hypot(me.x - n.x, me.y - n.y) < 24) return n;
    if (Math.hypot(me.x - (BOARD.x + 0.5) * T, me.y - (BOARD.y + 1) * T) < 20) return 'board';
    return null;
  }

  async function interact(n) {
    if (paused) return;
    keys.clear();
    target = null;
    if (n === 'board') { ctx.go('memorize'); return; }
    const s = n.s;
    paused = true;
    const before = ctx.state.points;
    const header = h('div', { class: 'npc-talk' }, portrait(s.look),
      h('div', {}, h('b', {}, `${s.npc}, ${s.role}`), h('div', { class: 'bubble', style: { marginTop: '6px' } }, s.line)));
    const markDone = async () => {
      if (ctx.state.points > before) {
        done = (await ctx.api.getItem(doneKey)) || {};
        done[s.id] = (done[s.id] || 0) + 1;
        await ctx.api.setItem(doneKey, done);
        buildLabels();
      }
      paused = false;
      wrap.focus();
    };
    if (s.cat === 'speak') {
      let stop = null;
      const m = modal([icon('mic', 20), s.name], { onClose: () => { if (stop) stop(); markDone(); } });
      const mount = h('div');
      m.body.append(header, mount);
      stop = await repeatSession(ctx, mount, { count: 3, onDone: () => m.close() });
    } else {
      await startQuiz(ctx, s.cat, { title: [icon(CATS[s.cat].icon, 20), s.name], header });
      await markDone();
    }
  }

  // ---------- Boucle ----------
  let raf = 0;
  let last = performance.now();
  let stuck = 0;
  let amb = ambient();
  let ambAt = 0;
  const SPEED = 72;

  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let vx = 0;
    let vy = 0;
    if (!paused) {
      if (keys.has('u')) vy -= 1;
      if (keys.has('d')) vy += 1;
      if (keys.has('l')) vx -= 1;
      if (keys.has('r')) vx += 1;
      if (!vx && !vy && target) {
        const dx = target.x - me.x;
        const dy = target.y - me.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 2) {
          const then = target.then;
          target = null;
          if (then) { const n = findNear(); if (n) interact(n); }
        } else { vx = dx / dist; vy = dy / dist; }
      }
    }
    if (vx || vy) {
      const len = Math.hypot(vx, vy);
      vx /= len; vy /= len;
      const nx = me.x + vx * SPEED * dt;
      const ny = me.y + vy * SPEED * dt;
      let moved = false;
      if (!blocked(nx, me.y)) { me.x = nx; moved = true; }
      if (!blocked(me.x, ny)) { me.y = ny; moved = true; }
      if (Math.abs(vx) > Math.abs(vy)) me.dir = vx < 0 ? 'left' : 'right';
      else me.dir = vy < 0 ? 'up' : 'down';
      me.walking = moved;
      if (!moved && target) { stuck += dt; if (stuck > 0.35) { target = null; stuck = 0; } } else stuck = 0;
    } else me.walking = false;
    if (me.walking) me.t += dt;

    near = findNear();
    if (near && !paused) {
      prompt.style.display = '';
      clear(prompt).append(touch ? '' : h('kbd', {}, 'Espace'), near === 'board' ? 'Ouvrir le tableau des devoirs' : `Parler à ${near.s.npc} · ${CATS[near.s.cat]?.label || 'Oral'}`);
    } else prompt.style.display = 'none';
    if (actBtn) { actBtn.style.display = near && !paused ? '' : 'none'; actBtn.textContent = near === 'board' ? 'Ouvrir' : 'Parler'; }

    // Lumière : recalculée toutes les 30 s (elle suit l'heure réelle).
    // (window.__teachAmbient permet à l'autotest de forcer le jour ou la nuit.)
    if (window.__teachAmbient) amb = window.__teachAmbient;
    else if (now - ambAt > 30000) { amb = ambient(); ambAt = now; }

    const walkFrame = me.walking ? [0, 1, 0, 2][Math.floor(me.t * 9) % 4] : 0;
    // Clignement : chaque personnage à son propre rythme.
    const blinkAt = (seed) => Math.floor(now / 130 + seed * 17) % (28 + (seed % 5) * 3) === 0;
    const chars = npcs.map((n, i) => ({ x: n.x, y: n.y, look: n.look, dir: 'down', frame: 0, bob: Math.sin(now / 420 + i * 1.3) > 0.7 ? -1 : 0, blink: blinkAt(i + 1) }));
    chars.push({ x: me.x, y: me.y, look: PLAYER_LOOK, dir: me.dir, frame: walkFrame, bob: walkFrame ? -1 : 0, blink: blinkAt(9) });
    const markers = npcs.filter((n) => !done[n.s.id]).map((n) => ({ x: n.x, y: n.y }));
    renderWorld(fg, { time: now, chars, markers, ambient: amb, player: { x: me.x, y: me.y } });

    // Caméra adoucie.
    const c = camTarget();
    view.cx += (c.x - view.cx) * Math.min(1, dt * 8);
    view.cy += (c.y - view.cy) * Math.min(1, dt * 8);
    const cx = Math.round(view.cx * view.zoom) / view.zoom;
    const cy = Math.round(view.cy * view.zoom) / view.zoom;
    sg.imageSmoothingEnabled = false;
    sg.fillStyle = '#2f5f2c';
    sg.fillRect(0, 0, view.w, view.h);
    sg.drawImage(frameCv, -cx * view.zoom, -cy * view.zoom, PW * view.zoom, PH * view.zoom);

    for (const t of tags) {
      t.el.style.left = `${((t.x - cx) * view.zoom) / view.dpr}px`;
      t.el.style.top = `${((t.y - cy) * view.zoom) / view.dpr}px`;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  wrap.focus();

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    ro.disconnect();
    unsub();
  };
}
