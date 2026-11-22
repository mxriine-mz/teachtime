// Synchronisation en ligne de TEAch Time (Supabase : base Postgres + connexion par e-mail).
// Un seul fichier pour l'app du PC (require) et la version web (balise <script>).
// Données : les mêmes que sur le PC.
//  - événements (points gagnés) : ajoutés, jamais modifiés, fusionnés par identifiant ;
//  - objets (textes, listes, réglages partagés) : le plus récent gagne.
// Chaque compte ne voit que ses propres lignes (règles de sécurité de supabase/schema.sql).
(function (root) {
  const OVERLAP = 10000; // on relit 10 s en arrière pour ne rien rater entre deux écritures

  function create({ url, key, storage, fetch: f = (typeof fetch !== 'undefined' ? fetch.bind(root) : null) }) {
    if (!url || !key) throw new Error('adresse ou clé manquante');
    if (!f) throw new Error('fetch indisponible');
    const base = String(url).trim().replace(/\/+$/, '');
    let session = storage.get('session') || null;

    const headers = (withUser = true) => {
      const out = { apikey: key, 'Content-Type': 'application/json' };
      if (withUser && session) out.Authorization = `Bearer ${session.access_token}`;
      return out;
    };

    async function readJson(r) {
      const txt = await r.text();
      try { return txt ? JSON.parse(txt) : null; } catch { return txt; }
    }

    function errorOf(j, status) {
      const msg = j && (j.error_description || j.msg || j.message || j.error);
      if (/invalid login|invalid_grant|invalid credentials/i.test(String(msg))) return new Error('E-mail ou mot de passe incorrect.');
      if (/email not confirmed/i.test(String(msg))) return new Error('Adresse e-mail pas encore confirmée.');
      return new Error(msg ? String(msg) : `Erreur ${status}`);
    }

    async function auth(path, body) {
      const r = await f(`${base}/auth/v1/${path}`, { method: 'POST', headers: headers(false), body: JSON.stringify(body) });
      const j = await readJson(r);
      if (!r.ok) throw errorOf(j, r.status);
      return j;
    }

    function keep(j) {
      session = {
        access_token: j.access_token,
        refresh_token: j.refresh_token,
        expires_at: Date.now() + (j.expires_in || 3600) * 1000,
        user: { id: j.user && j.user.id, email: j.user && j.user.email },
      };
      storage.set('session', session);
    }

    async function signIn(email, password) {
      keep(await auth('token?grant_type=password', { email: String(email).trim(), password: String(password) }));
      return session.user;
    }

    function signOut() {
      session = null;
      storage.set('session', null);
      storage.set('cursor', null);
      storage.set('cache', null);
    }

    async function ensure() {
      if (!session) throw new Error('Pas connectée.');
      if (Date.now() > session.expires_at - 60000) {
        try { keep(await auth('token?grant_type=refresh_token', { refresh_token: session.refresh_token })); } catch (e) {
          signOut();
          throw new Error('Session expirée : reconnecte-toi.');
        }
      }
    }

    async function rest(method, path, body, extra = {}) {
      await ensure();
      const r = await f(`${base}/rest/v1/${path}`, { method, headers: { ...headers(), ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
      const j = await readJson(r);
      if (!r.ok) throw errorOf(j, r.status);
      return j;
    }

    function cache() {
      return storage.get('cache') || { events: [], items: {} };
    }

    // Envoie ce qui est nouveau sur cet appareil, puis récupère ce qui est nouveau en ligne.
    // own : { events: [...], items: { key: { v, u, deleted } } }. Renvoie le contenu en ligne (cache local).
    async function sync(own) {
      const cur = storage.get('cursor') || { pushT: 0, pushU: 0, ev: 0, it: 0 };
      const data = cache();

      const newEv = (own.events || []).filter((e) => e.t > cur.pushT);
      for (let i = 0; i < newEv.length; i += 500) {
        const rows = newEv.slice(i, i + 500).map((e) => ({ id: e.id, dev: e.dev || null, t: e.t, day: e.day, kind: e.kind, pts: e.pts || 0, ref: e.ref || null }));
        await rest('POST', 'tt_events?on_conflict=id', rows, { Prefer: 'resolution=ignore-duplicates,return=minimal' });
      }
      if (newEv.length) cur.pushT = Math.max(cur.pushT, ...newEv.map((e) => e.t));

      const newIt = Object.entries(own.items || {}).filter(([, it]) => it && it.u > cur.pushU);
      for (let i = 0; i < newIt.length; i += 200) {
        const rows = newIt.slice(i, i + 200).map(([k, it]) => ({ key: k, v: it.deleted ? null : it.v, u: it.u, deleted: !!it.deleted }));
        await rest('POST', 'rpc/tt_put_items', { rows });
      }
      if (newIt.length) cur.pushU = Math.max(cur.pushU, ...newIt.map(([, it]) => it.u));

      // Événements : par date d'arrivée sur le serveur.
      const seen = new Set(data.events.map((e) => e.id));
      for (;;) {
        const rows = await rest('GET', `tt_events?select=id,dev,t,day,kind,pts,ref,srv&srv=gt.${Math.max(0, cur.ev - OVERLAP)}&order=srv.asc&limit=1000`);
        let fresh = 0;
        for (const e of rows || []) {
          if (!seen.has(e.id)) { seen.add(e.id); data.events.push({ id: e.id, dev: e.dev, t: Number(e.t), day: e.day, kind: e.kind, pts: e.pts, ref: e.ref }); fresh++; }
          cur.ev = Math.max(cur.ev, Number(e.srv));
        }
        if (!rows || rows.length < 1000 || !fresh) break;
      }

      for (;;) {
        const rows = await rest('GET', `tt_items?select=key,v,u,deleted,srv&srv=gt.${Math.max(0, cur.it - OVERLAP)}&order=srv.asc&limit=1000`);
        let fresh = 0;
        for (const it of rows || []) {
          const old = data.items[it.key];
          if (!old || Number(it.u) > old.u) { data.items[it.key] = { v: it.v, u: Number(it.u), deleted: !!it.deleted }; fresh++; }
          cur.it = Math.max(cur.it, Number(it.srv));
        }
        if (!rows || rows.length < 1000 || !fresh) break;
      }

      storage.set('cache', data);
      storage.set('cursor', cur);
      return data;
    }

    return {
      signIn,
      signOut,
      sync,
      cache,
      user: () => (session ? session.user : null),
      url: base,
    };
  }

  // Lien d'installation : l'adresse et la clé publique de la base, dans la partie « # » de l'URL
  // (jamais envoyée au serveur de la page). Rien n'est écrit dans le code.
  function encodeLink(cfg) {
    const raw = JSON.stringify({ url: cfg.url, key: cfg.key });
    const b64 = typeof btoa !== 'undefined' ? btoa(unescape(encodeURIComponent(raw))) : Buffer.from(raw, 'utf8').toString('base64');
    return `cloud=${b64.replace(/=+$/, '')}`;
  }

  function decodeLink(hash) {
    const m = String(hash || '').match(/cloud=([A-Za-z0-9+/_-]+)/);
    if (!m) return null;
    try {
      const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
      const raw = typeof atob !== 'undefined' ? decodeURIComponent(escape(atob(b64))) : Buffer.from(b64, 'base64').toString('utf8');
      const j = JSON.parse(raw);
      return j && j.url && j.key ? { url: j.url, key: j.key } : null;
    } catch { return null; }
  }

  const api = { create, encodeLink, decodeLink };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TTCloud = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
