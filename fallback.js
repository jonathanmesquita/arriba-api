export function getFallbackResponse(message) {
  const text = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (text.includes("datacob") || text.includes("crm")) {
    return `
Para assuntos relacionados ao DataCob/CRM, você pode usar:

1. Freshdesk PH3A:
https://ph3a.freshdesk.com/

2. Base de soluções PH3A:
https://suporte.ph3a.com.br/pt-BR/support/solutions

Sugestão: antes de abrir um chamado, registre o erro, print da tela, cliente impactado, rotina afetada e passo a passo para reproduzir.
    `;
  }

  if (text.includes("chamado") || text.includes("suporte")) {
    return `
Para abrir um chamado, organize as informações assim:

Cliente:
Rotina:
Erro apresentado:
Passo a passo para reproduzir:
Impacto:
Prints/anexos:
Urgência:

Depois registre no portal de suporte da PH3A ou Freshdesk.
    `;
  }

  if (text.includes("erro")) {
    return `
Para investigar um erro técnico, siga este checklist:

1. Identifique a rotina afetada.
2. Reproduza o erro.
3. Verifique mensagem, código ou log.
4. Confirme se ocorre com um cliente ou vários.
5. Colete prints.
6. Consulte a base de soluções.
7. Abra chamado se necessário.
    `;
  }

  if (text.includes("api rest") || text.includes("rest")) {
    return "API REST é um padrão para comunicação entre sistemas usando HTTP, normalmente com métodos como GET, POST, PUT e DELETE.";
  }

  if (text.includes("api")) {
    return "API é uma ponte entre sistemas. No Arriba, o frontend conversa com o backend em Node.js por meio da API api.jm.dev.br.";
  }

  if (text.includes("render")) {
    return "Render é onde o backend Node.js da Arriba Platform está hospedado.";
  }

  if (text.includes("vercel")) {
    return "Vercel é onde o frontend da Arriba Platform está hospedado.";
  }

  if (text.includes("cloudflare")) {
    return "Cloudflare gerencia o DNS do domínio jm.dev.br, conectando frontend e backend.";
  }

  return `
Modo offline ativo.

Posso ajudar com:
- DataCob/CRM
- abertura de chamados
- erros técnicos
- API REST
- Node.js
- Render
- Vercel
- Cloudflare
- suporte e troubleshooting
  `;
}