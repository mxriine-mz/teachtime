// Version web : connexion à la base en ligne (Supabase), ou utilisation sur cet appareil seulement.
import { h } from '../lib/ui.js';
import { icon } from '../lib/icons.js';
import { mascot } from '../lib/mascot.js';

export async function render(root, ctx) {
  const cfg = await ctx.api.cloudConfig();
  const url = h('input', { type: 'url', placeholder: 'https://xxxx.supabase.co', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  const key = h('input', { type: 'text', placeholder: 'Clé publique (publishable / anon)', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  const email = h('input', { type: 'email', placeholder: 'E-mail', autocomplete: 'username', autocapitalize: 'off' });
  const pass = h('input', { type: 'password', placeholder: 'Mot de passe', autocomplete: 'current-password' });
  const err = h('p', { class: 'small', style: { color: 'var(--bad)', minHeight: '20px' } });
  const btn = h('button', { class: 'btn primary big' }, 'Se connecter');

  const needCfg = !cfg;
  const cfgBox = h('div', { style: { display: needCfg ? '' : 'none' } },
    h('p', { class: 'small muted' }, 'Première fois sur cet appareil : ouvre plutôt le lien d\'installation (Réglages de l\'app du PC, « Lien pour un autre appareil »). Sinon, colle ici l\'adresse et la clé publique de ta base Supabase.'),
    h('label', { class: 'field' }, h('span', {}, 'Adresse de la base'), url),
    h('label', { class: 'field' }, h('span', {}, 'Clé publique'), key));

  const go = async () => {
    err.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Connexion…';
    const newCfg = cfgBox.style.display !== 'none' && url.value.trim() && key.value.trim();
    const r = await ctx.api.cloudConnect({ url: newCfg ? url.value : null, key: newCfg ? key.value : null, email: email.value, password: pass.value });
    btn.disabled = false;
    btn.textContent = 'Se connecter';
    if (!r.ok) { err.textContent = r.error || 'Connexion impossible.'; return; }
    pass.value = '';
    await ctx.refresh();
    ctx.go('home');
  };
  btn.addEventListener('click', go);
  pass.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });

  const local = async () => { await ctx.api.useLocal(); await ctx.refresh(); ctx.go('home'); };

  root.append(h('div', { class: 'setup' },
    h('div', { class: 'card' },
      h('div', { class: 'row', style: { gap: '14px', flexWrap: 'nowrap' } },
        mascot({ size: 72, alone: true }),
        h('div', {}, h('h1', { style: { margin: 0 } }, 'TEAch Time'), h('p', { class: 'sub', style: { margin: '4px 0 0' } }, 'Ta tasse d\'anglais de tous les jours, sur iPhone et iPad.'))),
      h('h3', { style: { marginTop: '22px' } }, 'Connexion'),
      h('p', { class: 'small muted' }, 'Avec ton compte, tes points, tes textes et tes listes sont les mêmes sur le PC, l\'iPad et l\'iPhone.'),
      cfgBox,
      cfg ? h('p', { class: 'small muted' }, icon('check', 12), ` Base : ${cfg.url.replace(/^https?:\/\//, '')}`, ' · ',
        h('a', { href: '#', onclick: (e) => { e.preventDefault(); cfgBox.style.display = ''; } }, 'changer')) : null,
      h('label', { class: 'field' }, h('span', {}, 'E-mail'), email),
      h('label', { class: 'field' }, h('span', {}, 'Mot de passe'), pass),
      err,
      h('div', { class: 'row' }, btn, h('button', { class: 'btn ghost', onclick: local }, 'Utiliser sans compte')),
      h('p', { class: 'small muted', style: { marginTop: '14px' } }, 'Sans compte, la progression reste dans Safari sur cet appareil. Tu pourras te connecter plus tard dans les Réglages : ce que tu as fait sera envoyé en ligne.'))));
  setTimeout(() => (cfg ? email : url).focus(), 50);
}
