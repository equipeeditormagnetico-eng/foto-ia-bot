const sharp = require('sharp');

const WATERMARK_TEXT = '© EnsaioDasMães';

// Aplica marca d'água diagonal em um Buffer de imagem
// Retorna um novo Buffer JPEG com a marca aplicada
async function applyWatermark(imageBuffer, text = WATERMARK_TEXT) {
  const meta = await sharp(imageBuffer).metadata();
  const w = meta.width  || 1024;
  const h = meta.height || 1024;

  // Tamanho da fonte proporcional à largura
  const fontSize = Math.max(18, Math.floor(w * 0.042));
  const gap      = Math.floor(h * 0.22); // espaço vertical entre repetições

  // Gera as linhas de texto repetidas em diagonal (–35°) para cobrir a imagem
  const lines = [];
  for (let y = -h * 0.1; y < h * 1.2; y += gap) {
    lines.push(
      `<text x="${w * 0.05}" y="${y}" transform="rotate(-35,${w / 2},${h / 2})">${text}</text>`
    );
  }

  const svg = `
    <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <style>
        text {
          font-family: Arial, Helvetica, sans-serif;
          font-size: ${fontSize}px;
          font-weight: bold;
          fill: rgba(255,255,255,0.50);
          letter-spacing: 2px;
        }
      </style>
      ${lines.join('\n')}
    </svg>`;

  return sharp(imageBuffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: false })
    .toBuffer();
}

module.exports = { applyWatermark };
