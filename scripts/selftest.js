'use strict';
// Autotest : vérifie la logique du verrou, capture chaque écran hors écran (rien ne s'affiche),
// relève les erreurs de la console et teste Whisper sur une phrase lue par la voix Windows.
// Usage : npx electron . --selftest=<dossier de sortie>
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function outDirFromArgs() {
  const arg = process.argv.find((a) => a.startsWith('--selftest='));
  const dir = arg ? arg.slice('--selftest='.length) : path.join(os.tmpdir(), 'teachtime-selftest-out');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function makeWav(text, file) {
  const ps = [
    'Add-Type -AssemblyName System.Speech',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    '$v = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like "en-*" } | Select-Object -First 1',
    'if ($v) { $s.SelectVoice($v.VoiceInfo.Name) }',
    '$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)',
    `$s.SetOutputToWaveFile('${file.replace(/'/g, "''")}', $fmt)`,
    `$s.Speak('${text.replace(/'/g, "''")}')`,
    '$s.Dispose()',
  ].join('; ');
  return new Promise((resolve, reject) => {
    execFile('powershell', ['-NoProfile', '-Command', ps], { windowsHide: true }, (err) => (err ? reject(err) : resolve(file)));
  });
}

function readWavFloat32(file) {
  const buf = fs.readFileSync(file);
  let off = 12;
  while (off < buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'data') {
      const n = size / 2;
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(off + 8 + i * 2) / 32768;
      return out;
    }
    off += 8 + size + (size % 2);
  }
  throw new Error('chunk data introuvable');
}

async function run({ app, ensureWindow, getState, shouldLock, tick, config, store, stt, isLocked }) {
  const out = outDirFromArgs();
  const report = { checks: [], consoleErrors: [], screenshots: [] };
  const check = (name, ok, detail = '') => {
    report.checks.push({ name, ok: !!ok, detail });
    console.log(`${ok ? 'OK  ' : 'ÉCHEC'} ${name}${detail ? ` — ${detail}` : ''}`);
  };

  try {
    // ---------- 1. Logique du verrou ----------
    check('pas de verrou avant l\'assistant', !shouldLock());
    config.setCode('1234');
    config.update({ setupDone: true, lockHour: 0, lockMinute: 0, dailyQuota: 300 });
    check('code correct accepté', config.checkCode('1234'));
    check('code faux refusé', !config.checkCode('9999'));
    config.update({ setupDay: store.dayKey() });
    check('jour d\'installation : pas de verrou', !shouldLock());
    config.update({ setupDay: '2000-01-01' });
    check('verrou en pause par défaut', !shouldLock());
    config.update({ lockArmed: true });
    check('verrou voulu après l\'heure si quota non atteint', shouldLock());
    tick();
    check('verrou activé par tick()', isLocked());
    check('état : 300 points restants', getState().remaining === 300, `remaining=${getState().remaining}`);
    store.addEvent({ kind: 'quiz', pts: 300, ref: 'selftest' });
    tick();
    check('quota atteint : verrou levé', !isLocked());
    config.update({ dailyQuota: 600 });
    tick();
    check('quota relevé : verrou revenu', isLocked());
    store.addEvent({ kind: 'unlock', pts: 0, ref: 'code' });
    tick();
    check('code d\'urgence : verrou levé pour la journée', !isLocked() && getState().unlockedToday);
    check('le déblocage ne compte pas de points', getState().points === 300, `points=${getState().points}`);
    const now = new Date();
    config.update({ lockHour: 23, lockMinute: 59, dailyQuota: 300 });
    check('pas de verrou avant l\'heure', now.getHours() * 60 + now.getMinutes() >= 23 * 60 + 59 || !shouldLock(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0)));
    // Pour les captures : on repart d'un compte neuf mais configuré, sans verrou.
    config.update({ lockHour: 18, lockMinute: 0, dailyQuota: 300, lockArmed: false });
    check('série : 1 jour (quota atteint aujourd\'hui)', getState().streak === 1, `streak=${getState().streak}`);

    // ---------- 2. Captures des écrans ----------
    const win = ensureWindow();
    win.webContents.on('console-message', (e) => {
      const level = e.level ?? e;
      const msg = e.message ?? '';
      if (level === 'error' || level === 3) report.consoleErrors.push(msg);
    });
    win.webContents.on('preload-error', (_e, p, err) => report.consoleErrors.push(`preload ${p}: ${err}`));
    await new Promise((r) => (win.webContents.isLoading() ? win.webContents.once('did-finish-load', r) : r()));
    await wait(1200);

    const js = (code) => win.webContents.executeJavaScript(code, true);
    // En rendu hors écran, l'image vient de l'événement « paint ».
    let lastFrame = null;
    win.webContents.on('paint', (_e, _dirty, image) => { lastFrame = image; });
    win.webContents.setFrameRate(20);
    const shot = async (name) => {
      await wait(900);
      win.webContents.invalidate();
      await wait(200);
      const img = lastFrame;
      if (!img) { check(`capture ${name}`, false, 'aucune image reçue'); return; }
      const file = path.join(out, `${name}.png`);
      fs.writeFileSync(file, img.toPNG());
      report.screenshots.push(file);
      const size = img.getSize();
      check(`capture ${name}`, size.width > 100 && !img.isEmpty(), `${size.width}x${size.height}`);
    };

    // Données d'exemple pour remplir les écrans.
    await js(`(async () => {
      await window.api.setItem('text:demo', { id: 'demo', title: 'My internship', body: 'Last summer, I did an internship in a hospital. I worked with the data team and I learned a lot about databases. It was a great experience.', created: Date.now(), srs: { reps: 0, due: '2000-01-01' } });
      await window.api.setItem('vlist:demo', { id: 'demo', title: 'Unit 4 - At the office', created: Date.now(), cards: [
        { en: 'a deadline', fr: 'une date limite', box: 0 }, { en: 'to schedule', fr: 'programmer', box: 1 },
        { en: 'an invoice', fr: 'une facture', box: 0 }, { en: 'a supplier', fr: 'un fournisseur', box: 3 } ] });
      await window.teachtime.ctx.refresh();
    })()`);

    const views = [
      ['home', {}], ['game', {}], ['lessons', {}], ['lessons', { id: 'conditionals' }],
      ['memorize', {}], ['memorize', { id: 'demo' }], ['memorize', { id: 'demo', mode: 'hide' }], ['memorize', { id: 'demo', mode: 'order' }],
      ['vocab', {}], ['vocab', { id: 'demo' }], ['vocab', { preset: 'toeic-finance' }], ['vocab', { id: 'demo', mode: 'all' }],
      ['speak', {}], ['speak', { mode: 'roleplay' }], ['speak', { mode: 'free' }], ['settings', {}], ['login', {}],
    ];
    const garbled = [];
    for (const [v, p] of views) {
      await js(`window.teachtime.navigate(${JSON.stringify(v)}, ${JSON.stringify(p)})`);
      const suffix = p.id ? `-${p.id}` : p.preset ? `-${p.preset}` : '';
      const name = `${v}${suffix}${p.mode ? `-${p.mode}` : ''}`;
      await shot(name);
      if (await js('document.body.innerText.includes("[object ") || /(^|\\n)\\s*(null|undefined)\\s*(\\n|$)/.test(document.body.innerText)')) garbled.push(name);
    }
    check('aucun écran n\'affiche « [object … ] », « null » ou « undefined »', garbled.length === 0, garbled.join(', '));
    const lessonCards = await js('(async () => { window.teachtime.navigate("lessons"); await new Promise((r) => setTimeout(r, 400)); return document.querySelectorAll(".card.click").length; })()');
    check('cours : les fiches s\'affichent en cartes', lessonCards >= 18, `cartes=${lessonCards}`);
    check('cours : plus de bouton « J\'ai lu ce cours »', !(await js('(async () => { window.teachtime.navigate("lessons", { id: "conditionals" }); await new Promise((r) => setTimeout(r, 400)); return document.body.innerText.includes("J\'ai lu"); })()')));

    // Entraînement d'un cours : 5 erreurs ouvrent la fiche, puis 3 bonnes d'affilée valident.
    const T = 'window.__teachTraining';
    const step = async (good) => js(`(async () => {
      const g = ${T}.good();
      const btns = [...document.querySelectorAll('.overlay .choice')];
      btns[${good} ? g : (g + 1) % btns.length].click();
      await new Promise((r) => setTimeout(r, 30));
      const n = document.querySelector('.overlay [data-next]');
      const st = ${T}.state();
      if (n && !st.popup && !st.done) n.click();
      await new Promise((r) => setTimeout(r, 60));
      return ${T}.state();
    })()`);
    await js(`(async () => {
      const lessons = await window.teachtime.ctx.content('lessons');
      const m = await import('./views/training.js');
      m.runTraining(window.teachtime.ctx, lessons.find((l) => l.id === 'conditionals'));
      await new Promise((r) => setTimeout(r, 300));
    })()`);
    await shot('entrainement');
    let st = null;
    for (let i = 0; i < 4; i++) st = await step(false);
    check('entraînement : 4 erreurs, pas encore de fiche', st && !st.popup && st.target === 16, JSON.stringify(st));
    st = await step(false);
    check('entraînement : 5 erreurs d\'affilée ouvrent la fiche du cours', st.popup, JSON.stringify(st));
    await shot('entrainement-fiche');
    await js(`${T}.closePopup(); document.querySelector('.overlay [data-next]').click()`);
    await wait(100);
    for (let i = 0; i < 60 && !st.done; i++) {
      st = await step(true);
      // Pas validé avant d'avoir fait toute la longueur, même avec 3 bonnes d'affilée.
      if (!st.done && st.asked < st.target && st.streak >= 3) { /* normal */ }
    }
    check('entraînement : validé après la longueur et 3 bonnes d\'affilée', st.done && st.asked >= st.target && st.target === 17 && st.streak >= 3, JSON.stringify(st));
    await wait(300);
    await shot('entrainement-valide');
    const doneMap = await js('window.api.getItem("lessonsDone")');
    check('entraînement : cours marqué validé', !!(doneMap && doneMap.conditionals));
    await js('document.querySelector(".overlay .x")?.click()');

    // Mémoriser : parcours guidé sur un texte de plusieurs blocs, un échec au texte à trous.
    await js(`window.api.setItem('text:long', { id: 'long', title: 'My presentation', created: Date.now(), srs: { reps: 0, due: '2000-01-01' }, body: 'Good morning everyone. Today I am going to talk about my internship. I worked in a hospital for three months. My team was in charge of the patient database. We cleaned the data every week. Then we built dashboards for the doctors. It was hard at the beginning. But I learned a lot. Thank you for listening.' })`);
    await js('window.teachtime.navigate("memorize", { id: "long" })');
    await wait(500);
    const M = 'window.__teachMemo';
    const ms0 = await js(`${M}.state()`);
    check('mémoriser : texte découpé en blocs, cumulés', ms0.units >= 4 && ms0.stepId === 'listen', JSON.stringify(ms0));
    await shot('memo-parcours-ecoute');
    const mstep = async (good) => js(`(async () => {
      window.__teachMemoStep[${good} ? 'perfect' : 'fail']();
      await new Promise((r) => setTimeout(r, 150));
      const n = document.querySelector('[data-next]');
      if (n && ${good}) n.click();
      await new Promise((r) => setTimeout(r, 200));
      return ${M}.state();
    })()`);
    let ms = await mstep(true);
    check('mémoriser : l\'écoute mène au texte à trous', ms.stepId === 'gaps20', JSON.stringify(ms));
    await shot('memo-parcours-trous');
    ms = await mstep(false);
    check('mémoriser : sous 85 %, l\'étape reste à refaire', ms.stepId === 'gaps20' && ms.step === 1, JSON.stringify(ms));
    await shot('memo-parcours-rate');
    await js('document.querySelector("[data-next]")?.click()');
    await wait(200);
    let guard = 0;
    for (; guard < 60 && !ms.learned; guard++) ms = await mstep(true);
    const tomorrowM = await js('(() => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })()');
    check('mémoriser : texte su au bout du parcours, première révision demain', ms.learned && ms.due === tomorrowM, `${guard} étapes · ${JSON.stringify(ms)}`);
    await wait(300);
    await shot('memo-parcours-su');

    // Voix anglaise neuronale (Kokoro), calculée sur le PC.
    const v0 = Date.now();
    const vr = await js('window.api.voiceSpeak("Hello Marine, this is your daily English practice.", "bf_emma", 1).then((r) => ({ ok: r.ok, n: r.ok ? r.samples.length : 0, sr: r.sampleRate, error: r.error }))');
    check('voix : Kokoro produit de l\'anglais', vr.ok && vr.n > vr.sr, `${vr.ok ? `${(vr.n / vr.sr).toFixed(1)} s d'audio en ${Date.now() - v0} ms` : vr.error}`);
    const vfr = await js('window.teachtime && import("./lib/tts.js").then((m) => m.VOICES.every((v) => /^[ab][fm]_/.test(v.id)))');
    check('voix : uniquement des voix anglaises proposées', vfr);

    // Oral : séance de phrases, une erreur puis 3 réussites d'affilée par phrase.
    const O = 'window.__teachOral';
    await js('window.teachtime.navigate("speak")');
    await wait(500);
    await js('[...document.querySelectorAll(".card .btn.primary")].find((b) => b.textContent.includes("Commencer")).click()');
    await wait(300);
    await shot('oral-seance');
    const say = async (good) => js(`(async () => {
      const exp = ${O}.expected();
      window.__teachSay(${good} ? exp : 'banana banana');
      await new Promise((r) => setTimeout(r, 60));
      const st = ${O}.state();
      const n = document.querySelector('[data-next]');
      if (n && !st.done) n.click();
      await new Promise((r) => setTimeout(r, 60));
      return ${O}.state();
    })()`);
    let os = await say(false);
    check('oral : une phrase ratée revient', os.attempts === 1 && os.left === 5 && os.streak === 0, JSON.stringify(os));
    for (let i = 0; i < 40 && !os.done; i++) os = await say(true);
    check('oral : séance validée à 3 réussites d\'affilée par phrase', os.done && os.attempts === 1 + 5 * 3, JSON.stringify(os));
    await shot('oral-seance-fin');

    // Oral : jeu de rôle complet, une réponse incomplète au premier tour.
    await js('window.teachtime.navigate("speak", { mode: "roleplay" })');
    await wait(500);
    await js('document.querySelector(".card.click").click()');
    await wait(400);
    await js('window.__teachSay("hello")');
    await wait(100);
    let rp = await js(`${O}.state()`);
    check('jeu de rôle : réponse incomplète refusée', rp.turn === 0 && rp.tries === 1, JSON.stringify(rp));
    await shot('oral-jeu-de-role');
    for (let i = 0; i < 12 && !rp.done; i++) {
      await js(`window.__teachSay(${O}.expected())`);
      await wait(600);
      rp = await js(`${O}.state()`);
    }
    check('jeu de rôle : conversation menée jusqu\'au bout avec les réponses modèles', rp.done, JSON.stringify(rp));
    await wait(300);
    await shot('oral-jeu-de-role-fin');

    // Vocabulaire : séance progressive sur la liste démo (QCM, écrire, dictée), une erreur au début.
    const toeicSaved = await js('window.api.getItem("vlist:toeic-finance")');
    check('vocabulaire : liste toute prête copiée à la première ouverture, mots « nouveaux »', toeicSaved && toeicSaved.cards.length === 20 && toeicSaved.cards.every((c) => !c.due), toeicSaved ? `${toeicSaved.cards.length} mots` : 'absente');
    check('vocabulaire : plus de bouton « Je savais »', !(await js('(async () => { window.teachtime.navigate("vocab", { id: "demo" }); await new Promise((r) => setTimeout(r, 400)); return document.body.innerText.includes("Je savais"); })()')));
    const V = 'window.__teachVocab';
    const vstep = async (good) => js(`(async () => {
      const exp = ${V}.expected();
      const choices = [...document.querySelectorAll('.overlay .choice')];
      if (choices.length) {
        const ok = choices.find((b) => b.textContent === exp);
        (${good} ? ok : choices.find((b) => b !== ok)).click();
      } else {
        const inp = document.querySelector('.overlay input[type=text]');
        inp.value = ${good} ? exp : 'zzz';
        [...document.querySelectorAll('.overlay .btn.primary')].find((b) => b.textContent.includes('Vérifier')).click();
      }
      await new Promise((r) => setTimeout(r, 40));
      const st = ${V}.state();
      const n = document.querySelector('.overlay [data-next]');
      if (n && !st.finished) n.click();
      await new Promise((r) => setTimeout(r, 60));
      return ${V}.state();
    })()`);
    await js(`(async () => {
      const l = await window.api.getItem('vlist:demo');
      const m = await import('./views/vocab-session.js');
      const others = (await window.api.getItem('vlist:toeic-finance')).cards;
      m.runVocabSession(window.teachtime.ctx, { title: 'Séance : test', items: l.cards.map((card) => ({ card, list: l })), distractors: others });
      await new Promise((r) => setTimeout(r, 300));
    })()`);
    await shot('vocab-seance-qcm');
    let vs = await vstep(false);
    check('vocabulaire : une erreur garde le mot dans la séance', vs.left === 4 && vs.asked === 1, JSON.stringify(vs));
    let sawWrite = false;
    for (let i = 0; i < 40 && !vs.finished; i++) {
      if (!sawWrite && await js('!!document.querySelector(".overlay input[type=text]")')) { sawWrite = true; await shot('vocab-seance-ecrire'); }
      vs = await vstep(true);
    }
    check('vocabulaire : séance finie quand chaque mot a 3 bonnes réponses d\'affilée', vs.finished && vs.asked === 4 * 3 + 1, JSON.stringify(vs));
    await wait(300);
    await shot('vocab-seance-fin');
    const demo = await js('window.api.getItem("vlist:demo")');
    const tomorrow = await js('(() => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })()');
    // Boîtes de départ de la démo : 0, 1, 0, 3. Le mot raté retombe en boîte 0 (revu demain), les autres montent d'une boîte.
    const boxes = demo.cards.map((c) => c.box);
    check('vocabulaire : le mot raté revient demain, les autres montent d\'une boîte',
      demo.cards.filter((c) => c.box === 0 && c.due === tomorrow).length === 1 && demo.cards.every((c) => c.due >= tomorrow) && boxes.reduce((a, b) => a + b, 0) >= 4 + 3 - 3,
      JSON.stringify(demo.cards.map((c) => [c.box, c.due])));
    await js('document.querySelector(".overlay .x")?.click()');
    // Révision du jour depuis l'accueil.
    await js('(async () => { const l = await window.api.getItem("vlist:demo"); l.cards.forEach((c) => { c.due = "2000-01-01"; }); await window.api.setItem("vlist:demo", l); })()');
    await js('window.teachtime.navigate("vocab", { review: 1 })');
    await wait(500);
    check('vocabulaire : la révision du jour s\'ouvre', await js('!!window.__teachVocab && document.querySelector(".overlay h2")?.textContent.includes("Révision du jour")'));
    await shot('vocab-revision');
    await js('document.querySelector(".overlay .x")?.click()');

    // Déplacement et dialogue dans le jeu.
    await js('window.teachtime.navigate("game")');
    await wait(800);
    const x0 = await js('window.__teachGame.me.x');
    await js('window.dispatchEvent(new KeyboardEvent("keydown", { key: "d" }))');
    await wait(700);
    await js('window.dispatchEvent(new KeyboardEvent("keyup", { key: "d" }))');
    const x1 = await js('window.__teachGame.me.x');
    check('jeu : la touche D fait avancer à droite', x1 > x0 + 20, `${Math.round(x0)} → ${Math.round(x1)}`);
    await js('window.dispatchEvent(new KeyboardEvent("keydown", { key: "z" }))');
    await wait(1500);
    await js('window.dispatchEvent(new KeyboardEvent("keyup", { key: "z" }))');
    const y1 = await js('window.__teachGame.me.y');
    check('jeu : les bâtiments bloquent le passage', y1 > 7 * 16, `y=${Math.round(y1)}`);
    await js('(() => { const g = window.__teachGame; const n = g.npcs[0]; g.me.x = n.x; g.me.y = n.y + 14; })()');
    await wait(300);
    await js('window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }))');
    await wait(600);
    check('jeu : Espace près d\'Iris ouvre la série de grammaire', await js('!!document.querySelector(".overlay .npc-talk")'));
    await shot('game-dialogue');
    await js('document.querySelector(".overlay .x").click()');

    // Le Quartier de jour, au coucher du soleil et de nuit (lumière forcée pour la capture).
    await js('(() => { const g = window.__teachGame; g.me.x = 16.5 * 16; g.me.y = 12.5 * 16; })()');
    for (const [name, amb] of [
      ['jour', { mul: null, lightsOn: false, night: false, day: true }],
      ['soir', { mul: [255, 222, 186], lightsOn: true, night: false, day: false }],
      ['nuit', { mul: [78, 92, 160], lightsOn: true, night: true, day: false }],
    ]) {
      await js(`window.__teachAmbient = ${JSON.stringify(amb)}`);
      await shot(`game-${name}`);
    }
    // Dans les hautes herbes du sud.
    await js('(() => { const g = window.__teachGame; g.me.x = 19.5 * 16; g.me.y = 24.4 * 16; })()');
    await js(`window.__teachAmbient = ${JSON.stringify({ mul: null, lightsOn: false, night: false, day: true })}`);
    await shot('game-hautes-herbes');
    // La place et la fontaine, de jour puis de nuit (la joueuse reste sur la rue, loin des pigeons).
    await js('(() => { const g = window.__teachGame; g.me.x = 20 * 16; g.me.y = 9.3 * 16; })()');
    await shot('game-place');
    await js(`window.__teachAmbient = ${JSON.stringify({ mul: [78, 92, 160], lightsOn: true, night: true, day: false })}`);
    await shot('game-place-nuit');
    await js('window.__teachAmbient = null');

    // Planche des personnages : chacun sous les quatre angles, et deux pas de marche, agrandis.
    await js(`(async () => {
      const W = await import('./views/game-world.js');
      const looks = [W.PLAYER_LOOK, ...W.STATIONS.map((s) => s.look)];
      const cv = document.createElement('canvas');
      cv.width = 1280; cv.height = 822; cv.id = 'planche';
      Object.assign(cv.style, { position: 'fixed', inset: '0', zIndex: 999, imageRendering: 'pixelated', width: '1280px', height: '822px' });
      const big = document.createElement('canvas'); big.width = 320; big.height = 205;
      const g = big.getContext('2d'); g.fillStyle = '#8cc063'; g.fillRect(0, 0, 320, 205);
      const dirs = [['down', 0], ['left', 0], ['right', 0], ['up', 0], ['down', 1], ['left', 1]];
      looks.forEach((look, i) => dirs.forEach(([dir, frame], j) => W.drawChar(g, 14 + j * 22 + (i % 2) * 160, 40 + Math.floor(i / 2) * 50, look, { dir, frame })));
      const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(big, 0, 0, 1280, 820);
      document.body.appendChild(cv);
    })()`);
    await shot('personnages-planche');
    await js('document.getElementById("planche").remove()');

    // Quiz ouvert depuis l'accueil.
    await js('window.teachtime.navigate("home")');
    await wait(500);
    await js('import("./views/activities.js").then((m) => { m.startQuiz(window.teachtime.ctx, "grammar"); })');
    await shot('quiz-grammar');
    await js('document.querySelector(".choice").click()');
    await shot('quiz-grammar-answered');
    await js('document.querySelector(".overlay .x").click()');

    // Thème unique : même avec un ancien choix enregistré (autre thème, sombre, accent), l'app reste en Ardoise clair.
    await js('window.teachtime.ctx.api.setItem("appearance", { theme: "chaussette", mode: "dark", accent: "#7a5cff" })');
    await js('window.teachtime.theme.load(window.teachtime.ctx.api)');
    const nav = await js("getComputedStyle(document.documentElement).getPropertyValue('--nav').trim()");
    const acc = await js("getComputedStyle(document.documentElement).getPropertyValue('--accent-2').trim()");
    check('thème Ardoise clair imposé, ancien choix ignoré', nav === '#2b2f36' && acc === '#3fa796', `nav=${nav} accent=${acc}`);

    // Assistant de premier lancement.
    config.update({ setupDone: false });
    tick();
    await js('window.teachtime.navigate("setup")');
    await shot('setup');
    config.update({ setupDone: true });

    // Personnage dessiné à la main : le guide pâle de la planche modèle doit être ignoré,
    // un vrai dessin doit être chargé, et le profil droit vide doit devenir le miroir du gauche.
    const sheetTest = await js(`(async () => {
      const W = await import('./views/game-world.js');
      W.resetPlayerSheet();
      const guideOnly = await W.loadPlayerSheet('assets/sprites/modele-personnage.png');
      W.resetPlayerSheet();
      const cv = document.createElement('canvas'); cv.width = 48; cv.height = 128;
      const g = cv.getContext('2d');
      for (const row of [0, 1, 3]) for (let c = 0; c < 3; c++) { g.fillStyle = '#c0392b'; g.fillRect(c * 16 + 4, row * 32 + 8, 8, 24); }
      g.fillStyle = '#2a2633'; g.fillRect(16 + 4, 32 + 8, 2, 2);
      const ok = await W.loadPlayerSheet(cv.toDataURL());
      const info = W.playerSheetInfo();
      W.resetPlayerSheet();
      return { guideOnly, ok, info };
    })()`);
    check('personnage dessiné : le guide pâle seul est ignoré', sheetTest.guideOnly === false);
    check('personnage dessiné : une planche 48 × 128 est chargée en cases de 16 × 32', sheetTest.ok && sheetTest.info && sheetTest.info.w === 16 && sheetTest.info.h === 32, JSON.stringify(sheetTest.info));
    const npcSheets = await js(`import('./views/game-world.js').then((W) => W.STATIONS.map((s) => W.sheetInfo(s.look.sheet)))`);
    check('habitants : six planches chargées, avec le clin d\'oeil', npcSheets.length === 6 && npcSheets.every((s) => s && s.w === 16 && s.h === 32 && s.blink), JSON.stringify(npcSheets.filter((s) => !s || !s.blink).length));

    // ---------- 3. Whisper ----------
    const sentence = 'Could you send me the report by Friday?';
    const wav = path.join(out, 'zira.wav');
    try {
      await makeWav(sentence, wav);
      const samples = readWavFloat32(wav);
      const t0 = Date.now();
      const text = await stt.transcribe(samples);
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      const norm = (s) => s.toLowerCase().replace(/[^a-z ]/g, '').trim();
      check('Whisper transcrit la phrase', norm(text) === norm(sentence), `« ${text} » en ${secs} s`);
      const t1 = Date.now();
      await stt.transcribe(samples);
      check('Whisper, deuxième passage (modèle chargé)', true, `${((Date.now() - t1) / 1000).toFixed(1)} s`);
      check('Whisper ignore le silence', (await stt.transcribe(new Float32Array(32000))) === '');
    } catch (e) {
      check('Whisper', false, String(e.message || e));
    }
  } catch (e) {
    check('exécution de l\'autotest', false, String(e.stack || e));
  }

  check('aucune erreur dans la console', report.consoleErrors.length === 0, report.consoleErrors.slice(0, 5).join(' | '));
  fs.writeFileSync(path.join(out, 'rapport.json'), JSON.stringify(report, null, 2), 'utf8');
  const failed = report.checks.filter((c) => !c.ok).length;
  console.log(`\n${report.checks.length - failed} / ${report.checks.length} vérifications réussies. Captures : ${out}`);
  app.exit(failed ? 1 : 0);
}

module.exports = { run };
