# Atendente WhatsApp — Ensaios Fotográficos com IA

Bot de qualificação de leads via WhatsApp usando Evolution API + Node.js, pronto para deploy no Railway.

---

## Fluxo de atendimento

```
WELCOME → GET_NAME → GET_STYLE → GET_DECISION → DONE
```

1. **WELCOME** — Saudação inicial ao primeiro contato
2. **GET_NAME** — Coleta o nome do lead
3. **GET_STYLE** — Lead escolhe o estilo de ensaio (1–4)
4. **GET_DECISION** — Lead decide entre teste gratuito (A) ou contratar (B)
5. **DONE** — Notificação enviada ao dono + mensagem de confirmação ao lead

---

## Pré-requisitos

- Node.js 18+
- Evolution API configurada e rodando
- Conta no [Railway](https://railway.app) (ou qualquer VPS/PaaS)

---

## Setup local

### 1. Clone e instale dependências

```bash
git clone <seu-repositorio>
cd atendente-fotos-ia
npm install
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` com seus dados:

```env
EVOLUTION_API_URL=https://sua-evolution-api.com
EVOLUTION_API_KEY=sua_api_key_aqui
EVOLUTION_INSTANCE=nome_da_instancia
OWNER_PHONE=5581987990864
PORT=3000
```

### 3. Rode localmente

```bash
npm start
# ou com hot-reload (Node 18+):
npm run dev
```

### 4. Configure o webhook na Evolution API

Aponte o webhook da sua instância para:

```
POST https://<sua-url>/webhook
```

No painel da Evolution API (ou via API REST):
- **URL:** `https://<sua-url>/webhook`
- **Eventos habilitados:** `MESSAGES_UPSERT`

---

## Deploy no Railway

### 1. Crie um novo projeto no Railway

```bash
# Via CLI do Railway:
railway login
railway init
railway up
```

### 2. Configure as variáveis de ambiente

No painel do Railway → seu serviço → **Variables**, adicione:

| Variável | Valor |
|---|---|
| `EVOLUTION_API_URL` | URL da sua Evolution API |
| `EVOLUTION_API_KEY` | Chave da API |
| `EVOLUTION_INSTANCE` | Nome da instância |
| `OWNER_PHONE` | Número do dono (com DDI, sem +) |
| `PORT` | 3000 |

### 3. Atualize o webhook

Após o deploy, o Railway fornecerá uma URL pública. Atualize o webhook na Evolution API para:

```
POST https://<seu-projeto>.railway.app/webhook
```

---

## Estrutura de arquivos

```
├── src/
│   ├── index.js              # Servidor Express + rota /webhook
│   ├── bot/
│   │   ├── handler.js        # Máquina de estados do fluxo
│   │   ├── messages.js       # Todos os textos editáveis centralizados
│   │   └── session.js        # Gerenciamento de sessões (TTL + lembrete)
│   └── services/
│       └── whatsapp.js       # sendText() via Evolution API
├── .env.example
├── railway.json
├── package.json
└── README.md
```

---

## Comportamentos especiais

| Situação | Comportamento |
|---|---|
| 15 min sem resposta (fluxo ativo) | Envia lembrete automático uma vez |
| Sessão inativa por 24h | Sessão apagada da memória |
| Mensagem de grupo | Ignorada |
| Mensagem enviada pelo próprio bot | Ignorada (`fromMe: true`) |
| Opção inválida (estilo ou decisão) | Repete a pergunta educadamente |

---

## Personalização

Todos os textos do bot estão em **`src/bot/messages.js`** — edite à vontade sem mexer na lógica.
