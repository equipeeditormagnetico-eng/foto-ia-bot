require('dotenv').config();
const express = require('express');
const { handleMessage }       = require('./bot/handler');
const { handleOperatorCommand } = require('./bot/operator');
const { getSession, updateSession } = require('./bot/session');

const app = express();
app.use(express.json());

const PORT           = process.env.PORT           || 3000;
const OPERATOR_PHONE = process.env.OPERATOR_PHONE || '';

// Health check para Railway / Docker
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/webhook', async (req, res) => {
  // Responde imediatamente para a Evolution API não retentar
  res.sendStatus(200);

  try {
    const body = req.body;

    // A Evolution API envolve o payload em diferentes estruturas.
    // Suporte ao formato padrão: { event, data: { key, message, ... } }
    const data = body?.data ?? body;

    const key     = data?.key;
    const message = data?.message;

    if (!key || !message) {
      console.log('[webhook] Payload sem key/message — ignorado');
      return;
    }

    const remoteJid = key.remoteJid ?? '';

    // Número limpo — suporta @s.whatsapp.net e @lid (Meta/Instagram)
    const phone = remoteJid
      .replace('@s.whatsapp.net', '')
      .replace('@lid', '');

    const messageType =
      Object.keys(message).find((k) => k !== 'messageContextInfo') ||
      Object.keys(message)[0] ||
      'unknown';

    const sessionForLog = getSession(phone);
    console.log(`[webhook] De: ${remoteJid} | Tipo: ${messageType} | Estado: ${sessionForLog?.state ?? 'nova'}`);

    // Ignora mensagens de grupos
    if (remoteJid.endsWith('@g.us')) {
      console.log(`[webhook] Grupo — ignorado`);
      return;
    }

    // ── fromMe: detecta se foi o operador digitando manualmente ──────────
    if (key.fromMe === true) {
      const senderJid  = data?.participant ?? key?.participant ?? data?.sender ?? '';
      const senderPhone = senderJid.replace('@s.whatsapp.net', '').replace('@lid', '');
      const isOperatorManual = OPERATOR_PHONE && senderPhone === OPERATOR_PHONE;

      if (isOperatorManual) {
        const lead = getSession(phone);
        if (lead && !lead.finished) {
          updateSession(phone, { finished: true });
          console.log(`[webhook] Operador assumiu ${phone} — sessão finalizada`);
        }
      } else {
        console.log(`[webhook] fromMe (bot automático) — ignorado`);
      }
      return;
    }

    // ── Comandos do operador ──────────────────────────────────────────────
    if (OPERATOR_PHONE && phone === OPERATOR_PHONE) {
      const text =
        message?.conversation ||
        message?.extendedTextMessage?.text ||
        '';
      if (text) {
        console.log(`[webhook] Operador: "${text}"`);
        await handleOperatorCommand(phone, text);
      }
      return;
    }

    // ── Fluxo normal de clientes ──────────────────────────────────────────
    const text =
      message?.conversation ||
      message?.extendedTextMessage?.text ||
      message?.buttonsResponseMessage?.selectedButtonId ||
      message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
      message?.templateButtonReplyMessage?.selectedId ||
      '';

    const isImage = !!message?.imageMessage;

    if (!text && !isImage) {
      console.log(`[webhook] Tipo "${messageType}" sem texto nem imagem — ignorado`);
      return;
    }

    console.log(`[webhook] Processando ${phone}: ${isImage ? '[IMAGEM]' : `"${text}"`}`);

    // Passa o messageKey para o handler poder baixar mídia (comprovante de PIX)
    await handleMessage(phone, text, message, key);

  } catch (err) {
    console.error('[webhook] Erro:', err.message);
  }
});

app.listen(PORT, () => {
  console.log(`[server] Bot rodando na porta ${PORT}`);
  console.log(`[server] Webhook:  POST http://localhost:${PORT}/webhook`);
  console.log(`[server] Health:   GET  http://localhost:${PORT}/health`);
  console.log(`[server] Operador: ${OPERATOR_PHONE || '(não configurado)'}`);
});
