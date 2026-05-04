require('dotenv').config();
const { getSession, createSession, updateSession } = require('./session');
const { saveImages, loadImages, markUsed, getUsedStatus } = require('./session');
const { messages, STYLES } = require('./messages');
const { sendText, sendImage, downloadMedia } = require('../services/whatsapp');
const { generatePortraits, downloadImage } = require('../services/replicate');
const { applyWatermark } = require('../services/watermark');

// URLs de exemplo para prova social — substitua pelas suas reais
// Cada entrada: [url, legenda]
const PROOF_IMAGES = [
  [process.env.PROOF_IMAGE_1 || 'https://picsum.photos/seed/mae1/800/1067', 'Ela enviou essa foto 👇'],
  [process.env.PROOF_IMAGE_2 || 'https://picsum.photos/seed/mae2/800/1067', 'E recebeu esse resultado 😍'],
  [process.env.PROOF_IMAGE_3 || 'https://picsum.photos/seed/mae3/800/1067', 'Outra cliente nossa 🌸'],
];

// ── Detecta estilo a partir do texto digitado ──────────────
function parseStyle(text) {
  if (text === '1' || text.includes('estudio') || text.includes('estúdio') || text.includes('profissional')) return 'estudio';
  if (text === '2' || text.includes('jardim') || text.includes('flor'))  return 'jardim';
  if (text === '3' || text.includes('sol') || text.includes('sunset') || text.includes('dourado')) return 'pordosol';
  return null;
}

// ── Fluxo principal ────────────────────────────────────────
// phone     — número limpo, usado APENAS como chave de sessão
// remoteJid — JID completo (ex: 5511...@s.whatsapp.net ou @lid)
//             usado em TODOS os envios de mensagem
// rawText   — texto da mensagem
// message   — objeto bruto da Evolution API
// messageKey — { id, fromMe, remoteJid } para download de mídia
async function handleMessage(phone, remoteJid, rawText, message, messageKey) {

  // Sessão finalizada: ignora tudo
  const existing = getSession(phone);
  if (existing?.finished === true) {
    console.log(`[handler] Sessão finalizada para ${phone} — ignorado`);
    return;
  }

  const text    = rawText.trim().toLowerCase();
  const isImage = !!message?.imageMessage;

  // Cria sessão se não existir e armazena o remoteJid correto
  const session = existing || createSession(phone);
  if (!session.remoteJid) {
    updateSession(phone, { remoteJid });
  }
  // jid é sempre o remoteJid mais recente (pode atualizar se mudar de dispositivo)
  const jid = session.remoteJid || remoteJid;

  console.log(`[handler] ${phone} | ${session.state} | jid: ${jid} | ${isImage ? '[IMAGEM]' : `"${rawText}"`}`);

  switch (session.state) {

    // ── WELCOME ─────────────────────────────────────────────
    case 'WELCOME': {
      const used = await getUsedStatus(phone);

      if (used.hasPreview && !used.hasFinalPhotos) {
        updateSession(phone, { state: 'WAITING_PAYMENT' });
        await sendText(jid, messages.alreadyHasPreview());
        return;
      }

      await sendText(jid, messages.welcome());
      updateSession(phone, { state: 'WAITING_STYLE' });
      break;
    }

    // ── WAITING_STYLE ────────────────────────────────────────
    case 'WAITING_STYLE': {
      const estilo = parseStyle(text);

      if (!estilo) {
        await sendText(jid, messages.invalidStyle());
        return;
      }

      const styleName = STYLES[estilo];
      updateSession(phone, { estilo, state: 'WAITING_PHOTO' });

      // Prova social — 3 imagens com legenda individual
      await sendText(jid, messages.proofIntro(styleName));
      for (const [url, caption] of PROOF_IMAGES) {
        try {
          const buf = await downloadImage(url);
          await sendImage(jid, buf, caption);
        } catch {
          // Imagem de exemplo falhou — silencia e continua
        }
      }
      await sendText(jid, messages.proofOutro());
      break;
    }

    // ── WAITING_PHOTO ────────────────────────────────────────
    case 'WAITING_PHOTO': {
      if (!isImage) {
        await sendText(jid, messages.needPhoto());
        return;
      }

      await sendText(jid, messages.photoReceived());

      let imageUrls;
      try {
        imageUrls = await generatePortraits(session.estilo || 'estudio', 3);
      } catch (err) {
        console.error(`[handler] Replicate falhou para ${phone}:`, err.message);
        await sendText(jid, messages.generationError());
        return;
      }

      await sendText(jid, messages.previewIntro());

      const finalBuffers = [];
      for (let i = 0; i < imageUrls.length; i++) {
        const original = await downloadImage(imageUrls[i]);
        finalBuffers.push(original);

        const preview = await applyWatermark(original);
        await sendImage(jid, preview, `📸 Foto ${i + 1} de ${imageUrls.length}`);

        if (i < imageUrls.length - 1) await new Promise((r) => setTimeout(r, 2000));
      }

      await saveImages(phone, finalBuffers);
      await markUsed(phone, { hasPreview: true });

      await sendText(jid, messages.previewPayment());
      updateSession(phone, { state: 'WAITING_PAYMENT' });
      break;
    }

    // ── WAITING_PAYMENT ──────────────────────────────────────
    case 'WAITING_PAYMENT': {
      if (!isImage) {
        await sendText(jid, messages.needProof());
        return;
      }

      await sendText(jid, messages.paymentReceived());
      updateSession(phone, { state: 'PENDING_RELEASE' });

      const OPERATOR = process.env.OPERATOR_PHONE;
      if (OPERATOR) {
        try {
          const { base64, mimetype } = await downloadMedia(messageKey);
          if (base64) {
            const buf = Buffer.from(base64, 'base64');
            // Envia o comprovante para o operador usando o número limpo dele
            await sendImage(OPERATOR + '@s.whatsapp.net', buf, messages.operatorNotifyPayment(phone));
          } else {
            await sendText(OPERATOR + '@s.whatsapp.net', messages.operatorNotifyPayment(phone));
          }
        } catch {
          await sendText(OPERATOR + '@s.whatsapp.net', messages.operatorNotifyPayment(phone));
        }
      }
      break;
    }

    // ── PENDING_RELEASE ──────────────────────────────────────
    case 'PENDING_RELEASE': {
      console.log(`[handler] ${phone} em PENDING_RELEASE — aguardando operador`);
      break;
    }

    // ── DONE ─────────────────────────────────────────────────
    case 'DONE': {
      console.log(`[handler] ${phone} em DONE — ignorado`);
      break;
    }

    default: {
      console.warn(`[handler] Estado desconhecido para ${phone}: ${session.state}`);
      break;
    }
  }
}

module.exports = { handleMessage };
