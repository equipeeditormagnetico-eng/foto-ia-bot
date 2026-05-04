require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
const API_KEY  = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

function headers() {
  return { apikey: API_KEY, 'Content-Type': 'application/json' };
}

// Remove sufixos @s.whatsapp.net / @lid / @g.us — Evolution API v1.8
// espera apenas os dígitos no campo "number"
function toNumber(jidOrPhone) {
  return String(jidOrPhone)
    .replace(/@s\.whatsapp\.net$/, '')
    .replace(/@lid$/, '')
    .replace(/@g\.us$/, '')
    .trim();
}

// Envia mensagem de texto — Evolution API v1.8
async function sendText(jidOrPhone, text) {
  const number = toNumber(jidOrPhone);
  const url    = `${BASE_URL}/message/sendText/${INSTANCE}`;
  const body   = { number, textMessage: { text } };

  console.log(`[whatsapp] sendText → ${number}`);
  console.log(`[whatsapp] sendText body: ${JSON.stringify(body)}`);

  try {
    const resp = await axios.post(url, body, { headers: headers(), timeout: 15_000 });
    console.log(`[whatsapp] sendText ✅ ${resp.status}`);
    return resp.data;
  } catch (err) {
    const status = err.response?.status;
    const data   = err.response?.data;
    console.error(`[whatsapp] sendText ❌ ${status} — ${JSON.stringify(data)}`);

    // @lid: Evolution API v1.8 não consegue enviar para IDs internos do Meta.
    // Esses usuários não recebem resposta até upgrade para v2.
    if (status === 400 && JSON.stringify(data).includes('exists')) {
      console.error(`[whatsapp] ⚠️  Número @lid não suportado na v1.8. Upgrade para v2 necessário.`);
      return null; // não lança erro — evita crashar o fluxo
    }
    throw err;
  }
}

// Envia imagem a partir de Buffer JPEG — Evolution API v1.8
async function sendImage(jidOrPhone, imageBuffer, caption = '') {
  const number = toNumber(jidOrPhone);
  const url    = `${BASE_URL}/message/sendMedia/${INSTANCE}`;
  const body   = {
    number,
    mediaMessage: {
      mediatype: 'image',
      mimetype:  'image/jpeg',
      caption,
      media:     imageBuffer.toString('base64'),
      fileName:  'ensaio.jpg',
    },
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
    if (err.response?.status === 400 && JSON.stringify(err.response?.data).includes('exists')) {
      console.error(`[whatsapp] ⚠️  @lid não suportado na v1.8.`);
      return null;
    }
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
