export function stripPlaceholderHtml(value = "") {
  return String(value || "")
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

function asPlaceholderList(items = []) {
  if (!Array.isArray(items)) return "- " + String(items || "A confirmar");
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- A confirmar";
}

const STATUS_LABELS = {
  2: "Aberto",
  3: "Pendente",
  4: "Resolvido",
  5: "Fechado",
  6: "Aguardando Cliente",
  7: "Aguardando Aprovação",
  8: "Análise",
  9: "Desenvolvendo",
  10: "Homologado",
  11: "Rejeitado",
  12: "Em Backlog"
};

const PRIORITY_LABELS = {
  1: "Baixa",
  2: "Média",
  3: "Alta",
  4: "Urgente"
};

const SOURCE_LABELS = {
  1: "E-mail",
  2: "Portal",
  3: "Telefone",
  7: "Chat",
  9: "Feedback widget",
  10: "Outbound email"
};

function clean(value = "") {
  return stripPlaceholderHtml(value || "");
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function joinList(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  return value || "";
}

function normalizeStatus(value, ticket = {}) {
  return firstNonEmpty(ticket.status_name, STATUS_LABELS[value], value);
}

function normalizePriority(value, ticket = {}) {
  return firstNonEmpty(ticket.priority_name, PRIORITY_LABELS[value], value);
}

function normalizeSource(value, ticket = {}) {
  return firstNonEmpty(ticket.source_name, SOURCE_LABELS[value], value);
}

export function getRequester(ticket = {}, context = {}) {
  return ticket.requester || context.contact || {};
}

export function getCompany(ticket = {}, context = {}) {
  return ticket.company || context.company || {};
}

export function getAgent(ticket = {}, context = {}) {
  const agent = ticket.agent || context.agent || {};
  const contact = agent.contact || {};
  return {
    ...agent,
    name: firstNonEmpty(agent.name, contact.name, ticket.agent_name, ticket.responder_name),
    email: firstNonEmpty(agent.email, contact.email, ticket.agent_email, ticket.responder_email)
  };
}

export function getGroup(ticket = {}, context = {}) {
  return ticket.group || context.group || {};
}

export function getTicketUrl(ticket = {}) {
  if (ticket.url) return ticket.url;
  if (ticket.id && process.env.FRESHDESK_DOMAIN) {
    const domain = String(process.env.FRESHDESK_DOMAIN).replace(/^https?:\/\//i, "").replace(/\/$/, "");
    return `https://${domain}/a/tickets/${ticket.id}`;
  }
  return "";
}

function extractLatestComment(conversations = [], privateOnly = null) {
  const filtered = conversations
    .filter((item) => {
      if (privateOnly === null) return true;
      return Boolean(item.private) === privateOnly;
    })
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));

  const latest = filtered[0];
  if (!latest) return "";
  return clean(latest.body_text || latest.body || latest.description || "");
}

function getByPath(data, path) {
  return String(path || "")
    .split(".")
    .filter(Boolean)
    .reduce((acc, key) => {
      if (acc === undefined || acc === null) return undefined;
      return acc[key];
    }, data);
}

function buildAiVariables(analysis = {}) {
  const recommended = analysis.recommendedTemplate || {};
  return {
    "ai.source": analysis.source || "",
    "ai.summary": analysis.summary || "Resumo nao gerado.",
    "ai.product": analysis.product || "Nao identificado",
    "ai.requestType": analysis.requestType || "Triagem",
    "ai.freshdeskType": analysis.freshdeskType || analysis.requestType || "Triagem",
    "ai.developmentType": analysis.developmentType || "Nao indicado",
    "ai.priority": analysis.priority || "Baixa",
    "ai.recommendedScenario": analysis.recommendedScenario || "Revisao manual pelo Suporte",
    "ai.recommendedGroup": analysis.recommendedGroup || "Suporte",
    "ai.recommendedTemplateTitle": recommended.title || analysis.recommendedTemplateTitle || "Resposta inicial",
    "ai.recommendedTemplateKey": recommended.key || "respostaInicial",
    "ai.confidence": analysis.confidence !== undefined ? String(Math.round(Number(analysis.confidence) * 100)) + "%" : "",
    "ai.routine": analysis.routine || "Rotina a confirmar",
    "ai.currentScenario": analysis.currentScenario || analysis.summary || "",
    "ai.expectedBehavior": analysis.expectedBehavior || "",
    "ai.suggestedReply": analysis.suggestedReply || "",
    "ai.checklist": asPlaceholderList(analysis.checklist || analysis.evidenceNeeded || []),
    "ai.evidenceNeeded": asPlaceholderList(analysis.evidenceNeeded || analysis.checklist || []),
    "ai.acceptanceCriteria": asPlaceholderList(analysis.acceptanceCriteria || []),
    "ai.nextAction": analysis.nextAction || "Revisar a analise e confirmar evidencias.",
    "ai.needsDevelopmentSpec": analysis.needsDevelopmentSpec ? "Sim" : "Nao",
    "ai.agentValidationStatus": analysis.agentValidation?.status || "Nao validado",
    "ai.agentValidationMessage": analysis.agentValidation?.message || "",
    "ai.knowledgeTitle": (analysis.knowledgeBase || [])[0]?.title || "Base nao localizada",
    "ai.knowledgeSummary": analysis.knowledgeSummary || "Sem base relacionada.",
    "ai.knowledgeUrl": (analysis.knowledgeBase || [])[0]?.url || "",
    "ai.knowledgeSource": (analysis.knowledgeBase || [])[0]?.source || ""
  };
}

export function buildPlaceholderVariables(ticket = {}, analysis = {}, context = {}, conversations = []) {
  const requester = getRequester(ticket, context);
  const company = getCompany(ticket, context);
  const agent = getAgent(ticket, context);
  const group = getGroup(ticket, context);
  const internalAgent = ticket.internal_agent || context.internalAgent || agent || {};
  const internalGroup = ticket.internal_group || context.internalGroup || group || {};
  const custom = ticket.custom_fields || {};
  const requesterName = firstNonEmpty(requester.name, ticket.requester_name, ticket.name, "Cliente");
  const requesterFirstName = firstNonEmpty(requester.firstname, requesterName.split(" ")[0], "Cliente");
  const requesterLastName = firstNonEmpty(requester.lastname, requesterName.split(" ").slice(1).join(" "));
  const ticketUrl = getTicketUrl(ticket);

  const base = {
    // Acoes relacionadas ao ticket
    "ticket.tracker_ticket_id": firstNonEmpty(ticket.tracker_ticket_id, ticket.trackerTicketId),
    "ticket.parent_ticket_id": firstNonEmpty(ticket.parent_ticket_id, ticket.parentTicketId),
    "ticket.due_by_time": firstNonEmpty(ticket.due_by_time, ticket.due_by, ticket.dueBy),
    "ticket.satisfaction_survey": firstNonEmpty(ticket.satisfaction_survey, ticket.satisfactionSurvey),
    "ticket.internal_agent.email": firstNonEmpty(internalAgent.email),
    "ticket.internal_agent.name": firstNonEmpty(internalAgent.name),
    "ticket.internal_group.name": firstNonEmpty(internalGroup.name),
    "ticket.agent.email": firstNonEmpty(agent.email, ticket.agent_email, ticket.responder_email),
    "ticket.agent.name": firstNonEmpty(agent.name, ticket.agent_name, ticket.responder_name, "Analista responsavel"),
    "ticket.group.name": firstNonEmpty(group.name, ticket.group_name, analysis.recommendedGroup, "Suporte"),
    "ticket.latest_private_comment": firstNonEmpty(ticket.latest_private_comment, extractLatestComment(conversations, true)),
    "ticket.latest_public_comment": firstNonEmpty(ticket.latest_public_comment, extractLatestComment(conversations, false), extractLatestComment(conversations, null)),
    "ticket.tags": joinList(ticket.tags),
    "ticket.portal_url": firstNonEmpty(ticket.portal_url, ticketUrl),
    "ticket.url": ticketUrl,
    "ticket.description": clean(firstNonEmpty(ticket.description_text, ticket.description, ticket.message)),
    "ticket.subject": firstNonEmpty(ticket.subject, ticket.title),
    "ticket.id": firstNonEmpty(ticket.id, ticket.ticketId),

    // Campos do ticket
    "ticket.ticket_type": firstNonEmpty(ticket.ticket_type, ticket.type, analysis.freshdeskType),
    "ticket.source": normalizeSource(ticket.source, ticket),
    "ticket.priority": normalizePriority(ticket.priority, ticket),
    "ticket.status": normalizeStatus(ticket.status, ticket),

    // Helpdesk
    "ticket.product_description": firstNonEmpty(ticket.product_description, ticket.product?.description, ticket.product_name, analysis.product),
    "ticket.portal_name": firstNonEmpty(ticket.portal_name, process.env.FRESHDESK_PORTAL_NAME),
    "helpdesk_name": process.env.FRESHDESK_HELPDESK_NAME || "PH3A",

    // Empresa
    "ticket.company.approvaldate": firstNonEmpty(company.approvaldate, company.approval_date),
    "ticket.company.teslacustomerid": firstNonEmpty(company.teslacustomerid, company.teslaCustomerId),
    "ticket.company.brokers": joinList(company.brokers),
    "ticket.company.enabled": company.enabled === undefined ? "" : String(company.enabled),
    "ticket.company.businessname": firstNonEmpty(company.businessname, company.business_name),
    "ticket.company.industry": firstNonEmpty(company.industry),
    "ticket.company.renewal_date": firstNonEmpty(company.renewal_date, company.renewalDate),
    "ticket.company.account_tier": firstNonEmpty(company.account_tier, company.accountTier),
    "ticket.company.health_score": firstNonEmpty(company.health_score, company.healthScore),
    "ticket.company.domains": joinList(company.domains),
    "ticket.company.note": clean(company.note),
    "ticket.company.description": clean(company.description),
    "ticket.company.name": firstNonEmpty(company.name, company.businessname, ticket.company_name, ticket.company, "Empresa nao informada"),

    // Contato
    "ticket.requester.unique_external_id": firstNonEmpty(requester.unique_external_id, requester.uniqueExternalId),
    "ticket.requester.address": firstNonEmpty(requester.address),
    "ticket.requester.phone": firstNonEmpty(requester.phone, ticket.phone),
    "ticket.requester.email": firstNonEmpty(requester.email, ticket.email, ticket.requester_email),
    "ticket.requester.mobile": firstNonEmpty(requester.mobile, requester.phone),
    "ticket.requester.lastname": requesterLastName,
    "ticket.requester.firstname": requesterFirstName,
    "ticket.requester.name": requesterName
  };

  // Campos customizados do Freshdesk: {{ticket.cf_algum_campo}}
  Object.entries(custom).forEach(([key, value]) => {
    base[`ticket.${key}`] = joinList(value);
  });

  return {
    ...base,
    ...buildAiVariables(analysis)
  };
}

export function resolvePlaceholder(key, data = {}) {
  const trimmed = String(key || "").trim();
  if (!trimmed) return "";
  if (Object.prototype.hasOwnProperty.call(data.variables || {}, trimmed)) {
    return data.variables[trimmed];
  }

  const direct = getByPath(data, trimmed);
  if (direct !== undefined && direct !== null) return joinList(direct);

  // fallback para ticket.cf_* quando veio direto no objeto ticket, sem custom_fields
  if (trimmed.startsWith("ticket.cf_")) {
    const field = trimmed.replace("ticket.", "");
    const value = data.ticket?.custom_fields?.[field] ?? data.ticket?.[field];
    return value !== undefined && value !== null ? joinList(value) : "";
  }

  return "";
}

export function renderPlaceholders(template = "", ticket = {}, analysis = {}, context = {}, conversations = []) {
  const variables = buildPlaceholderVariables(ticket, analysis, context, conversations);
  return String(template || "").replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, key) => {
    const value = resolvePlaceholder(key, { variables, ticket, analysis, context, conversations });
    return value === undefined || value === null || value === "" ? "-" : String(value);
  });
}

export function listSupportedPlaceholders() {
  return [
    "ticket.tracker_ticket_id",
    "ticket.parent_ticket_id",
    "ticket.due_by_time",
    "ticket.satisfaction_survey",
    "ticket.internal_agent.email",
    "ticket.internal_agent.name",
    "ticket.internal_group.name",
    "ticket.agent.email",
    "ticket.agent.name",
    "ticket.group.name",
    "ticket.latest_private_comment",
    "ticket.latest_public_comment",
    "ticket.tags",
    "ticket.portal_url",
    "ticket.url",
    "ticket.description",
    "ticket.subject",
    "ticket.id",
    "ticket.cf_*",
    "ticket.ticket_type",
    "ticket.source",
    "ticket.priority",
    "ticket.status",
    "ticket.product_description",
    "ticket.portal_name",
    "helpdesk_name",
    "ticket.company.approvaldate",
    "ticket.company.teslacustomerid",
    "ticket.company.brokers",
    "ticket.company.enabled",
    "ticket.company.businessname",
    "ticket.company.industry",
    "ticket.company.renewal_date",
    "ticket.company.account_tier",
    "ticket.company.health_score",
    "ticket.company.domains",
    "ticket.company.note",
    "ticket.company.description",
    "ticket.company.name",
    "ticket.requester.unique_external_id",
    "ticket.requester.address",
    "ticket.requester.phone",
    "ticket.requester.email",
    "ticket.requester.mobile",
    "ticket.requester.lastname",
    "ticket.requester.firstname",
    "ticket.requester.name",
    "ai.summary",
    "ai.product",
    "ai.freshdeskType",
    "ai.developmentType",
    "ai.priority",
    "ai.recommendedScenario",
    "ai.recommendedGroup",
    "ai.recommendedTemplateTitle",
    "ai.checklist",
    "ai.nextAction",
    "ai.agentValidationStatus",
    "ai.agentValidationMessage",
    "ai.knowledgeTitle",
    "ai.knowledgeSummary",
    "ai.knowledgeUrl",
    "ai.knowledgeSource"
  ];
}
