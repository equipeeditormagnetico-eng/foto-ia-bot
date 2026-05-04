require('dotenv').config();
const { getSession, updateSession, listAllSessions, loadImages, markUsed } = require('./session');
const { sendText, sendImage } = require('../services/whatsapp');
const { messages } = require('./messages');

const CMD_LIBERAR  = /^liberar\s+(\S+)/i;
const CMD_FIM      = /^fim\s+(\S+)/i;
const CMD_SESSOES  = /^sess[oõ]es$/i;
const CMD_REATIVAR = /^reativar\s+(\S+)/i;

// Resolve o JID correto para envio: usa o salvo na sessão ou reconstrói
function resolveJid(phone) {
  const session = getSession(phone);
  if (session?.remoteJid) return session.remoteJid;
  // Fallback: assume formato padrão @s.whatsapp.net
  return `${phone}@s.whatsapp.net`;
}

async function handleOperatorCommand(operatorPhone, text) {
  const cmd = text.trim();

  // ── LIBERAR [número] ────────────────────────────────────
  const liberarMatch = cmd.match(CMD_LIBERAR);
  if (liberarMatch) {
    const clientPhone = liberarMatch[1];
    const clientJid   = resolveJid(clientPhone);

    const buffers = loadImages(clientPhone);
    if (!buffers || buffers.length === 0) {
      await sendText(`${operatorPhone}@s.whatsapp.net`, messages.operatorLiberarNotFound(clientPhone));
      return;
    }

    await sendText(clientJid, messages.finalDelivery());
    for (let i = 0; i < buffers.length; i++) {
      await sendImage(clientJid, buffers[i], `🌸 Foto ${i + 1} de ${buffers.length} — alta resolução`);
      if (i < buffers.length - 1) await new Promise((r) => setTimeout(r, 2000));
    }

    updateSession(clientPhone, { state: 'DONE', finished: true });
    await markUsed(clientPhone, { hasFinalPhotos: true });
    await sendText(`${operatorPhone}@s.whatsapp.net`, messages.operatorLiberarOk(clientPhone));
    console.log(`[operator] Fotos liberadas para ${clientPhone} (${clientJid})`);
    return;
  }

  // ── fim [número] ────────────────────────────────────────
  const fimMatch = cmd.match(CMD_FIM);
  if (fimMatch) {
    const target = fimMatch[1];
    const s = getSession(target);
    if (!s) {
      await sendText(`${operatorPhone}@s.whatsapp.net`, `⚠️ Sessão não encontrada para ${target}.`);
    } else {
      updateSession(target, { finished: true });
      await sendText(`${operatorPhone}@s.whatsapp.net`, `✅ Conversa com ${target} finalizada.`);
    }
    return;
  }

  // ── sessões ─────────────────────────────────────────────
  if (CMD_SESSOES.test(cmd)) {
    const all = listAllSessions();
    if (all.length === 0) {
      await sendText(`${operatorPhone}@s.whatsapp.net`, `Nenhuma sessão ativa no momento.`);
    } else {
      const lines = all
        .map((s) => {
          const status = s.finished ? ' _(finalizada)_' : '';
          return `• ${s.phone} → ${s.state}${s.estilo ? ` [${s.estilo}]` : ''}${status}`;
        })
        .join('\n');
      await sendText(`${operatorPhone}@s.whatsapp.net`, `📋 *Sessões ativas:*\n${lines}`);
    }
    return;
  }

  // ── reativar [número] ───────────────────────────────────
  const reativarMatch = cmd.match(CMD_REATIVAR);
  if (reativarMatch) {
    const target = reativarMatch[1];
    const s = getSession(target);
    if (!s) {
      await sendText(`${operatorPhone}@s.whatsapp.net`, `⚠️ Sessão não encontrada para ${target}.`);
    } else {
      updateSession(target, { finished: false });
      await sendText(`${operatorPhone}@s.whatsapp.net`, `✅ Sessão de ${target} reativada.`);
    }
    return;
  }

  // ── ajuda ───────────────────────────────────────────────
  await sendText(`${operatorPhone}@s.whatsapp.net`, messages.operatorHelp());
}

module.exports = { handleOperatorCommand };
