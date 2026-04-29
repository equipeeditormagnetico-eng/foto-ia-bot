require('dotenv').config();
const { getSession, createSession, updateSession } = require('./session');
const { messages, STYLES } = require('./messages');
const { sendText } = require('../services/whatsapp');

const OWNER_PHONE   = process.env.OWNER_PHONE;
const OWNER_PHONE_2 = process.env.OWNER_PHONE_2;

// Remove prefixo 55 do número para exibição na notificação
function formatPhone(phone) {
  return phone.replace(/^55/, '');
}

// Envia notificação para todos os números do dono configurados
async function sendOwnerNotification(text) {
  const targets = [OWNER_PHONE, OWNER_PHONE_2].filter(Boolean);
  await Promise.all(targets.map((n) => sendText(n, text)));
}

// Resolve qual chave de estilo o lead quis dizer (1–10)
function parseStyle(text) {
  // Aceitar número exato digitado
  if (['1','2','3','4','5','6','7','8','9','10'].includes(text)) return text;

  // Palavras-chave por estilo
  if (text.includes('executivo') || text.includes('empresarial') || text.includes('empresa')) return '1';
  if (text.includes('saude') || text.includes('saúde') || text.includes('medico') ||
      text.includes('médico') || text.includes('enfermeiro') || text.includes('doutor')) return '2';
  if (text.includes('empreendedor') || text.includes('negocio') ||
      text.includes('negócio') || text.includes('local')) return '3';
  if (text.includes('feminino') || text.includes('autoestima') || text.includes('feminina')) return '4';
  if (text.includes('maes') || text.includes('mães') || text.includes('mae') || text.includes('mãe')) return '5';
  if (text.includes('casal') || text.includes('romantico') ||
      text.includes('romântico') || text.includes('namorado')) return '6';
  if (text.includes('gestante') || text.includes('gravida') || text.includes('grávida')) return '7';
  if (text.includes('fitness') || text.includes('corpo') ||
      text.includes('academia') || text.includes('musculação') || text.includes('musculacao')) return '8';
  if (text.includes('perfil') || text.includes('redes sociais') ||
      text.includes('social') || text.includes('instagram')) return '9';
  if (text.includes('datas') || text.includes('comemorativa') ||
      text.includes('aniversario') || text.includes('formatura')) return '10';

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

// AJUSTE 3 — Disparado 30s após a primeira foto recebida
async function processPhotosTimeout(phone) {
  const session = getSession(phone);
  if (!session || session.state !== 'WAITING_PHOTOS') return;

  const photoCount = session.photoCount || 0;
  const displayPhone = formatPhone(phone);

  console.log(`[handler] Timer de fotos disparado para ${phone} (${session.name}) — ${photoCount} foto(s)`);

  try {
    await sendText(phone, messages.confirmPhotosReceived());
    await sendOwnerNotification(
      messages.ownerNotifyTestPhotos(session.name, displayPhone, session.style, photoCount)
    );
  } catch (err) {
    console.error(`[handler] Erro ao enviar confirmação de fotos para ${phone}:`, err.message);
  }

  // AJUSTE 1 — Marcar sessão como finalizada ao entrar em DONE
  updateSession(phone, { state: 'DONE', finished: true });
  console.log(`[handler] Lead ${phone} (${session.name}) finalizado após envio de fotos`);
}

// phone    — número limpo (sem @s.whatsapp.net)
// rawText  — texto da mensagem (vazio para imagens)
// message  — objeto bruto da Evolution API (para detectar imageMessage)
async function handleMessage(phone, rawText, message) {
  const text = rawText.trim().toLowerCase();

  let session = getSession(phone);

  if (!session) {
    session = createSession(phone);
    console.log(`[handler] Nova sessão criada para ${phone} | estado: WELCOME`);
  }

  // AJUSTE 1 — Silenciar completamente sessões finalizadas
  if (session.finished === true) {
    console.log(`[handler] Sessão finalizada para ${phone} — mensagem ignorada`);
    return;
  }

  // Detectar se a mensagem é uma imagem
  const isImage = !!message?.imageMessage;

  console.log(`[handler] ${phone} | estado: ${session.state} | ${isImage ? '[IMAGEM]' : `"${rawText}"`}`);

  switch (session.state) {
    case 'WELCOME': {
      await sendText(phone, messages.welcome());
      updateSession(phone, { state: 'GET_NAME' });
      break;
    }

    case 'GET_NAME': {
      // Se o lead perguntar sobre preço antes de informar o nome,
      // exibir tabela anônima e permanecer em GET_NAME sem salvar como nome
      if (isPricingQuestion(text)) {
        console.log(`[handler] Lead ${phone} perguntou sobre preços antes de informar o nome`);
        await sendText(phone, messages.pricingInfoAnonymous());
        return;
      }

      // Mensagens automáticas de saudação do Meta/Instagram chegam com
      // messageContextInfo mas o texto é extraído normalmente pelo index.js.
      // Se por algum motivo chegarem vazias aqui, ignoramos sem quebrar o fluxo.
      const name = rawText.trim();
      if (!name) {
        console.log(`[handler] GET_NAME: rawText vazio — ignorado (possível saudação automática)`);
        return;
      }

      updateSession(phone, { name, state: 'GET_STYLE' });

      // Log de confirmação: verifica se o estado foi realmente atualizado
      console.log('[handler] Nome salvo:', name, '| Novo estado:', session.state);

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

      // Lead perguntou sobre preço/valor → mostrar tabela usando nome salvo na sessão
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

      if (decision === 'TESTE') {
        // AJUSTE 3 — Não finaliza aqui: aguarda envio das fotos
        await sendText(phone, messages.askPhotos());
        updateSession(phone, { state: 'WAITING_PHOTOS', photoCount: 0, photoTimer: null });
        console.log(`[handler] Lead ${phone} (${session.name}) escolheu TESTE GRATUITO → aguardando fotos`);
      } else {
        // CONTRATAR: informa os pacotes ao lead, notifica o dono e finaliza
        // AJUSTE 1 — marcar finished ao entrar em DONE
        // AJUSTE 2 — usar formatPhone na notificação
        await sendText(phone, messages.confirmHire(session.name));
        await sendOwnerNotification(messages.ownerNotifyHire(session.name, formatPhone(phone), session.style));
        updateSession(phone, { state: 'DONE', finished: true });
        console.log(`[handler] Lead ${phone} (${session.name}) quer CONTRATAR — finalizado`);
      }
      break;
    }

    // AJUSTE 3 — Estado de espera pelas fotos do teste gratuito
    case 'WAITING_PHOTOS': {
      // Ignorar mensagens de texto silenciosamente — aguardar apenas imagens
      if (!isImage) {
        console.log(`[handler] Lead ${phone} enviou texto em WAITING_PHOTOS — aguardando imagens`);
        return;
      }

      const newCount = (session.photoCount || 0) + 1;
      updateSession(phone, { photoCount: newCount });
      console.log(`[handler] Lead ${phone} (${session.name}) enviou foto ${newCount}`);

      // Iniciar timer de 30s somente na primeira imagem recebida
      if (newCount === 1) {
        const timer = setTimeout(() => processPhotosTimeout(phone), 30_000);
        updateSession(phone, { photoTimer: timer });
        console.log(`[handler] Timer de 30s iniciado para ${phone}`);
      }
      break;
    }

    case 'DONE': {
      // Nunca deve ser alcançado pois finished=true é verificado no início
      console.log(`[handler] Lead ${phone} em DONE (estado inesperado) — ignorado`);
      break;
    }

    default: {
      console.warn(`[handler] Estado desconhecido para ${phone}: ${session.state}`);
      break;
    }
  }
}

module.exports = { handleMessage };
