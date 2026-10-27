// Backend: statisches Frontend + Kulturpool-Proxy + serverseitige Speicherung von Likes & Boards.
const express = require('express');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPSTREAM = 'https://api.kulturpool.at/v2/';
const ALLOWED = /^(search|similar|similar\/image|object)$/;

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ---------- Proxy zur Kulturpool-API (kein CORS-Problem, kleiner Cache) ---------- */
const cache = new Map();
const TTL = 5 * 60 * 1000;

app.get('/api/kp/*', async (req, res) => {
  const sub = req.params[0].replace(/\/+$/, '');
  if (!ALLOWED.test(sub)) return res.status(404).json({ detail: 'Endpunkt nicht erlaubt' });
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const url = UPSTREAM + sub + qs;
  const cacheable = !qs.includes('_rand');              // Zufallssuche nie cachen
  const hit = cacheable && cache.get(url);
  if (hit && hit.t > Date.now()) return res.status(hit.status).type('json').send(hit.body);
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const body = await r.text();
    if (cacheable && r.ok) {
      if (cache.size > 500) cache.clear();
      cache.set(url, { t: Date.now() + TTL, status: r.status, body });
    }
    res.status(r.status).type('json').send(body);
  } catch (e) {
    res.status(502).json({ detail: 'Kulturpool-API nicht erreichbar: ' + e.message });
  }
});

/* ---------- Zustand (Likes + Boards) je anonymem Nutzer (Cookie) ---------- */
const STR = (v, n = 500) => (typeof v === 'string' ? v.slice(0, n) : undefined);
const URLOK = v => (typeof v === 'string' && /^https?:\/\//i.test(v) ? v.slice(0, 1000) : undefined);
const STRS = v => (Array.isArray(v) ? v.slice(0, 5).map(x => STR(x, 200)) : STR(v, 200));

function cleanItem(d) {
  if (!d || typeof d.uuid !== 'string') return null;
  return {
    uuid: STR(d.uuid, 64), title: STR(d.title), previewImage: URLOK(d.previewImage),
    dataProvider: STR(d.dataProvider), date: STRS(d.date), creator: STRS(d.creator),
    url: URLOK(d.url), isShownBy: URLOK(d.isShownBy),
    imageAspectRatio: Number.isFinite(d.imageAspectRatio) ? d.imageAspectRatio : undefined,
  };
}
const items = a => (Array.isArray(a) ? a.slice(0, 500).map(cleanItem).filter(Boolean) : []);
function cleanState(b = {}) {
  return {
    liked: items(b.liked),
    boards: (Array.isArray(b.boards) ? b.boards.slice(0, 100) : []).map(x => ({
      id: STR(x && x.id, 32) || crypto.randomBytes(4).toString('hex'),
      name: STR(x && x.name, 100) || 'Board',
      items: items(x && x.items),
    })),
  };
}

function uid(req, res) {
  const m = /(?:^|;\s*)uid=([a-f0-9]{32})/.exec(req.headers.cookie || '');
  if (m) return m[1];
  const id = crypto.randomBytes(16).toString('hex');
  res.setHeader('Set-Cookie', `uid=${id}; Max-Age=31536000; Path=/; HttpOnly; SameSite=Lax`);
  return id;
}
const fileOf = id => path.join(DATA_DIR, id + '.json');

app.get('/api/state', async (req, res) => {
  const id = uid(req, res);
  try { res.json(JSON.parse(await fs.readFile(fileOf(id), 'utf8'))); }
  catch { res.json({ liked: [], boards: [] }); }
});

app.put('/api/state', async (req, res) => {
  const id = uid(req, res);
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const f = fileOf(id);
    await fs.writeFile(f + '.tmp', JSON.stringify(cleanState(req.body)));
    await fs.rename(f + '.tmp', f);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

app.listen(PORT, () => console.log(`Kulturpool Entdecker läuft auf http://localhost:${PORT}`));
