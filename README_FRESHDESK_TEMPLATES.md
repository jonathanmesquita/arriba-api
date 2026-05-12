# PH3A Support Copilot - Templates Freshdesk

Esta versao adiciona uma camada de templates inteligentes para o Freshdesk.

## Rotas novas

### Listar templates locais

```http
GET /freshdesk/templates
```

### Renderizar template para um ticket

```http
POST /freshdesk/tickets/:ticketId/render-template
Content-Type: application/json

{
  "template": "solicitarEvidencias",
  "analyze": true
}
```

Templates disponiveis:

- `respostaInicial`
- `solicitarEvidencias`
- `encaminharDesenvolvimento`
- `direcionamentoComercial`
- `aguardandoCliente`
- `notaInternaIA`

### Adicionar nota interna com analise IA

```http
POST /freshdesk/tickets/:ticketId/ai-note
Content-Type: application/json

{
  "template": "notaInternaIA",
  "addInternalNote": true
}
```

## Regra operacional

A IA recomenda. O analista revisa.

No MVP, evite envio automatico de resposta ao cliente. A acao automatizada mais segura e adicionar nota interna privada no ticket.

## Tipos DEV aceitos

- Melhoria
- Customizacao
- BUG (Erros)

## Prioridade

- Baixa: verde
- Media: azul
- Alta: amarelo
- Urgente: vermelho

Use Urgente para recepcao travada, sistema parado, bug bloqueante, indisponibilidade ou operacao parada.
