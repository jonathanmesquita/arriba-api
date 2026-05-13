# PH3A Support Copilot v1.9 - Real Ticket Validation

Esta versão mantém o modo seguro/read-only e adiciona ajustes para validação com tickets reais.

## Principais melhorias

- Classificação mais forte para evitar que solicitações de relatório sejam confundidas com Prospect/Comercial.
- Prioridade do Freshdesk é preservada quando o ticket já está como Urgente.
- Endpoint para registrar validação local sem escrever no Freshdesk.
- Painel de qualidade com últimas 24h, validações e contagens por empresa/agente.
- Logs locais continuam em `data/support-copilot-logs.jsonl`.

## Novas rotas

```http
POST /support/copilot/validation
GET  /freshdesk/quality/dashboard
GET  /support/copilot/logs
```

## Modo seguro

Mantenha no Render:

```env
FRESHDESK_ENABLE_WRITES=false
SUPPORT_COPILOT_AUTO_NOTE=false
```

Com isso, a API não adiciona notas, não altera tags e não atualiza tickets.

## Validação sugerida

Separe tickets reais variados e valide:

- Produto correto
- Tipo Freshdesk correto
- Prioridade correta
- Cenário recomendado
- Tipo DEV: Melhoria, Customização ou BUG (Erros)
- Resumo útil
- Checklist acionável
- Resposta natural
- Tickets do solicitante retornando corretamente
