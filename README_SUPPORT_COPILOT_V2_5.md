# Arriba Support Copilot v2.5 - Knowledge Router

Esta versão adiciona uma camada local de roteamento de manuais para o Support Copilot.

## Objetivo

Separar a base de conhecimento por:

- manuais gerais DataCob;
- rotinas por módulo;
- rotinas específicas por cliente;
- manuais técnicos de integração/layout;
- artigos locais e artigos Freshdesk.

## Novos módulos

```txt
modules/knowledge/manualCatalog.js
modules/knowledge/manualSearch.js
```

## Novas rotas

```http
GET  /freshdesk/manuals
GET  /freshdesk/manuals/search?term=moneyplus bmp
POST /freshdesk/manuals/match
```

## Integração com ticket

A rota abaixo agora retorna também `context.manuals` e `context.manualMatch`:

```http
GET /freshdesk/tickets/:ticketId/context
```

A análise do ticket continua em modo seguro/read-only.

## Exemplos de busca

```txt
/freshdesk/manuals/search?term=versao checklist homologacao
/freshdesk/manuals/search?term=moneyplus bmp acordo
/freshdesk/manuals/search?term=active directory login
/freshdesk/manuals/search?term=recepcao boleto original
/freshdesk/manuals/search?term=cnab444 bmp
```

## Próxima evolução

- converter PDFs em artigos locais padronizados;
- sincronizar índice local com Freshdesk Solutions;
- permitir edição pelo manual-builder.html;
- registrar lacunas: tickets sem manual sugerido.
