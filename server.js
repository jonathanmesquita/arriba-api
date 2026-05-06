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

app.get("/", (req, res) => {
  res.send("API do Jonathan está viva 🚀");
});

app.get("/healthz", (req, res) => {
  res.send("ok");
});

app.post("/chat", async (req, res) => {
  const { message } = req.body;

  try {

    if (!message) {
      return res.status(400).json({
        reply: "Envie uma mensagem válida."
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Você é o Arriba Bot.
Um assistente técnico da Arriba Platform.

Suas respostas devem:
- ser em português
- ser objetivas
- ser amigáveis
- ajudar em tecnologia
- ajudar com APIs
- ajudar com produtividade
- ajudar com suporte técnico
- ajudar com programação
          `
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    res.json({
      reply: completion.choices[0].message.content
    });

  } catch (error) {

    console.error("Erro na OpenAI:", error);

    // fallback offline inteligente
    res.status(200).json({
      reply: getFallbackResponse(message)
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});