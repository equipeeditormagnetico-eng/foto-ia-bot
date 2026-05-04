require('dotenv').config();
const { getSession, createSession, updateSession } = require('./session');
const { saveImages, loadImages, markUsed, getUsedStatus } = require('./session');
const { messages, STYLES } = require('./messages');
const { sendText, sendImage, downloadMedia } = require('../services/whatsapp');
const { generatePortraits, downloadImage } = require('../services/replicate');
const { applyWatermark } = require('../services/watermark');

// URLs de exemplo para prova social — substitua pelas suas reais
const PROOF_IMAGES = [
  process.env.PROOF_IMAGE_1 || 'https://picsum.photos/seed/mae1/800/1067',
  process.env.PROOF_IMAGE_2 || 'https://picsum.photos/seed/mae2/800/1067',
];

// ── Detecta estilo a partir do texto digitado ──────────────
function parseStyle(text) {
  if (text === '1' || text.includes('estudio') || text.includes('estúdio') || text.includes('profissional')) return 'estudio';
  if (text === '2' || text.includes('jardim') || text.includes('flor'))  return 'jardim';
  if (text === '3' || text.includes('sol') || text.includes('sunset') || text.includes('dourado')) return 'pordosol';
  return null;
}

// ── Fluxo principal ────────────────────────────────────────
// phone      — número limpo (sem @s.whatsapp.net)
// rawText    — texto da mensagem ('' para imagens)
// message    — objeto bruto da Evolution API
// messageKey — { id, fromMe, remoteJid } para download de mídia
async function handleMessage(phone, rawText, message, messageKey) {

  // Sessão finalizada: ignora tudo
  const existing = getSession(phone);
  if (existing?.finished === true) {
    console.log(`[handler] Sessão finalizada para ${phone} — ignorado`);
    return;
  }

  const text    = rawText.trim().toLowerCase();
  const isImage = !!message?.imageMessage;

  // Garante que a sessão existe
  const session = existing || createSession(phone);

  console.log(`[handler] ${phone} | ${session.state} | ${isImage ? '[IMAGEM]' : `"${rawText}"`}`);

  switch (session.state) {

    // ── WELCOME ─────────────────────────────────────────────
    // Primeira mensagem: verifica se o número já tem prévia não paga
    case 'WELCOME': {
      const used = await getUsedStatus(phone);

      if (used.hasPreview && !used.hasFinalPhotos) {
        // Já gerou preview mas não pagou — recoloca no estado certo
        updateSession(phone, { state: 'WAITING_PAYMENT' });
        await sendText(phone, messages.alreadyHasPreview());
        return;
      }

      await sendText(phone, messages.welcome());
      updateSession(phone, { state: 'WAITING_STYLE' });
      break;
    }

    // ── WAITING_STYLE ────────────────────────────────────────
    case 'WAITING_STYLE': {
      const estilo = parseStyle(text);

      if (!estilo) {
        await sendText(phone, messages.invalidStyle());
        return;
      }

      const styleName = STYLES[estilo];
      updateSession(phone, { estilo, state: 'WAITING_PHOTO' });

      // Prova social
      await sendText(phone, messages.proofIntro(styleName));
      for (const url of PROOF_IMAGES) {
        try {
          const buf = await downloadImage(url);
          await sendImage(phone, buf);
        } catch {
          // Imagem de exemplo falhou — silencia
        }
      }
      await sendText(phone, messages.proofOutro());
      break;
    }

    // ── WAITING_PHOTO ────────────────────────────────────────
    case 'WAITING_PHOTO': {
      if (!isImage) {
        await sendText(phone, messages.needPhoto());
        return;
      }

      await sendText(phone, messages.photoReceived());

      let imageUrls;
      try {
        // Gera 3 portraits com Replicate
        imageUrls = await generatePortraits(session.estilo || 'estudio', 3);
      } catch (err) {
        console.error(`[handler] Replicate falhou para ${phone}:`, err.message);
        await sendText(phone, messages.generationError());
        return;
      }

      // Baixa, aplica marca d'água e envia cada imagem
      await sendText(phone, messages.previewIntro());

      const finalBuffers = []; // buffers originais (sem marca) para LIBERAR depois

      for (let i = 0; i < imageUrls.length; i++) {
        const original = await downloadImage(imageUrls[i]);
        finalBuffers.push(original);

        const preview = await applyWatermark(original);
        await sendImage(phone, preview, `📸 Foto ${i + 1} de ${imageUrls.length}`);

        // Pequena pausa para não travar o WhatsApp do cliente
        if (i < imageUrls.length - 1) await new Promise((r) => setTimeout(r, 2000));
      }

      // Persiste as imagens originais para envio após pagamento
      await saveImages(phone, finalBuffers);
      await markUsed(phone, { hasPreview: true });

      await sendText(phone, messages.previewPayment());
      updateSession(phone, { state: 'WAITING_PAYMENT' });
      break;
    }

    // ── WAITING_PAYMENT ──────────────────────────────────────
    case 'WAITING_PAYMENT': {
      if (!isImage) {
        await sendText(phone, messages.needProof());
        return;
      }

      // Recebeu comprovante — notifica operador e aguarda liberação manual
      await sendText(phone, messages.paymentReceived());
      updateSession(phone, { state: 'PENDING_RELEASE' });

      const OPERATOR = process.env.OPERATOR_PHONE;
      if (OPERATOR) {
        // Encaminha o comprovante para o operador
        try {
          const { base64, mimetype } = await downloadMedia(messageKey);
          if (base64) {
            const buf = Buffer.from(base64, 'base64');
            await sendImage(OPERATOR, buf, messages.operatorNotifyPayment(phone));
          } else {
            await sendText(OPERATOR, messages.operatorNotifyPayment(phone));
          }
        } catch {
          await sendText(OPERATOR, messages.operatorNotifyPayment(phone));
        }
      }
      break;
    }

    // ── PENDING_RELEASE ──────────────────────────────────────
    // Cliente aguarda o operador rodar LIBERAR no WhatsApp do operador.
    // Qualquer mensagem enquanto aguarda recebe esta resposta silenciosa.
    case 'PENDING_RELEASE': {
      // Sem resposta automática para não criar pressão — o operador já foi avisado
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
