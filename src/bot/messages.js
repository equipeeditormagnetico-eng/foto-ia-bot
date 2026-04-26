const STYLES = {
  '1': 'Executivo / Corporativo',
  '2': 'Artístico / Editorial',
  '3': 'Casual / Lifestyle',
  '4': 'Glamour / Fashion',
};

const messages = {
  welcome: () =>
    `Olá! 👋 Seja bem-vindo(a)!\n` +
    `Eu sou a assistente virtual do nosso estúdio de ensaios fotográficos com IA. 📸✨\n\n` +
    `Aqui a gente transforma qualquer foto sua em um ensaio profissional incrível — sem precisar sair de casa!\n\n` +
    `Para começar, me conta: qual é o seu nome?`,

  askStyle: (name) =>
    `Que nome lindo, ${name}! 😊\n\n` +
    `Agora me diz: qual estilo de ensaio combina mais com você?\n\n` +
    `1️⃣ Executivo / Corporativo — perfeito para LinkedIn e perfil profissional\n` +
    `2️⃣ Artístico / Editorial — fotos com mood e estética diferenciada\n` +
    `3️⃣ Casual / Lifestyle — natural, leve e autêntico\n` +
    `4️⃣ Glamour / Fashion — elegante, poderoso e impactante\n\n` +
    `Responde com o número da opção! 👇`,

  invalidStyle: () =>
    `Hmm, não entendi essa opção! 😅\n\n` +
    `Por favor, responde com o *número* da opção que combina com você:\n\n` +
    `1️⃣ Executivo / Corporativo\n` +
    `2️⃣ Artístico / Editorial\n` +
    `3️⃣ Casual / Lifestyle\n` +
    `4️⃣ Glamour / Fashion`,

  askDecision: (name, style) =>
    `Ótima escolha! O estilo *${style}* fica LINDO! 🔥\n\n` +
    `Agora me diz, ${name}: como você prefere seguir?\n\n` +
    `✅ A — Quero fazer um *teste gratuito* primeiro para ver como fica\n` +
    `💎 B — Já quero contratar direto o pacote completo!\n\n` +
    `Qual das duas opções é a sua?`,

  pricingInfo: (name) =>
    `Ótima pergunta, ${name}! 😊\n\n` +
    `O *teste gratuito* é 1 foto sem nenhum custo — você vê como fica antes de decidir qualquer coisa! ✅\n\n` +
    `Se adorar (e vai adorar! 😄), temos dois pacotes:\n\n` +
    `📸 *Pacote Essencial* — R$ 97,00\n` +
    `6 fotos profissionais em diferentes cenários\n\n` +
    `📸 *Pacote Completo* — R$ 149,00\n` +
    `10 fotos profissionais em diferentes cenários\n\n` +
    `Os dois incluem entrega em 24h e sem sair de casa! 🏠\n\n` +
    `Então me diz: prefere começar pelo teste grátis (A) ou já garantir um dos pacotes (B)?`,

  invalidDecision: () =>
    `Não entendi bem! 😅 Responde com *A* ou *B*:\n\n` +
    `✅ A — Teste gratuito primeiro\n` +
    `💎 B — Contratar o pacote completo direto`,

  confirmTest: () =>
    `Perfeito! 🎉 Vou avisar nossa equipe agora mesmo.\n` +
    `Em breve alguém vai entrar em contato com você para combinar os detalhes do teste gratuito!\n\n` +
    `Qualquer dúvida é só chamar aqui. 😊`,

  confirmHire: (name) =>
    `Incrível, ${name}! Você tomou a melhor decisão! 🚀\n\n` +
    `Nossos pacotes disponíveis:\n\n` +
    `📸 *Pacote Essencial* — R$ 97,00\n` +
    `6 fotos profissionais em diferentes cenários\n\n` +
    `💎 *Pacote Completo* — R$ 149,00\n` +
    `10 fotos profissionais em diferentes cenários\n\n` +
    `Nossa equipe vai entrar em contato em instantes para você escolher o pacote e já começar! ✨`,

  done: () =>
    `Nossa equipe já foi avisada e entrará em contato em breve! 😊\n` +
    `Se tiver alguma dúvida urgente, pode perguntar aqui que eu te ajudo!`,

  reminder: (name) =>
    `Oi ${name || ''}! Ainda estou por aqui caso queira continuar. 😊`.trim(),

  ownerNotifyTest: (name, phone, style) =>
    `🔔 *NOVO LEAD — TESTE GRATUITO*\n\n` +
    `Nome: ${name}\n` +
    `Telefone: ${phone}\n` +
    `Estilo escolhido: ${style}\n` +
    `Decisão: Quer fazer o TESTE gratuito primeiro\n\n` +
    `⚡ Entre em contato agora!`,

  ownerNotifyHire: (name, phone, style) =>
    `🔥 *NOVO LEAD — QUER CONTRATAR*\n\n` +
    `Nome: ${name}\n` +
    `Telefone: ${phone}\n` +
    `Estilo escolhido: ${style}\n` +
    `Decisão: Quer CONTRATAR o pacote completo\n\n` +
    `💰 Lead informado sobre os pacotes:\n` +
    `- Essencial: R$ 97,00 (6 fotos)\n` +
    `- Completo: R$ 149,00 (10 fotos)\n\n` +
    `💰 Entre em contato agora para fechar!`,
};

module.exports = { messages, STYLES };
