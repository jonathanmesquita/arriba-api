import { knowledgeBase } from "./knowledgeBase.js";

export function getFallbackResponse(message = "") {
  const text = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const item = knowledgeBase.find(entry =>
    entry.keywords.some(keyword => text.includes(keyword))
  );

  if (item) {
    return item.reply.trim();
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
- SQL
- troubleshooting
  `.trim();
}