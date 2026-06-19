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
// ═══ AUTH ════════════════════════════════════════════════════════════════════

// POST /api/register
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, securityQuestion, securityAnswer } = req.body;
    if (!name?.trim())           return res.status(400).json({ success:false, message:'Name is required' });
    if (!email || !isEmail(email)) return res.status(400).json({ success:false, message:'Valid email required' });
    if (!password || password.length < 6) return res.status(400).json({ success:false, message:'Password must be 6+ chars' });
    if (!securityQuestion?.trim()) return res.status(400).json({ success:false, message:'Security question required' });
    if (!securityAnswer?.trim())   return res.status(400).json({ success:false, message:'Security answer required' });

    const data = read();
    const lo   = email.toLowerCase().trim();
    if (data.users.some(u => u.email === lo))
      return res.status(409).json({ success:false, message:'Email already registered' });

    const hash   = await bcrypt.hash(password, SALT_ROUNDS);
    const aHash  = await bcrypt.hash(securityAnswer.trim().toLowerCase(), SALT_ROUNDS);
    const isFirst = data.users.length === 0;
    const user = {
      id: Date.now(), name: sanitize(name.trim()), email: lo,
      password: hash, securityQuestion: sanitize(securityQuestion.trim()),
      securityAnswer: aHash,
      role: isFirst ? 'admin' : 'member',
      createdAt: new Date().toISOString()
    };
    data.users.push(user);
    write(data);

    const token = jwt.sign({ id:user.id, name:user.name, email:user.email, role:user.role }, JWT_SECRET, { expiresIn:'7d' });
    // mark online
    const data2 = read();
    data2.sessions[user.id] = { userId:user.id, name:user.name, lastSeen:Date.now() };
    write(data2);

    res.status(201).json({ success:true, token, user:{ id:user.id, name:user.name, email:user.email, role:user.role, createdAt:user.createdAt } });
  } catch(e) { console.error(e); res.status(500).json({ success:false, message:'Registration failed' }); }
});
// POST /api/login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success:false, message:'Email and password required' });
    const data = read();
    const user = data.users.find(u => u.email === email.toLowerCase().trim());
    if (!user) return res.status(401).json({ success:false, message:'No account with this email' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ success:false, message:'Incorrect password' });

    const token = jwt.sign({ id:user.id, name:user.name, email:user.email, role:user.role }, JWT_SECRET, { expiresIn:'7d' });
    // mark online
    data.sessions[user.id] = { userId:user.id, name:user.name, lastSeen:Date.now() };
    write(data);

    res.json({ success:true, token, user:{ id:user.id, name:user.name, email:user.email, role:user.role, createdAt:user.createdAt } });
  } catch(e) { res.status(500).json({ success:false, message:'Login failed' }); }
});

// POST /api/logout
app.post('/api/logout', requireAuth, (req, res) => {
  const data = read();
  delete data.sessions[req.user.id];
  write(data);
  res.json({ success:true });
});
// GET /api/me
app.get('/api/me', requireAuth, (req, res) => {
  const data = read();
  const user = data.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ success:false });
  res.json({ success:true, user:{ id:user.id, name:user.name, email:user.email, role:user.role, createdAt:user.createdAt } });
});