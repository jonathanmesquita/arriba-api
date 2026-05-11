const DEFAULT_PASSWORD = "X";

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

    const error = new Error(`Configuração Freshdesk incompleta: ${missing.join(", ")}.`);
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

function toQueryString(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, value);
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

async function parseFreshdeskResponse(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

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
    throw error;
  }

  return payload;
}

async function optionalFreshdeskRequest(path, fallbackValue) {
  try {
    return await freshdeskRequest(path);
  } catch (error) {
    console.warn(`Freshdesk opcional falhou em ${path}:`, error.message);
    return fallbackValue;
  }
}

export async function getTicket(ticketId) {
  return freshdeskRequest(`/tickets/${encodeURIComponent(ticketId)}?include=requester,stats`);
}

export async function getTicketConversations(ticketId) {
  const conversations = await optionalFreshdeskRequest(`/tickets/${encodeURIComponent(ticketId)}/conversations`, []);
  return Array.isArray(conversations) ? conversations : [];
}

export async function getAssociatedTickets(ticketId) {
  const associated = await optionalFreshdeskRequest(`/tickets/${encodeURIComponent(ticketId)}/associated_tickets`, []);
  if (Array.isArray(associated)) return associated;
  if (Array.isArray(associated?.tickets)) return associated.tickets;
  return [];
}

export async function getContact(contactId) {
  if (!contactId) return null;
  return optionalFreshdeskRequest(`/contacts/${encodeURIComponent(contactId)}`, null);
}

export async function getCompany(companyId) {
  if (!companyId) return null;
  return optionalFreshdeskRequest(`/companies/${encodeURIComponent(companyId)}`, null);
}

export async function getAgent(agentId) {
  if (!agentId) return null;
  return optionalFreshdeskRequest(`/agents/${encodeURIComponent(agentId)}`, null);
}

export async function getGroup(groupId) {
  if (!groupId) return null;
  return optionalFreshdeskRequest(`/groups/${encodeURIComponent(groupId)}`, null);
}

export async function listRequesterTickets(requesterId, limit = 30) {
  if (!requesterId) return [];
  const params = toQueryString({
    requester_id: requesterId,
    include: "stats",
    order_by: "created_at",
    order_type: "desc",
    per_page: Math.min(Math.max(Number(limit) || 30, 1), 100)
  });
  const tickets = await optionalFreshdeskRequest(`/tickets${params}`, []);
  return Array.isArray(tickets) ? tickets : [];
}

function escapeFreshdeskSearchTerm(term = "") {
  return String(term).replace(/'/g, "\\'").trim();
}

export async function searchTicketsBySubject(term, limit = 10) {
  const safeTerm = escapeFreshdeskSearchTerm(term);
  if (!safeTerm) return [];

  const queries = [
    `subject:'${safeTerm}'`,
    `description:'${safeTerm}'`
  ];

  for (const query of queries) {
    const encoded = encodeURIComponent(`"${query}"`);
    const result = await optionalFreshdeskRequest(`/search/tickets?query=${encoded}`, null);
    const tickets = Array.isArray(result?.results) ? result.results : Array.isArray(result) ? result : [];
    if (tickets.length) return tickets.slice(0, limit);
  }

  return [];
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
