import { freshdeskRequest } from "./freshdeskClient.js";
import { searchLocalKnowledge } from "./knowledgeBase.js";

const DEFAULT_CACHE_TTL_MINUTES = 60;
const DEFAULT_PER_PAGE = 100;

const solutionCache = {
  syncedAt: null,
  expiresAt: 0,
  articles: [],
  byId: new Map(),
  folders: new Map(),
  lastError: null
};

function normalizeText(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value = "") {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCsvEnv(name) {
  return String(process.env[name] || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getDomain() {
  return String(process.env.FRESHDESK_DOMAIN || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");
}

function getKbCacheTtlMs() {
  const minutes = Number(process.env.FRESHDESK_KB_CACHE_TTL_MINUTES || DEFAULT_CACHE_TTL_MINUTES);
  return Math.max(minutes, 5) * 60 * 1000;
}

export function isFreshdeskSolutionsEnabled() {
  return process.env.FRESHDESK_USE_SOLUTIONS_API === "true";
}

function freshdeskArticleUrl(article = {}) {
  const domain = getDomain();
  const id = article.id || article.article_id || article.solution_article_id;
  if (!domain || !id) return article.url || "";
  return `https://${domain}/a/solutions/articles/${id}?lang=pt-BR`;
}

function articleBody(raw = {}) {
  return raw.description || raw.description_text || raw.body || raw.body_text || raw.content || raw.answer || raw.article_body || "";
}

function articleTitle(raw = {}) {
  return raw.title || raw.name || raw.subject || `Artigo ${raw.id || raw.article_id || "Freshdesk"}`;
}

function articleStatus(raw = {}) {
  return raw.status || raw.state || raw.approval_status || raw.visibility || "";
}

function articleFolderId(raw = {}) {
  return raw.folder_id || raw.solution_folder_id || raw.parent_folder_id || raw.folder?.id || raw.hierarchy?.folder_id || "";
}

function articleCategoryId(raw = {}) {
  return raw.category_id || raw.solution_category_id || raw.category?.id || raw.hierarchy?.category_id || "";
}

function scoreArticle(article = {}, term = "") {
  const query = normalizeText(term);
  const haystack = normalizeText([
    article.title,
    article.summary,
    article.bodyText,
    article.product,
    article.freshdeskType,
    article.folderName,
    article.categoryName,
    Array.isArray(article.keywords) ? article.keywords.join(" ") : article.keywords
  ].filter(Boolean).join(" "));

  if (!query) return article.score || 0.35;

  const queryTerms = query.split(/\s+/).filter((item) => item.length >= 3);
  const hits = queryTerms.filter((word) => haystack.includes(word)).length;
  const titleBoost = normalizeText(article.title).includes(query) ? 0.35 : 0;
  const phraseBoost = haystack.includes(query) ? 0.25 : 0;
  const keywordBoost = Array.isArray(article.keywords) && article.keywords.some((kw) => normalizeText(kw).includes(query) || query.includes(normalizeText(kw))) ? 0.25 : 0;
  const base = queryTerms.length ? hits / queryTerms.length : 0;
  return Math.min(Number((base * 0.55 + titleBoost + phraseBoost + keywordBoost + 0.1).toFixed(3)), 1);
}

function inferArticleType(text = "") {
  const normalized = normalizeText(text);
  if (/versao|atualizacao|agendamento|checklist|homologacao|producao/.test(normalized)) return "Versao";
  if (/relatorio|extracao|exportacao/.test(normalized)) return "Relatorio";
  if (/recepcao|importacao|layout|arquivo|csv/.test(normalized)) return "Recepcao de Arquivo";
  if (/senha|login|acesso|token|tag/.test(normalized)) return "Reset Senha";
  if (/integracao|api|webhook/.test(normalized)) return "Integracao";
  return "Duvida";
}

function inferProduct(text = "") {
  const normalized = normalizeText(text);
  if (/databusca|data busca/.test(normalized)) return "DataBusca";
  if (/datacob|data cob|cobranca|versao|recepcao|contrato|relatorio/.test(normalized)) return "DataCob";
  return "Nao identificado";
}

export function normalizeSolutionArticle(raw = {}, options = {}) {
  const id = String(raw.id || raw.article_id || raw.solution_article_id || options.id || "");
  const title = articleTitle(raw);
  const body = articleBody(raw);
  const bodyText = stripHtml(body);
  const summary = stripHtml(raw.summary || raw.description_text || bodyText).slice(0, 500);
  const combined = `${title} ${summary} ${bodyText}`;
  const freshdeskType = raw.freshdeskType || inferArticleType(combined);
  const product = raw.product || inferProduct(combined);
  const folderId = articleFolderId(raw) || options.folderId || "";
  const categoryId = articleCategoryId(raw) || options.categoryId || "";

  return {
    id,
    title,
    source: options.source || "freshdesk-solutions",
    sourceLabel: "Freshdesk Solutions",
    product,
    freshdeskType,
    folderId: folderId ? String(folderId) : "",
    folderName: raw.folder_name || raw.folder?.name || options.folderName || "",
    categoryId: categoryId ? String(categoryId) : "",
    categoryName: raw.category_name || raw.category?.name || options.categoryName || "",
    status: articleStatus(raw),
    url: raw.url || freshdeskArticleUrl(raw),
    bodyHtml: body,
    bodyText,
    summary,
    keywords: [title, freshdeskType, product, raw.tags].flat().filter(Boolean),
    rules: raw.rules || [],
    checklist: raw.checklist || [],
    suggestedReply: raw.suggestedReply || "",
    updatedAt: raw.updated_at || raw.modified_at || raw.created_at || "",
    raw
  };
}

function asList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.articles)) return payload.articles;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.solution_articles)) return payload.solution_articles;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

async function tryFreshdeskPaths(paths = []) {
  let lastError = null;
  for (const path of paths) {
    try {
      const payload = await freshdeskRequest(path);
      return { payload, path };
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  return { payload: null, path: "" };
}

export async function getFreshdeskSolutionArticle(articleId) {
  if (!articleId) return null;
  if (!isFreshdeskSolutionsEnabled()) return null;

  const cached = solutionCache.byId.get(String(articleId));
  if (cached) return cached;

  const paths = [
    `/solutions/articles/${encodeURIComponent(articleId)}`,
    `/solutions/articles/${encodeURIComponent(articleId)}?include=folder`,
    `/solution/articles/${encodeURIComponent(articleId)}`
  ];
  const { payload } = await tryFreshdeskPaths(paths);
  const raw = Array.isArray(payload) ? payload[0] : payload?.article || payload?.solution_article || payload;
  const article = normalizeSolutionArticle(raw || {}, { id: articleId, source: "freshdesk-article" });
  solutionCache.byId.set(String(article.id || articleId), article);
  return article;
}

export async function getFreshdeskFolderArticles(folderId, options = {}) {
  if (!folderId) return [];
  if (!isFreshdeskSolutionsEnabled()) return [];

  const cacheKey = String(folderId);
  if (!options.force && solutionCache.folders.has(cacheKey) && Date.now() < solutionCache.expiresAt) {
    return solutionCache.folders.get(cacheKey) || [];
  }

  const perPage = Math.min(Number(options.perPage || DEFAULT_PER_PAGE), 100);
  const maxPages = Math.max(Number(options.maxPages || 5), 1);
  const collected = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const paths = [
      `/solutions/folders/${encodeURIComponent(folderId)}/articles?per_page=${perPage}&page=${page}`,
      `/solutions/folders/${encodeURIComponent(folderId)}/articles?state=published&per_page=${perPage}&page=${page}`,
      `/solutions/articles?folder_id=${encodeURIComponent(folderId)}&per_page=${perPage}&page=${page}`
    ];

    try {
      const { payload } = await tryFreshdeskPaths(paths);
      const list = asList(payload);
      if (!list.length) break;
      collected.push(...list.map((raw) => normalizeSolutionArticle(raw, { folderId, source: "freshdesk-folder" })));
      if (list.length < perPage) break;
    } catch (error) {
      if (page === 1) throw error;
      break;
    }
  }

  const unique = dedupeArticles(collected);
  solutionCache.folders.set(cacheKey, unique);
  unique.forEach((article) => solutionCache.byId.set(String(article.id), article));
  return unique;
}

function dedupeArticles(articles = []) {
  const map = new Map();
  articles.filter(Boolean).forEach((article) => {
    const key = String(article.id || article.url || article.title);
    if (!map.has(key)) map.set(key, article);
  });
  return [...map.values()];
}

export async function searchFreshdeskSolutionArticles(term = "", options = {}) {
  const query = String(term || "").trim();
  if (!query || !isFreshdeskSolutionsEnabled()) return [];
  const maxResults = Number(options.maxResults || 10);

  const attempts = [
    `/search/solutions?term=${encodeURIComponent(query)}`,
    `/search/solutions?query=${encodeURIComponent(query)}`
  ];

  const collected = [];
  for (const path of attempts) {
    try {
      const payload = await freshdeskRequest(path);
      const list = asList(payload).map((raw) => normalizeSolutionArticle(raw, { source: "freshdesk-search" }));
      collected.push(...list);
      if (collected.length >= maxResults) break;
    } catch (error) {
      solutionCache.lastError = error.message;
    }
  }

  return dedupeArticles(collected)
    .map((article) => ({ ...article, score: scoreArticle(article, query) }))
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, maxResults);
}

export async function syncFreshdeskKnowledge(options = {}) {
  const force = Boolean(options.force);
  if (!isFreshdeskSolutionsEnabled()) {
    return {
      enabled: false,
      articles: [],
      total: 0,
      message: "FRESHDESK_USE_SOLUTIONS_API=false. Usando apenas base local."
    };
  }

  if (!force && Date.now() < solutionCache.expiresAt && solutionCache.articles.length) {
    return {
      enabled: true,
      cached: true,
      syncedAt: solutionCache.syncedAt,
      total: solutionCache.articles.length,
      articles: solutionCache.articles
    };
  }

  const folderIds = parseCsvEnv("FRESHDESK_SOLUTIONS_FOLDER_IDS");
  const articleIds = parseCsvEnv("FRESHDESK_SEED_ARTICLE_IDS");
  const collected = [];
  const errors = [];

  for (const folderId of folderIds) {
    try {
      const folderArticles = await getFreshdeskFolderArticles(folderId, { force: true, maxPages: Number(options.maxPages || 5) });
      collected.push(...folderArticles);
    } catch (error) {
      errors.push({ source: "folder", id: folderId, error: error.message });
    }
  }

  for (const articleId of articleIds) {
    try {
      const article = await getFreshdeskSolutionArticle(articleId);
      if (article) collected.push(article);
    } catch (error) {
      errors.push({ source: "article", id: articleId, error: error.message });
    }
  }

  const unique = dedupeArticles(collected);
  const now = new Date();
  solutionCache.articles = unique;
  solutionCache.syncedAt = now.toISOString();
  solutionCache.expiresAt = Date.now() + getKbCacheTtlMs();
  solutionCache.lastError = errors.length ? errors.map((item) => `${item.source}:${item.id}:${item.error}`).join(" | ") : null;
  unique.forEach((article) => solutionCache.byId.set(String(article.id), article));

  return {
    enabled: true,
    cached: false,
    syncedAt: solutionCache.syncedAt,
    total: unique.length,
    errors,
    articles: unique
  };
}

export async function getCachedFreshdeskKnowledge(options = {}) {
  const sync = await syncFreshdeskKnowledge(options);
  return sync.articles || [];
}

export async function searchUnifiedKnowledge(term = "", options = {}) {
  const query = String(term || "").trim();
  const maxResults = Number(options.maxResults || 8);
  const local = searchLocalKnowledge(query, { maxResults });
  let freshdesk = [];
  let syncStatus = null;

  if (isFreshdeskSolutionsEnabled()) {
    const [searchResults, sync] = await Promise.allSettled([
      searchFreshdeskSolutionArticles(query, { maxResults }),
      syncFreshdeskKnowledge({ force: options.forceSync === true })
    ]);

    if (searchResults.status === "fulfilled") freshdesk.push(...searchResults.value);
    if (sync.status === "fulfilled") {
      syncStatus = { enabled: sync.value.enabled, cached: sync.value.cached, syncedAt: sync.value.syncedAt, total: sync.value.total, errors: sync.value.errors || [] };
      const cachedMatches = (sync.value.articles || [])
        .map((article) => ({ ...article, score: scoreArticle(article, query) }))
        .filter((article) => !query || (article.score || 0) >= 0.25)
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, maxResults);
      freshdesk.push(...cachedMatches);
    } else {
      syncStatus = { enabled: true, error: sync.reason?.message || "Falha ao sincronizar Freshdesk Solutions." };
    }
  }

  freshdesk = dedupeArticles(freshdesk)
    .map((article) => ({ ...article, score: article.score ?? scoreArticle(article, query) }))
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, maxResults);

  const combined = dedupeArticles([...freshdesk, ...local])
    .map((article) => ({ ...article, score: article.score ?? scoreArticle(article, query) }))
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, maxResults);

  return {
    term: query,
    source: isFreshdeskSolutionsEnabled() ? "local+freshdesk" : "local",
    freshdeskSolutionsEnabled: isFreshdeskSolutionsEnabled(),
    sync: syncStatus,
    local,
    freshdesk,
    combined
  };
}

export function getFreshdeskSolutionsConfig() {
  return {
    enabled: isFreshdeskSolutionsEnabled(),
    folderIds: parseCsvEnv("FRESHDESK_SOLUTIONS_FOLDER_IDS"),
    seedArticleIds: parseCsvEnv("FRESHDESK_SEED_ARTICLE_IDS"),
    cacheTtlMinutes: Number(process.env.FRESHDESK_KB_CACHE_TTL_MINUTES || DEFAULT_CACHE_TTL_MINUTES),
    cachedArticles: solutionCache.articles.length,
    syncedAt: solutionCache.syncedAt,
    lastError: solutionCache.lastError
  };
}
