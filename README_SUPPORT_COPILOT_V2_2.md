# PH3A Support Copilot v2.2 — Freshdesk Knowledge Connector

Esta versão conecta a análise do Support Copilot com duas fontes de conhecimento:

1. **Base local/offline** (`modules/freshdesk/knowledgeBase.js`) — fallback versionado.
2. **Freshdesk Solutions** — artigos reais da base de conhecimento do Freshdesk.

O modo seguro permanece ativo: a API consulta, analisa, renderiza e copia, mas não escreve no Freshdesk enquanto `FRESHDESK_ENABLE_WRITES=false`.

## Variáveis de ambiente

```env
FRESHDESK_USE_SOLUTIONS_API=true
FRESHDESK_SOLUTIONS_FOLDER_IDS=48000676183
FRESHDESK_SEED_ARTICLE_IDS=48001282071,48001170514,48001280258
FRESHDESK_KB_CACHE_TTL_MINUTES=60
FRESHDESK_ENABLE_WRITES=false
SUPPORT_COPILOT_AUTO_NOTE=false
```

## Rotas novas

```http
GET /freshdesk/knowledge/search?term=versao
GET /freshdesk/knowledge/sync?force=true
GET /freshdesk/solutions/articles/:articleId
GET /freshdesk/solutions/folders/:folderId/articles
```

## Fluxo

```text
Ticket Freshdesk
  ↓
Busca contexto do ticket
  ↓
Busca conhecimento local + Freshdesk Solutions
  ↓
Análise IA/fallback usa o ticket + artigos encontrados
  ↓
Frontend mostra a aba Base com origem, regras, checklist, artigo e link
```

## Testes rápidos

```text
https://api.jm.dev.br/freshdesk/status
https://api.jm.dev.br/freshdesk/knowledge/search?term=versao
https://api.jm.dev.br/freshdesk/knowledge/sync?force=true
https://api.jm.dev.br/freshdesk/solutions/articles/48001282071
https://api.jm.dev.br/freshdesk/solutions/folders/48000676183/articles
```

## Observação

Se o Freshdesk bloquear algum endpoint de Solutions por plano/permissão, a API mantém a base local como fallback e exibe o erro no campo `sync.errors` ou `knowledge.lastError`.
