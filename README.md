# arriba-api

Backend Node.js + Express da Arriba Platform.

## Módulos

```text
routes/chat.routes.js
modules/chat/
```
Chatbot atual da Arriba Platform, com OpenAI e fallback local.

```text
routes/freshdesk.routes.js
modules/freshdesk/
```
Freshdesk Support Copilot: busca tickets, analisa chamados, gera resumo, checklist, resposta sugerida, nota interna e especificação para Desenvolvimento.

## Rodar local

```bash
npm install
cp .env.example .env
npm start
```

## Rotas principais

```http
GET  /healthz
POST /chat
GET  /freshdesk/status
GET  /freshdesk/tickets/:ticketId
POST /freshdesk/tickets/:ticketId/analyze
POST /freshdesk/tickets/:ticketId/note
POST /freshdesk/webhook/ticket-created
POST /support/copilot/analyze
```

Veja também: `README_FRESHDESK_RENDER.md`.
