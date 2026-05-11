import OpenAI from "openai";
import {
  FRESHDESK_ALLOWED_PRIORITIES,
  FRESHDESK_ALLOWED_STATUSES,
  FRESHDESK_ALLOWED_TYPES,
  DEVELOPMENT_QUALIFICATION_TYPES,
  SUPPORT_GROUPS,
  buildDevelopmentSpec,
  buildTicketText
} from "./templates.js";

function hasOpenAI() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function createOpenAIClient() {
  if (!hasOpenAI()) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function inferProduct(text) {
  if (/databusca|data busca|crm\/databusca|higienizacao|higienização|enriquecimento|pesquisa|pacotes/.test(text)) return "DataBusca";
  if (/datacob|data cob|cobranca|cobrança|renegociacao|renegociação|negociacao|negociação|parcela|parcelamento|mailing|recepcao|recepção|contrato|boleto|baixa|cobran/.test(text)) return "DataCob";
  if (/comercial|proposta|contratacao|contratação|orcamento|orçamento|valor|preco|preço|licenca|licença|prospect|teste|venda|demo/.test(text)) return "Comercial";
  if (/financeiro|boleto ph3a|nota fiscal|pagamento|fatura/.test(text)) return "Financeiro";
  return "Não identificado";
}

function inferFreshdeskType(text) {
  if (/elogio|parabens|parabéns/.test(text)) return "Elógios";
  if (/exclusao de dados|exclusão de dados|lgpd|titular/.test(text)) return "Exclusão de dados";
  if (/enriquecimento/.test(text)) return "Enriquecimento";
  if (/higienizacao|higienização/.test(text)) return "Higienização";
  if (/integracao|integração|api|webhook/.test(text)) return "Integração";
  if (/lentidao|lentidão|lento|performance/.test(text)) return "Lentidão";
  if (/migracao|migração/.test(text)) return "Migração";
  if (/modelagem/.test(text)) return "Modelagem";
  if (/pacote|consumo/.test(text)) return "Notificação de Consumo de PACOTES";
  if (/prospect|comercial|proposta|orcamento|orçamento|contratar|contratacao|contratação|venda|licenca|licença|teste/.test(text)) return "Prospect";
  if (/recepcao|recepção|importacao|importação|layout|csv|arquivo/.test(text)) return "Recepção de Arquivo";
  if (/reclamacao|reclamação|insatisfeito|problema recorrente/.test(text)) return "Reclamação";
  if (/relatorio|relatório|extracao|extração/.test(text)) return "Relatório";
  if (/senha|reset/.test(text)) return "Reset Senha";
  if (/reuniao|reunião|treinamento/.test(text)) return /treinamento/.test(text) ? "Treinamento" : "Reunião";
  if (/tag|token/.test(text)) return "Token/TAG";
  if (/versao|versão|release/.test(text)) return "Versão";
  if (/hardware|software|infra|servidor|vpn/.test(text)) return "Infra/Hardware/Software";
  if (/melhoria|sugestao|sugestão|nova funcionalidade|feature/.test(text)) return "Melhorias";
  if (/erro|falha|bug|exception|nao funciona|não funciona|travado|parado|incidente/.test(text)) return "Incidente";
  return "Dúvida";
}

function inferDevelopmentType(text, freshdeskType) {
  if (/customizacao|customização|personalizar|especifico|específico|regra exclusiva|cliente especifico|cliente específico/.test(text)) return "Customização";
  if (/melhoria|sugestao|sugestão|nova funcionalidade|feature|evolucao|evolução/.test(text) || freshdeskType === "Melhorias") return "Melhoria";
  if (/bug|erro|falha|exception|nao funciona|não funciona|travado|quebra|corrigir|incidente/.test(text) || freshdeskType === "Incidente") return "BUG (Erros)";
  return "Não aplicável";
}

function inferPriority(text, freshdeskType) {
  if (/recepcao travada|recepção travada|sistema parado|operacao parada|operação parada|produção parada|producao parada|indisponivel|indisponível|todos os usuarios|todos os usuários|urgente|critico|crítico/.test(text)) return "Urgente";
  if (/erro|falha|bug|impacto|bloqueia|nao consegue|não consegue|vencido|prazo/.test(text) || freshdeskType === "Incidente") return "Alta";
  if (/duvida|dúvida|orientacao|orientação|validar|confirmar|treinamento|reuniao|reunião/.test(text)) return "Média";
  return "Baixa";
}

function inferScenario(product, freshdeskType, developmentType, text) {
  if (product === "Comercial" || freshdeskType === "Prospect") return "Mover para Comercial";
  if (/delivery|implantacao|implantação|treinamento|migração|migracao/.test(text)) return "Mover para Delivery";
  if (developmentType !== "Não aplicável" && (/desenvolvimento|dev|bug|melhoria|customizacao|customização|corrigir|ajuste na regra|feature/.test(text) || freshdeskType === "Melhorias" || freshdeskType === "Incidente")) return "Mover para Desenvolvimento";
  if (product === "DataBusca") return "Mover para CRM/DataBusca";
  if (product === "DataCob") return "Mover para Datacob";
  return "Revisão manual pelo Suporte";
}

function inferStatusSuggestion(scenario, priority, text) {
  if (scenario === "Mover para Desenvolvimento") return "Análise";
  if (/aguardando cliente|precisa enviar|solicitar|evidencia|evidência|print|arquivo/.test(text)) return "Aguardando Cliente";
  if (priority === "Urgente" || priority === "Alta") return "Análise";
  return "Aberto";
}

function inferRoutine(text) {
  if (/recepcao|recepção|importacao|importação|layout|csv|arquivo/.test(text)) return "Recepção / Importação de arquivos";
  if (/negociacao|negociação|parcelamento|parcela|calculo|cálculo|boleto/.test(text)) return "Negociação / Parcelamento";
  if (/login|acesso|senha|usuario|usuário/.test(text)) return "Acesso / Login";
  if (/relatorio|relatório|extracao|extração/.test(text)) return "Relatórios / Extrações";
  if (/mailing/.test(text)) return "Mailing";
  if (/parametro|parâmetro|configuracao|configuração/.test(text)) return "Parâmetros / Configurações";
  return "Rotina a confirmar";
}

function buildSuggestedReply(ticket, product, checklist = []) {
  const requesterName = ticket.requester?.name || ticket.requester_name || ticket.name || "";
  const firstName = requesterName ? ` ${requesterName.split(" ")[0]}` : "";
  return `Olá${firstName},\n\nAgradecemos por sua mensagem e queremos informar que já estamos analisando sua solicitação${product && product !== "Não identificado" ? ` sobre ${product}` : ""}.\n\nPara agilizar a análise, poderia nos encaminhar:\n${checklist.map((item) => `- ${item}`).join("\n")}\n\nCom essas informações conseguiremos direcionar o atendimento com mais precisão.\n\nAtenciosamente,`;
}

function buildChecklist(freshdeskType, priority) {
  if (freshdeskType === "Recepção de Arquivo") {
    return [
      "Arquivo utilizado na recepção/importação",
      "Print completo do erro apresentado",
      "Cliente, carteira, fase e layout utilizado",
      "Quantidade de registros afetados",
      "Data e horário da tentativa de processamento"
    ];
  }

  if (freshdeskType === "Incidente" || priority === "Urgente" || priority === "Alta") {
    return [
      "Print ou vídeo curto do erro",
      "Passo a passo para reprodução",
      "Usuário afetado e perfil de acesso",
      "Contrato, carteira ou registro de exemplo",
      "Data/hora da ocorrência e se afeta outros usuários"
    ];
  }

  if (freshdeskType === "Prospect") {
    return [
      "Produto de interesse",
      "Nome, empresa, e-mail e telefone do contato",
      "Necessidade comercial resumida",
      "Prazo ou urgência informada pelo cliente",
      "Origem do contato"
    ];
  }

  return [
    "Print da tela, se houver",
    "Passo a passo realizado",
    "Comportamento atual e comportamento esperado",
    "Cliente/carteira/contrato de exemplo, quando aplicável",
    "Informações complementares para encerrar a dúvida no primeiro retorno"
  ];
}

function buildContactSummary(ticket, context = {}) {
  const contact = context.contact || ticket.requester || {};
  const phones = [contact.phone, contact.mobile, contact.work_phone].filter(Boolean);
  return {
    name: contact.name || ticket.requester?.name || ticket.requester_name || "Não informado",
    email: contact.email || ticket.requester?.email || ticket.email || ticket.requester_email || "Não informado",
    phone: phones.length ? phones.join(" / ") : "Não informado",
    company: context.company?.name || ticket.company_name || ticket.company || "Não informado",
    requesterId: ticket.requester_id || contact.id || null,
    companyId: ticket.company_id || context.company?.id || null
  };
}

function buildFallbackAnalysis(ticket, conversations = [], context = {}) {
  const rawText = buildTicketText(ticket, conversations, context);
  const text = normalizeText(rawText);
  const product = inferProduct(text);
  const freshdeskType = inferFreshdeskType(text);
  const priority = inferPriority(text, freshdeskType);
  const developmentType = inferDevelopmentType(text, freshdeskType);
  const recommendedScenario = inferScenario(product, freshdeskType, developmentType, text);
  const statusSuggestion = inferStatusSuggestion(recommendedScenario, priority, text);
  const routine = inferRoutine(text);
  const checklist = buildChecklist(freshdeskType, priority);
  const shouldGoToDevelopment = recommendedScenario === "Mover para Desenvolvimento";
  const contactSummary = buildContactSummary(ticket, context);
  const supportGroup = product === "DataBusca" ? "Suporte CRM/DataBusca" : product === "DataCob" ? "Suporte DataCob" : product === "Comercial" ? "Comercial" : "Suporte";
  const groupConfig = SUPPORT_GROUPS[supportGroup] || null;

  const analysis = {
    source: "local-fallback",
    product,
    freshdeskType,
    requestType: freshdeskType,
    priority,
    statusSuggestion,
    recommendedScenario,
    recommendedGroup: supportGroup,
    allowedAgents: groupConfig?.agents || [],
    developmentType: shouldGoToDevelopment ? developmentType : "Não aplicável",
    confidence: product === "Não identificado" ? 0.45 : 0.76,
    routine,
    contactSummary,
    relatedTicketsSummary: {
      openTicketsCount: context.requesterOpenTickets?.length || 0,
      associatedTicketsCount: context.associatedTickets?.length || 0,
      message: `${context.requesterOpenTickets?.length || 0} ticket(s) aberto(s) do solicitante e ${context.associatedTickets?.length || 0} ticket(s) associado(s) encontrados.`
    },
    summary: `Chamado relacionado a ${product}. Tipo sugerido: ${freshdeskType}. Prioridade sugerida: ${priority}.`,
    currentScenario: `O cliente abriu um chamado com indícios de ${freshdeskType.toLowerCase()} relacionado a ${routine}. É necessário revisar a descrição, histórico e evidências antes de concluir o encaminhamento.`,
    expectedBehavior: shouldGoToDevelopment
      ? "A rotina deve ser corrigida, ajustada ou evoluída conforme o comportamento esperado pelo cliente e as regras vigentes."
      : "O suporte deve identificar a causa, orientar o cliente e coletar evidências suficientes para resolver ou direcionar corretamente.",
    suggestedReply: buildSuggestedReply(ticket, product, checklist),
    predefinedRecommended: freshdeskType === "Prospect" ? "Encaminhamento para Comercial" : freshdeskType === "Incidente" || freshdeskType === "Recepção de Arquivo" ? "Resposta para o cliente (Solicitar mais evidências)" : "Resposta após abertura do chamado - DATACOB",
    checklist,
    evidenceNeeded: checklist,
    acceptanceCriteria: [
      "O cenário deve ser reproduzível com as evidências informadas.",
      "A classificação do chamado deve indicar produto, tipo, prioridade e próximo cenário.",
      "O suporte deve conseguir validar o retorno antes do encerramento."
    ],
    needsDevelopmentSpec: shouldGoToDevelopment,
    predictiveSignal: context.requesterOpenTickets?.length > 3
      ? "Cliente possui múltiplos tickets abertos. Validar recorrência antes de responder."
      : "Sem sinal forte de recorrência com os dados coletados."
  };

  analysis.developmentSpec = buildDevelopmentSpec(analysis, ticket, context);
  return analysis;
}

function safeJsonParse(content) {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("A IA não retornou JSON válido.");
  }
}

function normalizeOpenAIAnalysis(analysis, ticket, context) {
  const fallback = buildFallbackAnalysis(ticket, [], context);
  const merged = { ...fallback, ...analysis };
  merged.freshdeskType = FRESHDESK_ALLOWED_TYPES.includes(merged.freshdeskType) ? merged.freshdeskType : fallback.freshdeskType;
  merged.requestType = merged.freshdeskType;
  merged.priority = FRESHDESK_ALLOWED_PRIORITIES.includes(merged.priority) ? merged.priority : fallback.priority;
  merged.statusSuggestion = FRESHDESK_ALLOWED_STATUSES.includes(merged.statusSuggestion) ? merged.statusSuggestion : fallback.statusSuggestion;
  merged.developmentType = DEVELOPMENT_QUALIFICATION_TYPES.includes(merged.developmentType) ? merged.developmentType : fallback.developmentType;
  merged.contactSummary = merged.contactSummary || fallback.contactSummary;
  merged.relatedTicketsSummary = merged.relatedTicketsSummary || fallback.relatedTicketsSummary;
  merged.checklist = Array.isArray(merged.checklist) && merged.checklist.length ? merged.checklist : fallback.checklist;
  merged.evidenceNeeded = Array.isArray(merged.evidenceNeeded) && merged.evidenceNeeded.length ? merged.evidenceNeeded : merged.checklist;
  merged.developmentSpec = buildDevelopmentSpec(merged, ticket, context);
  return merged;
}

export async function analyzeSupportTicket(ticket, conversations = [], context = {}) {
  const openai = createOpenAIClient();

  if (!openai) {
    return buildFallbackAnalysis(ticket, conversations, context);
  }

  const ticketText = buildTicketText(ticket, conversations, context);

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `
Você é o PH3A Support Copilot, um copiloto interno para analistas de suporte a clientes.
Analise chamados do Freshdesk e devolva APENAS JSON válido.
A IA recomenda; o analista revisa antes de responder, mover ou alterar o ticket.

Use somente estes valores para priority: ${FRESHDESK_ALLOWED_PRIORITIES.join(", ")}.
Use somente estes valores para statusSuggestion: ${FRESHDESK_ALLOWED_STATUSES.join(", ")}.
Use somente estes valores para freshdeskType: ${FRESHDESK_ALLOWED_TYPES.join(", ")}.
Para chamados que vão para Desenvolvimento, use somente estes valores para developmentType: ${DEVELOPMENT_QUALIFICATION_TYPES.join(", ")}.

Regras importantes:
- Comercial, proposta, contratação, licença, orçamento, venda, prospect ou teste => recommendedScenario "Mover para Comercial" e freshdeskType "Prospect".
- Recepção travada, erro em recepção, sistema parado ou bug bloqueante => priority "Urgente".
- Desenvolvimento deve ser usado apenas quando houver BUG (Erros), Melhoria ou Customização.
- Não invente dados de telefone, e-mail ou empresa; use "Não informado" quando não existir.

O JSON deve conter:
{
  "source": "openai",
  "product": "DataCob | DataBusca | Comercial | Financeiro | Delivery | Desenvolvimento | Não identificado",
  "freshdeskType": "",
  "requestType": "",
  "priority": "",
  "statusSuggestion": "",
  "recommendedScenario": "Mover para Datacob | Mover para CRM/DataBusca | Mover para Comercial | Mover para Delivery | Mover para Desenvolvimento | Revisão manual pelo Suporte",
  "recommendedGroup": "",
  "allowedAgents": [],
  "developmentType": "Melhoria | Customização | BUG (Erros) | Não aplicável",
  "confidence": 0.0,
  "routine": "",
  "contactSummary": {"name":"", "email":"", "phone":"", "company":"", "requesterId":"", "companyId":""},
  "relatedTicketsSummary": {"openTicketsCount":0, "associatedTicketsCount":0, "message":""},
  "summary": "",
  "currentScenario": "",
  "expectedBehavior": "",
  "suggestedReply": "",
  "predefinedRecommended": "",
  "checklist": [],
  "evidenceNeeded": [],
  "acceptanceCriteria": [],
  "needsDevelopmentSpec": false,
  "predictiveSignal": ""
}
          `.trim()
        },
        {
          role: "user",
          content: ticketText
        }
      ]
    });

    const content = completion.choices[0].message.content;
    const analysis = safeJsonParse(content);
    analysis.source = "openai";
    return normalizeOpenAIAnalysis(analysis, ticket, context);
  } catch (error) {
    console.error("Erro na análise IA do suporte:", error);
    return buildFallbackAnalysis(ticket, conversations, context);
  }
}
