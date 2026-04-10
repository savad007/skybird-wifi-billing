// Minimal Omada OC200 proxy server (run on a PC/RPi on same network)
// Why: GitHub Pages/Vercel frontend cannot directly call OC200 reliably (CORS + private LAN IP + self-signed HTTPS)
//
// Usage:
//   1) Install Node.js 18+
//   2) npm i express
//   3) Set env vars then run: node omada-proxy-server.js
//
// Env:
//   OMADA_URL=https://192.168.1.4:443   (or :8043 depending on your controller)
//   OMADA_USERNAME=Savad007
//   OMADA_PASSWORD=Aifa@1601
//   PORT=8787
//
// Then in your omada-sync.html settings, set Omada Controller URL to:
//   http://YOUR-PC-IP:8787

const express = require('express');
const https = require('https');

const app = express();
app.use(express.json());

// Allow your GitHub Pages domain to call this proxy
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

const OMADA_URL = process.env.OMADA_URL;
const OMADA_USERNAME = process.env.OMADA_USERNAME;
const OMADA_PASSWORD = process.env.OMADA_PASSWORD;
const PORT = parseInt(process.env.PORT || '8787', 10);

if (!OMADA_URL || !OMADA_USERNAME || !OMADA_PASSWORD) {
  console.error('Missing env vars: OMADA_URL, OMADA_USERNAME, OMADA_PASSWORD');
}

const insecureHttpsAgent = new https.Agent({ rejectUnauthorized: false });

async function omadaFetch(url, options = {}) {
  const r = await fetch(url, {
    ...options,
    // for self-signed controller certs
    agent: url.startsWith('https://') ? insecureHttpsAgent : undefined,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!r.ok) {
    const err = new Error(`HTTP ${r.status}`);
    err.status = r.status;
    err.body = json;
    throw err;
  }
  return json;
}

function parseSetCookie(setCookieArr) {
  if (!setCookieArr) return '';
  // Take only cookie pairs
  return setCookieArr.map(v => v.split(';')[0]).join('; ');
}

async function loginAndGetContext() {
  // 1) get omadacId
  const info = await omadaFetch(`${OMADA_URL}/api/info`, { method: 'GET' });
  const omadacId = info?.result?.omadacId;
  if (!omadacId) throw new Error('Cannot read omadacId from /api/info');

  // 2) login (need cookies + csrf token)
  const loginUrl = `${OMADA_URL}/${omadacId}/api/v2/login`;

  const loginRes = await fetch(loginUrl, {
    method: 'POST',
    agent: OMADA_URL.startsWith('https://') ? insecureHttpsAgent : undefined,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: OMADA_USERNAME, password: OMADA_PASSWORD }),
  });

  const setCookie = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : loginRes.headers.raw?.()['set-cookie'];
  const cookieHeader = parseSetCookie(setCookie || []);

  const loginText = await loginRes.text();
  const loginJson = JSON.parse(loginText);
  const token = loginJson?.result?.token;

  if (!token) {
    throw new Error(`Login failed: ${loginJson?.msg || 'no token'}`);
  }

  return { omadacId, token, cookieHeader };
}

async function apiGet(path, query = '') {
  const { omadacId, token, cookieHeader } = await loginAndGetContext();
  const url = `${OMADA_URL}/${omadacId}/api/v2/${path}${query}${query.includes('?') ? '&' : '?'}token=${token}`;

  const r = await fetch(url, {
    method: 'GET',
    agent: OMADA_URL.startsWith('https://') ? insecureHttpsAgent : undefined,
    headers: {
      'Content-Type': 'application/json',
      'Csrf-Token': token,
      'Cookie': cookieHeader,
    },
  });

  const text = await r.text();
  const json = JSON.parse(text);
  if (!r.ok || json.errorCode !== 0) {
    throw new Error(json.msg || `Omada API error (${r.status})`);
  }
  return json.result;
}

// --- Endpoints used by omada-sync.html ---
app.get('/api/sites', async (req, res) => {
  try {
    const result = await apiGet('sites', '?currentPage=1&currentPageSize=1000');
    res.json({ data: result?.data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// NOTE: the exact Omada endpoints for hotspot vouchers/sessions can differ by controller version/config.
// These are common patterns; adjust if your controller returns "Invalid request parameters".
app.get('/api/hotspot/vouchers', async (req, res) => {
  try {
    const siteId = req.query.siteId;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });

    // Many controllers expose voucher list under portal/voucher APIs.
    // If this endpoint doesn't work, tell me your controller version and I will adjust.
    const result = await apiGet(`sites/${siteId}/hotspot/vouchers`, '?currentPage=1&currentPageSize=1000');
    res.json({ data: result?.data || result || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/clients', async (req, res) => {
  try {
    const siteId = req.query.siteId;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const result = await apiGet(`sites/${siteId}/clients`, '?currentPage=1&currentPageSize=1000');
    res.json({ data: result?.data || result || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/hotspot/sessions', async (req, res) => {
  try {
    const siteId = req.query.siteId;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const result = await apiGet(`sites/${siteId}/hotspot/sessions`, '?currentPage=1&currentPageSize=1000');
    res.json({ data: result?.data || result || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Omada proxy running on http://0.0.0.0:${PORT}`);
});
