import { knowledgeBase } from "./knowledgeBase.js";

export function getFallbackResponse(message = "", mode = "geral") {

  const text = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // tenta encontrar resposta específica na base
  const item = knowledgeBase.find(entry =>
    entry.keywords.some(keyword => text.includes(keyword))
  );

  if (item) {
    return item.reply.trim();
  }

  // fallback por modo
  switch (mode) {

    case "datacob":
      return `
Modo offline: DataCob / Suporte

Posso ajudar com:
- abertura de chamados
- troubleshooting
- erros CRM/DataCob
- checklist técnico
- suporte operacional

Portais:
- https://ph3a.freshdesk.com/
- https://suporte.ph3a.com.br/pt-BR/support/solutions
      `.trim();

    case "sql":
      return `
Modo offline: SQL / Banco de Dados

Posso ajudar com:
- SELECT
- JOIN
- WHERE
- GROUP BY
- modelagem
- troubleshooting SQL
- normalização
      `.trim();

    case "devops":
      return `
Modo offline: DevOps / Cloud

Posso ajudar com:
- Render
- Vercel
- Cloudflare
- DNS
- GitHub
- deploy
- APIs
- Node.js
      `.trim();

    case "produtividade":
      return `
Modo offline: Produtividade

Posso ajudar com:
- organização
- documentação
- estudos
- rotina
- planejamento técnico
- estruturação de projetos
      `.trim();

    default:
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
- SQL
- troubleshooting
      `.trim();
  }
}