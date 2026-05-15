# PH3A Support Copilot v2.3 - Knowledge Admin

Esta versão mantém o modo seguro/read-only e adiciona uma camada de administração e diagnóstico da base de conhecimento.

## Objetivo

Evitar manutenção manual de `knowledgeBase.js` por sessão e facilitar a validação da base usada pelo Support Copilot.

## Novas rotas

```http
GET /freshdesk/knowledge/admin
GET /freshdesk/knowledge/articles
GET /freshdesk/knowledge/gaps
```

## Rotas já usadas pela base

```http
GET /freshdesk/knowledge/search?term=versao
GET /freshdesk/knowledge/sync?force=true
GET /freshdesk/solutions/articles/:articleId
GET /freshdesk/solutions/folders/:folderId/articles
```

## Variáveis recomendadas no Render

```env
FRESHDESK_USE_SOLUTIONS_API=true
FRESHDESK_SOLUTIONS_FOLDER_IDS=48000676183
FRESHDESK_SEED_ARTICLE_IDS=48001282071,48001170514,48001280258
FRESHDESK_KB_CACHE_TTL_MINUTES=60
FRESHDESK_ENABLE_WRITES=false
SUPPORT_COPILOT_AUTO_NOTE=false
```

## O que a rota admin retorna

- status do cache;
- artigos locais;
- artigos Freshdesk sincronizados;
- total combinado;
- contagem por fonte, produto e tipo;
- lacunas de conhecimento com base nos logs locais;
- modo atual `read-only` ou `read-write`.

## Segurança

Nenhuma rota desta versão grava no Freshdesk. A escrita segue bloqueada enquanto `FRESHDESK_ENABLE_WRITES=false`.
