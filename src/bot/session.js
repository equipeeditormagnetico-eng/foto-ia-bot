const { sendText } = require('../services/whatsapp');
const { messages } = require('./messages');

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
const REMINDER_DELAY_MS = 15 * 60 * 1000;   // 15 minutos

const sessions = new Map();

function getSession(phone) {
  const session = sessions.get(phone);
  if (!session) return null;

  if (Date.now() - session.lastActivity > SESSION_TTL_MS) {
    clearSessionTimers(session);
    sessions.delete(phone);
    return null;
  }

  return session;
}

function createSession(phone) {
  const session = {
    phone,
    state: 'WELCOME',
    name: null,
    style: null,
    lastActivity: Date.now(),
    reminderTimer: null,
    reminderSent: false,
    expiryTimer: null,
  };
  sessions.set(phone, session);
  scheduleExpiry(phone, session);
  return session;
}

function updateSession(phone, updates) {
  const session = sessions.get(phone);
  if (!session) return;

  Object.assign(session, updates, { lastActivity: Date.now() });

  resetReminderTimer(phone, session);
}

function clearSessionTimers(session) {
  if (session.reminderTimer) clearTimeout(session.reminderTimer);
  if (session.expiryTimer) clearTimeout(session.expiryTimer);
}

function scheduleExpiry(phone, session) {
  if (session.expiryTimer) clearTimeout(session.expiryTimer);
  session.expiryTimer = setTimeout(() => {
    clearSessionTimers(session);
    sessions.delete(phone);
    console.log(`[session] Sessão expirada para ${phone}`);
  }, SESSION_TTL_MS);
}

// Retorna todas as sessões ativas (não expiradas) para o comando "sessões" do operador
function listAllSessions() {
  const result = [];
  for (const [phone, session] of sessions.entries()) {
    if (Date.now() - session.lastActivity > SESSION_TTL_MS) continue;
    result.push({
      phone,
      state: session.state,
      finished: session.finished || false,
      name: session.name,
    });
  }
  return result;
}

function resetReminderTimer(phone, session) {
  if (session.reminderTimer) clearTimeout(session.reminderTimer);
  session.reminderSent = false;

  // Não agenda lembrete se o fluxo terminou ou a sessão foi finalizada pelo operador
  if (session.state === 'DONE' || session.finished) return;

  session.reminderTimer = setTimeout(async () => {
    const current = sessions.get(phone);
    if (!current || current.state === 'DONE' || current.finished || current.reminderSent) return;

    current.reminderSent = true;
    console.log(`[session] Enviando lembrete para ${phone}`);
    try {
      await sendText(phone, messages.reminder(current.name));
    } catch (err) {
      console.error(`[session] Erro ao enviar lembrete para ${phone}:`, err.message);
    }
  }, REMINDER_DELAY_MS);
}

module.exports = { getSession, createSession, updateSession, listAllSessions };
