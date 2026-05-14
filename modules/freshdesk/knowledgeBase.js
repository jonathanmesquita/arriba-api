function normalize(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniq(items = []) {
  return [...new Set(items.filter(Boolean))];
}

export const LOCAL_KNOWLEDGE_ARTICLES = [
  {
    id: "datacob-agendamento-automatico-versao",
    title: "Manual - Agendamento automatico de versao",
    source: "local-manual",
    product: "DataCob",
    freshdeskType: "Versao",
    recommendedTemplateKey: "versaoAgendamento",
    recommendedTemplateTitle: "@Respostas para o cliente quer atualizar versao - (Resposta do agendamento)",
    url: "docs/datacob/versao/agendamento-automatico-de-versao",
    confidenceBoost: 0.18,
    keywords: [
      "versao",
      "versão",
      "atualizacao de versao",
      "atualização de versão",
      "agendamento de versao",
      "agendamento de versão",
      "agendamento automatico",
      "agendamento automático",
      "checklist versao",
      "checklist versão",
      "virada de versao",
      "virada de versão",
      "homologacao",
      "homologação",
      "producao",
      "produção",
      "ambiente de producao",
      "ambiente de produção",
      "manual agendamento automatico de versao"
    ],
    summary:
      "Orienta o cliente sobre o agendamento automatico de versao do DataCob em homologacao, incluindo checklist, escolha de data/hora e regras de excecao.",
    rules: [
      "A partir da versao v.3.0.196.4 do DataCob, o cliente pode realizar o agendamento para mudanca de versao.",
      "O fluxo inicia no ambiente de Homologacao, acessando o icone de ajuda (?) e a opcao Checklist versao.",
      "Depois de validar os itens, o cliente deve finalizar o checklist e escolher data/hora para a virada.",
      "Para agendamento no mesmo dia, o checklist precisa ser finalizado ate as 17h; depois disso fica pendente para aprovacao da equipe PH3A.",
      "Agendamentos automaticos devem ocorrer de segunda a quinta-feira, das 20h as 00h.",
      "Agendamentos para sexta-feira, sabado ou domingo exigem comunicacao/atuacao do suporte para efetivar no proximo dia util.",
      "Se o cliente cancelar o agendamento, ele nao conseguira agendar automaticamente novamente ate uma nova atualizacao/versao ser enviada, devendo contatar o suporte."
    ],
    checklist: [
      "Confirmar se a solicitacao e sobre atualizacao/agendamento de versao do DataCob.",
      "Confirmar se o cliente esta no ambiente de homologacao.",
      "Orientar acesso ao icone de ajuda (?) e a opcao Checklist versao.",
      "Confirmar se o checklist foi finalizado com sucesso.",
      "Validar data e horario pretendidos para a virada.",
      "Se for mesmo dia, confirmar se o checklist foi finalizado ate as 17h.",
      "Se for sexta, sabado ou domingo, orientar que o suporte devera atuar para efetivar no proximo dia util.",
      "Se o agendamento foi cancelado, orientar que sera necessario contato com o suporte para nova tratativa.",
      "Se necessario, enviar/anexar o manual de agendamento automatico de versao."
    ],
    suggestedReply: `Boa tarde,

O agendamento deve ocorrer no ambiente de homologacao.

Em anexo, segue o manual com as instrucoes para o agendamento automatico de versao do DataCob.

De forma resumida, o cliente deve acessar o ambiente de homologacao, abrir a opcao Checklist versao, validar os itens necessarios e finalizar o checklist para selecionar a data e horario da virada.

Atencao as principais regras:
- Para agendamento no mesmo dia, o checklist deve ser finalizado ate as 17h;
- Agendamentos automaticos devem ocorrer de segunda a quinta-feira, entre 20h e 00h;
- Agendamentos para sexta-feira, sabado ou domingo exigem atuacao/validacao do suporte;
- Em caso de cancelamento do agendamento, sera necessario contato com o suporte para nova orientacao.

Obrigado!`,
    nextAction:
      "Usar a resposta predefinida de agendamento de versao, anexar/indicar o manual e confirmar data/horario conforme regras do checklist."
  },
  {
    id: "datacob-relatorio-extracao",
    title: "Orientacao - Relatorios e extracoes DataCob",
    source: "local-rule",
    product: "DataCob",
    freshdeskType: "Relatorio",
    recommendedTemplateKey: "solicitarEvidencias",
    recommendedTemplateTitle: "Solicitar mais evidencias",
    keywords: ["relatorio", "relatório", "extracao", "extração", "exportacao", "exportação", "listar cpf", "contratos registrados", "dados do processamento"],
    summary:
      "Usado para chamados que solicitam relatorio, extracao ou consulta de dados no DataCob, evitando classificar como Comercial sem indicio de proposta/licenca.",
    rules: [
      "Solicitacoes de relatorio ou extracao devem ser classificadas como Relatorio quando nao houver intencao comercial.",
      "Se a solicitacao pedir nova funcionalidade de relatorio, avaliar como Customizacao/Melhoria para Desenvolvimento."
    ],
    checklist: [
      "Confirmar objetivo do relatorio ou extracao.",
      "Solicitar periodo, filtros, campos desejados e exemplo de saida esperada.",
      "Validar se a funcionalidade ja existe em Relatorios/Visualizar Relatorios.",
      "Se nao existir, gerar especificacao para Desenvolvimento como Customizacao ou Melhoria."
    ]
  }
];

function articleText(article = {}) {
  return normalize([
    article.title,
    article.product,
    article.freshdeskType,
    article.summary,
    ...(article.keywords || []),
    ...(article.rules || []),
    ...(article.checklist || [])
  ].join(" "));
}

export function searchLocalKnowledge(term = "", options = {}) {
  const text = normalize(term);
  const maxResults = Number(options.maxResults || 5);
  if (!text) return [];

  const scored = LOCAL_KNOWLEDGE_ARTICLES.map((article) => {
    const haystack = articleText(article);
    const matchedKeywords = (article.keywords || []).filter((keyword) => text.includes(normalize(keyword)) || haystack.includes(normalize(keyword)) && text.includes(normalize(keyword).split(" ")[0] || "__never__"));
    let score = matchedKeywords.length * 3;

    if (article.freshdeskType && text.includes(normalize(article.freshdeskType))) score += 4;
    if (article.product && text.includes(normalize(article.product))) score += 2;
    if (matchedKeywords.some((keyword) => /vers[aã]o|version|checklist|agendamento/i.test(keyword))) score += 5;

    return {
      ...article,
      score,
      matchedKeywords: uniq(matchedKeywords).slice(0, 12)
    };
  })
    .filter((article) => article.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  return scored;
}

export function findKnowledgeMatches(ticket = {}, conversations = [], context = {}) {
  const conversationText = conversations
    .slice(-8)
    .map((item) => [item.body_text, item.body, item.description].filter(Boolean).join(" "))
    .join(" ");

  const text = [
    ticket.subject,
    ticket.description_text,
    ticket.description,
    ticket.message,
    ticket.type,
    ticket.ticket_type,
    Array.isArray(ticket.tags) ? ticket.tags.join(" ") : ticket.tags,
    context.company?.name,
    context.group?.name,
    conversationText
  ]
    .filter(Boolean)
    .join(" ");

  return searchLocalKnowledge(text, { maxResults: 5 });
}

export function summarizeKnowledgeMatches(matches = []) {
  if (!matches.length) return "Nenhuma base local encontrada para o contexto do ticket.";
  return matches.map((article) => `- ${article.title} (${article.freshdeskType || "tipo nao definido"}): ${article.summary}`).join("\n");
}

export function mergeKnowledgeChecklist(baseChecklist = [], matches = []) {
  const knowledgeItems = matches.flatMap((article) => article.checklist || []);
  return uniq([...knowledgeItems, ...(baseChecklist || [])]);
}
