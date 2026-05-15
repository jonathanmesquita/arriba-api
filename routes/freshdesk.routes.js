import express from "express";
import {
  addPrivateNote,
  getTicket,
  getTicketContext,
  getTicketConversations,
  getRequesterTickets,
  isFreshdeskConfigured,
  searchTickets,
  updateTicket
} from "../modules/freshdesk/freshdeskClient.js";
import { analyzeSupportTicket } from "../modules/freshdesk/supportAnalyzer.js";
import {
  getFreshdeskSolutionArticle,
  getFreshdeskFolderArticles,
  getFreshdeskSolutionsConfig,
  getKnowledgeArticlesIndex,
  getKnowledgeCacheState,
  searchUnifiedKnowledge,
  syncFreshdeskKnowledge
} from "../modules/freshdesk/freshdeskSolutions.js";
import { buildKnowledgeGapsDashboard, buildQualityDashboard, logSupportAnalysis, logSupportValidation, readSupportLogs } from "../modules/freshdesk/localLogs.js";
import { listSupportedPlaceholders } from "../modules/freshdesk/placeholders.js";
import {
  buildInternalNoteHtml,
  FRESHDESK_TEMPLATES,
  renderRecommendedTemplates,
  renderTemplate,
  textToHtml
} from "../modules/freshdesk/templates.js";

function getTicketIdFromWebhook(body = {}) {
  return body.ticket_id || body.ticketId || body.id || body.ticket?.id || body.display_id || body.ticket?.display_id;
}

function canWriteToFreshdesk() {
  return process.env.FRESHDESK_ENABLE_WRITES === "true";
}

function isAutoNoteEnabled() {
  return canWriteToFreshdesk() && process.env.SUPPORT_COPILOT_AUTO_NOTE === "true";
}

function checkWebhookSecret(req, res) {
  const expected = process.env.FRESHDESK_WEBHOOK_SECRET;
  if (!expected) return true;

  const received = req.get("x-arriba-webhook-secret") || req.query.secret || req.body.secret;
  if (received !== expected) {
    res.status(401).json({ error: "Webhook nao autorizado." });
    return false;
  }

  return true;
}

function sendError(res, error) {
  res.status(error.statusCode || 500).json({
    error: error.message,
    code: error.code,
    details: error.details
  });
}

function blockedWriteResponse(res) {
  return res.status(403).json({
    error: "Escrita no Freshdesk desativada.",
    message: "Este ambiente esta em modo somente leitura. Use as rotas de analise, contexto e renderizacao de templates para copiar o conteudo manualmente.",
    writesEnabled: false
  });
}

function buildKnowledgeSearchText(ticket = {}, conversations = [], context = {}) {
  const conversationText = conversations
    .slice(-8)
    .map((item) => [item.body_text, item.body, item.description].filter(Boolean).join(" "))
    .join(" ");

  return [
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
  ]
    .filter(Boolean)
    .join(" ");
}

async function enrichTicketResultWithKnowledge(result, options = {}) {
  const query = buildKnowledgeSearchText(result.ticket, result.conversations || [], result.context || {});
  const knowledge = await searchUnifiedKnowledge(query, {
    maxResults: Number(options.maxResults || 8),
    forceSync: options.forceSync === true
  });

  return {
    ...result,
    context: {
      ...(result.context || {}),
      knowledgeBase: knowledge.combined || [],
      knowledgeSearch: {
        term: knowledge.term,
        source: knowledge.source,
        freshdeskSolutionsEnabled: knowledge.freshdeskSolutionsEnabled,
        sync: knowledge.sync,
        localCount: knowledge.local?.length || 0,
        freshdeskCount: knowledge.freshdesk?.length || 0,
        totalCount: knowledge.combined?.length || 0
      }
    }
  };
}

async function fetchAndAnalyzeTicket(ticketId) {
  const result = await enrichTicketResultWithKnowledge(await getTicketContext(ticketId));
  const analysis = await analyzeSupportTicket(result.ticket, result.conversations, result.context);
  const renderedTemplates = renderRecommendedTemplates(result.ticket, analysis, result.context, result.conversations);
  await logSupportAnalysis({ ticket: result.ticket, analysis, context: result.context, action: "freshdesk-ticket-analysis" });
  return { ...result, analysis, renderedTemplates };
}

export function createFreshdeskRouter() {
  const router = express.Router();

  router.get("/freshdesk/status", (req, res) => {
    const writesEnabled = canWriteToFreshdesk();
    res.json({
      ok: true,
      freshdeskConfigured: isFreshdeskConfigured(),
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
      writesEnabled,
      autoNote: isAutoNoteEnabled(),
      mode: writesEnabled ? "read-write" : "read-only",
      templates: Object.keys(FRESHDESK_TEMPLATES),
      knowledge: getFreshdeskSolutionsConfig()
    });
  });

  router.get("/freshdesk/templates", (req, res) => {
    res.json({ templates: FRESHDESK_TEMPLATES });
  });

  router.get("/freshdesk/knowledge/search", async (req, res) => {
    try {
      const term = req.query.term || req.query.q || "";
      const limit = Number(req.query.limit || 8);
      const result = await searchUnifiedKnowledge(term, {
        maxResults: limit,
        forceSync: req.query.force === "true"
      });
      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/freshdesk/knowledge/sync", async (req, res) => {
    try {
      const result = await syncFreshdeskKnowledge({ force: req.query.force === "true" });
      res.json({ ...result, config: getFreshdeskSolutionsConfig() });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/freshdesk/knowledge/admin", async (req, res) => {
    try {
      const index = await getKnowledgeArticlesIndex({
        force: req.query.force === "true",
        maxPages: Number(req.query.maxPages || 5)
      });
      const gaps = await buildKnowledgeGapsDashboard();
      res.json({
        ok: true,
        mode: canWriteToFreshdesk() ? "read-write" : "read-only",
        writesEnabled: canWriteToFreshdesk(),
        cache: getKnowledgeCacheState(),
        index,
        gaps
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/freshdesk/knowledge/articles", async (req, res) => {
    try {
      const index = await getKnowledgeArticlesIndex({ force: req.query.force === "true" });
      const source = String(req.query.source || "").toLowerCase();
      const type = String(req.query.type || "").toLowerCase();
      const product = String(req.query.product || "").toLowerCase();
      const articles = index.articles.filter((article) => {
        const articleSource = String(article.sourceLabel || article.source || "").toLowerCase();
        const articleType = String(article.freshdeskType || "").toLowerCase();
        const articleProduct = String(article.product || "").toLowerCase();
        return (!source || articleSource.includes(source)) && (!type || articleType.includes(type)) && (!product || articleProduct.includes(product));
      });
      res.json({ ...index, articles, filteredTotal: articles.length });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/freshdesk/knowledge/gaps", async (req, res) => {
    try {
      res.json(await buildKnowledgeGapsDashboard());
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/freshdesk/solutions/articles/:articleId", async (req, res) => {
    try {
      const article = await getFreshdeskSolutionArticle(req.params.articleId);
      if (!article) return res.status(404).json({ error: "Artigo nao localizado ou Solutions API desativada." });
      res.json({ article });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/freshdesk/solutions/folders/:folderId/articles", async (req, res) => {
    try {
      const articles = await getFreshdeskFolderArticles(req.params.folderId, {
        force: req.query.force === "true",
        maxPages: Number(req.query.maxPages || 5)
      });
      res.json({ folderId: req.params.folderId, total: articles.length, articles });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/freshdesk/placeholders", (req, res) => {
    res.json({ placeholders: listSupportedPlaceholders() });
  });

  router.get("/freshdesk/quality/dashboard", async (req, res) => {
    try {
      res.json(await buildQualityDashboard());
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/support/copilot/logs", async (req, res) => {
    try {
      const limit = Number(req.query.limit || 50);
      res.json({ logs: await readSupportLogs(limit) });
    } catch (error) {
      sendError(res, error);
    }
  });


  router.post("/support/copilot/validation", async (req, res) => {
    try {
      const entry = await logSupportValidation(req.body || {});
      res.json({ ok: Boolean(entry), validation: entry, writesEnabled: canWriteToFreshdesk() });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/freshdesk/tickets/search", async (req, res) => {
    try {
      const term = req.query.term || req.query.q || "";
      const tickets = await searchTickets(term);
      res.json({ term, tickets });
    } catch (error) {
      sendError(res, error);
    }
  });


  router.get("/freshdesk/requesters/:requesterId/tickets", async (req, res) => {
    try {
      const requesterId = req.params.requesterId;
      const email = req.query.email || "";
      const maxResults = Number(req.query.limit || 50);
      const tickets = await getRequesterTickets(requesterId, email, { maxResults });
      res.json({ requesterId, email, total: tickets.length, tickets });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/freshdesk/tickets/:ticketId", async (req, res) => {
    try {
      const ticket = await getTicket(req.params.ticketId);
      const conversations = await getTicketConversations(req.params.ticketId);
      res.json({ ticket, conversations });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/freshdesk/tickets/:ticketId/context", async (req, res) => {
    try {
      const result = await enrichTicketResultWithKnowledge(await getTicketContext(req.params.ticketId));
      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/freshdesk/tickets/:ticketId/analyze", async (req, res) => {
    try {
      const { addInternalNote = false, updateTags = false } = req.body || {};
      const result = await fetchAndAnalyzeTicket(req.params.ticketId);
      let note = null;
      let updatedTicket = null;
      const skippedWrites = [];

      if (addInternalNote) {
        if (canWriteToFreshdesk()) {
          note = await addPrivateNote(
            req.params.ticketId,
            buildInternalNoteHtml(result.analysis, result.ticket, result.context, result.conversations || [])
          );
        } else {
          skippedWrites.push("addInternalNote");
        }
      }

      if (updateTags) {
        if (canWriteToFreshdesk()) {
          const currentTags = Array.isArray(result.ticket.tags) ? result.ticket.tags : [];
          const productTag = `ia-${String(result.analysis.product || "na").toLowerCase().replace(/\s+/g, "-")}`;
          const typeTag = `tipo-${String(result.analysis.freshdeskType || "triagem").toLowerCase().replace(/\s+/g, "-")}`;
          const tags = [...new Set([...currentTags, "support-copilot", productTag, typeTag])];
          updatedTicket = await updateTicket(req.params.ticketId, { tags });
        } else {
          skippedWrites.push("updateTags");
        }
      }

      res.json({
        ...result,
        note,
        updatedTicket,
        writesEnabled: canWriteToFreshdesk(),
        skippedWrites
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/freshdesk/tickets/:ticketId/render-template", async (req, res) => {
    try {
      const { template = "respostaInicial", analyze = true } = req.body || {};
      const result = analyze ? await fetchAndAnalyzeTicket(req.params.ticketId) : await getTicketContext(req.params.ticketId);
      const analysis = result.analysis || {};
      const rendered = renderTemplate(template, result.ticket, analysis, result.context, result.conversations || []);
      res.json({
        template: rendered,
        analysis,
        ticket: result.ticket,
        context: result.context,
        writesEnabled: canWriteToFreshdesk()
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/freshdesk/tickets/:ticketId/ai-note", async (req, res) => {
    try {
      const { template = "notaInternaIA", addInternalNote = false } = req.body || {};
      const result = await fetchAndAnalyzeTicket(req.params.ticketId);
      const rendered = renderTemplate(template, result.ticket, result.analysis, result.context, result.conversations || []);
      const html = template === "notaInternaIA"
        ? buildInternalNoteHtml(result.analysis, result.ticket, result.context, result.conversations || [])
        : textToHtml(rendered.body);

      let note = null;
      let skippedWrite = null;

      if (addInternalNote) {
        if (!canWriteToFreshdesk()) {
          skippedWrite = "addInternalNote";
        } else {
          note = await addPrivateNote(req.params.ticketId, html);
        }
      }

      res.json({
        ...result,
        template: rendered,
        html,
        note,
        writesEnabled: canWriteToFreshdesk(),
        skippedWrite
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/freshdesk/tickets/:ticketId/note", async (req, res) => {
    try {
      if (!canWriteToFreshdesk()) {
        return blockedWriteResponse(res);
      }

      const { note } = req.body || {};
      if (!note) {
        return res.status(400).json({ error: "Informe o conteudo da nota interna." });
      }

      const createdNote = await addPrivateNote(req.params.ticketId, textToHtml(note));
      res.json({ note: createdNote, writesEnabled: true });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/freshdesk/webhook/ticket-created", async (req, res) => {
    try {
      if (!checkWebhookSecret(req, res)) return;

      const ticketId = getTicketIdFromWebhook(req.body);
      if (!ticketId) {
        return res.status(400).json({ error: "Webhook recebido, mas sem ticket_id." });
      }

      const result = await fetchAndAnalyzeTicket(ticketId);
      const shouldAddNote = isAutoNoteEnabled();
      let note = null;

      if (shouldAddNote) {
        note = await addPrivateNote(ticketId, buildInternalNoteHtml(result.analysis, result.ticket, result.context, result.conversations || []));
      }

      res.json({
        received: true,
        ticketId,
        ...result,
        note,
        writesEnabled: canWriteToFreshdesk(),
        autoNote: shouldAddNote
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/support/copilot/analyze", async (req, res) => {
    try {
      const ticket = req.body?.ticket || req.body || {};
      const conversations = req.body?.conversations || [];
      const context = req.body?.context || {};
      const analysis = await analyzeSupportTicket(ticket, conversations, context);
      const renderedTemplates = renderRecommendedTemplates(ticket, analysis, context);
      res.json({
        ticket,
        conversations,
        context,
        analysis,
        renderedTemplates,
        writesEnabled: canWriteToFreshdesk()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
