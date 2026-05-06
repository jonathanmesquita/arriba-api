import express from "express";
import cors from "cors";
import OpenAI from "openai";

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
  try {
    const { message } = req.body;

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
- ajudar em tecnologia, APIs, produtividade, suporte e programação
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

    res.status(500).json({
      reply: "Tive um problema ao processar sua mensagem."
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});