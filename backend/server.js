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

/* ================= DB POOL ================= */
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

/* ================= AUTH MIDDLEWARE ================= */
function authenticateToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });

  try {
    const token = auth.split(' ')[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/* ================= REGISTER ================= */
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, sheetUrl, webAppUrl, webAppSecret } = req.body;

    if (!username || !password || !webAppUrl || !webAppSecret) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const hash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO teachers
       (username, password_hash, sheet_url, webapp_url, webapp_secret, role)
       VALUES (?, ?, ?, ?, ?, 'teacher')`,
      [username, hash, sheetUrl || null, webAppUrl, webAppSecret]
    );

    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'Username already exists' });

    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ================= LOGIN ================= */
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const [rows] = await pool.query(
      'SELECT id, username, password_hash, role FROM teachers WHERE username=?',
      [username]
    );

    if (!rows.length)
      return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok)
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ================= CHANGE PASSWORD ================= */
app.post('/api/change-password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword)
      return res.status(400).json({ error: 'Both passwords required' });

    const [rows] = await pool.query(
      'SELECT password_hash FROM teachers WHERE id=?',
      [req.user.id]
    );

    if (!rows.length)
      return res.status(404).json({ error: 'User not found' });

    const match = await bcrypt.compare(oldPassword, rows[0].password_hash);
    if (!match)
      return res.status(401).json({ error: 'Old password incorrect' });

    const newHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE teachers SET password_hash=? WHERE id=?',
      [newHash, req.user.id]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ================= VERIFY WEBAPP ================= */
app.post('/api/verify-webapp', authenticateToken, async (req, res) => {
  try {
    const { webAppUrl, webAppSecret } = req.body;
    if (!webAppUrl || !webAppSecret)
      return res.status(400).json({ error: 'Missing fields' });

    const r = await fetch(webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: webAppSecret, test: true })
    });

    const text = await r.text();
    if (!r.ok)
      return res.status(400).json({ error: text });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verify failed' });
  }
});

/* ================= ATTENDANCE ================= */
const MAX_ROLL = 80;

app.post('/api/attendance', authenticateToken, async (req, res) => {
  try {
    const { subject, date, regular, extra, presentMatrix } = req.body;

    if (!Array.isArray(presentMatrix))
      return res.status(400).json({ error: 'Invalid matrix' });

    // 🔥 STRICT NORMALIZATION (FIXES EXCEL ISSUE)
    let matrix = presentMatrix
      .slice(0, MAX_ROLL)
      .map(v => (v === true || v === 1 || v === "1" ? "1" : "0"));

    while (matrix.length < MAX_ROLL) matrix.push("0");

    const [rows] = await pool.query(
      'SELECT webapp_url, webapp_secret FROM teachers WHERE id=?',
      [req.user.id]
    );

    if (!rows.length)
      return res.status(400).json({ error: 'Teacher not found' });

    const payload = {
      secret: rows[0].webapp_secret,
      subject,
      date,
      regular: regular ? 1 : 0,
      extra: extra ? 1 : 0,
      presentMatrix: matrix
    };

    const r = await fetch(rows[0].webapp_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const text = await r.text();
    if (!r.ok)
      return res.status(500).json({ error: 'WebApp error', detail: text });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ================= START SERVER ================= */
const port = process.env.PORT || 4000;
app.listen(port, () => console.log('Server running on port', port));
