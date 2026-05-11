import express from "express";
import {
  addPrivateNote,
  getTicket,
  getTicketConversations,
  isFreshdeskConfigured,
  updateTicket
} from "../modules/freshdesk/freshdeskClient.js";
import { analyzeSupportTicket } from "../modules/freshdesk/supportAnalyzer.js";
import { buildInternalNoteHtml } from "../modules/freshdesk/templates.js";

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

async function fetchAndAnalyzeTicket(ticketId) {
  const ticket = await getTicket(ticketId);
  const conversations = await getTicketConversations(ticketId);
  const analysis = await analyzeSupportTicket(ticket, conversations);
  return { ticket, conversations, analysis };
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

  router.get("/freshdesk/tickets/:ticketId", async (req, res) => {
    try {
      const ticket = await getTicket(req.params.ticketId);
      const conversations = await getTicketConversations(req.params.ticketId);
      res.json({ ticket, conversations });
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
      const analysis = await analyzeSupportTicket(ticket, conversations);
      res.json({ ticket, conversations, analysis });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
