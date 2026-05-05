import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("API do Jonathan está viva 🚀");
});

app.post("/chat", (req, res) => {
  const { message } = req.body;

  res.json({
    reply: `Eco da máquina: ${message}`
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
