# PH3A Support Copilot v2.1 - Knowledge Base + Versao

## Objetivo

A v2.1 adiciona uma camada de base de conhecimento ao Support Copilot para melhorar a analise completa de tickets, principalmente casos de **Versao / Agendamento automatico de versao**.

O projeto continua em modo seguro/read-only quando:

```env
FRESHDESK_ENABLE_WRITES=false
SUPPORT_COPILOT_AUTO_NOTE=false
```

## O que mudou

- Criado `modules/freshdesk/knowledgeBase.js` com catalogo local de artigos/manuais.
- Adicionada deteccao forte de tickets com palavras-chave de versao.
- Tickets de versao passam a sugerir:
  - Produto: `DataCob`
  - Tipo Freshdesk: `Versao`
  - Cenario: `Mover para Datacob`
  - Template: `@Respostas para o cliente quer atualizar versao - (Resposta do agendamento)`
- Criado template `versaoAgendamento`.
- Anotacao interna passa a exibir base de conhecimento sugerida.
- Nova rota: `GET /freshdesk/knowledge/search?term=versao`.

## Rotas novas/alteradas

```http
GET /freshdesk/knowledge/search?term=agendamento%20versao
GET /freshdesk/templates
POST /freshdesk/tickets/:ticketId/analyze
```

## Variaveis novas

```env
FRESHDESK_USE_SOLUTIONS_API=false
```

- `false`: usa somente catalogo local versionado no backend.
- `true`: tenta consultar a base real do Freshdesk Solutions, alem do catalogo local.

## Proximo passo

Quando a base local estiver validada, conectar com artigos reais do Freshdesk usando a API de Solutions/Search e/ou mapear categorias/pastas oficiais da base de conhecimento PH3A.
