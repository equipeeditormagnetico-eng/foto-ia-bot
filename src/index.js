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

    // Número limpo — suporta @s.whatsapp.net e @lid (Meta/Instagram)
    const phone = remoteJid
      .replace('@s.whatsapp.net', '')
      .replace('@lid', '');

    // Detectar tipo da mensagem para logging (ignora messageContextInfo que é só metadado)
    const messageType =
      Object.keys(message).find((k) => k !== 'messageContextInfo') ||
      Object.keys(message)[0] ||
      'unknown';

    // Log detalhado no início de cada evento recebido
    const sessionForLog = getSession(phone);
    console.log('[webhook] De:', remoteJid, '| Tipo:', messageType, '| Estado:', sessionForLog?.state ?? 'nova');

    // Ignorar mensagens de grupos (@g.us)
    // Mensagens individuais chegam como @s.whatsapp.net ou @lid (Meta/Instagram)
    if (remoteJid.endsWith('@g.us')) {
      console.log(`[webhook] Mensagem de grupo (${remoteJid}) — ignorada`);
      return;
    }

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

    // Extrair texto da mensagem.
    // messageContextInfo é apenas metadado (contexto de anúncio Meta/Instagram)
    // e não interfere na extração — o texto real vem nos campos abaixo.
    const text =
      message?.conversation ||
      message?.extendedTextMessage?.text ||           // texto com contexto/citação
      message?.buttonsResponseMessage?.selectedButtonId ||  // botão clicado
      message?.listResponseMessage?.singleSelectReply?.selectedRowId || // lista
      message?.templateButtonReplyMessage?.selectedId ||    // template button
      '';

    const isImage = !!message?.imageMessage;

    // Ignorar se não for texto nem imagem (sticker, áudio, vídeo, documento, etc.)
    if (!text && !isImage) {
      console.log(`[webhook] Tipo "${messageType}" sem texto nem imagem — ignorado`);
      return;
    }

    console.log(`[webhook] Processando de ${phone}: ${isImage ? '[IMAGEM]' : `"${text}"`}`);
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
