require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json({ limit: '200kb' }));

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// helpers
function extractSheetId(url) {
  const m = url && url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

function authenticateToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  const token = auth.split(' ')[1];
  try {
    const data = jwt.verify(token, process.env.JWT_SECRET);
    req.user = data; // { id, username }
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// REGISTER
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, sheetUrl, webAppUrl, webAppSecret } = req.body;
    if (!username || !password || !webAppUrl || !webAppSecret) {
      return res.status(400).json({ error: 'missing fields (username,password,webAppUrl,webAppSecret)' });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO teachers (username, password_hash, sheet_url, webapp_url, webapp_secret) VALUES (?, ?, ?, ?, ?)',
      [username, password_hash, sheetUrl || null, webAppUrl, webAppSecret]
    );
    return res.json({ ok: true, id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'username taken' });
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

// LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM teachers WHERE username = ?', [username]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'invalid credentials' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, webAppUrl: user.webapp_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// VERIFY WEBAPP: test call to teacher webapp URL (optional)
app.post('/api/verify-webapp', authenticateToken, async (req, res) => {
  try {
    const { webAppUrl, webAppSecret } = req.body;
    if (!webAppUrl || !webAppSecret) return res.status(400).json({ error: 'missing fields' });

    // try a lightweight test post
    const testPayload = { secret: webAppSecret, test: true };
    const r = await fetch(webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
      timeout: 10000
    });
    const data = await r.json();
    if (r.ok) return res.json({ ok: true, data });
    return res.status(400).json({ ok: false, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'verify failed', detail: String(err) });
  }
});

// ATTENDANCE: receive from frontend; post to teacher webapp
// ---------- REPLACE YOUR /api/attendance HANDLER WITH THIS DEBUG VERSION ----------
app.post('/api/attendance', authenticateToken, async (req, res) => {
  try {
    console.log('=== /api/attendance called ===');
    console.log('User from token:', req.user && req.user.id ? req.user : '(no user in token)');

    // Log incoming request body (trim large objects if needed)
    console.log('Request body keys:', Object.keys(req.body));
    // Print some sample of the body
    const preview = {
      subject: req.body.subject,
      date: req.body.date,
      regular: req.body.regular,
      extra: req.body.extra,
      presentMatrixLen: Array.isArray(req.body.presentMatrix) ? req.body.presentMatrix.length : null
    };
    console.log('Payload preview:', preview);

    const userId = req.user && req.user.id;
    if (!userId) {
      console.error('No user id in token');
      return res.status(401).json({ error: 'unauthenticated' });
    }

    // fetch teacher info from DB
    const [rows] = await pool.query('SELECT webapp_url, webapp_secret FROM teachers WHERE id = ?', [userId]);
    const teacher = rows[0];
    console.log('DB teacher row:', teacher);

    if (!teacher || !teacher.webapp_url || !teacher.webapp_secret) {
      console.error('Teacher missing webapp config');
      return res.status(400).json({ error: 'teacher has no webapp configured' });
    }

    // normalize presentMatrix to 100 '0'/'1' strings
    let matrix = [];
    if (Array.isArray(req.body.presentMatrix) && req.body.presentMatrix.length >= 100) {
      matrix = req.body.presentMatrix.slice(0, 100).map(v => (v === true || v === 1 || v === '1') ? '1' : '0');
    } else {
      // fallback: create all zeros
      matrix = Array.from({length:100}, () => '0');
    }

    const payload = {
      secret: teacher.webapp_secret,
      subject: req.body.subject || '',
      date: req.body.date || '',
      regular: req.body.regular ? 1 : 0,
      extra: req.body.extra ? 1 : 0,
      presentMatrix: matrix
    };

    console.log('Posting to teacher webapp URL:', teacher.webapp_url);
    // POST with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(teacher.webapp_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    }).catch(err => {
      // fetch may throw on abort or network error
      console.error('Fetch to teacher webapp threw:', String(err));
      throw err;
    }).finally(() => { clearTimeout(timeout); });

    // read response text (not only json) for better debugging
    const respText = await response.text().catch(err => {
      console.error('Failed to read response text:', String(err));
      return null;
    });

    console.log('Teacher webapp responded status:', response.status);
    console.log('Teacher webapp response body (first 2000 chars):', (respText || '').slice(0, 2000));

    if (!response.ok) {
      // return full info to frontend (but not sensitive secrets)
      console.error('Teacher webapp returned non-OK status');
      return res.status(500).json({ error: 'teacher webapp error', status: response.status, detail: respText });
    }

    console.log('/api/attendance succeeded');
    return res.json({ ok: true, webappResult: respText || 'OK' });
  } catch (err) {
    console.error('ATTENDANCE HANDLER ERROR:', err && err.stack ? err.stack : String(err));
    return res.status(500).json({ error: 'server error', detail: String(err) });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log('Server listening on', port));
