export const MANUAL_CATALOG_VERSION = "2.5.0";

export const manualCatalog = [
  {
    id: "datacob-versao-agendamento-automatico",
    title: "Agendamento automático de versão DataCob",
    product: "DataCob",
    category: "Versão",
    routine: "Agendamento automático de versão",
    module: "Versão",
    kind: "Manual geral",
    client: "Geral",
    source: "Help Center local / Freshdesk Solutions",
    sourceFile: "Manual - Agendamento automático de versão.pdf",
    url: "/tools/datacob/support-copilot/docs/datacob/versao/agendamento-automatico-de-versao/",
    freshdeskType: "Versão",
    priority: "Alta",
    keywords: ["versão", "versao", "atualização", "atualizacao", "agendamento", "checklist versão", "checklist versao", "homologação", "homologacao", "produção", "producao", "virada"],
    symptoms: ["cliente quer atualizar versão", "dúvida sobre checklist versão", "agendamento de virada", "cancelamento de agendamento"],
    checklist: [
      "Confirmar se o cliente está em homologação.",
      "Orientar acesso ao ícone de ajuda (?) e Checklist versão.",
      "Validar se o checklist foi finalizado com sucesso.",
      "Confirmar data e horário pretendidos para virada.",
      "Se for mesmo dia, confirmar finalização até 17h."
    ],
    suggestedReply: "Orientar o cliente a realizar o checklist de versão no ambiente de homologação e seguir as regras de data/horário do agendamento.",
    related: ["servico-automatico-boleto-colchao-acordo"]
  },
  {
    id: "datacob-usuarios-login-active-directory",
    title: "Login Active Directory no DataCob",
    product: "DataCob",
    category: "Usuários / Acesso",
    routine: "Login Active Directory",
    module: "Usuários",
    kind: "Manual geral",
    client: "Geral",
    source: "Usuários.zip",
    sourceFile: "LOGIN_AD_CLIENTE.pdf",
    freshdeskType: "Infra/Hardware/Software",
    priority: "Média",
    keywords: ["active directory", "ad", "login", "windows", "usuário", "usuario", "senha", "vincular", "servidor ad", "acesso"],
    symptoms: ["usuário não consegue logar", "alteração de login para AD", "vincular usuário Windows ao DataCob"],
    checklist: [
      "Confirmar se o cliente possui servidor próprio de Active Directory.",
      "Confirmar se a PH3A já habilitou o servidor AD.",
      "Validar se o usuário DataCob foi vinculado ao usuário Windows.",
      "Conferir e-mail, nome e login após o vínculo."
    ],
    suggestedReply: "Para login via AD, confirme o servidor próprio de Active Directory e realize o vínculo do usuário Windows ao usuário DataCob.",
    related: []
  },
  {
    id: "datacob-renegociacao-geral",
    title: "Renegociação DataCob - fluxo padrão",
    product: "DataCob",
    category: "Rotina Sistemas",
    routine: "Renegociação",
    module: "Acordo / Renegociação",
    kind: "Manual geral",
    client: "Geral",
    source: "Rotina Sistemas",
    sourceFile: "Renegociação-MoneyPlus(v3).pdf / Renegociação-MoneyPlus.pdf",
    freshdeskType: "Dúvida",
    priority: "Alta",
    keywords: ["renegociação", "renegociacao", "acordo", "novo contrato", "primeira parcela", "liquida acordo", "parâmetro de acordo", "parametro de acordo", "cnab444", "cnab500", "serviço automático", "servico automatico"],
    symptoms: ["acordo não gerou novo contrato", "pagamento da primeira parcela não liquidou", "dúvida sobre parametrização de renegociação"],
    checklist: [
      "Verificar parâmetros de cálculo e parâmetros de acordo.",
      "Confirmar marcação de renegociação no parâmetro de acordo.",
      "Confirmar 'Liquida acordo no pagamento da 1ª parcela'.",
      "Validar serviço automático de geração de novo contrato.",
      "Conferir pagamento/baixa da primeira parcela."
    ],
    suggestedReply: "Validar parametrização da renegociação, pagamento da primeira parcela e execução do serviço automático responsável pela geração do novo contrato.",
    related: ["moneyplus-renegociacao-api-bmp", "exportacao-bmp-cnab444-cnab500"]
  },
  {
    id: "moneyplus-renegociacao-api-bmp",
    title: "Renegociação MoneyPlus - API BMP",
    product: "DataCob",
    category: "Rotina Sistemas",
    routine: "Renegociação MoneyPlus",
    module: "Integração / WebService BMP",
    kind: "Rotina específica por cliente",
    client: "MoneyPlus",
    source: "Rotina Sistemas / Banco MoneyPlus",
    sourceFile: "Renegociação-MoneyPlus(v2) - API.pdf",
    freshdeskType: "Integração",
    priority: "Alta",
    keywords: ["moneyplus", "bmp", "api bmp", "renegociação moneyplus", "renegociacao moneyplus", "webservice", "bmpapiusuario", "bmpapisenha", "bmpapichave", "bmpapicodigoparametro", "consulta proposta bmp", "consultar pagamento bmp", "sms", "voz", "agenda boleto"],
    symptoms: ["proposta BMP não retorna", "boleto BMP não gerado", "acordo MoneyPlus pendente", "pagamento BMP não liquidou acordo"],
    checklist: [
      "Confirmar cadastro do WebService Banco MoneyPlus - Cobrança.",
      "Validar parâmetros bmpApiUsuario, bmpApiSenha, bmpApiChave e bmpApiCodigoParametro.",
      "Confirmar se o acordo usa fluxo VOZ ou SMS.",
      "Verificar serviço automático Consulta Proposta BMP.",
      "Verificar serviço automático Consultar Pagamento BMP."
    ],
    suggestedReply: "Para MoneyPlus/BMP, validar WebService, fluxo VOZ/SMS, Agenda Boleto e serviços automáticos de consulta de proposta/pagamento.",
    related: ["datacob-renegociacao-geral", "servico-automatico-boleto-colchao-acordo", "exportacao-bmp-cnab444-cnab500"]
  },
  {
    id: "exportacao-bmp-cnab444-cnab500",
    title: "Exportação BMP CNAB444/CNAB500",
    product: "DataCob",
    category: "Exportação",
    routine: "Exportação CNAB444/CNAB500",
    module: "Exportação de arquivos",
    kind: "Manual técnico / layout",
    client: "Banco MoneyPlus / BMP",
    source: "Exportação de arquivos.zip",
    sourceFile: "Layout PADRAO EXPORTAÇÃO - FUNDO DE INVESTIMENTOS.pdf",
    freshdeskType: "Recepção de Arquivo",
    priority: "Média",
    keywords: ["exportação", "exportacao", "cnab444", "cnab500", "bmp", "fidc", "remessa", "liquidação", "liquidacao", "cessão", "cessao", "layout fundo de investimentos"],
    symptoms: ["arquivo CNAB444 com erro", "dúvida de layout FIDC", "campo valor pago", "campo valor presente"],
    checklist: [
      "Confirmar tipo de arquivo: cessão, liquidação, baixa ou recompra.",
      "Validar posições do layout CNAB444/CNAB500.",
      "Confirmar se a exportação ocorre após pagamento da primeira parcela e geração do novo contrato.",
      "Validar campos monetários com 2 casas decimais."
    ],
    suggestedReply: "Validar layout CNAB444/CNAB500 conforme tipo de exportação, posições obrigatórias e regras do fluxo BMP/FIDC.",
    related: ["datacob-renegociacao-geral", "moneyplus-renegociacao-api-bmp"]
  },
  {
    id: "datacob-datapact-portal-autonegociacao",
    title: "DataPact - Portal de Autonegociação",
    product: "DataCob",
    category: "Portal / Autonegociação",
    routine: "DataPact",
    module: "Portal / Token / Negociação",
    kind: "Manual geral",
    client: "Geral",
    source: "Guia do Usuário DataPact - 2022.pdf",
    sourceFile: "Guia do Usuário DataPact - 2022.pdf",
    freshdeskType: "Dúvida",
    priority: "Média",
    keywords: ["datapact", "portal", "autonegociação", "auto negociação", "autonegociacao", "token", "negociar por acordo", "link de confirmação", "ativação de cadastro"],
    symptoms: ["financiado não acessa DataPact", "token de acesso", "cadastro não ativa", "não consegue negociar dívida no portal"],
    checklist: [
      "Confirmar parâmetro DataPact no DataCob.",
      "Verificar marcação Negociar por Acordo no cadastro do cliente.",
      "Confirmar envio de Token de Acesso por SMS/TTS/e-mail.",
      "Validar cadastro/ativação do financiado no portal."
    ],
    suggestedReply: "Validar parâmetros DataPact no DataCob, envio do token e ativação do cadastro do financiado no portal.",
    related: ["datacob-renegociacao-geral"]
  },
  {
    id: "discador-3cplus-microfone-site-inseguro",
    title: "Discador 3CPlus - bloqueio de microfone no frame",
    product: "DataCob",
    category: "Discador",
    routine: "3CPlus",
    module: "Discador / Telefonia",
    kind: "Manual técnico",
    client: "Geral",
    source: "Discador.zip",
    sourceFile: "Erro de não conexão com a 3CPlus devido a bloqueio do Microfone no Frame - site inseguro.pdf",
    freshdeskType: "Infra/Hardware/Software",
    priority: "Média",
    keywords: ["discador", "3cplus", "microfone", "frame", "site inseguro", "telefonia", "ligação", "ligacao", "audio", "áudio"],
    symptoms: ["discador não conecta", "navegador bloqueia microfone", "sem áudio no discador"],
    checklist: ["Validar permissão de microfone no navegador.", "Confirmar se o site está sendo carregado em contexto seguro.", "Testar acesso fora do frame quando necessário."],
    suggestedReply: "Validar permissões de microfone e contexto seguro do navegador para uso do discador 3CPlus.",
    related: []
  },
  {
    id: "distribuicao-escob-api",
    title: "Distribuição Escob API / Entre DataCobs",
    product: "DataCob",
    category: "Distribuição",
    routine: "Distribuição para escritórios",
    module: "Distribuição",
    kind: "Manual geral",
    client: "Geral",
    source: "Distribuição.zip",
    sourceFile: "Distribuição Escob API.pdf / Distribuição Escob - ENTRE DATACOBS.pdf",
    freshdeskType: "Integração",
    priority: "Média",
    keywords: ["distribuição", "distribuicao", "escob", "entre datacobs", "api", "escritório", "escritorio", "localizador"],
    symptoms: ["contratos não distribuídos", "erro de distribuição escob", "integração entre DataCobs"],
    checklist: ["Confirmar origem e destino da distribuição.", "Validar parâmetros da API/rotina.", "Conferir se contratos atendem às regras de distribuição."],
    suggestedReply: "Validar configuração da rotina de distribuição, origem/destino e regras para contratos distribuídos.",
    related: []
  },
  {
    id: "recepcao-boleto-original",
    title: "Recepção de Boleto Original",
    product: "DataCob",
    category: "Recepção",
    routine: "Boleto Original",
    module: "Recepção de arquivos",
    kind: "Manual geral",
    client: "Geral",
    source: "Recepção.zip",
    sourceFile: "Recepção boleto original - PH3A.pdf",
    freshdeskType: "Recepção de Arquivo",
    priority: "Alta",
    keywords: ["recepção", "recepcao", "boleto original", "boleto gerado externo", "arquivo", "layout", "carga", "importação", "importacao"],
    symptoms: ["boleto externo não recepcionado", "arquivo de boleto original com erro", "layout boleto original"],
    checklist: ["Validar layout do arquivo recepcionado.", "Conferir contratos e boletos no arquivo.", "Checar logs de recepção e mensagens de erro."],
    suggestedReply: "Solicitar arquivo, layout utilizado, logs de recepção e exemplo de contrato/boleto afetado.",
    related: ["exportacao-bmp-cnab444-cnab500"]
  },
  {
    id: "servico-automatico-boleto-colchao-acordo",
    title: "Serviço Automático - Boleto automático e colchão de acordo",
    product: "DataCob",
    category: "Serviço Automático",
    routine: "Boleto automático / Colchão de acordo",
    module: "Serviço Automático",
    kind: "Manual geral",
    client: "Geral",
    source: "Servico Automatico.zip",
    sourceFile: "Manual Boleto Automático e Colchão de Acordo 2023.pdf",
    freshdeskType: "Dúvida",
    priority: "Média",
    keywords: ["serviço automático", "servico automatico", "boleto automático", "boleto automatico", "colchão de acordo", "colchao de acordo", "segunda parcela", "envio boleto acordo"],
    symptoms: ["boleto de acordo não enviado", "serviço automático não executou", "colchão de acordo"],
    checklist: ["Confirmar se o serviço automático está ativo.", "Validar frequência, horário e parâmetros.", "Conferir logs de execução e fila de envio."],
    suggestedReply: "Validar se o serviço automático está ativo, configurado e executando conforme frequência definida.",
    related: ["datacob-renegociacao-geral"]
  }
];

export function normalizeManualText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getManualCatalogSummary() {
  const byCategory = {};
  const byClient = {};
  const byModule = {};
  for (const manual of manualCatalog) {
    byCategory[manual.category] = (byCategory[manual.category] || 0) + 1;
    byClient[manual.client] = (byClient[manual.client] || 0) + 1;
    byModule[manual.module] = (byModule[manual.module] || 0) + 1;
  }
  return {
    version: MANUAL_CATALOG_VERSION,
    total: manualCatalog.length,
    byCategory,
    byClient,
    byModule
  };
}
