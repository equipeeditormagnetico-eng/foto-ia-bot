require('dotenv').config();
const express = require('express');
const { handleMessage } = require('./bot/handler');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

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

    const key = data?.key;
    const message = data?.message;

    if (!key || !message) {
      console.log('[webhook] Payload sem key/message — ignorado');
      return;
    }

    // Ignorar mensagens enviadas pelo próprio bot
    if (key.fromMe === true) {
      console.log('[webhook] Mensagem própria (fromMe) — ignorada');
      return;
    }

    // Ignorar mensagens de grupos
    const remoteJid = key.remoteJid ?? '';
    if (remoteJid.endsWith('@g.us')) {
      console.log(`[webhook] Mensagem de grupo (${remoteJid}) — ignorada`);
      return;
    }

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

    // Número limpo: remover sufixo @s.whatsapp.net
    const phone = remoteJid.replace('@s.whatsapp.net', '');

    console.log(`[webhook] Mensagem recebida de ${phone}: ${isImage ? '[IMAGEM]' : `"${text}"`}`);
    await handleMessage(phone, text, message);
  } catch (err) {
    console.error('[webhook] Erro ao processar mensagem:', err.message);
  }
});

app.listen(PORT, () => {
  console.log(`[server] Atendente rodando na porta ${PORT}`);
  console.log(`[server] Webhook: POST http://localhost:${PORT}/webhook`);
  console.log(`[server] Health:  GET  http://localhost:${PORT}/health`);
});
