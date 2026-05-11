import OpenAI from "openai";
import { buildDevelopmentSpec, buildTicketText } from "./templates.js";

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
  if (/databusca|data busca|crm\/databusca/.test(text)) return "DataBusca";
  if (/datacob|data cob|cobranca|renegociacao|negociacao|parcela|parcelamento|mailing|recepcao|contrato/.test(text)) return "DataCob";
  if (/comercial|proposta|contratacao|valor|orcamento/.test(text)) return "Comercial";
  return "Não identificado";
}

function inferRequestType(text) {
  if (/erro|falha|bug|exception|nao funciona|não funciona|problema/.test(text)) return "Erro técnico";
  if (/melhoria|feature|nova funcionalidade|ajuste na regra|desenvolvimento/.test(text)) return "Melhoria / Desenvolvimento";
  if (/acesso|senha|login|usuario|usuário/.test(text)) return "Acesso";
  if (/duvida|dúvida|como faço|como faco|orientacao|orientação/.test(text)) return "Dúvida operacional";
  if (/comercial|proposta|contratacao|contratação/.test(text)) return "Solicitação comercial";
  return "Triagem";
}

function inferPriority(text) {
  if (/parado|indisponivel|indisponível|urgente|produção|producao|todos os usuarios|todos os usuários|operacao parada|operação parada/.test(text)) return "Urgente";
  if (/erro|falha|impacto|nao consegue|não consegue|bloqueia/.test(text)) return "Alta";
  if (/duvida|dúvida|orientacao|orientação/.test(text)) return "Média";
  return "Baixa";
}

function inferScenario(product, requestType, text) {
  if (/comercial|proposta|contratacao|contratação/.test(text)) return "Mover para Comercial";
  if (/delivery|implantacao|implantação|treinamento/.test(text)) return "Mover para Delivery";
  if (/dev|desenvolvimento|bug|melhoria|feature|corrigir|corrigido|ajuste na regra/.test(text) || requestType === "Melhoria / Desenvolvimento") return "Mover para Desenvolvimento";
  if (product === "DataBusca") return "Mover para CRM/DataBusca";
  if (product === "DataCob") return "Mover para Datacob";
  return "Revisão manual pelo Suporte";
}

function inferRoutine(text) {
  if (/recepcao|recepção|importacao|importação|layout|csv|arquivo/.test(text)) return "Recepção / Importação de arquivos";
  if (/negociacao|negociação|parcelamento|parcela|calculo|cálculo/.test(text)) return "Negociação / Parcelamento";
  if (/login|acesso|senha|usuario|usuário/.test(text)) return "Acesso / Login";
  if (/relatorio|relatório|extracao|extração/.test(text)) return "Relatórios / Extrações";
  if (/mailing/.test(text)) return "Mailing";
  return "Rotina a confirmar";
}

function buildFallbackAnalysis(ticket, conversations = []) {
  const rawText = buildTicketText(ticket, conversations);
  const text = normalizeText(rawText);
  const product = inferProduct(text);
  const requestType = inferRequestType(text);
  const priority = inferPriority(text);
  const recommendedScenario = inferScenario(product, requestType, text);
  const routine = inferRoutine(text);
  const shouldGoToDevelopment = recommendedScenario === "Mover para Desenvolvimento";

  const analysis = {
    source: "local-fallback",
    product,
    requestType,
    priority,
    recommendedScenario,
    confidence: product === "Não identificado" ? 0.45 : 0.72,
    routine,
    summary: `Chamado relacionado a ${product}. Classificação inicial: ${requestType}. Prioridade sugerida: ${priority}.`,
    currentScenario: `O cliente abriu um chamado com indícios de ${requestType.toLowerCase()} relacionado a ${routine}. É necessário revisar a descrição e as evidências anexadas antes de concluir o encaminhamento.`,
    expectedBehavior: "O atendimento deve identificar a causa, orientar o cliente ou encaminhar a demanda com contexto suficiente para análise técnica.",
    suggestedReply: "Agradecemos por sua mensagem e queremos informar que já estamos analisando sua solicitação. Para agilizar a análise, poderia nos encaminhar prints, exemplos, passo a passo realizado e demais evidências relacionadas ao cenário informado?",
    checklist: [
      "Confirmar produto e rotina impactada",
      "Solicitar print da tela ou erro apresentado",
      "Solicitar passo a passo para reprodução",
      "Confirmar cliente/carteira/contrato de exemplo, quando aplicável",
      "Validar se o problema ocorre com todos os usuários ou apenas um usuário",
      "Verificar se há arquivos, logs ou anexos relacionados"
    ],
    evidenceNeeded: [
      "Print da tela/erro",
      "Passo a passo realizado",
      "Contrato, carteira ou exemplo afetado",
      "Usuário utilizado",
      "Data e horário da ocorrência"
    ],
    acceptanceCriteria: [
      "O cenário deve ser reproduzível com as evidências informadas.",
      "A solução deve atender ao comportamento esperado pelo cliente ou regra vigente.",
      "O suporte deve conseguir validar o retorno antes do encerramento."
    ],
    needsDevelopmentSpec: shouldGoToDevelopment
  };

  analysis.developmentSpec = buildDevelopmentSpec(analysis, ticket);
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

export async function analyzeSupportTicket(ticket, conversations = []) {
  const openai = createOpenAIClient();

  if (!openai) {
    return buildFallbackAnalysis(ticket, conversations);
  }

  const ticketText = buildTicketText(ticket, conversations);

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `
Você é o PH3A Support Copilot, um copiloto interno para analistas de suporte.
Analise chamados do Freshdesk e devolva APENAS JSON válido.
Não responda o cliente diretamente sem revisão humana.

Classifique sempre usando estes campos:
- product: DataCob, DataBusca, Comercial, Financeiro, Delivery, Desenvolvimento, Não identificado
- requestType: Erro técnico, Dúvida operacional, Acesso, Melhoria / Desenvolvimento, Solicitação comercial, Triagem
- priority: Baixa, Média, Alta, Urgente
- recommendedScenario: Mover para Datacob, Mover para CRM/DataBusca, Mover para Comercial, Mover para Delivery, Mover para Desenvolvimento, Revisão manual pelo Suporte

O JSON deve conter:
{
  "source": "openai",
  "product": "",
  "requestType": "",
  "priority": "",
  "recommendedScenario": "",
  "confidence": 0.0,
  "routine": "",
  "summary": "",
  "currentScenario": "",
  "expectedBehavior": "",
  "suggestedReply": "",
  "checklist": [],
  "evidenceNeeded": [],
  "acceptanceCriteria": [],
  "needsDevelopmentSpec": false
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
    analysis.developmentSpec = buildDevelopmentSpec(analysis, ticket);
    return analysis;
  } catch (error) {
    console.error("Erro na análise IA do suporte:", error);
    return buildFallbackAnalysis(ticket, conversations);
  }
}
