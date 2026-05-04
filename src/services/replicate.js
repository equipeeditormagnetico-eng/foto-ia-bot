require('dotenv').config();
const axios = require('axios');

const TOKEN = process.env.REPLICATE_API_TOKEN;

// Prompts por estilo — ajuste à vontade para melhorar resultados
const STYLE_PROMPTS = {
  estudio: [
    'Professional studio photography portrait, mother with children, pure white background,',
    'soft cinematic lighting, elegant pose, sharp focus, high-end fashion photography,',
    'photorealistic, 4k, award-winning portrait',
  ].join(' '),

  jardim: [
    'Professional outdoor portrait, mother and children in a beautiful blooming spring garden,',
    'golden hour light, pink cherry blossom bokeh background, warm colors, elegant,',
    'photorealistic 4k portrait photography, editorial quality',
  ].join(' '),

  pordosol: [
    'Professional portrait photography, mother with children at magical golden sunset,',
    'warm orange and pink tones, dreamy soft glow, emotional, candid luxury editorial,',
    'photorealistic 4k, National Geographic quality',
  ].join(' '),
};

// Fallback caso o estilo não seja reconhecido
const DEFAULT_PROMPT = STYLE_PROMPTS.estudio;

// Gera 3 imagens no Replicate usando flux-schnell (texto → imagem)
// Retorna array com as URLs das imagens geradas
async function generatePortraits(estilo, numOutputs = 3) {
  if (!TOKEN) throw new Error('REPLICATE_API_TOKEN não configurado');

  const prompt = STYLE_PROMPTS[estilo] || DEFAULT_PROMPT;

  // Inicia a predição — "Prefer: wait" faz a API aguardar inline (até ~60s)
  const startResp = await axios.post(
    'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions',
    {
      input: {
        prompt,
        num_outputs: numOutputs,
        num_inference_steps: 4,
        aspect_ratio: '3:4',
        output_format: 'jpg',
        output_quality: 90,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        Prefer: 'wait',
      },
      timeout: 120_000,
    }
  );

  let prediction = startResp.data;

  // Poll até concluir (caso o Prefer:wait não tenha resolvido inline)
  let attempts = 0;
  while (
    prediction.status !== 'succeeded' &&
    prediction.status !== 'failed' &&
    prediction.status !== 'canceled' &&
    attempts < 40
  ) {
    await new Promise((r) => setTimeout(r, 3000));

    const pollResp = await axios.get(
      `https://api.replicate.com/v1/predictions/${prediction.id}`,
      { headers: { Authorization: `Bearer ${TOKEN}` }, timeout: 15_000 }
    );
    prediction = pollResp.data;
    attempts++;

    console.log(`[replicate] Status: ${prediction.status} (tentativa ${attempts})`);
  }

  if (prediction.status !== 'succeeded' || !prediction.output) {
    throw new Error(`Replicate falhou: ${prediction.error || prediction.status}`);
  }

  // output é um array de URLs
  return prediction.output;
}

// Baixa uma imagem de uma URL e retorna o Buffer
async function downloadImage(url) {
  const resp = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30_000,
  });
  return Buffer.from(resp.data);
}

module.exports = { generatePortraits, downloadImage };
