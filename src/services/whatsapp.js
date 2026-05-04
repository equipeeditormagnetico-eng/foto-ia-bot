require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
const API_KEY  = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

function headers() {
  return { apikey: API_KEY, 'Content-Type': 'application/json' };
}

// Remove sufixos @s.whatsapp.net / @lid / @g.us
// Evolution API v2 aceita o número limpo OU o JID completo com @lid
function toNumber(jidOrPhone) {
  return String(jidOrPhone).trim();
  // Nota: NÃO removemos @lid aqui — v2 aceita o JID completo para roteamento
  // Se quiser forçar strip: .replace(/@[\w.]+$/, '')
}

// Envia mensagem de texto — Evolution API v2
async function sendText(jidOrPhone, text) {
  const number = toNumber(jidOrPhone);
  const url    = `${BASE_URL}/message/sendText/${INSTANCE}`;

  // v2: campo "text" direto (não mais "textMessage.text")
  const body = { number, text };

  console.log(`[whatsapp] sendText → ${number}`);
  console.log(`[whatsapp] sendText body: ${JSON.stringify(body)}`);

  try {
    const resp = await axios.post(url, body, { headers: headers(), timeout: 15_000 });
    console.log(`[whatsapp] sendText ✅ ${resp.status}`);
    return resp.data;
  } catch (err) {
    console.error(`[whatsapp] sendText ❌ ${err.response?.status} — ${JSON.stringify(err.response?.data)}`);
    throw err;
  }
}

// Envia imagem a partir de Buffer JPEG — Evolution API v2
async function sendImage(jidOrPhone, imageBuffer, caption = '') {
  const number = toNumber(jidOrPhone);
  const url    = `${BASE_URL}/message/sendMedia/${INSTANCE}`;

  // v2: campos de mídia no nível raiz (não mais "mediaMessage" aninhado)
  const body = {
    number,
    mediatype: 'image',
    mimetype:  'image/jpeg',
    caption,
    media:     imageBuffer.toString('base64'),
    fileName:  'ensaio.jpg',
  };

  console.log(`[whatsapp] sendImage → ${number} (${imageBuffer.length} bytes)`);

  try {
    const resp = await axios.post(url, body, {
      headers: headers(),
      timeout: 60_000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    console.log(`[whatsapp] sendImage ✅ ${resp.status}`);
    return resp.data;
  } catch (err) {
    console.error(`[whatsapp] sendImage ❌ ${err.response?.status} — ${JSON.stringify(err.response?.data)}`);
    throw err;
  }
}

// Baixa mídia de uma mensagem recebida — retorna { base64, mimetype }
async function downloadMedia(messageKey) {
  const url = `${BASE_URL}/chat/getBase64FromMediaMessage/${INSTANCE}`;
  console.log(`[whatsapp] downloadMedia msg ${messageKey.id}`);

  const resp = await axios.post(
    url,
    { key: messageKey, convertToMp4: false },
    { headers: headers(), timeout: 30_000 }
  );

  const data     = resp.data;
  const base64   = data.base64   || data?.message?.base64   || null;
  const mimetype = data.mimetype || data?.message?.mimetype || 'image/jpeg';
  return { base64, mimetype };
}

module.exports = { sendText, sendImage, downloadMedia };
