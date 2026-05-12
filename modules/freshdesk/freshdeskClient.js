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
    throw error;
  }

  return payload;
}

async function safeFreshdesk(path, fallback = null) {
  try {
    return await freshdeskRequest(path);
  } catch (error) {
    console.warn(`Freshdesk opcional falhou em ${path}:`, error.message);
    return fallback;
  }
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

export async function getAssociatedTickets(ticketId) {
  const associated = await safeFreshdesk(`/tickets/${encodeURIComponent(ticketId)}/associated_tickets`, []);
  if (Array.isArray(associated)) return associated;
  if (Array.isArray(associated?.tickets)) return associated.tickets;
  return [];
}

export async function searchTickets(term, maxResults = 10) {
  const cleanTerm = String(term || "").trim();
  if (!cleanTerm) return [];

  const safeTerm = cleanTerm.replace(/"/g, "\\\"");
  const queries = [
    `\"subject:'${safeTerm}'\"`,
    `\"description:'${safeTerm}'\"`,
    `\"requester_email:'${safeTerm}'\"`
  ];

  for (const query of queries) {
    const result = await safeFreshdesk(`/search/tickets?query=${encodeURIComponent(query)}`, null);
    const tickets = Array.isArray(result?.results) ? result.results : [];
    if (tickets.length) return tickets.slice(0, maxResults);
  }

  return [];
}

export async function getRequesterOpenTickets(requesterId, maxResults = 10) {
  if (!requesterId) return [];
  const query = `\"requester_id:${requesterId} AND status:2 OR status:3 OR status:6\"`;
  const result = await safeFreshdesk(`/search/tickets?query=${encodeURIComponent(query)}`, null);
  const tickets = Array.isArray(result?.results) ? result.results : [];
  return tickets.slice(0, maxResults);
}

export async function getTicketContext(ticketId) {
  const ticket = await getTicket(ticketId);
  const conversations = await getTicketConversations(ticketId);
  const contact = await getContact(ticket.requester_id || ticket.requester?.id);
  const company = await getCompany(ticket.company_id || contact?.company_id);
  const group = await getGroup(ticket.group_id);
  const agent = await getAgent(ticket.responder_id);
  const associatedTickets = await getAssociatedTickets(ticketId);
  const requesterOpenTickets = await getRequesterOpenTickets(ticket.requester_id || contact?.id);

  return {
    ticket,
    conversations,
    context: {
      contact: contact || ticket.requester || null,
      company,
      group,
      agent,
      associatedTickets,
      requesterOpenTickets
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
