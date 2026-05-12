import express from "express";
import {
  addPrivateNote,
  getTicket,
  getTicketContext,
  getTicketConversations,
  isFreshdeskConfigured,
  searchTickets,
  updateTicket
} from "../modules/freshdesk/freshdeskClient.js";
import { analyzeSupportTicket } from "../modules/freshdesk/supportAnalyzer.js";
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

async function fetchAndAnalyzeTicket(ticketId) {
  const result = await getTicketContext(ticketId);
  const analysis = await analyzeSupportTicket(result.ticket, result.conversations, result.context);
  const renderedTemplates = renderRecommendedTemplates(result.ticket, analysis, result.context);
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
      templates: Object.keys(FRESHDESK_TEMPLATES)
    });
  });

  router.get("/freshdesk/templates", (req, res) => {
    res.json({ templates: FRESHDESK_TEMPLATES });
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
      const result = await getTicketContext(req.params.ticketId);
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
            buildInternalNoteHtml(result.analysis, result.ticket, result.context)
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
      const rendered = renderTemplate(template, result.ticket, analysis, result.context);
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
      const rendered = renderTemplate(template, result.ticket, result.analysis, result.context);
      const html = template === "notaInternaIA"
        ? buildInternalNoteHtml(result.analysis, result.ticket, result.context)
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
        note = await addPrivateNote(ticketId, buildInternalNoteHtml(result.analysis, result.ticket, result.context));
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
