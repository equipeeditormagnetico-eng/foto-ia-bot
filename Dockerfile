# ── Build stage ───────────────────────────────────────────
FROM node:18-slim AS base

# sharp precisa de libvips — instalada aqui antes do npm install
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Cria a pasta de dados (imagens geradas + used_numbers.json)
RUN mkdir -p /app/data/images

EXPOSE 3000

CMD ["node", "src/index.js"]
