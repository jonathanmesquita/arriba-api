import fs from "fs/promises";
import path from "path";

const LOG_DIR = path.resolve(process.cwd(), "data");
const LOG_FILE = path.join(LOG_DIR, "support-copilot-logs.jsonl");
const MAX_LINES = Number(process.env.SUPPORT_COPILOT_LOG_LIMIT || 300);

function nowIso() {
  return new Date().toISOString();
}

function normalize(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function ensureLogDir() {
  await fs.mkdir(LOG_DIR, { recursive: true });
}

export async function logSupportAnalysis({ ticket = {}, analysis = {}, context = {}, action = "analysis" } = {}) {
  try {
    await ensureLogDir();
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: nowIso(),
      action,
      ticketId: ticket.id || ticket.ticketId || null,
      subject: ticket.subject || ticket.title || null,
      requesterEmail: context.contact?.email || ticket.requester?.email || ticket.requester_email || null,
      companyName: context.company?.name || context.company?.businessname || ticket.company_name || null,
      groupName: context.group?.name || ticket.group_name || analysis.recommendedGroup || null,
      agentName: context.agent?.name || ticket.responder_name || ticket.agent_name || null,
      product: analysis.product || null,
      freshdeskType: analysis.freshdeskType || analysis.requestType || null,
      developmentType: analysis.developmentType || null,
      priority: analysis.priority || null,
      recommendedScenario: analysis.recommendedScenario || null,
      routine: analysis.routine || null,
      needsDevelopmentSpec: Boolean(analysis.needsDevelopmentSpec),
      source: analysis.source || null
    };
    await fs.appendFile(LOG_FILE, JSON.stringify(entry) + "\n", "utf8");
    await trimLogs();
    return entry;
  } catch (error) {
    console.warn("Nao foi possivel gravar log local do Support Copilot:", error.message);
    return null;
  }
}

async function trimLogs() {
  try {
    const content = await fs.readFile(LOG_FILE, "utf8");
    const lines = content.split("\n").filter(Boolean);
    if (lines.length <= MAX_LINES) return;
    await fs.writeFile(LOG_FILE, lines.slice(-MAX_LINES).join("\n") + "\n", "utf8");
  } catch {
    // ignore
  }
}

export async function readSupportLogs(limit = 100) {
  try {
    const content = await fs.readFile(LOG_FILE, "utf8");
    return content
      .split("\n")
      .filter(Boolean)
      .slice(-limit)
      .map((line) => JSON.parse(line))
      .reverse();
  } catch {
    return [];
  }
}

function countBy(logs, key) {
  return logs.reduce((acc, item) => {
    const label = item[key] || "Nao informado";
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
}

function topTerms(logs) {
  const stop = new Set(["de", "do", "da", "dos", "das", "com", "para", "por", "em", "no", "na", "os", "as", "um", "uma", "e", "ou", "ticket", "chamado"]);
  const counts = {};
  logs.forEach((item) => {
    normalize(`${item.subject || ""} ${item.routine || ""}`)
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 3 && !stop.has(word))
      .forEach((word) => {
        counts[word] = (counts[word] || 0) + 1;
      });
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([term, count]) => ({ term, count }));
}

function detectRecurrence(logs) {
  const byProduct = countBy(logs, "product");
  const byType = countBy(logs, "freshdeskType");
  const byRoutine = countBy(logs, "routine");
  const alerts = [];

  Object.entries(byProduct).forEach(([product, count]) => {
    if (count >= 3 && product !== "Nao informado") alerts.push(`${count} analises recentes relacionadas a ${product}.`);
  });
  Object.entries(byType).forEach(([type, count]) => {
    if (count >= 3 && type !== "Nao informado") alerts.push(`${count} chamados recentes classificados como ${type}.`);
  });
  Object.entries(byRoutine).forEach(([routine, count]) => {
    if (count >= 3 && routine !== "Nao informado") alerts.push(`${count} ocorrencias recentes na rotina ${routine}.`);
  });

  return alerts.slice(0, 8);
}

export async function buildQualityDashboard() {
  const logs = await readSupportLogs(300);
  const total = logs.length;
  const urgentCount = logs.filter((item) => item.priority === "Urgente").length;
  const devCount = logs.filter((item) => item.needsDevelopmentSpec || ["Melhoria", "Customizacao", "BUG (Erros)"].includes(item.developmentType)).length;
  const commercialCount = logs.filter((item) => item.recommendedScenario === "Mover para Comercial" || item.freshdeskType === "Prospect").length;
  const recurrenceAlerts = detectRecurrence(logs);

  return {
    generatedAt: nowIso(),
    mode: "local-read-only-logs",
    totalAnalyses: total,
    urgentCount,
    devCount,
    commercialCount,
    recurrenceAlerts,
    topProducts: countBy(logs, "product"),
    topTypes: countBy(logs, "freshdeskType"),
    topPriorities: countBy(logs, "priority"),
    topScenarios: countBy(logs, "recommendedScenario"),
    topTerms: topTerms(logs),
    recentLogs: logs.slice(0, 20)
  };
}
