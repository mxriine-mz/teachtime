// Page de connexion à la base en ligne (Supabase), sur le PC comme sur l'iPhone et l'iPad.
// Sur le web, on peut aussi utiliser l'app sans compte ; sur le PC, « Plus tard » ramène à l'accueil.
import { h } from '../lib/ui.js';
import { mascot } from '../lib/mascot.js';

export const LATER_KEY = 'tt.loginLater';

export async function render(root, ctx) {
  const web = ctx.state && ctx.state.platform === 'web';
  const st = await ctx.api.cloudStatus();
  const cfg = ctx.api.cloudConfig ? await ctx.api.cloudConfig() : (st && st.url ? { url: st.url } : null);

  const url = h('input', { type: 'url', placeholder: 'https://xxxx.supabase.co', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  const key = h('input', { type: 'text', placeholder: 'sb_publishable_…', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  const email = h('input', { type: 'email', placeholder: 'E-mail', autocomplete: 'username', autocapitalize: 'off' });
  const pass = h('input', { type: 'password', placeholder: 'Mot de passe', autocomplete: 'current-password' });
  const err = h('p', { class: 'small', style: { color: 'var(--bad)', minHeight: '20px' } });
  const btn = h('button', { class: 'btn primary big' }, 'Se connecter');

  const cfgBox = h('div', { style: { display: cfg ? 'none' : '' } },
    h('p', { class: 'small muted' }, web
      ? 'Première fois sur cet appareil : ouvre plutôt le lien d\'installation (Réglages de l\'app du PC, « Lien pour un autre appareil »). Sinon, colle ici l\'adresse et la clé publique de ta base.'
      : 'L\'adresse de la base n\'est pas configurée sur ce PC : crée le fichier .env (voir .env.example), ou colle ici l\'adresse et la clé publique.'),
    h('label', { class: 'field' }, h('span', {}, 'Adresse de la base'), url),
    h('label', { class: 'field' }, h('span', {}, 'Clé publique'), key));

  const go = async () => {
    err.textContent = '';
    if (!email.value.trim() || !pass.value) { err.textContent = 'Il faut ton e-mail et ton mot de passe.'; return; }
    const newCfg = cfgBox.style.display !== 'none' && url.value.trim() && key.value.trim();
    if (!cfg && !newCfg) { err.textContent = 'Il faut l\'adresse et la clé publique de la base.'; return; }
    btn.disabled = true;
    btn.textContent = 'Connexion…';
    const r = await ctx.api.cloudConnect({ url: newCfg ? url.value : null, key: newCfg ? key.value : null, email: email.value, password: pass.value });
    btn.disabled = false;
    btn.textContent = 'Se connecter';
    if (!r.ok) { err.textContent = r.error || 'Connexion impossible.'; return; }
    pass.value = '';
    try { localStorage.removeItem(LATER_KEY); } catch { /* rien */ }
    await ctx.refresh();
    ctx.toast('Connectée : ta progression est synchronisée.', 'ok');
    ctx.go('home');
  };
  btn.addEventListener('click', go);

  // Connexion avec Google (même adresse e-mail que ton compte TEAch Time).
  const gbtn = h('button', { class: 'btn google' }, h('span', { class: 'g-logo', 'aria-hidden': 'true' }, 'G'), 'Continuer avec Google');
  gbtn.addEventListener('click', async () => {
    err.textContent = '';
    gbtn.disabled = true;
    gbtn.lastChild.textContent = web ? 'Ouverture de Google…' : 'Termine la connexion dans ton navigateur…';
    const r = await ctx.api.cloudGoogle();
    if (r && r.redirecting) return; // le site part chez Google puis revient
    gbtn.disabled = false;
    gbtn.lastChild.textContent = 'Continuer avec Google';
    if (!r || !r.ok) { err.textContent = (r && r.error) || 'Connexion Google impossible.'; return; }
    try { localStorage.removeItem(LATER_KEY); } catch { /* rien */ }
    await ctx.refresh();
    ctx.toast('Connectée avec Google : ta progression est synchronisée.', 'ok');
    ctx.go('home');
  });
  const previous = ctx.api.lastLoginError ? await ctx.api.lastLoginError() : null;
  if (previous) err.textContent = previous;
  pass.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });

  const later = async () => {
    if (web) { await ctx.api.useLocal(); await ctx.refresh(); }
    else { try { localStorage.setItem(LATER_KEY, '1'); } catch { /* rien */ } }
    ctx.go('home');
  };

  root.append(h('div', { class: 'setup' },
    h('div', { class: 'card' },
      h('div', { class: 'row', style: { gap: '14px', flexWrap: 'nowrap' } },
        mascot({ size: 72, alone: true }),
        h('div', {}, h('h1', { style: { margin: 0 } }, 'Connexion'), h('p', { class: 'sub', style: { margin: '4px 0 0' } }, web ? 'Ta tasse d\'anglais de tous les jours, sur iPhone et iPad.' : 'Ton compte TEAch Time en ligne.'))),
      h('p', { class: 'small muted', style: { marginTop: '18px' } }, 'Avec ton compte, tes points, tes textes et tes listes sont les mêmes sur le PC, l\'iPad et l\'iPhone. Ce que tu as déjà fait ici sera envoyé en ligne.'),
      cfgBox,
      cfg ? h('div', { style: { margin: '6px 0 4px' } }, gbtn) : null,
      cfg ? h('div', { class: 'or-line' }, h('span', {}, 'ou avec ton e-mail')) : null,
      h('label', { class: 'field' }, h('span', {}, 'E-mail'), email),
      h('label', { class: 'field' }, h('span', {}, 'Mot de passe'), pass),
      err,
      h('div', { class: 'row' }, btn, h('button', { class: 'btn ghost', onclick: later }, web ? 'Utiliser sans compte' : 'Plus tard')),
      h('p', { class: 'small muted', style: { marginTop: '14px' } }, web
        ? 'Sans compte, la progression reste dans Safari sur cet appareil. Tu pourras te connecter plus tard dans les Réglages.'
        : 'Plus tard : l\'app marche comme avant sur ce PC. Tu retrouveras cette page dans Réglages › Compte en ligne.'))));
  setTimeout(() => (cfg ? email : url).focus(), 50);
}
