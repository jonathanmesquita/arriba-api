export const FRESHDESK_SCENARIOS = {
  datacob: "Mover para Datacob",
  databasa: "Mover para CRM/DataBusca",
  databusc: "Mover para CRM/DataBusca",
  desenvolvimento: "Mover para Desenvolvimento",
  comercial: "Mover para Comercial",
  delivery: "Mover para Delivery"
};

export function stripHtml(value = "") {
  return String(value)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildTicketText(ticket, conversations = []) {
  const conversationText = conversations
    .slice(-6)
    .map((item, index) => {
      const author = item.user_id || item.from_email || item.support_email || "origem desconhecida";
      return `Interação ${index + 1} (${author}): ${stripHtml(item.body_text || item.body || "")}`;
    })
    .join("\n\n");

  return [
    `Ticket: #${ticket.id || ticket.ticketId || "manual"}`,
    `Assunto: ${ticket.subject || ""}`,
    `Solicitante: ${ticket.requester?.name || ticket.requester_name || ticket.name || ""}`,
    `E-mail: ${ticket.requester?.email || ticket.email || ticket.requester_email || ""}`,
    `Empresa: ${ticket.company_id || ticket.company || ""}`,
    `Descrição: ${stripHtml(ticket.description_text || ticket.description || ticket.message || "")}`,
    conversationText ? `Histórico recente:\n${conversationText}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildInternalNoteHtml(analysis) {
  const checklist = (analysis.checklist || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  const spec = analysis.developmentSpec
    ? `<hr><h3>Especificação sugerida para Desenvolvimento</h3><pre>${escapeHtml(analysis.developmentSpec)}</pre>`
    : "";

  return `
    <div>
      <h2>Analise IA - PH3A Support Copilot</h2>
      <p><strong>Produto:</strong> ${escapeHtml(analysis.product || "Não identificado")}</p>
      <p><strong>Tipo:</strong> ${escapeHtml(analysis.requestType || "Não identificado")}</p>
      <p><strong>Prioridade sugerida:</strong> ${escapeHtml(analysis.priority || "Não identificada")}</p>
      <p><strong>Cenario recomendado:</strong> ${escapeHtml(analysis.recommendedScenario || "Revisão manual")}</p>
      <p><strong>Confianca:</strong> ${Math.round((analysis.confidence || 0) * 100)}%</p>
      <h3>Resumo</h3>
      <p>${escapeHtml(analysis.summary || "Sem resumo gerado.")}</p>
      <h3>Resposta sugerida</h3>
      <p>${escapeHtml(analysis.suggestedReply || "Sem resposta sugerida.")}</p>
      <h3>Checklist de evidencias</h3>
      <ul>${checklist}</ul>
      ${spec}
      <p><em>Observacao: analise gerada por IA/fallback local. Revisar antes de responder ou executar cenario.</em></p>
    </div>
  `;
}

export function buildDevelopmentSpec(analysis, ticket = {}) {
  const clientName = ticket.requester?.name || ticket.requester_name || ticket.name || "<NOME DO CLIENTE>";
  const analystName = ticket.responder_name || ticket.agent_name || "<NOME ANALISTA>";
  const ticketId = ticket.id || ticket.ticketId || "<ID_TICKET>";

  return `------------| Especificação de Requisito PARA DESENVOLVIMENTO |------------

Cliente: ${clientName}
Versão do cliente:
Versão PH3A:

Analista Responsável: ${analystName}
Ticket Freshdesk: #${ticketId}
Produto: ${analysis.product || "Não identificado"}
Prioridade sugerida: ${analysis.priority || "Revisar"}

---------------------------------------
Rotina:
${analysis.routine || "<Rotina, tela ou módulo afetado>"}

O cenário atual:
${analysis.currentScenario || analysis.summary || "<Explicação sobre o problema que deve ser corrigido/melhorado/criado>"}

A necessidade é:
${analysis.expectedBehavior || "<Explicação de como a rotina deve funcionar/ser entregue>"}

Critério de aceite:
${(analysis.acceptanceCriteria || [
  "O comportamento esperado deve ser validado com base no cenário informado.",
  "O problema não deve ocorrer após a correção/melhoria.",
  "O suporte deve conseguir reproduzir e homologar o cenário."
]).map((item) => `- ${item}`).join("\n")}

------------------------------------------------
Anexo:
${(analysis.evidenceNeeded || analysis.checklist || ["Prints, arquivos, logs e exemplos citados no chamado."]).map((item) => `- ${item}`).join("\n")}
`;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
