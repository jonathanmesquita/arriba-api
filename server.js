import express from "express";
import cors from "cors";
import { createChatRouter } from "./routes/chat.routes.js";
import { createFreshdeskRouter } from "./routes/freshdesk.routes.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => {
  res.json({
    name: "Arriba API",
    status: "online",
    modules: ["chatbot", "freshdesk-support-copilot"]
  });
});

app.get("/healthz", (req, res) => {
  res.send("ok");
});

app.use(createChatRouter());
app.use(createFreshdeskRouter());

app.use((req, res) => {
  res.status(404).json({
    error: "Rota não encontrada.",
    path: req.path
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
