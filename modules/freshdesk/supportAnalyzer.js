import OpenAI from "openai";
import {
  buildDevelopmentSpec,
  buildTicketText,
  FRESHDESK_TICKET_TYPES,
  getRecommendedTemplate,
  normalizeText,
  renderRecommendedTemplates
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

function ensureAllowedFreshdeskType(value) {
  if (FRESHDESK_TICKET_TYPES.includes(value)) return value;
  return "Duvida";
}

function hydrateAnalysis(analysis, ticket = {}, conversations = [], context = {}) {
  const rawText = normalizeText(buildTicketText(ticket, conversations, context));
  const product = analysis.product || inferProduct(rawText);
  const freshdeskType = ensureAllowedFreshdeskType(analysis.freshdeskType || inferFreshdeskType(rawText));
  const requestType = analysis.requestType || inferRequestType(rawText, freshdeskType);
  const priority = analysis.priority || inferPriority(rawText, freshdeskType);
  const recommendedScenario = analysis.recommendedScenario || inferScenario(product, requestType, freshdeskType, rawText);
  const developmentType = analysis.developmentType || inferDevelopmentType(rawText, requestType, freshdeskType);
  const needsDevelopmentSpec = Boolean(
    analysis.needsDevelopmentSpec ||
    recommendedScenario === "Mover para Desenvolvimento" ||
    /bug|desenvolvimento|melhoria|customizacao/.test(normalizeText(`${requestType} ${freshdeskType} ${recommendedScenario}`))
  );

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
    nextAction: analysis.nextAction || "Revisar a analise, confirmar evidencias faltantes e escolher a resposta predefinida mais adequada."
  };

  const recommendedTemplate = getRecommendedTemplate(hydrated);
  hydrated.recommendedTemplate = recommendedTemplate;
  hydrated.developmentSpec = buildDevelopmentSpec(hydrated, ticket, context);
  hydrated.renderedTemplates = renderRecommendedTemplates(ticket, hydrated, context);

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
  "nextAction": ""
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
