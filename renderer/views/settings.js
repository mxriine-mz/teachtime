import { h, clear } from '../lib/ui.js';
import * as tts from '../lib/tts.js';
import { startRecording } from '../lib/audio.js';
import { icon } from '../lib/icons.js';

// Adresse de la version web (GitHub Pages), pour le lien d'installation envoyé depuis le PC.
const WEB_URL = 'https://teach-time.mxrine-mz.dev/';

export async function render(root, ctx) {
  const s = await ctx.refresh();
  const web = s.platform === 'web';

  // ---- Voix ----
  let voiceCard;
  if (!web) {
    // PC : voix neuronale (Kokoro), calculée sur le PC.
    const cur = tts.currentVoice();
    const sel = h('select', {}, tts.VOICES.map((v) => h('option', { value: v.id, selected: v.id === cur }, v.label)));
    const voiceLine = h('p', { class: 'small muted' });
    const refreshVoice = async () => {
      const st = await tts.status();
      voiceLine.textContent = st.ready ? 'Voix neuronale prête. Elle tourne sur le PC : rien ne part sur Internet.'
        : st.error ? `Voix neuronale indisponible (${st.error}). En attendant, l'app utilise une voix anglaise de Windows s'il y en a une.`
          : st.downloaded ? 'Voix neuronale en cours de chargement…'
            : 'La voix neuronale (310 Mo) se télécharge à la première lecture, une seule fois.';
    };
    refreshVoice();
    const test = () => tts.speak('Hello Marine, this is your daily English practice. Shall we start?');
    sel.addEventListener('change', async () => { tts.setPreferred(sel.value); await ctx.api.setVoice(sel.value); test(); });
    voiceCard = h('div', { class: 'card' },
      h('h2', {}, 'Voix anglaise'),
      h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Accent britannique ou américain, voix d\'homme ou de femme.'),
      sel,
      h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn', onclick: async () => { await test(); refreshVoice(); } }, icon('play', 14), 'Tester')),
      voiceLine);
  } else {
    // iPhone, iPad : voix anglaises d'iOS.
    const voices = await tts.systemVoices();
    const cur = tts.currentSystemVoice();
    const sel = h('select', {}, [h('option', { value: '' }, 'Automatique (la meilleure voix anglaise)'), ...voices.map((v) => h('option', { value: v.name, selected: v.name === cur }, `${v.name} (${v.lang})`))]);
    const test = () => tts.speak('Hello Marine, this is your daily English practice. Shall we start?');
    sel.addEventListener('change', async () => { tts.setPreferred(sel.value); await ctx.api.setVoice(sel.value); test(); });
    voiceCard = h('div', { class: 'card' },
      h('h2', {}, 'Voix anglaise'),
      voices.length ? sel : h('p', { class: 'muted' }, 'Aucune voix anglaise trouvée sur cet appareil.'),
      h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn', onclick: test }, icon('play', 14), 'Tester')),
      h('p', { class: 'small muted' }, 'Pour une voix plus naturelle : Réglages de l\'iPhone › Accessibilité › Contenu énoncé › Voix › Anglais, puis télécharge une voix « améliorée » ou « premium » (Serena, Daniel, Ava…).'));
  }

  // ---- Micro et reconnaissance vocale (Whisper) ----
  const sttLine = h('p', { class: 'muted' });
  const testOut = h('p', { class: 'heard' });
  const refreshStt = async () => {
    const st = await ctx.api.sttStatus();
    sttLine.textContent = st.ready ? 'Reconnaissance vocale prête.'
      : st.loading ? `Modèle en cours de chargement${st.progress ? ` (${st.progress} %)` : ''}…`
        : st.downloaded ? 'Modèle présent, il se chargera au premier enregistrement (quelques secondes).'
          : `Modèle pas encore téléchargé : il le sera au premier enregistrement (environ 80 Mo${web ? ', en Wi-Fi de préférence' : ''}).`;
    if (st.error) sttLine.textContent += ` Dernière erreur : ${st.error}`;
  };
  refreshStt();
  const testBtn = h('button', { class: 'btn' }, icon('mic', 16), 'Tester le micro (4 s)');
  testBtn.addEventListener('click', async () => {
    testBtn.disabled = true;
    testOut.textContent = 'Parle en anglais…';
    try {
      const rec = await startRecording({ maxMs: 4000 });
      const audio = await rec.finished;
      testOut.textContent = 'Transcription…';
      const r = await ctx.api.transcribe(audio);
      testOut.textContent = r.ok ? (r.text ? `Entendu : « ${r.text} »` : 'Rien entendu. Vérifie le micro.') : `Erreur : ${r.error}`;
    } catch (e) {
      testOut.textContent = `Micro indisponible : ${e.message}`;
    }
    testBtn.disabled = false;
    refreshStt();
  });
  const micCard = h('div', { class: 'card' }, h('h2', {}, 'Micro et reconnaissance vocale'), sttLine, testBtn, testOut);

  // ---- Compte en ligne (PC et web) ----
  const accountCard = h('div', { class: 'card' });
  const drawAccount = async () => {
    const c = await ctx.api.cloudStatus();
    clear(accountCard).append(h('h2', {}, 'Compte en ligne'));
    const msg = h('p', { class: 'small', style: { minHeight: '20px' } });
    if (c && c.user && (!web || c.mode === 'cloud')) {
      const when = c.at ? new Date(c.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'jamais';
      const link = h('button', { class: 'btn', onclick: async () => {
        const l = await ctx.api.cloudLink(web ? null : WEB_URL);
        try { await navigator.clipboard.writeText(l); msg.style.color = 'var(--ok)'; msg.textContent = 'Lien copié : envoie-le-toi (Messages, mail) et ouvre-le dans Safari sur l\'iPhone ou l\'iPad.'; }
        catch { msg.textContent = l; }
      } }, 'Lien pour un autre appareil');
      accountCard.append(
        h('p', {}, 'Connectée : ', h('b', {}, c.user.email || ''), '. Tes points, textes et listes sont partagés avec tes autres appareils.'),
        h('p', { class: 'small muted' }, c.status === 'error' ? `Dernière synchro en échec : ${c.error}` : `Dernière synchro : ${when}`),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', onclick: async () => { msg.textContent = 'Synchronisation…'; await ctx.api.cloudSync(); await ctx.refresh(); drawAccount(); } }, 'Synchroniser maintenant'),
          link,
          h('button', { class: 'btn ghost', onclick: async () => { await ctx.api.cloudLogout(); await ctx.refresh(); if (web) ctx.go('login'); else drawAccount(); } }, 'Se déconnecter')),
        msg);
      return;
    }
    // Pas connectée : la connexion se fait sur sa propre page.
    accountCard.append(
      h('p', { class: 'muted', style: { marginTop: 0 } }, 'Pas encore connectée. Avec ton compte, tes points, tes textes et tes listes sont partagés entre le PC, l\'iPad et l\'iPhone.'),
      h('button', { class: 'btn primary', onclick: () => ctx.go('login') }, 'Se connecter'));
  };
  drawAccount();

  if (web) {
    // ---- Quota (pas de verrou sur iPhone) ----
    const quota = h('input', { type: 'number', min: '50', max: '2000', step: '10', value: String(s.quota), inputmode: 'numeric' });
    const qmsg = h('p', { class: 'small', style: { minHeight: '20px' } });
    const quotaCard = h('div', { class: 'card' },
      h('h2', {}, 'Quota du jour'),
      h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Il est partagé entre l\'iPhone et l\'iPad. Safari ne peut pas verrouiller l\'appareil : le verrou reste sur le PC.'),
      h('label', { class: 'field' }, h('span', {}, 'Points par jour'), quota),
      qmsg,
      h('button', { class: 'btn primary', onclick: async () => { await ctx.api.updateSettings(null, { dailyQuota: Number(quota.value) }); await ctx.refresh(); qmsg.style.color = 'var(--ok)'; qmsg.textContent = 'Enregistré.'; } }, 'Enregistrer'));
    const installCard = h('div', { class: 'card' },
      h('h2', {}, 'Sur l\'écran d\'accueil'),
      h('p', {}, 'Dans Safari, touche ', h('b', {}, 'Partager'), ' puis ', h('b', {}, 'Sur l\'écran d\'accueil'), ' : TEAch Time s\'ouvre alors en plein écran, comme une app, et marche aussi hors connexion (la synchro reprend au retour du réseau).'));
    clear(root).append(
      h('h1', {}, 'Réglages'),
      h('p', { class: 'sub' }, 'Voix, micro, quota et compte.'),
      h('div', { class: 'grid c2' }, voiceCard, micCard),
      h('div', { class: 'grid c2', style: { marginTop: '16px' } }, accountCard, quotaCard),
      h('div', { class: 'grid c2', style: { marginTop: '16px' } }, installCard));
    return;
  }

  // ---- Règles protégées (PC) ----
  const code = h('input', { type: 'password', placeholder: 'Code actuel', autocomplete: 'off' });
  const time = h('input', { type: 'time', value: `${String(s.lockHour).padStart(2, '0')}:${String(s.lockMinute).padStart(2, '0')}` });
  const quota = h('input', { type: 'number', min: '50', max: '2000', step: '10', value: String(s.quota) });
  const auto = h('input', { type: 'checkbox', checked: s.autostart });
  const armed = h('input', { type: 'checkbox', checked: !!s.lockArmed });
  const newCode = h('input', { type: 'password', placeholder: 'Laisser vide pour garder le code', autocomplete: 'new-password' });
  const msg = h('p', { class: 'small', style: { minHeight: '20px' } });
  const save = h('button', { class: 'btn primary' }, 'Enregistrer');
  save.addEventListener('click', async () => {
    const [hh, mm] = time.value.split(':').map(Number);
    const patch = { lockHour: hh, lockMinute: mm, dailyQuota: Number(quota.value), autostart: auto.checked, lockArmed: armed.checked };
    if (newCode.value) patch.newCode = newCode.value;
    const r = await ctx.api.updateSettings(code.value, patch);
    msg.style.color = r.ok ? 'var(--ok)' : 'var(--bad)';
    msg.textContent = r.ok ? 'Enregistré.' : r.error;
    if (r.ok && r.autostart && r.autostart.ok === false) msg.textContent += ` Démarrage automatique : ${r.autostart.error}`;
    if (r.ok) { code.value = ''; newCode.value = ''; ctx.refresh(); }
  });
  const rulesCard = h('div', { class: 'card' },
    h('h2', {}, 'Verrou et quota'),
    h('p', { class: 'small muted' }, 'Ces réglages demandent ton code, pour que le verrou garde son sens.'),
    h('div', { class: 'grid c2' },
      h('label', { class: 'field' }, h('span', {}, 'Heure du verrou'), time),
      h('label', { class: 'field' }, h('span', {}, 'Quota par jour'), quota)),
    h('label', { class: 'row', style: { marginBottom: '8px' } }, armed, h('span', {}, 'Activer le verrou (décoché : le verrou reste en pause)')),
    h('label', { class: 'row', style: { marginBottom: '14px' } }, auto, h('span', {}, 'Démarrage automatique et relance toutes les 5 minutes')),
    h('label', { class: 'field' }, h('span', {}, 'Nouveau code (facultatif)'), newCode),
    h('label', { class: 'field' }, h('span', {}, 'Code actuel'), code),
    msg, save);

  // ---- Synchronisation Google Drive (PC) ----
  const st = s.storage;
  const dataCard = h('div', { class: 'card' },
    h('h2', {}, 'Synchronisation entre PC'),
    st.driveDir
      ? h('p', {}, 'Google Drive trouvé : ', h('b', {}, st.driveDir), '. Tes points y sont copiés et fusionnés avec ceux de tes autres PC.')
      : h('p', {}, 'Google Drive introuvable pour l\'instant : la progression reste sur ce PC et sera copiée dès que le Drive sera monté.'),
    h('p', { class: 'small muted' }, `Ce PC : ${st.deviceId} · autres PC vus : ${st.otherDevices}`),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => ctx.api.hide() }, 'Masquer la fenêtre (TEAch Time reste dans la zone de notification)')));

  // ---- Statut Discord (PC) ----
  const dOn = h('input', { type: 'checkbox', checked: s.discord !== false });
  const dLine = h('p', { class: 'small muted' });
  const drawDiscord = async () => {
    const d = await ctx.api.discordStatus();
    dLine.textContent = !d.configured ? 'Identifiant de l\'application Discord absent du fichier .env (TEACHTIME_DISCORD_APP_ID).'
      : !d.enabled ? 'Désactivé : Discord n\'affiche rien.'
        : d.connected ? 'Connecté à Discord : ton statut est visible par tes amis.'
          : 'En attente de Discord : ouvre l\'appli Discord sur ce PC, le statut apparaît tout seul.';
  };
  dOn.addEventListener('change', async () => { await ctx.api.setDiscord(dOn.checked); setTimeout(drawDiscord, 600); });
  drawDiscord();
  const discordCard = h('div', { class: 'card' },
    h('h2', {}, 'Statut Discord'),
    h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Quand la fenêtre est ouverte, Discord montre « Joue à TEAch Time », ce que tu fais (le titre du cours, par exemple) et tes points du jour.'),
    h('label', { class: 'row', style: { marginBottom: '8px' } }, dOn, h('span', {}, 'Montrer mon activité sur Discord')),
    dLine);

  clear(root).append(
    h('h1', {}, 'Réglages'),
    h('p', { class: 'sub' }, 'Voix, micro, verrou et synchronisation.'),
    h('div', { class: 'grid c2' }, voiceCard, micCard),
    h('div', { class: 'grid c2', style: { marginTop: '16px' } }, rulesCard, accountCard),
    h('div', { class: 'grid c2', style: { marginTop: '16px' } }, dataCard, discordCard));
}
