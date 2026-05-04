require('dotenv').config();
const express = require('express');
const { handleMessage }         = require('./bot/handler');
const { handleOperatorCommand } = require('./bot/operator');
const { getSession, updateSession } = require('./bot/session');

const app = express();
app.use(express.json());

const PORT           = process.env.PORT           || 3000;
const OPERATOR_PHONE = process.env.OPERATOR_PHONE || '';

// ── Health check ───────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Debug: variáveis e conectividade ──────────────────────
app.get('/debug', async (_req, res) => {
  const axios  = require('axios');
  const evoUrl = process.env.EVOLUTION_API_URL || '(NÃO DEFINIDO)';
  let evoStatus = 'não testado', evoError = null;
  try {
    const r = await axios.get(evoUrl.replace(/\/$/, '') + '/instance/fetchInstances', {
      headers: { apikey: process.env.EVOLUTION_API_KEY }, timeout: 5000,
    });
    evoStatus = `OK (${r.status})`;
  } catch (e) { evoStatus = 'ERRO'; evoError = e.message; }

  res.json({
    EVOLUTION_API_URL:   evoUrl,
    EVOLUTION_API_KEY:   process.env.EVOLUTION_API_KEY  ? '***' + process.env.EVOLUTION_API_KEY.slice(-4)  : '(NÃO DEFINIDO)',
    EVOLUTION_INSTANCE:  process.env.EVOLUTION_INSTANCE  || '(NÃO DEFINIDO)',
    REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN ? '***' + process.env.REPLICATE_API_TOKEN.slice(-4) : '(NÃO DEFINIDO)',
    OPERATOR_PHONE:      process.env.OPERATOR_PHONE      || '(NÃO DEFINIDO)',
    MINHA_CHAVE_PIX:     process.env.MINHA_CHAVE_PIX     || '(NÃO DEFINIDO)',
    evolution_connectivity: evoStatus,
    evolution_error:     evoError,
  });
});

// ── Webhook principal ──────────────────────────────────────
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  try {
    const body = req.body;
    console.log('[webhook] RAW:', JSON.stringify(body));

    // Normaliza: data pode ser objeto ou array (v1.8+)
    let data = body?.data ?? body;
    if (Array.isArray(data)) {
      console.log(`[webhook] data é array — usando primeiro item`);
      data = data[0];
    }

    const key     = data?.key;
    const message = data?.message;

    if (!key || !message) {
      console.log('[webhook] Sem key/message — ignorado');
      return;
    }

    const remoteJid = key.remoteJid ?? '';

    // @lid é um ID interno do Meta — não é o número real do WhatsApp.
    // Quando isso ocorre, o campo "sender" do payload traz o número real
    // no formato correto (ex: 558179073673@s.whatsapp.net).
    const replyJid = remoteJid.endsWith('@lid')
      ? (body.sender ?? data.sender ?? remoteJid)
      : remoteJid;

    console.log(`[webhook] remoteJid: ${remoteJid} | replyJid: ${replyJid}`);

    // phone limpo — usado APENAS como chave de sessão, nunca para envio
    const phone = replyJid
      .replace(/@s\.whatsapp\.net$/, '')
      .replace(/@lid$/, '')
      .replace(/@g\.us$/, '');

    const messageType =
      Object.keys(message).find((k) => k !== 'messageContextInfo') ||
      Object.keys(message)[0] || 'unknown';

    const sessionForLog = getSession(phone);
    console.log(`[webhook] De: ${remoteJid} | Tipo: ${messageType} | Estado: ${sessionForLog?.state ?? 'nova'}`);

    // Ignora grupos
    if (remoteJid.endsWith('@g.us')) {
      console.log('[webhook] Grupo — ignorado');
      return;
    }

    // fromMe — detecta operador digitando manualmente vs bot automático
    if (key.fromMe === true) {
      const senderJid   = data?.participant ?? key?.participant ?? data?.sender ?? '';
      const senderPhone = senderJid.replace(/@s\.whatsapp\.net$/, '').replace(/@lid$/, '');
      if (OPERATOR_PHONE && senderPhone === OPERATOR_PHONE) {
        const lead = getSession(phone);
        if (lead && !lead.finished) {
          updateSession(phone, { finished: true });
          console.log(`[webhook] Operador assumiu ${phone} — sessão finalizada`);
        }
      } else {
        console.log('[webhook] fromMe (bot automático) — ignorado');
      }
      return;
    }

    // Comandos do operador (mensagem recebida DO operador)
    if (OPERATOR_PHONE && phone === OPERATOR_PHONE) {
      const text = message?.conversation || message?.extendedTextMessage?.text || '';
      if (text) {
        console.log(`[webhook] Operador: "${text}"`);
        await handleOperatorCommand(phone, text);
      }
      return;
    }

    // Fluxo normal de clientes
    const text =
      message?.conversation ||
      message?.extendedTextMessage?.text ||
      message?.buttonsResponseMessage?.selectedButtonId ||
      message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
      message?.templateButtonReplyMessage?.selectedId || '';

    const isImage = !!message?.imageMessage;

    if (!text && !isImage) {
      console.log(`[webhook] Tipo "${messageType}" sem texto/imagem — ignorado`);
      return;
    }

    console.log(`[webhook] ▶ Processando ${phone} (replyJid: ${replyJid}): ${isImage ? '[IMAGEM]' : `"${text}"`}`);

    // phone    → chave de sessão (número limpo)
    // replyJid → JID real para enviar a resposta (@s.whatsapp.net, nunca @lid)
    await handleMessage(phone, replyJid, text, message, key);
    console.log(`[webhook] ✅ Concluído para ${phone}`);

  } catch (err) {
    console.error('[webhook] ❌ Erro:', err.message);
    console.error(err.stack);
  }
});

app.listen(PORT, () => {
  console.log(`[server] Bot rodando na porta ${PORT}`);
  console.log(`[server] Webhook: POST http://localhost:${PORT}/webhook`);
  console.log(`[server] Health:  GET  http://localhost:${PORT}/health`);
  console.log(`[server] Debug:   GET  http://localhost:${PORT}/debug`);
  console.log(`[server] Operador: ${OPERATOR_PHONE || '(não configurado)'}`);
});
