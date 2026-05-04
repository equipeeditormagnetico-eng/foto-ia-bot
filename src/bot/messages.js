// Todos os textos do bot centralizados aqui — edite à vontade

const PIX_KEY = process.env.MINHA_CHAVE_PIX || '[MINHA_CHAVE_PIX]';

const STYLES = {
  estudio:  '🏛️ Estúdio profissional',
  jardim:   '🌸 Jardim florido',
  pordosol: '🌅 Pôr do sol dourado',
};

const messages = {

  // ── Etapa 1: Boas-vindas ────────────────────────────────
  welcome: () =>
    `Oi! 🌸 Bem-vinda ao *Ensaio das Mães*!\n\n` +
    `Aqui você transforma qualquer foto em um ensaio fotográfico profissional com IA.\n\n` +
    `Por apenas *R$ 29,90* você recebe *3 fotos lindas* pra guardar pra sempre 📸\n\n` +
    `Escolha o estilo do seu ensaio:\n\n` +
    `1️⃣ Estúdio profissional\n` +
    `2️⃣ Jardim florido\n` +
    `3️⃣ Pôr do sol dourado\n\n` +
    `_Responda com o número da opção!_`,

  invalidStyle: () =>
    `Não reconheci essa opção 😅\n\n` +
    `Por favor responda com *1*, *2* ou *3*:\n\n` +
    `1️⃣ Estúdio profissional\n` +
    `2️⃣ Jardim florido\n` +
    `3️⃣ Pôr do sol dourado`,

  // ── Etapa 2: Prova social ───────────────────────────────
  proofIntro: (styleName) =>
    `Ótima escolha! Você vai amar o resultado *${styleName}* 😍\n\n` +
    `Olha o resultado de uma cliente nossa 👇`,

  proofOutro: () =>
    `Agora me envia sua foto com seus filhos! Pode ser selfie mesmo 📱\n\n` +
    `💡 _Dica: boa iluminação = resultado ainda mais incrível!_`,

  // ── Etapa 3: Recebendo a foto ───────────────────────────
  photoReceived: () =>
    `Foto recebida! ✨ Nossa IA já está criando seu ensaio...\n\nAguarda 1 minutinho! ⏳`,

  needPhoto: () =>
    `Preciso de uma *foto* sua para criar o ensaio! 📸\n\n` +
    `Me envia uma foto com seus filhos, pode ser selfie mesmo 😊`,

  // ── Etapa 4: Prévia com marca d'água ───────────────────
  previewIntro: () =>
    `🎨 *Seu ensaio ficou incrível!* Veja a prévia:\n_(marca d'água removida após pagamento)_`,

  previewPayment: () =>
    `Para receber em *ALTA RESOLUÇÃO* sem marca d'água, faça o PIX 👇\n\n` +
    `💰 *R$ 29,90*\n` +
    `🔑 Chave PIX: \`${PIX_KEY}\`\n\n` +
    `Após pagar me envia o *comprovante* aqui! 📄`,

  // ── Etapa 5: Comprovante recebido ──────────────────────
  paymentReceived: () =>
    `Verificando pagamento... ⏳\n\n` +
    `Assim que confirmado você recebe as fotos em alta resolução!`,

  needProof: () =>
    `Para liberar as fotos em alta resolução, me envia o *comprovante do PIX* como imagem 📄\n\n` +
    `💰 *R$ 29,90*\n` +
    `🔑 Chave PIX: \`${PIX_KEY}\``,

  // ── Etapa 6: Liberação ─────────────────────────────────
  finalDelivery: () =>
    `Que lindo! Suas fotos chegaram! 🎉🌸\n\n` +
    `Guarda pra sempre esse momento especial!\n\n` +
    `Se curtiu me marca nas histórias ❤️\n` +
    `_Indica pra uma amiga e ela ganha 10% de desconto!_`,

  // ── Já usou: tem prévia mas não pagou ──────────────────
  alreadyHasPreview: () =>
    `Olá! 👋 Você já tem seu ensaio pronto!\n\n` +
    `Para receber as fotos em alta resolução sem marca d'água:\n\n` +
    `💰 *R$ 29,90*\n` +
    `🔑 Chave PIX: \`${PIX_KEY}\`\n\n` +
    `Basta me enviar o *comprovante do PIX* aqui 📄`,

  // ── Notificação para o operador ────────────────────────
  operatorNotifyPayment: (clientPhone) =>
    `💰 *COMPROVANTE RECEBIDO!*\n\n` +
    `📱 Cliente: ${clientPhone}\n\n` +
    `Para liberar as fotos em alta resolução, responda:\n` +
    `*LIBERAR ${clientPhone}*`,

  operatorLiberarOk: (clientPhone) =>
    `✅ Fotos enviadas para *${clientPhone}* com sucesso!`,

  operatorLiberarNotFound: (clientPhone) =>
    `❌ Sessão não encontrada para *${clientPhone}*.\n\n` +
    `Verifique o número e tente novamente.\n` +
    `_(use o número completo com DDI, ex: 5511999999999)_`,

  operatorHelp: () =>
    `🤖 *Comandos disponíveis:*\n\n` +
    `• *LIBERAR [número]* — envia fotos finais ao cliente\n` +
    `• *fim [número]* — encerra sessão de um lead\n` +
    `• *sessões* — lista sessões ativas\n` +
    `• *reativar [número]* — reativa sessão encerrada\n\n` +
    `_Ex: LIBERAR 5511999999999_`,

  // ── Erro de geração ────────────────────────────────────
  generationError: () =>
    `😔 Tive um problema ao criar as fotos. Pode me enviar a foto novamente?\n\n` +
    `Se o erro persistir, nossa equipe vai te atender manualmente!`,
};

module.exports = { messages, STYLES };
