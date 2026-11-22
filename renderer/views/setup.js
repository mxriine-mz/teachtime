// Assistant de premier lancement : règles, code d'urgence, heure et quota.
import { h } from '../lib/ui.js';

export async function render(root, ctx) {
  const code1 = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Au moins 4 caractères' });
  const code2 = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Le même code' });
  const time = h('input', { type: 'time', value: '18:00' });
  const quota = h('input', { type: 'number', min: '50', max: '2000', step: '10', value: '300' });
  const auto = h('input', { type: 'checkbox', checked: true });
  const err = h('p', { class: 'small', style: { color: 'var(--bad)', minHeight: '20px' } });
  const btn = h('button', { class: 'btn primary big' }, 'C\'est parti');

  btn.addEventListener('click', async () => {
    err.textContent = '';
    if (code1.value.length < 4) { err.textContent = 'Le code doit faire au moins 4 caractères.'; return; }
    if (code1.value !== code2.value) { err.textContent = 'Les deux codes ne sont pas identiques.'; return; }
    const [hh, mm] = (time.value || '18:00').split(':').map(Number);
    btn.disabled = true;
    const r = await ctx.api.setup({ code: code1.value, lockHour: hh, lockMinute: mm, dailyQuota: Number(quota.value), autostart: auto.checked });
    btn.disabled = false;
    if (!r.ok) { err.textContent = r.error || 'Impossible d\'enregistrer.'; return; }
    if (r.autostart && r.autostart.ok === false) ctx.toast('Le démarrage automatique n\'a pas pu être activé. Va voir dans Réglages.', 'bad');
    await ctx.refresh();
    ctx.go('home');
  });

  root.append(h('div', { class: 'setup' },
    h('div', { class: 'card' },
      h('img', { src: 'assets/logo-teachtime.svg', alt: 'TEAch Time, My Cup of English', style: { width: '320px', display: 'block', margin: '0 0 12px -6px' } }),
      h('h1', {}, 'Bienvenue !'),
      h('p', { class: 'sub' }, 'Ta tasse d\'anglais de tous les jours : cours, jeu, mémorisation de textes et oral.'),
      h('h3', {}, 'La règle du jeu'),
      h('ul', { class: 'rules' },
        h('li', {}, 'Chaque bonne réponse rapporte 10 points, et une série parfaite donne 10 points de bonus.'),
        h('li', {}, 'À l\'heure choisie, si ton quota du jour n\'est pas atteint, TEAch Time s\'ouvre en plein écran et ne se ferme plus.'),
        h('li', {}, 'Dès que le quota est atteint, le PC redevient libre.'),
        h('li', {}, 'En cas de vraie urgence, ton code débloque le PC jusqu\'à minuit.'),
        h('li', {}, 'Le verrou reste en pause tant que tu ne l\'as pas activé dans les Réglages.'),
        h('li', {}, 'Tes points se synchronisent entre tes PC grâce à Google Drive.')),
      h('label', { class: 'field', style: { marginTop: '18px' } }, h('span', {}, 'Code d\'urgence'), code1),
      h('label', { class: 'field' }, h('span', {}, 'Confirme le code'), code2),
      h('div', { class: 'grid c2' },
        h('label', { class: 'field' }, h('span', {}, 'Heure du verrou'), time),
        h('label', { class: 'field' }, h('span', {}, 'Quota de points par jour'), quota)),
      h('label', { class: 'row', style: { marginBottom: '16px' } }, auto, h('span', {}, 'Lancer TEAch Time au démarrage du PC (nécessaire pour le verrou)')),
      h('p', { class: 'small muted' }, 'Le code est enregistré sous forme chiffrée sur ce PC. Il faudra le choisir aussi sur ton PC fixe. Pour changer l\'heure ou le quota plus tard, il faudra ce code.'),
      err,
      btn)));
  code1.focus();
}
