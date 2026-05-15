import { manualCatalog, normalizeManualText, getManualCatalogSummary } from "./manualCatalog.js";

function scoreManual(manual, normalizedTerm) {
  if (!normalizedTerm) return 0;
  const haystack = normalizeManualText([
    manual.title,
    manual.product,
    manual.category,
    manual.routine,
    manual.module,
    manual.kind,
    manual.client,
    manual.source,
    manual.sourceFile,
    ...(manual.keywords || []),
    ...(manual.symptoms || []),
    ...(manual.checklist || [])
  ].join(" "));

  const tokens = normalizedTerm.split(" ").filter(Boolean);
  let score = 0;
  for (const token of tokens) {
    if (token.length < 2) continue;
    if (haystack.includes(token)) score += 4;
    if (normalizeManualText(manual.title).includes(token)) score += 3;
    if (normalizeManualText(manual.client).includes(token)) score += 3;
    if ((manual.keywords || []).some((keyword) => normalizeManualText(keyword).includes(token))) score += 2;
  }

  const exactBoosts = [manual.title, manual.client, manual.routine, manual.category].map(normalizeManualText);
  if (exactBoosts.some((value) => normalizedTerm && value.includes(normalizedTerm))) score += 8;
  return score;
}

export function listManuals(filters = {}) {
  const category = normalizeManualText(filters.category || "");
  const client = normalizeManualText(filters.client || "");
  const module = normalizeManualText(filters.module || "");

  return manualCatalog.filter((manual) => {
    return (!category || normalizeManualText(manual.category).includes(category))
      && (!client || normalizeManualText(manual.client).includes(client))
      && (!module || normalizeManualText(manual.module).includes(module));
  });
}

export function searchManuals(term = "", options = {}) {
  const normalizedTerm = normalizeManualText(term);
  const limit = Number(options.limit || 8);
  const filters = {
    category: options.category,
    client: options.client,
    module: options.module
  };

  const candidates = listManuals(filters);
  const scored = candidates
    .map((manual) => ({ ...manual, score: scoreManual(manual, normalizedTerm) }))
    .filter((manual) => !normalizedTerm || manual.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit);

  return {
    term,
    normalizedTerm,
    total: scored.length,
    summary: getManualCatalogSummary(),
    manuals: scored
  };
}

export function matchManualsForTicket(ticket = {}, conversations = [], context = {}, options = {}) {
  const conversationText = conversations
    .slice(-8)
    .map((item) => [item.body_text, item.body, item.description].filter(Boolean).join(" "))
    .join(" ");

  const text = [
    ticket.subject,
    ticket.description_text,
    ticket.description,
    ticket.type,
    ticket.ticket_type,
    Array.isArray(ticket.tags) ? ticket.tags.join(" ") : ticket.tags,
    context.company?.name,
    context.company?.businessname,
    context.contact?.email,
    context.group?.name,
    conversationText
  ].filter(Boolean).join(" ");

  const result = searchManuals(text, { limit: options.limit || 6 });
  const detected = {
    client: result.manuals.find((manual) => manual.client && manual.client !== "Geral")?.client || context.company?.name || "Geral",
    category: result.manuals[0]?.category || "A confirmar",
    routine: result.manuals[0]?.routine || "A confirmar",
    confidence: result.manuals[0]?.score ? Math.min(0.95, 0.35 + result.manuals[0].score / 50) : 0.2
  };

  return { ...result, detected, inputText: text };
}
