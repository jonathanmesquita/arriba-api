import { renderPlaceholders, buildPlaceholderVariables } from "./placeholders.js";
export const FRESHDESK_SCENARIOS = {
  datacob: "Mover para Datacob",
  databasa: "Mover para CRM/DataBusca",
  databusc: "Mover para CRM/DataBusca",
  desenvolvimento: "Mover para Desenvolvimento",
  comercial: "Mover para Comercial",
  delivery: "Mover para Delivery"
};

export const FRESHDESK_PRIORITIES = ["Baixa", "Media", "Alta", "Urgente"];
export const DEV_TYPES = ["Melhoria", "Customizacao", "BUG (Erros)"];

export const SUPPORT_DATACOB_AGENTS = [
  "Jonathan Mesquita",
  "Jonathan Oliveira Mesquita",
  "Ariel Fernando Saraiva da Silva",
  "Milena Miranda de Araujo",
  "Weslley Squavolin Andrade",
  "Ana Caroline Amarim de Souza",
  "Ananias Neto"
];

export const SUPPORT_DATABOC_AGENTS = SUPPORT_DATACOB_AGENTS;

export const FRESHDESK_TICKET_TYPES = [
  "Duvida",
  "Elogios",
  "Enriquecimento",
  "Exclusao de dados",
  "Higienizacao",
  "Incidente",
  "Infra/Hardware/Software",
  "Integracao",
  "Lentidao",
  "Melhorias",
  "Migracao",
  "Modelagem",
  "Notificacao de Consumo de PACOTES",
  "Pesquisa",
  "Prorrogar Teste",
  "Prospect",
  "Recepcao de Arquivo",
  "Reclamacao",
  "Questionario de avaliacao",
  "Relatorio",
  "Requisicoes de titular",
  "Reset Senha",
  "Reuniao",
  "Sugestao",
  "Token/TAG",
  "Treinamento",
  "Versao",
  "Alteracao de Licencas"
];

export const FRESHDESK_TEMPLATES = {
  respostaInicial: {
    title: "Resposta apos abertura do chamado - DATACOB",
    type: "public_reply",
    useWhen: ["novo_chamado", "analise_inicial", "sem_evidencias"],
    body: `Ola {{ticket.requester.firstname}},

Agradecemos por sua mensagem e queremos informar que ja estamos analisando sua solicitacao.

Em breve, entraremos em contato com voce para fornecer mais informacoes.

Ticket: #{{ticket.id}}
Portal: {{ticket.url}}

Atenciosamente,
{{ticket.agent.name}}`
  },

  solicitarEvidencias: {
    title: "Solicitar mais evidencias",
    type: "public_reply",
    useWhen: ["erro", "bug", "recepcao_arquivo", "lentidao", "duvida_incompleta"],
    body: `Ola {{ticket.requester.firstname}},

Para avancarmos com a analise do chamado #{{ticket.id}}, poderia nos encaminhar as seguintes informacoes?

{{ai.checklist}}

Com essas evidencias conseguimos direcionar a analise com mais precisao.

Atenciosamente,
{{ticket.agent.name}}`
  },

  encaminharDesenvolvimento: {
    title: "Chamado encaminhado para Desenvolvimento",
    type: "public_reply",
    useWhen: ["bug", "melhoria", "customizacao", "desenvolvimento"],
    body: `Ola {{ticket.requester.firstname}},

Apos analise inicial do chamado #{{ticket.id}}, identificamos a necessidade de avaliacao tecnica pelo nosso time de Desenvolvimento.

O caso sera encaminhado com as informacoes coletadas ate o momento. Caso sejam necessarias evidencias adicionais, retornaremos por este chamado.

Atenciosamente,
{{ticket.agent.name}}`
  },

  direcionamentoComercial: {
    title: "Direcionamento para Comercial",
    type: "public_reply",
    useWhen: ["comercial", "proposta", "licenca", "demo", "prospect"],
    body: `Ola {{ticket.requester.firstname}},

Recebemos sua solicitacao e identificamos que ela esta relacionada a uma demanda comercial.

Vamos direcionar seu atendimento para a equipe responsavel, que seguira com as proximas orientacoes.

Atenciosamente,
{{ticket.agent.name}}`
  },

  aguardandoCliente: {
    title: "Aguardando retorno do cliente",
    type: "public_reply",
    useWhen: ["aguardando_cliente", "pendencia_cliente"],
    body: `Ola {{ticket.requester.firstname}},

Para continuarmos a analise do chamado #{{ticket.id}}, precisamos do seu retorno com as informacoes solicitadas anteriormente.

Assim que recebermos os dados, daremos sequencia ao atendimento.

Atenciosamente,
{{ticket.agent.name}}`
  },

  notaInternaIA: {
    title: "@Anotacoes - Analise IA Support Copilot",
    type: "private_note",
    body: `Analise IA - Support Copilot

Ticket: #{{ticket.id}}
Assunto: {{ticket.subject}}
URL do ticket: {{ticket.url}}
Portal: {{ticket.portal_url}}
Helpdesk: {{helpdesk_name}}
Portal Freshdesk: {{ticket.portal_name}}

Solicitante: {{ticket.requester.name}}
Primeiro nome: {{ticket.requester.firstname}}
Sobrenome: {{ticket.requester.lastname}}
E-mail: {{ticket.requester.email}}
Telefone: {{ticket.requester.phone}}
Celular: {{ticket.requester.mobile}}
Endereco: {{ticket.requester.address}}
ID externo: {{ticket.requester.unique_external_id}}

Empresa: {{ticket.company.name}}
Razao social: {{ticket.company.businessname}}
Segmento: {{ticket.company.industry}}
Tier: {{ticket.company.account_tier}}
Health score: {{ticket.company.health_score}}
Dominios: {{ticket.company.domains}}
Renovacao: {{ticket.company.renewal_date}}
Descricao empresa: {{ticket.company.description}}
Nota empresa: {{ticket.company.note}}

Grupo atual: {{ticket.group.name}}
Agente atual: {{ticket.agent.name}} - {{ticket.agent.email}}
Grupo interno: {{ticket.internal_group.name}}
Agente interno: {{ticket.internal_agent.name}} - {{ticket.internal_agent.email}}
Status atual: {{ticket.status}}
Prioridade atual: {{ticket.priority}}
Origem: {{ticket.source}}
Tipo atual: {{ticket.ticket_type}}
Tags: {{ticket.tags}}
Vencimento/SLA: {{ticket.due_by_time}}
Ticket pai: {{ticket.parent_ticket_id}}
Ticket tracker: {{ticket.tracker_ticket_id}}
Pesquisa de satisfacao: {{ticket.satisfaction_survey}}
Produto: {{ticket.product_description}}

Ultimo comentario publico:
{{ticket.latest_public_comment}}

Ultimo comentario privado:
{{ticket.latest_private_comment}}

Resumo da solicitacao:
{{ai.summary}}

Produto identificado:
{{ai.product}}

Tipo Freshdesk sugerido:
{{ai.freshdeskType}}

Tipo DEV sugerido:
{{ai.developmentType}}

Prioridade sugerida:
{{ai.priority}}

Cenario recomendado:
{{ai.recommendedScenario}}

Grupo recomendado:
{{ai.recommendedGroup}}

Validacao agente/grupo:
{{ai.agentValidationStatus}} - {{ai.agentValidationMessage}}

Resposta predefinida recomendada:
{{ai.recommendedTemplateTitle}}

Checklist de evidencias:
{{ai.checklist}}

Proxima acao sugerida:
{{ai.nextAction}}

Campos customizados principais:
VSTS ID: {{ticket.cf_vstsid}}
Permissao de acesso: {{ticket.cf_permisso_de_acesso}}
Telefone FSM: {{ticket.cf_fsm_phone_number}}
Contato FSM: {{ticket.cf_fsm_contact_name}}
Inicio FSM: {{ticket.cf_fsm_appointment_start_time}}
Fim FSM: {{ticket.cf_fsm_appointment_end_time}}
Local FSM: {{ticket.cf_fsm_service_location}}
Assinatura FSM: {{ticket.cf_fsm_customer_signature}}
Teste: {{ticket.cf_teste}}
Testes: {{ticket.cf_testes}}

Atencao:
Esta anotacao foi gerada por IA/fallback local para apoiar a triagem. O analista deve revisar antes de responder, alterar propriedades ou encaminhar o chamado.`
  }
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

export function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function textToHtml(value = "") {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

export function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function asList(items = []) {
  if (!Array.isArray(items)) return "- " + String(items || "A confirmar");
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- A confirmar";
}

export function getRequester(ticket = {}, context = {}) {
  return ticket.requester || context.contact || {};
}

export function getAgent(ticket = {}, context = {}) {
  return ticket.agent || context.agent || {};
}

export function getGroup(ticket = {}, context = {}) {
  return ticket.group || context.group || {};
}

export function getCompany(ticket = {}, context = {}) {
  return ticket.company || context.company || {};
}

export function getTicketUrl(ticket = {}) {
  if (ticket.url) return ticket.url;
  if (ticket.id && process.env.FRESHDESK_DOMAIN) {
    const domain = String(process.env.FRESHDESK_DOMAIN).replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${domain}/a/tickets/${ticket.id}`;
  }
  return "";
}

export function buildTemplateVariables(ticket = {}, analysis = {}, context = {}) {
  const requester = getRequester(ticket, context);
  const agent = getAgent(ticket, context);
  const group = getGroup(ticket, context);
  const company = getCompany(ticket, context);
  const requesterName = requester.name || ticket.requester_name || ticket.name || "Cliente";
  const firstName = requester.firstname || requesterName.split(" ")[0] || "Cliente";
  const checklist = asList(analysis.checklist || analysis.evidenceNeeded || []);
  const recommendedTemplate = getRecommendedTemplate(analysis);

  return {
    "ticket.id": ticket.id || ticket.ticketId || "",
    "ticket.subject": ticket.subject || ticket.title || "",
    "ticket.description": stripHtml(ticket.description_text || ticket.description || ticket.message || ""),
    "ticket.url": getTicketUrl(ticket),
    "ticket.portal_url": ticket.portal_url || getTicketUrl(ticket),
    "ticket.tags": Array.isArray(ticket.tags) ? ticket.tags.join(", ") : (ticket.tags || ""),
    "ticket.status": ticket.status_name || ticket.status || "",
    "ticket.priority": ticket.priority_name || ticket.priority || "",
    "ticket.ticket_type": ticket.ticket_type || ticket.type || analysis.freshdeskType || "",

    "ticket.requester.firstname": firstName,
    "ticket.requester.lastname": requester.lastname || "",
    "ticket.requester.name": requesterName,
    "ticket.requester.email": requester.email || ticket.email || ticket.requester_email || "",
    "ticket.requester.phone": requester.phone || requester.mobile || ticket.phone || "",
    "ticket.requester.mobile": requester.mobile || requester.phone || "",

    "ticket.agent.name": agent.name || ticket.responder_name || ticket.agent_name || "Analista responsavel",
    "ticket.agent.email": agent.email || "",
    "ticket.group.name": group.name || ticket.group_name || analysis.recommendedGroup || "Suporte",
    "ticket.company.name": company.name || company.businessname || ticket.company_name || ticket.company || "Empresa nao informada",

    "ai.summary": analysis.summary || "Resumo nao gerado.",
    "ai.product": analysis.product || "Nao identificado",
    "ai.freshdeskType": analysis.freshdeskType || analysis.requestType || "Triagem",
    "ai.developmentType": analysis.developmentType || "Nao indicado",
    "ai.priority": analysis.priority || "Baixa",
    "ai.recommendedScenario": analysis.recommendedScenario || "Revisao manual pelo Suporte",
    "ai.recommendedTemplateTitle": recommendedTemplate.title,
    "ai.checklist": checklist,
    "ai.nextAction": analysis.nextAction || "Revisar a analise, confirmar evidencias e responder o cliente."
  };
}

export function renderTemplate(templateKey, ticket = {}, analysis = {}, context = {}, conversations = []) {
  const template = FRESHDESK_TEMPLATES[templateKey] || FRESHDESK_TEMPLATES.respostaInicial;
  const body = renderPlaceholders(template.body, ticket, analysis, context, conversations);
  const variables = buildPlaceholderVariables(ticket, analysis, context, conversations);

  return {
    key: templateKey,
    title: template.title,
    type: template.type,
    body,
    variables
  };
}

export function getRecommendedTemplate(analysis = {}) {
  const text = normalizeText([
    analysis.product,
    analysis.requestType,
    analysis.freshdeskType,
    analysis.recommendedScenario,
    analysis.summary,
    analysis.currentScenario,
    analysis.nextAction
  ].join(" "));

  if (/comercial|prospect|proposta|orcamento|licenca|contratacao|demo|teste/.test(text)) {
    return { key: "direcionamentoComercial", title: FRESHDESK_TEMPLATES.direcionamentoComercial.title };
  }

  if (/desenvolvimento|bug|erro|melhoria|customizacao|feature|corrigir|corrigido/.test(text) || analysis.needsDevelopmentSpec) {
    return { key: "encaminharDesenvolvimento", title: FRESHDESK_TEMPLATES.encaminharDesenvolvimento.title };
  }

  if (/aguardando cliente|pendencia|retorno do cliente/.test(text)) {
    return { key: "aguardandoCliente", title: FRESHDESK_TEMPLATES.aguardandoCliente.title };
  }

  if (/evidencia|print|arquivo|passo a passo|erro|falha|lentidao|recepcao/.test(text)) {
    return { key: "solicitarEvidencias", title: FRESHDESK_TEMPLATES.solicitarEvidencias.title };
  }

  return { key: "respostaInicial", title: FRESHDESK_TEMPLATES.respostaInicial.title };
}

export function renderRecommendedTemplates(ticket = {}, analysis = {}, context = {}, conversations = []) {
  const recommended = getRecommendedTemplate(analysis);
  return {
    recommended,
    customerReply: renderTemplate(recommended.key, ticket, analysis, context, conversations),
    internalNote: renderTemplate("notaInternaIA", ticket, analysis, context, conversations)
  };
}

export function buildTicketText(ticket, conversations = [], context = {}) {
  const requester = getRequester(ticket, context);
  const company = getCompany(ticket, context);
  const conversationText = conversations
    .slice(-8)
    .map((item, index) => {
      const author = item.user_id || item.from_email || item.support_email || "origem desconhecida";
      return `Interacao ${index + 1} (${author}): ${stripHtml(item.body_text || item.body || "")}`;
    })
    .join("\n\n");

  return [
    `Ticket: #${ticket.id || ticket.ticketId || "manual"}`,
    `Assunto: ${ticket.subject || ticket.title || ""}`,
    `Solicitante: ${requester.name || ticket.requester_name || ticket.name || ""}`,
    `E-mail: ${requester.email || ticket.email || ticket.requester_email || ""}`,
    `Telefone: ${requester.phone || requester.mobile || ticket.phone || ""}`,
    `Empresa: ${company.name || company.businessname || ticket.company_id || ticket.company || ""}`,
    `Grupo: ${context.group?.name || ticket.group_name || ""}`,
    `Agente: ${context.agent?.name || ticket.responder_name || ticket.agent_name || ""}`,
    `Status: ${ticket.status || ""}`,
    `Prioridade: ${ticket.priority || ""}`,
    `Tags: ${Array.isArray(ticket.tags) ? ticket.tags.join(", ") : (ticket.tags || "")}`,
    `Descricao: ${stripHtml(ticket.description_text || ticket.description || ticket.message || "")}`,
    conversationText ? `Historico recente:\n${conversationText}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildInternalNoteHtml(analysis, ticket = {}, context = {}, conversations = []) {
  const note = renderTemplate("notaInternaIA", ticket, analysis, context, conversations);
  const spec = analysis.developmentSpec
    ? `\n\n------------------------------\nESPECIFICACAO SUGERIDA PARA DESENVOLVIMENTO\n------------------------------\n${analysis.developmentSpec}`
    : "";
  return textToHtml(`${note.body}${spec}`);
}

export function buildDevelopmentSpec(analysis, ticket = {}, context = {}) {
  const requester = getRequester(ticket, context);
  const company = getCompany(ticket, context);
  const agent = getAgent(ticket, context);
  const clientName = company.name || company.businessname || ticket.company_name || requester.name || ticket.requester_name || ticket.name || "<NOME DO CLIENTE>";
  const clientId = ticket.company_id || ticket.customerId || "";
  const analystName = agent.name || ticket.responder_name || ticket.agent_name || "<NOME ANALISTA>";
  const ticketId = ticket.id || ticket.ticketId || "<ID_TICKET>";
  const devType = analysis.developmentType || "BUG (Erros)";

  return `------------| Especificacao de Requisito PARA DESENVOLVIMENTO |------------

Cliente: ${clientId ? clientId + " - " : ""}${clientName}
Versao do cliente:
Versao PH3A:

Analista Responsavel: ${analystName}
Ticket Freshdesk: #${ticketId}
Produto: ${analysis.product || "Nao identificado"}
Tipo DEV: ${devType}
Prioridade sugerida: ${analysis.priority || "Revisar"}

---------------------------------------
Rotina:
${analysis.routine || "<Rotina, tela ou modulo afetado>"}

O cenario atual:
${analysis.currentScenario || analysis.summary || "<Explicacao sobre o problema que deve ser corrigido/melhorado/criado>"}

A necessidade e:
${analysis.expectedBehavior || "<Explicacao de como a rotina deve funcionar/ser entregue>"}

Criterio de aceite:
${(analysis.acceptanceCriteria || [
  "O comportamento esperado deve ser validado com base no cenario informado.",
  "O problema nao deve ocorrer apos a correcao/melhoria.",
  "O suporte deve conseguir reproduzir e homologar o cenario."
]).map((item) => `- ${item}`).join("\n")}

------------------------------------------------
Anexo:
${(analysis.evidenceNeeded || analysis.checklist || ["Prints, arquivos, logs e exemplos citados no chamado."]).map((item) => `- ${item}`).join("\n")}
`;
}
