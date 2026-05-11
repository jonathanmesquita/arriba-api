import express from "express";
import {
  addPrivateNote,
  getAgent,
  getAssociatedTickets,
  getCompany,
  getContact,
  getGroup,
  getTicket,
  getTicketConversations,
  isFreshdeskConfigured,
  listRequesterTickets,
  searchTicketsBySubject,
  updateTicket
} from "../modules/freshdesk/freshdeskClient.js";
import { analyzeSupportTicket } from "../modules/freshdesk/supportAnalyzer.js";
import { buildInternalNoteHtml, DEFAULT_STATUS_LABELS, formatTicketListForUi } from "../modules/freshdesk/templates.js";

function getTicketIdFromWebhook(body = {}) {
  return body.ticket_id || body.ticketId || body.id || body.ticket?.id || body.display_id || body.ticket?.display_id;
}

function checkWebhookSecret(req, res) {
  const expected = process.env.FRESHDESK_WEBHOOK_SECRET;
  if (!expected) return true;

  const received = req.get("x-arriba-webhook-secret") || req.query.secret || req.body.secret;
  if (received !== expected) {
    res.status(401).json({ error: "Webhook não autorizado." });
    return false;
  }

  return true;
}

function isOpenTicket(ticket = {}) {
  const rawStatus = ticket.status;
  const status = DEFAULT_STATUS_LABELS[rawStatus] || String(rawStatus || "").toLowerCase();
  return !["Resolvido", "Fechado", "resolved", "closed", "4", "5"].includes(status);
}

async function buildTicketContext(ticketId) {
  const ticket = await getTicket(ticketId);
  const [conversations, associatedTickets, contact, company, group, agent] = await Promise.all([
    getTicketConversations(ticketId),
    getAssociatedTickets(ticketId),
    getContact(ticket.requester_id),
    getCompany(ticket.company_id),
    getGroup(ticket.group_id),
    getAgent(ticket.responder_id)
  ]);

  const requesterTickets = await listRequesterTickets(ticket.requester_id, 30);
  const requesterOpenTickets = requesterTickets.filter(isOpenTicket);

  const context = {
    contact,
    company,
    group,
    agent,
    associatedTickets,
    requesterTickets,
    requesterOpenTickets,
    ui: {
      associatedTickets: formatTicketListForUi(associatedTickets),
      requesterOpenTickets: formatTicketListForUi(requesterOpenTickets),
      requesterTickets: formatTicketListForUi(requesterTickets)
    }
  };

  return { ticket, conversations, context };
}

async function fetchAndAnalyzeTicket(ticketId) {
  const { ticket, conversations, context } = await buildTicketContext(ticketId);
  const analysis = await analyzeSupportTicket(ticket, conversations, context);
  return { ticket, conversations, context, analysis };
}

export function createFreshdeskRouter() {
  const router = express.Router();

  router.get("/freshdesk/status", (req, res) => {
    res.json({
      ok: true,
      freshdeskConfigured: isFreshdeskConfigured(),
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
      autoNote: process.env.SUPPORT_COPILOT_AUTO_NOTE === "true"
    });
  });

  router.get("/freshdesk/tickets/search", async (req, res) => {
    try {
      const term = String(req.query.term || req.query.q || "").trim();
      if (!term) return res.status(400).json({ error: "Informe o termo de busca em ?term=." });

      const tickets = await searchTicketsBySubject(term, Number(req.query.limit) || 10);
      res.json({ term, tickets, ui: { tickets: formatTicketListForUi(tickets) } });
    } catch (error) {
      res.status(error.statusCode || 500).json({
        error: error.message,
        code: error.code,
        details: error.details
      });
    }
  });

  router.get("/freshdesk/tickets/:ticketId", async (req, res) => {
    try {
      const { ticket, conversations, context } = await buildTicketContext(req.params.ticketId);
      res.json({ ticket, conversations, context });
    } catch (error) {
      res.status(error.statusCode || 500).json({
        error: error.message,
        code: error.code,
        details: error.details
      });
    }
  });

  router.get("/freshdesk/tickets/:ticketId/context", async (req, res) => {
    try {
      const { ticket, conversations, context } = await buildTicketContext(req.params.ticketId);
      res.json({ ticket, conversations, context });
    } catch (error) {
      res.status(error.statusCode || 500).json({
        error: error.message,
        code: error.code,
        details: error.details
      });
    }
  });

  router.post("/freshdesk/tickets/:ticketId/analyze", async (req, res) => {
    try {
      const { addInternalNote = false, updateTags = false } = req.body || {};
      const result = await fetchAndAnalyzeTicket(req.params.ticketId);
      let note = null;
      let updatedTicket = null;

      if (addInternalNote) {
        note = await addPrivateNote(req.params.ticketId, buildInternalNoteHtml(result.analysis));
      }

      if (updateTags) {
        const currentTags = Array.isArray(result.ticket.tags) ? result.ticket.tags : [];
        const tags = [...new Set([...currentTags, "support-copilot", `ia-${String(result.analysis.product || "na").toLowerCase()}`])];
        updatedTicket = await updateTicket(req.params.ticketId, { tags });
      }

      res.json({ ...result, note, updatedTicket });
    } catch (error) {
      res.status(error.statusCode || 500).json({
        error: error.message,
        code: error.code,
        details: error.details
      });
    }
  });

  router.post("/freshdesk/tickets/:ticketId/note", async (req, res) => {
    try {
      const { note } = req.body || {};
      if (!note) {
        return res.status(400).json({ error: "Informe o conteúdo da nota interna." });
      }

      const createdNote = await addPrivateNote(req.params.ticketId, note);
      res.json({ note: createdNote });
    } catch (error) {
      res.status(error.statusCode || 500).json({
        error: error.message,
        code: error.code,
        details: error.details
      });
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
      const shouldAddNote = process.env.SUPPORT_COPILOT_AUTO_NOTE === "true" || req.body.addInternalNote === true;
      let note = null;

      if (shouldAddNote) {
        note = await addPrivateNote(ticketId, buildInternalNoteHtml(result.analysis));
      }

      res.json({ received: true, ticketId, ...result, note });
    } catch (error) {
      res.status(error.statusCode || 500).json({
        error: error.message,
        code: error.code,
        details: error.details
      });
    }
  });

  router.post("/support/copilot/analyze", async (req, res) => {
    try {
      const ticket = req.body?.ticket || req.body || {};
      const conversations = req.body?.conversations || [];
      const context = req.body?.context || {};
      const analysis = await analyzeSupportTicket(ticket, conversations, context);
      res.json({ ticket, conversations, context, analysis });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
