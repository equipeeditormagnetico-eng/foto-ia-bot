require('dotenv').config();
const { getSession, updateSession, listAllSessions } = require('./session');
const { sendText } = require('../services/whatsapp');

// Padrões de comandos aceitos
const CMD_FIM      = /^fim\s+(\d+)/;
const CMD_SESSOES  = /^sess[oõ]es$/;
const CMD_REATIVAR = /^reativar\s+(\d+)/;

async function handleOperatorCommand(operatorPhone, text) {
  const cmd = text.trim().toLowerCase();

  // ── fim [número] ──────────────────────────────────────────────────────────
  const fimMatch = cmd.match(CMD_FIM);
  if (fimMatch) {
    const targetPhone = fimMatch[1];
    const session = getSession(targetPhone);
    if (!session) {
      await sendText(operatorPhone, `⚠️ Sessão não encontrada para ${targetPhone}.`);
    } else {
      updateSession(targetPhone, { finished: true });
      console.log(`[operator] Sessão de ${targetPhone} finalizada pelo operador`);
      await sendText(operatorPhone, `✅ Conversa com ${targetPhone} finalizada.`);
    }
    return;
  }

  // ── sessões ───────────────────────────────────────────────────────────────
  if (CMD_SESSOES.test(cmd)) {
    const all = listAllSessions();
    if (all.length === 0) {
      await sendText(operatorPhone, `Nenhuma sessão ativa no momento.`);
    } else {
      const lines = all
        .map((s) => {
          const status = s.finished ? ' *(finalizada)*' : '';
          const nome = s.name ? ` — ${s.name}` : '';
          return `- ${s.phone}${nome} → ${s.state}${status}`;
        })
        .join('\n');
      await sendText(operatorPhone, `📋 *Sessões ativas:*\n${lines}`);
    }
    return;
  }

  // ── reativar [número] ─────────────────────────────────────────────────────
  const reativarMatch = cmd.match(CMD_REATIVAR);
  if (reativarMatch) {
    const targetPhone = reativarMatch[1];
    const session = getSession(targetPhone);
    if (!session) {
      await sendText(operatorPhone, `⚠️ Sessão não encontrada para ${targetPhone}.`);
    } else {
      updateSession(targetPhone, { finished: false, state: 'DONE' });
      console.log(`[operator] Sessão de ${targetPhone} reativada pelo operador`);
      await sendText(operatorPhone, `✅ Conversa com ${targetPhone} reativada.`);
    }
    return;
  }

  // ── comando desconhecido ──────────────────────────────────────────────────
  await sendText(
    operatorPhone,
    `❓ Comandos disponíveis:\n\n` +
    `• *fim [número]* — finaliza a conversa com o lead\n` +
    `• *sessões* — lista todas as sessões ativas\n` +
    `• *reativar [número]* — reativa uma sessão finalizada`
  );
}

module.exports = { handleOperatorCommand };
