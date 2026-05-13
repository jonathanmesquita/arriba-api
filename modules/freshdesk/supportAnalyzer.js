import OpenAI from "openai";
import {
  buildDevelopmentSpec,
  buildTicketText,
  FRESHDESK_TICKET_TYPES,
  getRecommendedTemplate,
  normalizeText,
  renderRecommendedTemplates,
  SUPPORT_DATACOB_AGENTS
} from "./templates.js";

function hasOpenAI() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function createOpenAIClient() {
  if (!hasOpenAI()) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function inferProduct(text) {
  if (/databusca|data busca|crm\/databusca/.test(text)) return "DataBusca";
  if (/datacob|data cob|cobranca|renegociacao|negociacao|parcela|parcelamento|mailing|recepcao|contrato|boleto/.test(text)) return "DataCob";
  if (/comercial|proposta|contratacao|valor|orcamento|licenca|demo|prospect/.test(text)) return "Comercial";
  return "Nao identificado";
}

function inferFreshdeskType(text) {
  if (/comercial|proposta|orcamento|contratacao|licenca|demo|teste|prospect/.test(text)) return "Prospect";
  if (/recepcao|importacao|layout|csv|arquivo|remessa/.test(text)) return "Recepcao de Arquivo";
  if (/lentidao|lento|travando/.test(text)) return "Lentidao";
  if (/integracao|api|webhook/.test(text)) return "Integracao";
  if (/reset|senha|login|acesso|token/.test(text)) return "Reset Senha";
  if (/relatorio|extracao|exportacao/.test(text)) return "Relatorio";
  if (/treinamento|duvida|como faco|orientacao|parametro|configurar/.test(text)) return "Duvida";
  if (/melhoria|sugestao|feature|nova funcionalidade/.test(text)) return "Melhorias";
  if (/erro|falha|bug|nao funciona|problema|incidente|indisponivel|sistema parado/.test(text)) return "Incidente";
  return "Duvida";
}


function hasCommercialIntent(text) {
  return /comercial|proposta|orcamento|orçamento|contratacao|contratação|licenca|licença|valor de contrato|preco|preço|venda|comprar|contratar|demo|prospect|trial/.test(text);
}

function hasReportIntent(text) {
  return /relatorio|relatório|extracao|extração|exportacao|exportação|dashboard|indicador|consulta|dados para listar|cpfs|contratos no processamento|listar contratos|extração de relatório|extrair relatório/.test(text);
}

function asksNewFunctionality(text) {
  return /disponibilizar|criar|nova funcionalidade|funcionalidade|implementar|incluir|adicionar|seria de grande ajuda|precisamos de|gostaria que|solicitamos|possibilidade/.test(text);
}

function inferFreshdeskTypeStrong(text, currentType = "") {
  const normalizedCurrent = normalizeText(currentType);

  if (hasReportIntent(text) && !hasCommercialIntent(text)) return "Relatorio";
  if (hasCommercialIntent(text)) return "Prospect";
  if (/recepcao|recepção|importacao|importação|layout|csv|arquivo|remessa|carga/.test(text)) return "Recepcao de Arquivo";
  if (hasReportIntent(text)) return "Relatorio";
  if (/lentidao|lentidão|lento|travando|performance|demora/.test(text)) return "Lentidao";
  if (/integracao|integração|api|webhook|endpoint|conector/.test(text)) return "Integracao";
  if (/reset|senha|login|acesso|token|tag|permissao|permissão/.test(text)) return "Reset Senha";
  if (/treinamento|duvida|dúvida|como faco|como faço|orientacao|orientação|parametro|parâmetro|configurar|vincular/.test(text)) return "Duvida";
  if (/melhoria|sugestao|sugestão|feature|nova funcionalidade|evolucao|evolução/.test(text)) return "Melhorias";
  if (/erro|falha|bug|nao funciona|não funciona|problema|incidente|indisponivel|indisponível|sistema parado|exception|cannot insert|null/.test(text)) return "Incidente";

  if (normalizedCurrent && normalizedCurrent !== "prospect") return currentType;
  return normalizedCurrent === "prospect" && !hasCommercialIntent(text) ? "Duvida" : (currentType || "Duvida");
}

function mapFreshdeskPriority(value) {
  const map = {
    1: "Baixa",
    2: "Media",
    3: "Alta",
    4: "Urgente",
    baixa: "Baixa",
    low: "Baixa",
    media: "Media",
    medium: "Media",
    alta: "Alta",
    high: "Alta",
    urgente: "Urgente",
    urgent: "Urgente"
  };
  const key = typeof value === "number" ? value : normalizeText(value || "");
  return map[key] || null;
}

function mergePriority(text, inferredPriority, ticket = {}) {
  const ticketPriority = mapFreshdeskPriority(ticket.priority_name || ticket.priority_label || ticket.priority);
  if (ticketPriority === "Urgente") return "Urgente";
  if (/recepcao travada|recepção travada|sistema parado|operacao parada|operação parada|bug bloqueante|indisponivel|indisponível|todos os usuarios|todos os usuários|producao parada|produção parada/.test(text)) return "Urgente";
  if (ticketPriority === "Alta" && inferredPriority === "Baixa") return "Alta";
  return inferredPriority || ticketPriority || "Media";
}

function buildRuleWarnings({ text, analysis = {}, freshdeskType, recommendedScenario, priority, product }) {
  const warnings = [];
  if (normalizeText(analysis.freshdeskType || "") === "prospect" && freshdeskType !== "Prospect") {
    warnings.push("Tipo Prospect ajustado por regra local: nao havia indicio comercial forte no texto.");
  }
  if (freshdeskType === "Relatorio" && recommendedScenario === "Mover para Comercial") {
    warnings.push("Relatorio nao deve ir para Comercial sem evidência de proposta, licença ou contratação.");
  }
  if (priority === "Urgente" && !/parado|travada|bloqueante|indisponivel|indisponível|urgente|producao|produção/.test(text)) {
    warnings.push("Prioridade urgente preservada/indicada; revisar se o impacto informado justifica urgência.");
  }
  if (product === "Nao identificado") {
    warnings.push("Produto nao identificado com alta confiança. Revisar tags e descrição do ticket.");
  }
  return warnings;
}

function inferRequestType(text, freshdeskType) {
  if (freshdeskType === "Prospect") return "Solicitacao comercial";
  if (freshdeskType === "Incidente" || /erro|falha|bug|exception|nao funciona|problema/.test(text)) return "Erro tecnico";
  if (freshdeskType === "Melhorias" || /melhoria|feature|nova funcionalidade|ajuste na regra|desenvolvimento/.test(text)) return "Melhoria / Desenvolvimento";
  if (/acesso|senha|login|usuario/.test(text)) return "Acesso";
  if (/duvida|como faco|orientacao|parametro|configurar/.test(text)) return "Duvida operacional";
  return "Triagem";
}

function inferPriority(text, freshdeskType) {
  if (/recepcao travada|erro em recepcao|sistema parado|operacao parada|parado|indisponivel|urgente|producao|todos os usuarios|todos afetados|bug bloqueante/.test(text)) return "Urgente";
  if (/erro|falha|impacto|nao consegue|bloqueia|incidente/.test(text) || freshdeskType === "Incidente") return "Alta";
  if (/duvida|orientacao|parametro|treinamento/.test(text)) return "Baixa";
  return "Media";
}

function inferDevelopmentType(text, requestType, freshdeskType) {
  if (/customizacao|customizacao|cliente especifico|regra especifica|personalizado/.test(text)) return "Customizacao";
  if (/melhoria|sugestao|feature|nova funcionalidade|ajustar tela|evolucao/.test(text) || freshdeskType === "Melhorias") return "Melhoria";
  if (/erro|bug|falha|incidente|nao funciona|quebrou|travou|exception/.test(text) || requestType === "Erro tecnico") return "BUG (Erros)";
  return "Melhoria";
}

function inferScenario(product, requestType, freshdeskType, text) {
  if (freshdeskType === "Prospect" || /comercial|proposta|contratacao|orcamento|licenca|demo/.test(text)) return "Mover para Comercial";
  if (/delivery|implantacao|implantacao|treinamento/.test(text)) return "Mover para Delivery";
  if (/dev|desenvolvimento|bug|melhoria|feature|corrigir|corrigido|customizacao|customizacao/.test(text) || requestType === "Melhoria / Desenvolvimento") return "Mover para Desenvolvimento";
  if (product === "DataBusca") return "Mover para CRM/DataBusca";
  if (product === "DataCob") return "Mover para Datacob";
  return "Revisao manual pelo Suporte";
}

function inferRoutine(text) {
  if (/recepcao|importacao|layout|csv|arquivo/.test(text)) return "Recepcao / Importacao de arquivos";
  if (/negociacao|parcelamento|parcela|calculo/.test(text)) return "Negociacao / Parcelamento";
  if (/login|acesso|senha|usuario/.test(text)) return "Acesso / Login";
  if (/relatorio|extracao|exportacao/.test(text)) return "Relatorios / Extracoes";
  if (/mailing/.test(text)) return "Mailing";
  if (/parametro|configuracao|vincular|grupo/.test(text)) return "Parametros / Configuracao";
  return "Rotina a confirmar";
}

function classifyDevelopmentTypeStrict(text, requestType, freshdeskType, needsDevelopmentSpec) {
  if (!needsDevelopmentSpec) return "Nao indicado";

  if (hasReportIntent(text) && asksNewFunctionality(text)) return "Customizacao";

  if (/customizacao|customização|cliente especifico|cliente específico|regra especifica|regra específica|personalizado|exclusivo|particularidade|excecao para cliente|exceção para cliente|parametrizacao exclusiva|parametrização exclusiva|sob medida/.test(text)) {
    return "Customizacao";
  }

  if (/erro|bug|falha|incidente|nao funciona|não funciona|nao esta funcionando|não está funcionando|quebrou|travou|exception|stack|trace|sistema parado|operacao parada|operação parada|recepcao travada|recepção travada|indisponivel|indisponível|regressao|regressão|parou de funcionar/.test(text) || requestType === "Erro tecnico" || freshdeskType === "Incidente") {
    return "BUG (Erros)";
  }

  return "Melhoria";
}

function validateAgentGroup(context = {}, recommendedGroup = "") {
  const groupName = normalizeText(context.group?.name || recommendedGroup || "");
  const agentName = context.agent?.name || "";
  const normalizedAgent = normalizeText(agentName);
  const validAgents = SUPPORT_DATACOB_AGENTS;
  const isDataCobGroup = groupName.includes("datacob");

  if (!isDataCobGroup) {
    return {
      status: "Nao aplicavel",
      message: "Grupo atual/recomendado nao identificado como Suporte DataCob.",
      currentAgent: agentName || "Nao informado",
      currentGroup: context.group?.name || recommendedGroup || "Nao informado",
      validAgents
    };
  }

  const isValidAgent = validAgents.some((name) => normalizeText(name) === normalizedAgent);

  return {
    status: isValidAgent ? "OK" : "Alerta",
    message: isValidAgent
      ? "Agente atual pertence a lista validada do grupo Suporte DataCob."
      : "Agente atual nao esta na lista validada do grupo Suporte DataCob. Revisar atribuicao antes do encaminhamento.",
    currentAgent: agentName || "Nao informado",
    currentGroup: context.group?.name || recommendedGroup || "Suporte DataCob",
    validAgents
  };
}

function ensureAllowedFreshdeskType(value) {
  if (FRESHDESK_TICKET_TYPES.includes(value)) return value;
  return "Duvida";
}

function hydrateAnalysis(analysis, ticket = {}, conversations = [], context = {}) {
  const rawText = normalizeText(buildTicketText(ticket, conversations, context));
  const product = analysis.product && analysis.product !== "Nao identificado" ? analysis.product : inferProduct(rawText);
  const inferredType = inferFreshdeskTypeStrong(rawText, analysis.freshdeskType || inferFreshdeskType(rawText));
  let freshdeskType = ensureAllowedFreshdeskType(inferredType);
  if (hasReportIntent(rawText) && !hasCommercialIntent(rawText)) freshdeskType = "Relatorio";
  const requestType = analysis.requestType || inferRequestType(rawText, freshdeskType);
  const priority = mergePriority(rawText, analysis.priority || inferPriority(rawText, freshdeskType), ticket);
  let recommendedScenario = analysis.recommendedScenario || inferScenario(product, requestType, freshdeskType, rawText);
  if (freshdeskType === "Relatorio" && !hasCommercialIntent(rawText) && recommendedScenario === "Mover para Comercial") {
    recommendedScenario = product === "DataBusca" ? "Mover para CRM/DataBusca" : product === "DataCob" ? "Mover para Datacob" : "Revisao manual pelo Suporte";
  }
  if (freshdeskType === "Prospect") recommendedScenario = "Mover para Comercial";
  if (freshdeskType === "Relatorio" && hasReportIntent(rawText) && asksNewFunctionality(rawText)) {
    recommendedScenario = "Mover para Desenvolvimento";
  }
  const initialNeedsDevelopmentSpec = Boolean(
    analysis.needsDevelopmentSpec ||
    recommendedScenario === "Mover para Desenvolvimento" ||
    (hasReportIntent(rawText) && asksNewFunctionality(rawText)) ||
    /bug|desenvolvimento|melhoria|customizacao|customização|incidente|erro tecnico/.test(normalizeText(`${requestType} ${freshdeskType} ${recommendedScenario}`))
  );
  const inferredDevelopmentType = analysis.developmentType || inferDevelopmentType(rawText, requestType, freshdeskType);
  const needsDevelopmentSpec = initialNeedsDevelopmentSpec || ["Melhoria", "Customizacao", "BUG (Erros)"].includes(inferredDevelopmentType);
  const developmentType = classifyDevelopmentTypeStrict(rawText, requestType, freshdeskType, needsDevelopmentSpec);

  const checklist = Array.isArray(analysis.checklist) && analysis.checklist.length
    ? analysis.checklist
    : [
        "Confirmar produto e rotina impactada",
        "Solicitar print da tela ou erro apresentado",
        "Solicitar passo a passo para reproducao",
        "Confirmar cliente/carteira/contrato de exemplo, quando aplicavel",
        "Validar se o problema ocorre com todos os usuarios ou apenas um usuario",
        "Verificar se ha arquivos, logs ou anexos relacionados"
      ];

  const agentValidation = validateAgentGroup(context, analysis.recommendedGroup || (product === "DataCob" ? "Suporte DataCob" : ""));

  const hydrated = {
    source: analysis.source || "local-fallback",
    product,
    requestType,
    freshdeskType,
    priority,
    recommendedScenario,
    recommendedGroup: analysis.recommendedGroup || (product === "DataCob" ? "Suporte DataCob" : product === "DataBusca" ? "Suporte CRM/DataBusca" : product === "Comercial" ? "Comercial" : "Suporte"),
    developmentType: needsDevelopmentSpec ? developmentType : "Nao indicado",
    confidence: typeof analysis.confidence === "number" ? analysis.confidence : (product === "Nao identificado" ? 0.45 : 0.74),
    routine: analysis.routine || inferRoutine(rawText),
    summary: analysis.summary || `Chamado relacionado a ${product}. Classificacao inicial: ${freshdeskType}. Prioridade sugerida: ${priority}.`,
    currentScenario: analysis.currentScenario || `O cliente abriu um chamado com indicios de ${requestType.toLowerCase()} relacionado a ${analysis.routine || inferRoutine(rawText)}. E necessario revisar a descricao e as evidencias anexadas antes de concluir o encaminhamento.`,
    expectedBehavior: analysis.expectedBehavior || "O atendimento deve identificar a causa, orientar o cliente ou encaminhar a demanda com contexto suficiente para analise tecnica.",
    suggestedReply: analysis.suggestedReply || "Agradecemos por sua mensagem e queremos informar que ja estamos analisando sua solicitacao. Para agilizar a analise, poderia nos encaminhar prints, exemplos, passo a passo realizado e demais evidencias relacionadas ao cenario informado?",
    checklist,
    evidenceNeeded: Array.isArray(analysis.evidenceNeeded) && analysis.evidenceNeeded.length ? analysis.evidenceNeeded : checklist,
    acceptanceCriteria: Array.isArray(analysis.acceptanceCriteria) && analysis.acceptanceCriteria.length
      ? analysis.acceptanceCriteria
      : [
          "O cenario deve ser reproduzivel com as evidencias informadas.",
          "A solucao deve atender ao comportamento esperado pelo cliente ou regra vigente.",
          "O suporte deve conseguir validar o retorno antes do encerramento."
        ],
    needsDevelopmentSpec,
    agentValidation,
    ruleWarnings: buildRuleWarnings({ text: rawText, analysis, freshdeskType, recommendedScenario, priority, product }),
    nextAction: analysis.nextAction || "Revisar a analise, confirmar evidencias faltantes e escolher a resposta predefinida mais adequada."
  };

  const recommendedTemplate = getRecommendedTemplate(hydrated);
  hydrated.recommendedTemplate = recommendedTemplate;
  hydrated.developmentSpec = buildDevelopmentSpec(hydrated, ticket, context);
  hydrated.renderedTemplates = renderRecommendedTemplates(ticket, hydrated, context, conversations);

  return hydrated;
}

function buildFallbackAnalysis(ticket, conversations = [], context = {}) {
  return hydrateAnalysis({ source: "local-fallback" }, ticket, conversations, context);
}

function safeJsonParse(content) {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("A IA nao retornou JSON valido.");
  }
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
Voce e o PH3A Support Copilot, um copiloto interno para analistas de suporte.
Analise chamados do Freshdesk e devolva APENAS JSON valido.
Nao responda o cliente diretamente sem revisao humana.

Classifique usando somente estes valores quando aplicavel:
- product: DataCob, DataBusca, Comercial, Financeiro, Delivery, Desenvolvimento, Nao identificado
- requestType: Erro tecnico, Duvida operacional, Acesso, Melhoria / Desenvolvimento, Solicitacao comercial, Triagem
- freshdeskType: Duvida, Incidente, Integracao, Lentidao, Melhorias, Prospect, Recepcao de Arquivo, Relatorio, Reset Senha, Treinamento, Versao, Alteracao de Licencas, Reclamacao, Sugestao
- developmentType: Melhoria, Customizacao, BUG (Erros), Nao indicado
- priority: Baixa, Media, Alta, Urgente
- recommendedScenario: Mover para Datacob, Mover para CRM/DataBusca, Mover para Comercial, Mover para Delivery, Mover para Desenvolvimento, Revisao manual pelo Suporte

Use Urgente para recepcao travada, sistema parado, bug bloqueante, indisponibilidade ou operacao parada.
Quando recommendedScenario for Mover para Desenvolvimento, developmentType deve ser somente: Melhoria, Customizacao ou BUG (Erros).

O JSON deve conter:
{
  "source": "openai",
  "product": "",
  "requestType": "",
  "freshdeskType": "",
  "priority": "",
  "recommendedScenario": "",
  "recommendedGroup": "",
  "developmentType": "",
  "confidence": 0.0,
  "routine": "",
  "summary": "",
  "currentScenario": "",
  "expectedBehavior": "",
  "suggestedReply": "",
  "checklist": [],
  "evidenceNeeded": [],
  "acceptanceCriteria": [],
  "needsDevelopmentSpec": false,
  "nextAction": "",
  "agentValidation": {}
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
    return hydrateAnalysis(analysis, ticket, conversations, context);
  } catch (error) {
    console.error("Erro na analise IA do suporte:", error);
    return buildFallbackAnalysis(ticket, conversations, context);
  }
}
