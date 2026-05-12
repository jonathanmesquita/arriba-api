# PH3A Support Copilot v1.7

## Objetivo

A v1.7 consolida o modo seguro do Support Copilot e adiciona tres blocos principais:

1. Placeholder Resolver completo para variaveis Freshdesk e variaveis IA.
2. UX melhorada para busca por numero de ticket ou assunto, contato completo, tickets relacionados e preview de anotacao.
3. Painel inicial de qualidade do suporte baseado em logs locais de analise, sem gravar nada no Freshdesk.

## Modo seguro

A ferramenta continua em modo somente leitura quando as variaveis abaixo estiverem assim:

```env
FRESHDESK_ENABLE_WRITES=false
SUPPORT_COPILOT_AUTO_NOTE=false
```

Nesse modo, a API pode buscar, analisar, renderizar templates e gerar texto para copiar, mas nao adiciona nota, nao atualiza tags e nao altera ticket.

## Novas rotas

```http
GET /freshdesk/placeholders
GET /freshdesk/quality/dashboard
GET /support/copilot/logs
```

As rotas anteriores continuam funcionando:

```http
GET  /freshdesk/status
GET  /freshdesk/templates
GET  /freshdesk/tickets/search?term=...
GET  /freshdesk/tickets/:ticketId/context
POST /freshdesk/tickets/:ticketId/analyze
POST /freshdesk/tickets/:ticketId/render-template
POST /freshdesk/tickets/:ticketId/ai-note
POST /support/copilot/analyze
```

## Variaveis Freshdesk renderizadas

O resolvedor suporta variaveis como:

- `{{ticket.id}}`
- `{{ticket.subject}}`
- `{{ticket.description}}`
- `{{ticket.latest_public_comment}}`
- `{{ticket.latest_private_comment}}`
- `{{ticket.requester.name}}`
- `{{ticket.requester.email}}`
- `{{ticket.requester.phone}}`
- `{{ticket.company.name}}`
- `{{ticket.company.businessname}}`
- `{{ticket.agent.name}}`
- `{{ticket.group.name}}`
- `{{ticket.cf_*}}`
- `{{helpdesk_name}}`

Tambem suporta variaveis internas da IA:

- `{{ai.summary}}`
- `{{ai.product}}`
- `{{ai.freshdeskType}}`
- `{{ai.developmentType}}`
- `{{ai.priority}}`
- `{{ai.recommendedScenario}}`
- `{{ai.recommendedGroup}}`
- `{{ai.checklist}}`
- `{{ai.nextAction}}`
- `{{ai.agentValidationStatus}}`
- `{{ai.agentValidationMessage}}`

## Classificacao DEV

Quando o chamado precisa ir para Desenvolvimento, o tipo DEV fica restrito a:

- Melhoria
- Customizacao
- BUG (Erros)

## Painel de qualidade

O painel usa logs locais do backend e logs locais do navegador. Ele nao grava no Freshdesk.

Indicadores exibidos:

- Total de analises
- Chamados urgentes
- Chamados com demanda DEV
- Chamados comerciais
- Produtos mais recorrentes
- Tipos Freshdesk mais recorrentes
- Prioridades
- Cenarios recomendados
- Alertas de recorrencia
