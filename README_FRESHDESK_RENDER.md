# Arriba API + Freshdesk no Render

Este backend mantém os módulos separados:

```text
arriba-api/
├── routes/
│   ├── chat.routes.js              # chatbot atual
│   └── freshdesk.routes.js         # rotas Freshdesk / Support Copilot
├── modules/
│   ├── chat/                       # fallback e base local do chatbot
│   └── freshdesk/                  # cliente Freshdesk, IA e templates
└── server.js                       # servidor Express que carrega os módulos
```

## Variáveis de ambiente no Render

Crie estas variáveis no serviço do Render:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
FRESHDESK_DOMAIN=ph3a.freshdesk.com
FRESHDESK_API_KEY=cole-a-api-key-do-freshdesk
FRESHDESK_WEBHOOK_SECRET=um-token-forte-para-webhook
SUPPORT_COPILOT_AUTO_NOTE=false
```

## Configuração do Web Service no Render

- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Root Directory: `arriba-api` se o repositório tiver frontend e backend juntos.
- Branch: `main` ou a branch usada no deploy.

## Testes rápidos

Status geral:

```bash
curl https://SUA-API.onrender.com/healthz
```

Status Freshdesk:

```bash
curl https://SUA-API.onrender.com/freshdesk/status
```

Buscar ticket:

```bash
curl https://SUA-API.onrender.com/freshdesk/tickets/65841
```

Analisar ticket sem gravar nota:

```bash
curl -X POST https://SUA-API.onrender.com/freshdesk/tickets/65841/analyze \
  -H "Content-Type: application/json" \
  -d '{"addInternalNote": false}'
```

Analisar e gravar nota interna:

```bash
curl -X POST https://SUA-API.onrender.com/freshdesk/tickets/65841/analyze \
  -H "Content-Type: application/json" \
  -d '{"addInternalNote": true}'
```

## Webhook no Freshdesk

Use a URL:

```text
https://SUA-API.onrender.com/freshdesk/webhook/ticket-created?secret=SEU_TOKEN
```

Método: POST

Body JSON sugerido:

```json
{
  "ticket_id": "{{ticket.id}}"
}
```

No MVP, mantenha `SUPPORT_COPILOT_AUTO_NOTE=false` e use o endpoint manual de análise. Quando estiver seguro, ative a nota automática.

## v1.3 - Contexto completo do ticket

Novas rotas adicionadas:

```http
GET  /freshdesk/tickets/:ticketId/context
GET  /freshdesk/tickets/search?term=texto
POST /freshdesk/tickets/:ticketId/analyze
```

A rota `/context` busca o ticket, conversas, contato, empresa, agente, grupo, tickets associados e tickets abertos do solicitante. A tela do Support Copilot usa essa rota para preencher os campos automaticamente quando o usuário informa apenas o número do ticket.

A análise agora considera os valores operacionais usados no Freshdesk:

- Prioridade: Baixa, Média, Alta, Urgente
- Status sugerido: Aberto, Pendente, Resolvido, Fechado, Aguardando Aprovação, Aguardando Cliente, Análise, Desenvolvendo, Homologado, Rejeitado, Em Backlog
- Tipo Freshdesk conforme a lista operacional do Suporte
- Tipo DEV somente: Melhoria, Customização ou BUG (Erros)

Para começar seguro, mantenha:

```env
SUPPORT_COPILOT_AUTO_NOTE=false
```

Assim a IA recomenda, mas não grava nota interna automaticamente.
