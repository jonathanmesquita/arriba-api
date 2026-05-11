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

export async function getTicket(ticketId) {
  return freshdeskRequest(`/tickets/${encodeURIComponent(ticketId)}?include=requester,stats`);
}

export async function getTicketConversations(ticketId) {
  try {
    const conversations = await freshdeskRequest(`/tickets/${encodeURIComponent(ticketId)}/conversations`);
    return Array.isArray(conversations) ? conversations : [];
  } catch (error) {
    console.warn("Não foi possível buscar conversas do ticket:", error.message);
    return [];
  }
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
