# Ensaio das Mães — Bot WhatsApp com IA

Bot de vendas de ensaios fotográficos gerados com IA para o Dia das Mães.  
Stack: **Evolution API + Node.js + Replicate (flux-schnell) + sharp**.

---

## Fluxo de atendimento

```
1. Cliente manda qualquer mensagem
2. Bot mostra menu de estilos (Estúdio / Jardim / Pôr do sol)
3. Bot envia 2 fotos de prova social e pede a foto da cliente
4. Cliente envia foto → Replicate gera 3 portraits com IA
5. Bot aplica marca d'água e envia as 3 prévias + chave PIX
6. Cliente envia comprovante → operador recebe notificação
7. Operador digita  LIBERAR 5511999999999  no próprio WhatsApp
8. Bot envia as 3 fotos em alta resolução sem marca d'água
```

---

## Rodar localmente (sem Docker)

### Pré-requisitos
- Node.js 18+
- Evolution API já rodando (local ou em nuvem)
- Token do [Replicate](https://replicate.com/account/api-tokens)

```bash
# 1. Instale as dependências
npm install

# 2. Copie e preencha o .env
cp .env.example .env
# edite .env com suas chaves

# 3. Inicie o bot
npm start
# ou com hot-reload:
npm run dev
```

### Configure o webhook na Evolution API

No painel da Evolution API (ou via API REST), aponte o webhook da instância para:

```
POST http://localhost:3000/webhook
```

> Para receber webhooks localmente, use o [ngrok](https://ngrok.com):
> ```bash
> ngrok http 3000
> # Copie a URL https://xxxx.ngrok.io e use como webhook
> ```

---

## Rodar localmente com Docker Compose

```bash
# 1. Copie e preencha o .env
cp .env.example .env

# 2. Suba os containers (Evolution API + Bot)
docker compose up --build

# Evolution API → http://localhost:8080
# Bot (health)  → http://localhost:3000/health
```

O webhook já é configurado automaticamente no Docker Compose  
(`WEBHOOK_GLOBAL_URL=http://bot:3000/webhook`).

---

## Deploy no Railway — passo a passo

### 1. Fork do repositório

Acesse o GitHub, abra este repositório e clique em **Fork**.

### 2. Crie conta no Railway

Acesse [railway.app](https://railway.app) → **Login with GitHub**.

### 3. Crie dois serviços no mesmo projeto

#### Serviço A — Evolution API

1. No seu projeto Railway, clique em **+ New Service → Docker Image**
2. Imagem: `atendai/evolution-api:latest`
3. Clique no serviço → **Variables** e adicione:

| Variável | Valor |
|---|---|
| `SERVER_URL` | `https://<domínio-gerado>.railway.app` (URL pública do serviço A) |
| `AUTHENTICATION_API_KEY` | (qualquer string secreta, ex: `minha-chave-123`) |
| `WEBHOOK_GLOBAL_ENABLED` | `true` |
| `WEBHOOK_GLOBAL_URL` | `https://<domínio-do-bot>.railway.app/webhook` (URL pública do serviço B) |
| `WEBHOOK_EVENTS_MESSAGES_UPSERT` | `true` |
| `DATABASE_ENABLED` | `false` |
| `CONFIG_SESSION_PHONE_CLIENT` | `EnsaioDasMaes` |

4. Em **Settings → Networking**, clique em **Generate Domain** para obter a URL pública.

#### Serviço B — Bot Node.js

1. Clique em **+ New Service → GitHub Repo**
2. Selecione o repositório do fork
3. Railway detecta o `Dockerfile` automaticamente → build inicia

4. Clique no serviço → **Variables** e adicione:

| Variável | Valor |
|---|---|
| `EVOLUTION_API_URL` | URL interna do serviço A — veja abaixo |
| `EVOLUTION_API_KEY` | Mesma chave do serviço A |
| `EVOLUTION_INSTANCE` | Nome da instância que você vai criar (ex: `EnsaioInstance`) |
| `REPLICATE_API_TOKEN` | Token do [Replicate](https://replicate.com/account/api-tokens) |
| `MINHA_CHAVE_PIX` | Sua chave PIX (CPF, e-mail, telefone ou aleatória) |
| `OPERATOR_PHONE` | Seu número (DDI+DDD+número, ex: `5511999999999`) |
| `OWNER_PHONE` | Mesmo número ou segundo número |
| `PROOF_IMAGE_1` | URL pública de uma foto de exemplo de ensaio |
| `PROOF_IMAGE_2` | URL pública de uma segunda foto de exemplo |
| `PORT` | `3000` |

> **Como usar a URL interna do Railway entre serviços:**  
> No painel do serviço A → **Settings → Networking → Private Networking**.  
> O formato é `http://<nome-serviço>.railway.internal:<porta>`.  
> Se não tiver rede privada configurada, use a URL pública mesmo.

5. Em **Settings → Networking**, clique em **Generate Domain** para obter a URL pública do bot.

### 4. Criar a instância do WhatsApp

Com os dois serviços rodando, crie a instância e conecte o WhatsApp:

```bash
# Substitua <URL-EVOLUTION> e <API-KEY> pelos valores reais
curl -X POST https://<URL-EVOLUTION>/instance/create \
  -H "apikey: <API-KEY>" \
  -H "Content-Type: application/json" \
  -d '{"instanceName":"EnsaioInstance","qrcode":true}'
```

Depois acesse `https://<URL-EVOLUTION>/instance/connect/EnsaioInstance` para ver o QR code e escanear com o WhatsApp.

### 5. Persistência de imagens (opcional, recomendado)

Por padrão as imagens ficam em `/app/data` dentro do container.  
No Railway isso é resetado a cada deploy.

Para manter as imagens entre deploys:  
Railway → seu projeto → **+ New → Volume** → monte em `/app/data` no serviço B.

---

## Comandos do operador

Envie estes textos para si mesmo no WhatsApp (pelo número configurado em `OPERATOR_PHONE`):

| Comando | O que faz |
|---|---|
| `LIBERAR 5511999999999` | Envia as 3 fotos em alta resolução para a cliente |
| `sessões` | Lista todas as conversas ativas |
| `fim 5511999999999` | Encerra a sessão de uma cliente |
| `reativar 5511999999999` | Reabre uma sessão encerrada |

---

## Personalização rápida

| O que mudar | Onde |
|---|---|
| Textos das mensagens | [`src/bot/messages.js`](src/bot/messages.js) |
| Prompts de IA por estilo | [`src/services/replicate.js`](src/services/replicate.js) — objeto `STYLE_PROMPTS` |
| Imagens de prova social | Variáveis `PROOF_IMAGE_1` e `PROOF_IMAGE_2` no `.env` |
| Preço e chave PIX | Variável `MINHA_CHAVE_PIX` no `.env` |
| Marca d'água | [`src/services/watermark.js`](src/services/watermark.js) |

---

## Estrutura de arquivos

```
├── src/
│   ├── index.js                 # Servidor Express + rota /webhook
│   ├── bot/
│   │   ├── handler.js           # Máquina de estados do fluxo
│   │   ├── messages.js          # Todos os textos editáveis
│   │   ├── session.js           # Sessões em memória + persistência em disco
│   │   └── operator.js          # Comandos do operador (LIBERAR, fim, sessões)
│   └── services/
│       ├── whatsapp.js          # sendText, sendImage, downloadMedia
│       ├── replicate.js         # Geração de imagens com flux-schnell
│       └── watermark.js         # Marca d'água com sharp
├── data/                        # Gerado em runtime (imagens + used_numbers.json)
├── docker-compose.yml           # Evolution API + Bot para rodar local
├── Dockerfile                   # Build do bot para Railway / Docker
├── .env.example                 # Modelo de variáveis de ambiente
├── railway.json                 # Config de deploy no Railway
└── package.json
```

---

## Observações importantes

- **flux-schnell gera portraits de IA**, não uma transformação realista da foto enviada.  
  A foto da cliente é recebida (para provar intenção), mas o modelo gera imagens novas baseadas no prompt.  
  Para transformação realista da foto, substitua pelo modelo `black-forest-labs/flux-dev` em `replicate.js`.

- **URLs do Replicate expiram em ~1h.** As imagens originais são salvas em disco em `data/images/` imediatamente após a geração. O comando `LIBERAR` lê do disco, não da URL.

- **Contas gratuitas do Replicate** têm créditos iniciais. Cada geração de 3 imagens com flux-schnell custa aproximadamente US$ 0,01.
