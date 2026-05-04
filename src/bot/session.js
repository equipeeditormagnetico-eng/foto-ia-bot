const fs   = require('fs');
const path = require('path');
const { sendText } = require('../services/whatsapp');
const { messages } = require('./messages');

// ── Caminhos de persistência ───────────────────────────────
// Em Railway: montar um Volume em /app/data para manter os dados entre deploys
const DATA_DIR   = path.resolve(process.env.DATA_DIR || './data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const USED_FILE  = path.join(DATA_DIR, 'used_numbers.json');

// Garante que as pastas existem (cria se não existir)
function ensureDirs() {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}
ensureDirs();

// ── Sessões em memória ─────────────────────────────────────
const SESSION_TTL_MS    = 24 * 60 * 60 * 1000;  // 24h
const REMINDER_DELAY_MS = 15 * 60 * 1000;        // 15min

const sessions = new Map();

function getSession(phone) {
  const s = sessions.get(phone);
  if (!s) return null;
  if (Date.now() - s.lastActivity > SESSION_TTL_MS) {
    _clearTimers(s);
    sessions.delete(phone);
    return null;
  }
  return s;
}

function createSession(phone) {
  const s = {
    phone,
    state: 'WELCOME',
    estilo: null,
    lastActivity: Date.now(),
    finished: false,
    reminderTimer: null,
    reminderSent: false,
    expiryTimer: null,
  };
  sessions.set(phone, s);
  _scheduleExpiry(phone, s);
  return s;
}

function updateSession(phone, updates) {
  const s = sessions.get(phone);
  if (!s) return;
  Object.assign(s, updates, { lastActivity: Date.now() });
  _resetReminder(phone, s);
}

function listAllSessions() {
  const out = [];
  for (const [phone, s] of sessions) {
    if (Date.now() - s.lastActivity > SESSION_TTL_MS) continue;
    out.push({ phone, state: s.state, finished: s.finished, estilo: s.estilo });
  }
  return out;
}

function _clearTimers(s) {
  if (s.reminderTimer) clearTimeout(s.reminderTimer);
  if (s.expiryTimer)   clearTimeout(s.expiryTimer);
}

function _scheduleExpiry(phone, s) {
  if (s.expiryTimer) clearTimeout(s.expiryTimer);
  s.expiryTimer = setTimeout(() => {
    _clearTimers(s);
    sessions.delete(phone);
    console.log(`[session] Sessão expirada: ${phone}`);
  }, SESSION_TTL_MS);
}

function _resetReminder(phone, s) {
  if (s.reminderTimer) clearTimeout(s.reminderTimer);
  s.reminderSent = false;

  // Não lembra em estados finais
  if (s.state === 'DONE' || s.state === 'PENDING_RELEASE' || s.finished) return;

  s.reminderTimer = setTimeout(async () => {
    const cur = sessions.get(phone);
    if (!cur || cur.reminderSent || cur.finished) return;
    cur.reminderSent = true;
    try {
      await sendText(phone, messages.welcome()); // relembra o menu
    } catch (err) {
      console.error(`[session] Lembrete falhou para ${phone}:`, err.message);
    }
  }, REMINDER_DELAY_MS);
}

// ── Persistência de imagens geradas ───────────────────────
// Salva array de Buffers JPEG em disco, um arquivo por foto
async function saveImages(phone, buffers) {
  ensureDirs();
  const dir = path.join(IMAGES_DIR, phone);
  fs.mkdirSync(dir, { recursive: true });

  // Remove imagens antigas deste número
  for (const f of fs.readdirSync(dir)) {
    fs.unlinkSync(path.join(dir, f));
  }

  for (let i = 0; i < buffers.length; i++) {
    fs.writeFileSync(path.join(dir, `foto_${i + 1}.jpg`), buffers[i]);
  }
  console.log(`[session] ${buffers.length} imagens salvas para ${phone}`);
}

// Carrega os Buffers de imagens salvas para um número
function loadImages(phone) {
  const dir = path.join(IMAGES_DIR, phone);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.jpg'))
    .sort()
    .map((f) => fs.readFileSync(path.join(dir, f)));
}

// ── Persistência de números "já usados" ───────────────────
function _readUsed() {
  try {
    return JSON.parse(fs.readFileSync(USED_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function _writeUsed(data) {
  ensureDirs();
  fs.writeFileSync(USED_FILE, JSON.stringify(data, null, 2));
}

// Retorna { hasPreview, hasFinalPhotos }
async function getUsedStatus(phone) {
  const all = _readUsed();
  return all[phone] || { hasPreview: false, hasFinalPhotos: false };
}

// Merge parcial nos dados de um número
async function markUsed(phone, updates) {
  const all = _readUsed();
  all[phone] = { ...(all[phone] || {}), ...updates };
  _writeUsed(all);
}

module.exports = {
  getSession,
  createSession,
  updateSession,
  listAllSessions,
  saveImages,
  loadImages,
  getUsedStatus,
  markUsed,
};
