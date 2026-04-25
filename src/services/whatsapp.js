require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
const API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

async function sendText(phone, text) {
  const url = `${BASE_URL}/message/sendText/${INSTANCE}`;

  const payload = {
    number: phone,
    text,
  };

  console.log(`[whatsapp] Enviando mensagem para ${phone}`);

  const response = await axios.post(url, payload, {
    headers: {
      apikey: API_KEY,
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });

  return response.data;
}

module.exports = { sendText };
