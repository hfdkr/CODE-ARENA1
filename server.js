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
// ─── Forgot Password ──────────────────────────────────────────────────────────
const resetTokens = new Map();

app.get('/api/forgot-password/question', (req, res) => {
  const email = (req.query.email||'').toLowerCase().trim();
  if (!isEmail(email)) return res.status(400).json({ success:false, message:'Invalid email' });
  const user = read().users.find(u => u.email === email);
  if (!user) return res.status(404).json({ success:false, message:'No account with this email' });
  if (!user.securityQuestion) return res.status(404).json({ success:false, message:'No security question set' });
  res.json({ success:true, question:user.securityQuestion });
});

app.post('/api/forgot-password/verify', async (req, res) => {
  const email  = (req.body.email||'').toLowerCase().trim();
  const answer = (req.body.answer||'').trim().toLowerCase();
  const user = read().users.find(u => u.email === email);
  if (!user || !user.securityAnswer)
    return res.status(404).json({ success:false, message:'No account found' });
  const ok = await bcrypt.compare(answer, user.securityAnswer);
  if (!ok) return res.status(401).json({ success:false, message:'Incorrect answer' });
  const token = require('crypto').randomBytes(32).toString('hex');
  resetTokens.set(token, { userId:user.id, expires:Date.now() + 10*60*1000 });
  res.json({ success:true, token });
});

app.post('/api/forgot-password/reset', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword || newPassword.length < 6)
    return res.status(400).json({ success:false, message:'Invalid request' });
  const entry = resetTokens.get(token);
  if (!entry || entry.expires < Date.now()) {
    resetTokens.delete(token);
    return res.status(400).json({ success:false, message:'Reset link expired' });
  }
  const data = read();
  const idx  = data.users.findIndex(u => u.id === entry.userId);
  if (idx === -1) return res.status(404).json({ success:false, message:'User not found' });
  data.users[idx].password = await bcrypt.hash(newPassword, SALT_ROUNDS);
  write(data);
  resetTokens.delete(token);
  res.json({ success:true });
});
// ─── Account ──────────────────────────────────────────────────────────────────
app.put('/api/account/profile', requireAuth, async (req, res) => {
  const { name, email } = req.body;
  if (!name?.trim() || !email || !isEmail(email))
    return res.status(400).json({ success:false, message:'Invalid data' });
  const data = read();
  const idx  = data.users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ success:false, message:'Not found' });
  const lo = email.toLowerCase().trim();
  if (data.users.some(u => u.email === lo && u.id !== req.user.id))
    return res.status(409).json({ success:false, message:'Email already used' });
  data.users[idx].name  = sanitize(name.trim());
  data.users[idx].email = lo;
  write(data);
  res.json({ success:true, user:{ id:data.users[idx].id, name:data.users[idx].name, email:data.users[idx].email, role:data.users[idx].role } });
});

app.put('/api/account/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6)
    return res.status(400).json({ success:false, message:'Invalid data' });
  const data = read();
  const idx  = data.users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ success:false });
  const ok = await bcrypt.compare(currentPassword, data.users[idx].password);
  if (!ok) return res.status(401).json({ success:false, message:'Wrong current password' });
  data.users[idx].password = await bcrypt.hash(newPassword, SALT_ROUNDS);
  write(data);
  res.json({ success:true });
});
// ═══ PRESENCE ════════════════════════════════════════════════════════════════

// Heartbeat — called every 30s by logged-in clients
app.post('/api/heartbeat', requireAuth, (req, res) => {
  const data = read();
  data.sessions[req.user.id] = { userId:req.user.id, name:req.user.name, lastSeen:Date.now() };
  write(data);
  res.json({ success:true });
});

// GET /api/presence — online = active in last 2 min
app.get('/api/presence', requireAuth, (req, res) => {
  const data    = read();
  const now     = Date.now();
  const ONLINE  = 2 * 60 * 1000;
  const users   = data.users.map(u => ({
    id: u.id, name: u.name, email: u.email, role: u.role,
    online: !!(data.sessions[u.id] && (now - data.sessions[u.id].lastSeen) < ONLINE)
  }));
  res.json({ success:true, users });
});