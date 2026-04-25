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

// Resolve se o lead escolheu teste ou contratar
function parseDecision(text) {
  if (text.includes('b') || text.includes('contratar') || text.includes('pacote') ||
      text.includes('completo') || text.includes('direto')) return 'CONTRATAR';

  if (text.includes('a') || text.includes('teste') || text.includes('grátis') ||
      text.includes('gratis') || text.includes('gratuito')) return 'TESTE';

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
