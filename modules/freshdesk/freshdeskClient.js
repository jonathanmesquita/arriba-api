const DEFAULT_PASSWORD = "X";
const DEFAULT_PAGE_SIZE = 30;
const CLOSED_STATUS_IDS = new Set([4, 5]);

function normalizeDomain(domain = "") {
  return domain
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/api\/v2\/?$/i, "")
    .replace(/\/$/, "");
}

function getFreshdeskConfig() {
  const domain = normalizeDomain(process.env.FRESHDESK_DOMAIN || "");
  const apiKey = process.env.FRESHDESK_API_KEY || "";

  if (!domain || !apiKey) {
    const missing = [];
    if (!domain) missing.push("FRESHDESK_DOMAIN");
    if (!apiKey) missing.push("FRESHDESK_API_KEY");

    const error = new Error(`Configuracao Freshdesk incompleta: ${missing.join(", ")}.`);
    error.statusCode = 503;
    error.code = "FRESHDESK_NOT_CONFIGURED";
    throw error;
  }

  return {
    domain,
    apiKey,
    baseUrl: `https://${domain}/api/v2`
  };
}

function buildHeaders(apiKey, hasBody = false) {
  const token = Buffer.from(`${apiKey}:${DEFAULT_PASSWORD}`).toString("base64");
  const headers = {
    Authorization: `Basic ${token}`,
    Accept: "application/json"
  };

  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

async function parseFreshdeskResponse(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function freshdeskRequest(path, options = {}) {
  const config = getFreshdeskConfig();
  const hasBody = Object.prototype.hasOwnProperty.call(options, "body");
  const url = `${config.baseUrl}${path}`;

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      ...buildHeaders(config.apiKey, hasBody),
      ...(options.headers || {})
    },
    body: hasBody ? JSON.stringify(options.body) : undefined
  });

  const payload = await parseFreshdeskResponse(response);

  if (!response.ok) {
    const error = new Error(`Freshdesk API retornou HTTP ${response.status}.`);
    error.statusCode = response.status;
    error.code = "FRESHDESK_API_ERROR";
    error.details = payload;
    error.path = path;
    throw error;
  }

  return payload;
}

async function safeFreshdesk(path, fallback = null) {
  try {
    return await freshdeskRequest(path);
  } catch (error) {
    console.warn(`Freshdesk opcional falhou em ${path}:`, error.message, error.details || "");
    return fallback;
  }
}

function dedupeTickets(tickets = []) {
  const map = new Map();
  tickets.filter(Boolean).forEach((ticket) => {
    const key = String(ticket.id || ticket.display_id || ticket.ticket_id || JSON.stringify(ticket));
    if (!map.has(key)) map.set(key, ticket);
  });
  return [...map.values()];
}

function normalizeStatusName(ticket = {}) {
  return String(ticket.status_name || ticket.status_label || ticket.status || "").toLowerCase();
}

function isOpenTicket(ticket = {}) {
  const status = Number(ticket.status);
  if (CLOSED_STATUS_IDS.has(status)) return false;
  const name = normalizeStatusName(ticket);
  if (/resolvido|resolved|fechado|closed|encerrado|deleted|spam/.test(name)) return false;
  return true;
}

function sortTicketsByDate(tickets = []) {
  return [...tickets].sort((a, b) => {
    const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
    const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
    return dateB - dateA;
  });
}

async function listTicketsPage(params = {}) {
  const payload = await safeFreshdesk(`/tickets${buildQuery(params)}`, []);
  return Array.isArray(payload) ? payload : [];
}

export async function listTickets(params = {}, options = {}) {
  const perPage = Math.min(Number(options.perPage || DEFAULT_PAGE_SIZE), 100);
  const maxPages = Math.max(Number(options.maxPages || 3), 1);
  const collected = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const current = await listTicketsPage({ ...params, per_page: perPage, page });
    if (!current.length) break;
    collected.push(...current);
    if (current.length < perPage) break;
  }

  return dedupeTickets(collected);
}

export async function getTicket(ticketId) {
  return freshdeskRequest(`/tickets/${encodeURIComponent(ticketId)}?include=requester,stats`);
}

export async function getTicketConversations(ticketId) {
  const conversations = await safeFreshdesk(`/tickets/${encodeURIComponent(ticketId)}/conversations`, []);
  return Array.isArray(conversations) ? conversations : [];
}

export async function getContact(contactId) {
  if (!contactId) return null;
  return safeFreshdesk(`/contacts/${encodeURIComponent(contactId)}`, null);
}

export async function getCompany(companyId) {
  if (!companyId) return null;
  return safeFreshdesk(`/companies/${encodeURIComponent(companyId)}`, null);
}

export async function getAgent(agentId) {
  if (!agentId) return null;
  return safeFreshdesk(`/agents/${encodeURIComponent(agentId)}`, null);
}

export async function getGroup(groupId) {
  if (!groupId) return null;
  return safeFreshdesk(`/groups/${encodeURIComponent(groupId)}`, null);
}

export async function getGroupAgents(groupId) {
  if (!groupId) return [];
  const agents = await safeFreshdesk(`/agents?group_id=${encodeURIComponent(groupId)}`, []);
  return Array.isArray(agents) ? agents : [];
}

export async function getAssociatedTickets(ticketId) {
  const candidates = [
    `/tickets/${encodeURIComponent(ticketId)}/associated_tickets`,
    `/tickets/${encodeURIComponent(ticketId)}/associated`
  ];

  for (const path of candidates) {
    const associated = await safeFreshdesk(path, null);
    if (!associated) continue;
    if (Array.isArray(associated)) return associated;
    if (Array.isArray(associated?.tickets)) return associated.tickets;
    if (Array.isArray(associated?.associated_tickets)) return associated.associated_tickets;
    if (Array.isArray(associated?.results)) return associated.results;
  }

  return [];
}

function sanitizeSearchTerm(term = "") {
  return String(term || "")
    .trim()
    .replace(/["\\]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

async function searchTicketsByQuery(rawQuery, maxResults = 10) {
  if (!rawQuery) return [];
  const result = await safeFreshdesk(`/search/tickets?query=${encodeURIComponent(`\"${rawQuery}\"`)}`, null);
  const tickets = Array.isArray(result?.results) ? result.results : [];
  return tickets.slice(0, maxResults);
}

export async function searchTickets(term, maxResults = 10) {
  const cleanTerm = sanitizeSearchTerm(term);
  if (!cleanTerm) return [];

  const queries = [
    `subject:'${cleanTerm}'`,
    `description:'${cleanTerm}'`,
    `requester_email:'${cleanTerm}'`,
    `company_name:'${cleanTerm}'`
  ];

  const collected = [];
  for (const query of queries) {
    const tickets = await searchTicketsByQuery(query, maxResults);
    collected.push(...tickets);
    if (dedupeTickets(collected).length >= maxResults) break;
  }

  return sortTicketsByDate(dedupeTickets(collected)).slice(0, maxResults);
}

async function searchTicketsByRequesterFallback(requesterId, requesterEmail = "", maxResults = 30) {
  const queries = [];
  if (requesterId) queries.push(`requester_id:${requesterId}`);
  if (requesterEmail) queries.push(`requester_email:'${sanitizeSearchTerm(requesterEmail)}'`);

  const collected = [];
  for (const query of queries) {
    const tickets = await searchTicketsByQuery(query, maxResults);
    collected.push(...tickets);
  }

  return dedupeTickets(collected);
}

export async function getRequesterTickets(requesterId, requesterEmail = "", options = {}) {
  const maxResults = Number(options.maxResults || 50);
  const collected = [];

  // Preferir /tickets?requester_id=... porque a busca textual do Freshdesk pode variar por plano/configuracao.
  if (requesterId) {
    const byRequester = await listTickets({ requester_id: requesterId, include: "requester,stats" }, { perPage: 100, maxPages: 3 });
    collected.push(...byRequester);
  }

  if (requesterEmail) {
    const byEmail = await listTickets({ email: requesterEmail, include: "requester,stats" }, { perPage: 100, maxPages: 3 });
    collected.push(...byEmail);
  }

  // Fallback por search/tickets, caso /tickets com requester_id/email nao retorne em algum ambiente.
  if (!collected.length) {
    const fallback = await searchTicketsByRequesterFallback(requesterId, requesterEmail, maxResults);
    collected.push(...fallback);
  }

  return sortTicketsByDate(dedupeTickets(collected)).slice(0, maxResults);
}

export async function getRequesterOpenTickets(requesterId, requesterEmail = "", maxResults = 30) {
  const tickets = await getRequesterTickets(requesterId, requesterEmail, { maxResults: Math.max(maxResults, 50) });
  return tickets.filter(isOpenTicket).slice(0, maxResults);
}

export async function getCompanyOpenTickets(companyId, maxResults = 30) {
  if (!companyId) return [];
  const tickets = await listTickets({ company_id: companyId, include: "requester,stats" }, { perPage: 100, maxPages: 3 });
  return sortTicketsByDate(dedupeTickets(tickets).filter(isOpenTicket)).slice(0, maxResults);
}

export async function getRecurrenceCandidates(ticket, maxResults = 10) {
  const subject = String(ticket?.subject || "").trim();
  if (!subject) return [];
  const terms = subject
    .split(/\s+/)
    .filter((item) => item.length > 4)
    .slice(0, 3)
    .join(" ");
  if (!terms) return [];
  return searchTickets(terms, maxResults);
}

export async function getTicketContext(ticketId) {
  const ticket = await getTicket(ticketId);
  const conversations = await getTicketConversations(ticketId);
  const contact = await getContact(ticket.requester_id || ticket.requester?.id);
  const company = await getCompany(ticket.company_id || contact?.company_id);
  const group = await getGroup(ticket.group_id);
  const agent = await getAgent(ticket.responder_id);
  const groupAgents = await getGroupAgents(ticket.group_id);
  const associatedTickets = await getAssociatedTickets(ticketId);
  const requesterId = ticket.requester_id || contact?.id || ticket.requester?.id;
  const requesterEmail = contact?.email || ticket.requester?.email || ticket.requester_email || ticket.email;
  const requesterAllTickets = await getRequesterTickets(requesterId, requesterEmail, { maxResults: 50 });
  const requesterOpenTickets = requesterAllTickets.filter(isOpenTicket).slice(0, 30);
  const companyOpenTickets = await getCompanyOpenTickets(ticket.company_id || contact?.company_id, 30);
  const recurrenceCandidates = await getRecurrenceCandidates(ticket);

  return {
    ticket,
    conversations,
    context: {
      contact: contact || ticket.requester || null,
      company,
      group,
      agent,
      groupAgents,
      associatedTickets,
      requesterAllTickets,
      requesterOpenTickets,
      companyOpenTickets,
      recurrenceCandidates,
      requesterTicketSummary: {
        requesterId: requesterId || null,
        requesterEmail: requesterEmail || null,
        totalFound: requesterAllTickets.length,
        openFound: requesterOpenTickets.length,
        companyOpenFound: companyOpenTickets.length,
        strategy: requesterAllTickets.length ? "tickets_endpoint" : "empty"
      }
    }
  };
}

export async function addPrivateNote(ticketId, htmlBody) {
  return freshdeskRequest(`/tickets/${encodeURIComponent(ticketId)}/notes`, {
    method: "POST",
    body: {
      body: htmlBody,
      private: true
    }
  });
}

export async function updateTicket(ticketId, payload) {
  return freshdeskRequest(`/tickets/${encodeURIComponent(ticketId)}`, {
    method: "PUT",
    body: payload
  });
}

export function isFreshdeskConfigured() {
  try {
    getFreshdeskConfig();
    return true;
  } catch {
    return false;
  }
}

export const __freshdeskInternals = {
  isOpenTicket,
  dedupeTickets,
  sanitizeSearchTerm,
  buildQuery
};
