// ─── CodeArena v3 — server/index.js ──────────────────────────────────────────
const express       = require('express');
const cors          = require('cors');
const path          = require('path');
const fs            = require('fs');
const bcrypt        = require('bcryptjs');
const jwt           = require('jsonwebtoken');
const { v4: uuid }  = require('uuid');

const app         = express();
const PORT        = process.env.PORT || 3000;
const JWT_SECRET  = process.env.JWT_SECRET || 'codearena-jwt-secret-2025';
const SALT_ROUNDS = 10;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// ─── DB helpers ───────────────────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, 'data/db.json');

function read() {
  const raw  = fs.readFileSync(DB_PATH, 'utf-8');
  const data = JSON.parse(raw);
  if (!data.users)    data.users    = [];
  if (!data.sessions) data.sessions = {};
  return data;
}
function write(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }

// ─── Middleware ───────────────────────────────────────────────────────────────
function sanitize(s) {
  if (typeof s !== 'string') return s;
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}
function isEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ success:false, message:'Unauthorized' });
  try {
    req.user = jwt.verify(h.split(' ')[1], JWT_SECRET);
    // mark session active
    const data = read();
    if (data.sessions[req.user.id]) {
      data.sessions[req.user.id].lastSeen = Date.now();
      write(data);
    }
    next();
  } catch { res.status(401).json({ success:false, message:'Invalid token' }); }
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  res.status(403).json({ success:false, message:'Admin only' });
}
