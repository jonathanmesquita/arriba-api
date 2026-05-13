# v2.0 - Support Copilot: tickets, recorrencia e DEV

## Backend

A rota `GET /freshdesk/tickets/:ticketId/context` foi melhorada para retornar:

- `context.requesterAllTickets`
- `context.requesterOpenTickets`
- `context.requesterClosedTickets`
- `context.companyOpenTickets`
- `context.companyClosedTickets`
- `context.openTickets`
- `context.closedTickets`
- `context.associatedTickets`
- `context.recurrenceInsights`

## Recorrencia

`context.recurrenceInsights` traz contagens simples para apoiar o dashboard:

- problemas recorrentes
- prioridades
- status
- alertas de volume

## Especificacao DEV

A especificacao usa o agente do Freshdesk, quando retornado pela API:

- `context.agent.name`
- `context.agent.contact.name`
- `ticket.agent.name`
- `ticket.responder_name`

## Escrita no Freshdesk

Mantenha em read-only durante testes:

```env
FRESHDESK_ENABLE_WRITES=false
SUPPORT_COPILOT_AUTO_NOTE=false
```
