import express from "express";
import OpenAI from "openai";
import { getFallbackResponse } from "../modules/chat/fallback.js";

function getModeLabel(mode = "geral") {
  const labels = {
    geral: "Geral",
    datacob: "DataCob / Suporte",
    sql: "SQL / Banco de Dados",
    devops: "DevOps / Cloud",
    produtividade: "Produtividade"
  };

  return labels[mode] || labels.geral;
}

function createOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

export function createChatRouter() {
  const router = express.Router();
  const openai = createOpenAIClient();

  router.post("/chat", async (req, res) => {
    const { message, mode = "geral" } = req.body;

    try {
      if (!message) {
        return res.status(400).json({
          reply: "Envie uma mensagem válida."
        });
      }

      const modeLabel = getModeLabel(mode);

      if (!openai) {
        const fallbackReply = getFallbackResponse(message, mode);
        return res.status(200).json({
          mode,
          subject: modeLabel,
          source: "local-fallback",
          reply: `**${modeLabel}**\n\n${fallbackReply}`
        });
      }

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
Você é o Arriba Bot, assistente técnico da Arriba Platform.

Modo atual: ${modeLabel}

Regras gerais:
- responda em português
- seja objetivo
- seja amigável
- ajude com tecnologia, APIs, produtividade, suporte técnico e programação
- coloque um título curto no início da resposta

Se o modo for "DataCob / Suporte":
- ajude com suporte, chamados, erros, rotinas e troubleshooting
- sugira consultar Freshdesk PH3A e base de soluções PH3A quando fizer sentido
- organize respostas em checklist quando útil

Se o modo for "SQL / Banco de Dados":
- ajude com consultas SQL, modelagem, tabelas, joins e boas práticas

Se o modo for "DevOps / Cloud":
- ajude com Render, Vercel, Cloudflare, GitHub, APIs, DNS e deploy

Se o modo for "Produtividade":
- ajude com organização, rotina, documentação e melhoria de processo
            `
          },
          {
            role: "user",
            content: message
          }
        ]
      });

      const aiReply = completion.choices[0].message.content;

      res.json({
        mode,
        subject: modeLabel,
        source: "openai",
        reply: `**${modeLabel}**\n\n${aiReply}`
      });
    } catch (error) {
      console.error("Erro na OpenAI /chat:", error);

      const modeLabel = getModeLabel(mode);
      const fallbackReply = getFallbackResponse(message, mode);

      res.status(200).json({
        mode,
        subject: modeLabel,
        source: "local-fallback",
        reply: `**${modeLabel}**\n\n${fallbackReply}`
      });
    }
  });

  return router;
}
