# Freshdesk Support Copilot

Módulo separado do chatbot para conectar a Arriba API ao Freshdesk.

## Rotas

```http
GET /freshdesk/status
GET /freshdesk/tickets/:ticketId
POST /freshdesk/tickets/:ticketId/analyze
POST /freshdesk/tickets/:ticketId/note
POST /freshdesk/webhook/ticket-created
POST /support/copilot/analyze
```

## Fluxo recomendado no MVP

1. Buscar o ticket pelo ID.
2. Analisar com IA ou fallback local.
3. Retornar resumo, prioridade, cenário recomendado, checklist e especificação para desenvolvimento.
4. O analista revisa.
5. Só depois grava nota interna ou executa cenário no Freshdesk.

## Variáveis de ambiente

```env
FRESHDESK_DOMAIN=ph3a.freshdesk.com
FRESHDESK_API_KEY=...
FRESHDESK_WEBHOOK_SECRET=...
SUPPORT_COPILOT_AUTO_NOTE=false
OPENAI_API_KEY=...
```
