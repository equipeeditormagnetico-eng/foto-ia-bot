require('dotenv').config();
const express = require('express');
const { handleMessage } = require('./bot/handler');
const { handleOperatorCommand } = require('./bot/operator');
const { getSession, updateSession } = require('./bot/session');

const app = express();
app.use(express.json());

const PORT          = process.env.PORT           || 3000;
const OPERATOR_PHONE = process.env.OPERATOR_PHONE || '';

// Health check para o Railway
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/webhook', async (req, res) => {
  // Responder imediatamente para não travar a Evolution API
  res.sendStatus(200);

  try {
    const body = req.body;

    // A Evolution API envolve o payload em diferentes estruturas dependendo da versão.
    // Suporte ao formato padrão: { data: { key, message, ... } }
    const data = body?.data ?? body;

    const key     = data?.key;
    const message = data?.message;

    if (!key || !message) {
      console.log('[webhook] Payload sem key/message — ignorado');
      return;
    }

    const remoteJid = key.remoteJid ?? '';

    // Ignorar mensagens de grupos
    if (remoteJid.endsWith('@g.us')) {
      console.log(`[webhook] Mensagem de grupo (${remoteJid}) — ignorada`);
      return;
    }

    const phone = remoteJid.replace('@s.whatsapp.net', '');

    // ── AJUSTE 5 — Operador assume conversa automaticamente ─────────────────
    // Quando o operador responde diretamente a um lead pelo WhatsApp conectado,
    // fromMe=true e remoteJid é o número do lead. Finaliza a sessão dele.
    // Nota: configure o webhook da Evolution API com ignoreFromMe=false para receber esses eventos.
    if (key.fromMe === true) {
      const leadSession = getSession(phone);
      if (leadSession && !leadSession.finished) {
        updateSession(phone, { finished: true });
        console.log(`[webhook] Operador assumiu conversa com ${phone} — sessão finalizada automaticamente`);
      } else {
        console.log(`[webhook] fromMe=true para ${phone} — sem sessão ativa para finalizar`);
      }
      return;
    }

    // ── AJUSTE 4 — Comandos do operador ─────────────────────────────────────
    // Mensagens recebidas do OPERATOR_PHONE são tratadas como comandos administrativos,
    // nunca como leads.
    if (OPERATOR_PHONE && phone === OPERATOR_PHONE) {
      const text =
        message?.conversation ||
        message?.extendedTextMessage?.text ||
        '';

      if (text) {
        console.log(`[webhook] Comando do operador (${phone}): "${text}"`);
        await handleOperatorCommand(phone, text);
      } else {
        console.log(`[webhook] Mensagem não-texto do operador — ignorada`);
      }
      return;
    }

    // ── Fluxo normal de leads ────────────────────────────────────────────────

    // Extrair texto da mensagem (texto simples ou extended)
    const text =
      message?.conversation ||
      message?.extendedTextMessage?.text ||
      '';

    const isImage = !!message?.imageMessage;

    // Ignorar se não for texto nem imagem (sticker, áudio, vídeo, etc.)
    if (!text && !isImage) {
      console.log('[webhook] Mensagem sem texto nem imagem — ignorada');
      return;
    }

    console.log(`[webhook] Mensagem recebida de ${phone}: ${isImage ? '[IMAGEM]' : `"${text}"`}`);
    await handleMessage(phone, text, message);

  } catch (err) {
    console.error('[webhook] Erro ao processar mensagem:', err.message);
  }
});

app.listen(PORT, () => {
  console.log(`[server] Atendente rodando na porta ${PORT}`);
  console.log(`[server] Webhook:  POST http://localhost:${PORT}/webhook`);
  console.log(`[server] Health:   GET  http://localhost:${PORT}/health`);
  console.log(`[server] Operador: ${OPERATOR_PHONE || '(não configurado)'}`);
});
