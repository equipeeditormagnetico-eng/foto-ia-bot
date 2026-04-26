require('dotenv').config();
const { getSession, createSession, updateSession } = require('./session');
const { messages, STYLES } = require('./messages');
const { sendText } = require('../services/whatsapp');

const OWNER_PHONE = process.env.OWNER_PHONE;

// Resolve qual chave de estilo o lead quis dizer
function parseStyle(text) {
  if (['1', '2', '3', '4'].includes(text)) return text;

  if (text.includes('executivo') || text.includes('corporativo')) return '1';
  if (text.includes('artístico') || text.includes('artistico') || text.includes('editorial')) return '2';
  if (text.includes('casual') || text.includes('lifestyle')) return '3';
  if (text.includes('glamour') || text.includes('fashion')) return '4';

  return null;
}

// Detecta se o lead está perguntando sobre preço/valor
// Usado tanto no GET_NAME quanto no GET_DECISION
function isPricingQuestion(text) {
  const keywords = ['valor', 'preço', 'preco', 'quanto', 'custa', 'custo', 'como funciona', 'pacote', 'plano', '?'];
  return keywords.some((kw) => text.includes(kw));
}

// Resolve se o lead escolheu teste ou contratar
// Retorna: 'TESTE' | 'CONTRATAR' | 'PRICING' | null
function parseDecision(text) {
  // Perguntas sobre preço têm prioridade antes de checar letras isoladas
  if (isPricingQuestion(text)) return 'PRICING';

  // Opção B — contratar (checar antes do 'a' para evitar falso positivo em "pacote")
  if (text === 'b' || text.includes('contratar') || text.includes('pacote') ||
      text.includes('completo') || text.includes('direto') || text.includes('garantir')) return 'CONTRATAR';

  // Opção A — teste gratuito
  if (text === 'a' || text.includes('teste') || text.includes('grátis') ||
      text.includes('gratis') || text.includes('gratuito') || text.includes('free')) return 'TESTE';

  return null;
}

async function handleMessage(phone, rawText) {
  const text = rawText.trim().toLowerCase();

  let session = getSession(phone);

  if (!session) {
    session = createSession(phone);
    console.log(`[handler] Nova sessão criada para ${phone} | estado: WELCOME`);
  }

  console.log(`[handler] ${phone} | estado: ${session.state} | mensagem: "${rawText}"`);

  switch (session.state) {
    case 'WELCOME': {
      await sendText(phone, messages.welcome());
      updateSession(phone, { state: 'GET_NAME' });
      break;
    }

    case 'GET_NAME': {
      // BUG 1 — se o lead perguntar sobre preço antes de informar o nome,
      // exibir tabela e permanecer em GET_NAME sem salvar a mensagem como nome
      if (isPricingQuestion(text)) {
        console.log(`[handler] Lead ${phone} perguntou sobre preços antes de informar o nome`);
        await sendText(phone, messages.pricingInfoAnonymous());
        return;
      }

      const name = rawText.trim();
      updateSession(phone, { name, state: 'GET_STYLE' });
      await sendText(phone, messages.askStyle(name));
      break;
    }

    case 'GET_STYLE': {
      const styleKey = parseStyle(text);
      if (!styleKey) {
        await sendText(phone, messages.invalidStyle());
        return;
      }
      const styleName = STYLES[styleKey];
      updateSession(phone, { style: styleName, state: 'GET_DECISION' });
      await sendText(phone, messages.askDecision(session.name, styleName));
      break;
    }

    case 'GET_DECISION': {
      const decision = parseDecision(text);

      // Lead perguntou sobre preço/valor → mostrar tabela usando nome salvo na sessão (BUG 2)
      if (decision === 'PRICING') {
        console.log(`[handler] Lead ${phone} (${session.name}) perguntou sobre preços`);
        await sendText(phone, messages.pricingInfo(session.name)); // session.name, nunca rawText
        return;
      }

      // Resposta não reconhecida → repetir opções A/B
      if (!decision) {
        await sendText(phone, messages.invalidDecision());
        return;
      }

      updateSession(phone, { state: 'DONE' });

      if (decision === 'TESTE') {
        await sendText(phone, messages.confirmTest());
        await sendText(OWNER_PHONE, messages.ownerNotifyTest(session.name, phone, session.style));
        console.log(`[handler] Lead ${phone} (${session.name}) escolheu TESTE GRATUITO`);
      } else {
        // CONTRATAR: primeiro informa os pacotes ao lead, depois notifica o dono
        await sendText(phone, messages.confirmHire(session.name));
        await sendText(OWNER_PHONE, messages.ownerNotifyHire(session.name, phone, session.style));
        console.log(`[handler] Lead ${phone} (${session.name}) quer CONTRATAR`);
      }
      break;
    }

    case 'DONE': {
      await sendText(phone, messages.done());
      break;
    }

    default: {
      console.warn(`[handler] Estado desconhecido para ${phone}: ${session.state}`);
      break;
    }
  }
}

module.exports = { handleMessage };
