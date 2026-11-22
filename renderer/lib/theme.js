// Thème de TEAch Time : Ardoise (graphite et vert d'eau), en clair.
// Le moteur garde la version sombre et la couleur d'accent libre, mais l'app n'utilise plus que DEFAULT.

const SEMANTIC = {
  light: { ok: '#4f8f6f', 'ok-soft': '#e4f1e9', bad: '#d6455d', 'bad-soft': '#fde7eb', warn: '#c27c10', 'warn-soft': '#fff3dc' },
  dark: { ok: '#7fc4a0', 'ok-soft': '#1d3329', bad: '#f07a8c', 'bad-soft': '#3a1f25', warn: '#f0b454', 'warn-soft': '#3a2e16' },
};

// Ordre des clés : bg, panel, ink, muted, line, accent (boutons), accent-2 (surbrillance),
// accent-soft, accent-ink (texte accentué), btn-ink, nav, nav-ink, nav-active, nav-active-ink, hot (série).
const KEYS = ['bg', 'panel', 'ink', 'muted', 'line', 'accent', 'accent-2', 'accent-soft', 'accent-ink', 'btn-ink', 'nav', 'nav-ink', 'nav-active', 'nav-active-ink', 'hot'];
const pack = (arr) => Object.fromEntries(KEYS.map((k, i) => [k, arr[i]]));

export const THEMES = [
  {
    id: 'ardoise', name: 'Ardoise', hint: 'Graphite et vert d\'eau',
    light: pack(['#f4f5f6', '#ffffff', '#23272e', '#5f6670', '#e1e4e8', '#2a8576', '#3fa796', '#ddf2ee', '#24766a', '#ffffff', '#2b2f36', '#d9dde3', '#4fc1ae', '#0f2420', '#e39a5b']),
    dark: pack(['#16181c', '#1f2227', '#e6e8eb', '#9ba1aa', '#2e3238', '#4fc1ae', '#4fc1ae', '#1d302d', '#9be3d6', '#0f2420', '#101215', '#cfd3d9', '#4fc1ae', '#0f2420', '#f0a868']),
    // Choix de Marine : seuls les boutons pleins et la bulle de Chaussette passent en gris.
    extra: {
      light: { 'btn-bg': '#5b6573', 'btn-fg': '#ffffff', bubble: '#eceef1' },
      dark: { 'btn-bg': '#aab3bf', 'btn-fg': '#16181c', bubble: '#2a2e35' },
    },
  },
];

// Choix de Marine (14 nov 2026) : Ardoise en clair, partout et sur tous ses PC.
export const DEFAULT = { theme: 'ardoise', mode: 'light', accent: null };

let current = { ...DEFAULT };
let media = null;
let listeners = [];

function hexToRgb(hex) {
  const m = String(hex).replace('#', '').match(/^([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Texte lisible (clair ou foncé) sur une couleur donnée.
function readableOn(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#ffffff';
  const [r, g, b] = rgb.map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.4 ? '#14181e' : '#ffffff';
}

export function isDark(mode = current.mode) {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// Calcule toutes les variables CSS pour un réglage donné.
export function resolve(ap = current) {
  const theme = THEMES.find((t) => t.id === ap.theme) || THEMES[0];
  const dark = isDark(ap.mode);
  const vars = { ...(dark ? theme.dark : theme.light), ...(dark ? SEMANTIC.dark : SEMANTIC.light) };
  if (ap.accent && hexToRgb(ap.accent)) {
    const c = ap.accent;
    vars['accent-2'] = c;
    vars.accent = c;
    vars['btn-ink'] = readableOn(c);
    vars['nav-active'] = c;
    vars['nav-active-ink'] = readableOn(c);
    vars['accent-soft'] = `color-mix(in srgb, ${c} ${dark ? 22 : 14}%, ${vars.panel})`;
    vars['accent-ink'] = `color-mix(in srgb, ${c} ${dark ? 55 : 70}%, ${vars.ink})`;
  }
  // Boutons pleins et bulle de Chaussette : par défaut ceux de l'accent, sauf réglage propre au thème.
  // Une couleur d'accent libre s'applique partout, boutons et bulle compris.
  const extra = (!ap.accent && theme.extra && (dark ? theme.extra.dark : theme.extra.light)) || {};
  vars['btn-bg'] = extra['btn-bg'] || vars.accent;
  vars['btn-fg'] = extra['btn-fg'] || vars['btn-ink'];
  vars.bubble = extra.bubble || vars['accent-soft'];
  return { vars, dark, theme };
}

export function apply(ap = current) {
  current = { ...DEFAULT, ...ap };
  const { vars, dark } = resolve(current);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(`--${k}`, v);
  root.style.colorScheme = dark ? 'dark' : 'light';
  root.dataset.mode = dark ? 'dark' : 'light';
  // Le mode automatique suit Windows en direct.
  if (!media) {
    media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', () => { if (current.mode === 'auto') apply(current); });
  }
  listeners.forEach((fn) => fn(current, vars));
  return vars;
}

export function get() {
  return { ...current };
}

export function onChange(fn) {
  listeners.push(fn);
}

// Le thème est fixé : un ancien choix enregistré (autre thème, mode sombre, accent) est ignoré.
export async function load(_api) {
  return apply({ ...DEFAULT });
}

export async function save(api, patch) {
  const next = { ...current, ...patch };
  apply(next);
  await api.setItem('appearance', next);
  return next;
}
