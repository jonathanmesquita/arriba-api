export const FRESHDESK_SCENARIOS = {
  datacob: "Mover para Datacob",
  databasa: "Mover para CRM/DataBusca",
  databusc: "Mover para CRM/DataBusca",
  desenvolvimento: "Mover para Desenvolvimento",
  comercial: "Mover para Comercial",
  delivery: "Mover para Delivery"
};

export const FRESHDESK_ALLOWED_PRIORITIES = ["Baixa", "Média", "Alta", "Urgente"];

export const FRESHDESK_ALLOWED_STATUSES = [
  "Aberto",
  "Pendente",
  "Resolvido",
  "Fechado",
  "Aguardando Aprovação",
  "Aguardando Cliente",
  "Análise",
  "Desenvolvendo",
  "Homologado",
  "Rejeitado",
  "Em Backlog"
];

export const FRESHDESK_ALLOWED_TYPES = [
  "Dúvida",
  "Elógios",
  "Enriquecimento",
  "Exclusão de dados",
  "Higienização",
  "Incidente",
  "Infra/Hardware/Software",
  "Integração",
  "Lentidão",
  "Melhorias",
  "Migração",
  "Modelagem",
  "Notificação de Consumo de PACOTES",
  "Pesquisa",
  "Prorrogar Teste",
  "Prospect",
  "Recepção de Arquivo",
  "Reclamação",
  "Questionário de avaliação",
  "Relatório",
  "Requisições de titular",
  "Reset Senha",
  "Reunião",
  "Sugestão",
  "Token/TAG",
  "Treinamento",
  "Versão",
  "Alteração de Licenças"
];

export const DEVELOPMENT_QUALIFICATION_TYPES = ["Melhoria", "Customização", "BUG (Erros)", "Não aplicável"];

export const SUPPORT_GROUPS = {
  "Suporte DataCob": {
    agents: [
      "Jonathan Mesquita",
      "Jonathan Oliveira Mesquita",
      "Jonathan Oliveira Oliveira Mesquita",
      "Ariel Fernando Saraiva da Silva",
      "Milena Miranda de Araujo",
      "Weslley Squavolin Andrade",
      "Ana Caroline Amarim de Souza",
      "Ananias Neto"
    ]
  },
  "Suporte CRM/DataBusca": {
    agents: []
  },
  Comercial: {
    agents: []
  },
  Suporte: {
    agents: []
  }
};

export const DEFAULT_STATUS_LABELS = {
  2: "Aberto",
  3: "Pendente",
  4: "Resolvido",
  5: "Fechado"
};

export const DEFAULT_PRIORITY_LABELS = {
  1: "Baixa",
  2: "Média",
  3: "Alta",
  4: "Urgente"
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

function formatContactFromContext(ticket = {}, context = {}) {
  const contact = context.contact || ticket.requester || {};
  const phones = [contact.phone, contact.mobile, contact.work_phone].filter(Boolean);
  return [
    `Contato: ${contact.name || ticket.requester?.name || ticket.requester_name || ticket.name || "Não informado"}`,
    `E-mail: ${contact.email || ticket.requester?.email || ticket.email || ticket.requester_email || "Não informado"}`,
    `Telefone: ${phones.length ? phones.join(" / ") : "Não informado"}`,
    `Empresa: ${context.company?.name || ticket.company_name || ticket.company || ticket.company_id || "Não informado"}`
  ].join("\n");
}

export function buildTicketText(ticket, conversations = [], context = {}) {
  const conversationText = conversations
    .slice(-8)
    .map((item, index) => {
      const author = item.user_id || item.from_email || item.support_email || "origem desconhecida";
      return `Interação ${index + 1} (${author}): ${stripHtml(item.body_text || item.body || "")}`;
    })
    .join("\n\n");

  const openTickets = (context.requesterOpenTickets || [])
    .slice(0, 8)
    .map((item) => `#${item.id} - ${item.subject || "Sem assunto"}`)
    .join("\n");

  const associatedTickets = (context.associatedTickets || [])
    .slice(0, 8)
    .map((item) => `#${item.id} - ${item.subject || "Sem assunto"}`)
    .join("\n");

  return [
    `Ticket: #${ticket.id || ticket.ticketId || "manual"}`,
    `Assunto: ${ticket.subject || ticket.title || ""}`,
    formatContactFromContext(ticket, context),
    `Grupo atual: ${context.group?.name || ticket.group_name || ticket.group_id || "Não informado"}`,
    `Agente atual: ${context.agent?.contact?.name || context.agent?.name || ticket.responder_name || ticket.agent_name || ticket.responder_id || "Não informado"}`,
    `Tags: ${(ticket.tags || []).join(", ")}`,
    `Tipo atual: ${ticket.type || ticket.ticket_type || "Não informado"}`,
    `Status atual: ${ticket.status || "Não informado"}`,
    `Prioridade atual: ${ticket.priority || "Não informado"}`,
    `Descrição: ${stripHtml(ticket.description_text || ticket.description || ticket.message || "")}`,
    conversationText ? `Histórico recente:\n${conversationText}` : "",
    openTickets ? `Tickets abertos do solicitante:\n${openTickets}` : "",
    associatedTickets ? `Tickets associados:\n${associatedTickets}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildInternalNoteHtml(analysis) {
  const checklist = (analysis.checklist || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  const contact = analysis.contactSummary
    ? `<h3>Contato</h3>
      <p><strong>Nome:</strong> ${escapeHtml(analysis.contactSummary.name || "Não informado")}</p>
      <p><strong>E-mail:</strong> ${escapeHtml(analysis.contactSummary.email || "Não informado")}</p>
      <p><strong>Telefone:</strong> ${escapeHtml(analysis.contactSummary.phone || "Não informado")}</p>
      <p><strong>Empresa:</strong> ${escapeHtml(analysis.contactSummary.company || "Não informado")}</p>`
    : "";

  const spec = analysis.developmentSpec
    ? `<hr><h3>Especificação sugerida para Desenvolvimento</h3><pre>${escapeHtml(analysis.developmentSpec)}</pre>`
    : "";

  return `
    <div>
      <h2>Análise IA - PH3A Support Copilot</h2>
      ${contact}
      <p><strong>Produto:</strong> ${escapeHtml(analysis.product || "Não identificado")}</p>
      <p><strong>Tipo Freshdesk:</strong> ${escapeHtml(analysis.freshdeskType || analysis.requestType || "Não identificado")}</p>
      <p><strong>Tipo DEV:</strong> ${escapeHtml(analysis.developmentType || "Não aplicável")}</p>
      <p><strong>Prioridade sugerida:</strong> ${escapeHtml(analysis.priority || "Não identificada")}</p>
      <p><strong>Status sugerido:</strong> ${escapeHtml(analysis.statusSuggestion || "Revisar")}</p>
      <p><strong>Cenário recomendado:</strong> ${escapeHtml(analysis.recommendedScenario || "Revisão manual")}</p>
      <p><strong>Grupo recomendado:</strong> ${escapeHtml(analysis.recommendedGroup || "Revisar")}</p>
      <p><strong>Confiança:</strong> ${Math.round((analysis.confidence || 0) * 100)}%</p>
      <h3>Resumo</h3>
      <p>${escapeHtml(analysis.summary || "Sem resumo gerado.")}</p>
      <h3>Resposta sugerida</h3>
      <p>${escapeHtml(analysis.suggestedReply || "Sem resposta sugerida.")}</p>
      <h3>Checklist de evidências</h3>
      <ul>${checklist}</ul>
      ${spec}
      <p><em>Observação: análise gerada por IA/fallback local. Revisar antes de responder ou executar cenário.</em></p>
    </div>
  `;
}

export function buildDevelopmentSpec(analysis, ticket = {}, context = {}) {
  const contact = analysis.contactSummary || {};
  const companyName = context.company?.name || contact.company || ticket.company_name || ticket.company || "<NOME DO CLIENTE>";
  const clientId = context.company?.custom_fields?.cliente_id || ticket.custom_fields?.cliente || ticket.company_id || ticket.customerId || "<ID_CLIENTE>";
  const analystName = context.agent?.contact?.name || context.agent?.name || ticket.responder_name || ticket.agent_name || "<NOME ANALISTA>";
  const ticketId = ticket.id || ticket.ticketId || "<ID_TICKET>";
  const devType = analysis.developmentType && analysis.developmentType !== "Não aplicável" ? analysis.developmentType : "BUG (Erros) | Melhoria | Customização";

  return `------------| Especificação de Requisito PARA DESENVOLVIMENTO |------------

Cliente: ${clientId} - ${companyName}
Versão do cliente:
Versão PH3A:

Analista Responsável: ${analystName}
Ticket Freshdesk: #${ticketId}
Produto: ${analysis.product || "Não identificado"}
Tipo DEV: ${devType}
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

export function formatTicketListForUi(tickets = []) {
  return tickets.map((ticket) => ({
    id: ticket.id,
    subject: ticket.subject || "Sem assunto",
    status: DEFAULT_STATUS_LABELS[ticket.status] || ticket.status || "Não informado",
    priority: DEFAULT_PRIORITY_LABELS[ticket.priority] || ticket.priority || "Não informado",
    type: ticket.type || "Não informado",
    updatedAt: ticket.updated_at || ticket.created_at || ""
  }));
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
