require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
const API_KEY  = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

// Cabeçalho padrão para todas as chamadas
function headers() {
  return { apikey: API_KEY, 'Content-Type': 'application/json' };
}

// Envia mensagem de texto simples
async function sendText(phone, text) {
  const url = `${BASE_URL}/message/sendText/${INSTANCE}`;
  console.log(`[whatsapp] sendText → ${phone}`);

  const resp = await axios.post(
    url,
    { number: phone, text },
    { headers: headers(), timeout: 15_000 }
  );
  return resp.data;
}

// Envia imagem a partir de um Buffer JPEG/PNG
// caption é opcional
async function sendImage(phone, imageBuffer, caption = '') {
  const url = `${BASE_URL}/message/sendMedia/${INSTANCE}`;
  console.log(`[whatsapp] sendImage → ${phone} (${imageBuffer.length} bytes)`);

  const base64 = imageBuffer.toString('base64');

  const resp = await axios.post(
    url,
    {
      number:    phone,
      mediatype: 'image',
      mimetype:  'image/jpeg',
      media:     base64,
      fileName:  'ensaio.jpg',
      caption,
    },
    {
      headers: headers(),
      timeout: 60_000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    }
  );
  return resp.data;
}

// Baixa a mídia de uma mensagem recebida e retorna { base64, mimetype }
// messageKey = { id, fromMe, remoteJid }
async function downloadMedia(messageKey) {
  const url = `${BASE_URL}/chat/getBase64FromMediaMessage/${INSTANCE}`;
  console.log(`[whatsapp] downloadMedia mensagem ${messageKey.id}`);

  const resp = await axios.post(
    url,
    { key: messageKey, convertToMp4: false },
    { headers: headers(), timeout: 30_000 }
  );

  // A Evolution API retorna { base64, mimetype } ou { message: { ... } }
  const data = resp.data;
  const base64  = data.base64  || data?.message?.base64  || null;
  const mimetype = data.mimetype || data?.message?.mimetype || 'image/jpeg';

  return { base64, mimetype };
}

module.exports = { sendText, sendImage, downloadMedia };
