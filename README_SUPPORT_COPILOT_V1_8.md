# PH3A Support Copilot v1.8 - Tickets do Solicitante

## Objetivo

Melhorar a coleta de contexto do Freshdesk para exibir tickets abertos e historico do mesmo solicitante que abriu o chamado.

## Problema corrigido

Na v1.7, a aba **Tickets** podia retornar vazio mesmo quando o Freshdesk mostrava outros chamados do mesmo solicitante. O motivo principal era a dependencia da rota `/search/tickets`, que pode variar conforme a sintaxe de busca e configuracao do Freshdesk.

## Ajuste tecnico

A v1.8 passa a buscar tickets do solicitante preferencialmente por:

```http
GET /api/v2/tickets?requester_id=<ID>&include=requester,stats&page=<N>&per_page=100
GET /api/v2/tickets?email=<EMAIL>&include=requester,stats&page=<N>&per_page=100
```

E usa `/search/tickets` apenas como fallback.

## Novos dados no contexto

A rota abaixo:

```http
GET /freshdesk/tickets/:ticketId/context
```

passa a retornar em `context`:

```json
{
  "requesterAllTickets": [],
  "requesterOpenTickets": [],
  "companyOpenTickets": [],
  "requesterTicketSummary": {
    "requesterId": "...",
    "requesterEmail": "...",
    "totalFound": 0,
    "openFound": 0,
    "companyOpenFound": 0,
    "strategy": "tickets_endpoint"
  }
}
```

## Nova rota de debug

```http
GET /freshdesk/requesters/:requesterId/tickets?email=email@cliente.com&limit=50
```

Use para validar rapidamente se a API consegue listar tickets por solicitante.

## Frontend

A aba **Tickets** agora exibe:

- resumo com e-mail do solicitante;
- total localizado;
- tickets abertos;
- tickets abertos da empresa;
- todos os tickets localizados do solicitante;
- tickets associados;
- recorrencias por assunto.

## Modo seguro

A v1.8 continua respeitando:

```env
FRESHDESK_ENABLE_WRITES=false
SUPPORT_COPILOT_AUTO_NOTE=false
```

Ou seja: consulta, analisa, renderiza e copia. Nao grava nada no Freshdesk.
