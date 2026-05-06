import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { getFallbackResponse } from "./fallback.js";

const app = express();

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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

app.get("/", (req, res) => {
  res.send("API do Jonathan está viva 🚀");
});

app.get("/healthz", (req, res) => {
  res.send("ok");
});

app.post("/chat", async (req, res) => {
  const { message, mode = "geral" } = req.body;

  try {
    if (!message) {
      return res.status(400).json({
        reply: "Envie uma mensagem válida."
      });
    }

    const modeLabel = getModeLabel(mode);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
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
      reply: `**${modeLabel}**\n\n${aiReply}`
    });

  } catch (error) {
    console.error("Erro na OpenAI:", error);

    const modeLabel = getModeLabel(mode);
    const fallbackReply = getFallbackResponse(message, mode);

    res.status(200).json({
      mode,
      subject: modeLabel,
      reply: `**${modeLabel}**\n\n${fallbackReply}`
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});