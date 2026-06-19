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