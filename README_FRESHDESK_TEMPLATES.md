# Freshdesk Templates - Support Copilot v1.6

Esta versao mantem o Support Copilot em **modo somente leitura por padrao**.

O objetivo agora e:

- buscar contexto do ticket;
- analisar o chamado;
- recomendar resposta predefinida;
- renderizar resposta ao cliente;
- gerar anotacao interna para copiar;
- gerar especificacao para Desenvolvimento;
- **nao gravar nada no Freshdesk automaticamente**.

## Variaveis obrigatorias no Render

```env
FRESHDESK_DOMAIN=ph3a.freshdesk.com
FRESHDESK_API_KEY=sua-chave
OPENAI_API_KEY=sua-chave
OPENAI_MODEL=gpt-4o-mini
FRESHDESK_ENABLE_WRITES=false
SUPPORT_COPILOT_AUTO_NOTE=false
```

## Modo seguro

Com esta configuracao:

```env
FRESHDESK_ENABLE_WRITES=false
SUPPORT_COPILOT_AUTO_NOTE=false
```

As rotas continuam funcionando para leitura e analise:

```http
GET  /freshdesk/status
GET  /freshdesk/templates
GET  /freshdesk/tickets/:ticketId
GET  /freshdesk/tickets/:ticketId/context
POST /freshdesk/tickets/:ticketId/analyze
POST /freshdesk/tickets/:ticketId/render-template
POST /freshdesk/tickets/:ticketId/ai-note
POST /support/copilot/analyze
```

Mas as acoes de escrita ficam bloqueadas ou ignoradas com seguranca:

```http
POST /freshdesk/tickets/:ticketId/note
POST /freshdesk/webhook/ticket-created
POST /freshdesk/tickets/:ticketId/analyze { "addInternalNote": true }
POST /freshdesk/tickets/:ticketId/analyze { "updateTags": true }
POST /freshdesk/tickets/:ticketId/ai-note { "addInternalNote": true }
```

Quando uma rota pedir escrita e `FRESHDESK_ENABLE_WRITES=false`, a API retorna `writesEnabled: false` e informa em `skippedWrites` ou `skippedWrite` que a gravacao foi ignorada.

## Status esperado

Acesse:

```http
GET /freshdesk/status
```

Retorno esperado em modo seguro:

```json
{
  "ok": true,
  "freshdeskConfigured": true,
  "openaiConfigured": true,
  "writesEnabled": false,
  "autoNote": false,
  "mode": "read-only"
}
```

## Liberar escrita no futuro

Apenas depois dos testes e revisao interna:

```env
FRESHDESK_ENABLE_WRITES=true
SUPPORT_COPILOT_AUTO_NOTE=false
```

Mesmo com escrita liberada, mantenha `SUPPORT_COPILOT_AUTO_NOTE=false` enquanto a equipe estiver validando o fluxo.

Para permitir nota automatica por webhook, seria necessario:

```env
FRESHDESK_ENABLE_WRITES=true
SUPPORT_COPILOT_AUTO_NOTE=true
```

Nao recomendado no MVP.

## Rotas principais para teste

### Buscar contexto

```http
GET /freshdesk/tickets/65841/context
```

### Analisar sem escrever

```bash
curl -X POST https://api.jm.dev.br/freshdesk/tickets/65841/analyze \
  -H "Content-Type: application/json" \
  -d '{"addInternalNote": false, "updateTags": false}'
```

### Gerar nota interna sem gravar

```bash
curl -X POST https://api.jm.dev.br/freshdesk/tickets/65841/ai-note \
  -H "Content-Type: application/json" \
  -d '{"template":"notaInternaIA", "addInternalNote": false}'
```

### Renderizar resposta predefinida

```bash
curl -X POST https://api.jm.dev.br/freshdesk/tickets/65841/render-template \
  -H "Content-Type: application/json" \
  -d '{"template":"solicitarEvidencias"}'
```
