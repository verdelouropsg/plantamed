const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Health check
app.get("/health", (req, res) => res.json({ ok: true }));

// Diagnose endpoint
app.post("/api/diagnose", async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: "Chave de API não configurada no servidor." });
  }

  const { imageBase64, imageType } = req.body;

  if (!imageBase64 || !imageType) {
    return res.status(400).json({ error: "Imagem não enviada corretamente." });
  }

  const SYSTEM = `Você é um especialista em fitossanidade e agronomia. Analise a imagem da planta e retorne APENAS um JSON válido, sem texto extra, sem markdown, sem backticks.

Estrutura obrigatória:
{
  "diagnostico": "Nome do problema identificado",
  "categoria": "praga" | "hidratacao" | "doenca" | "nutricional" | "saudavel" | "desconhecido",
  "severidade": "leve" | "moderada" | "grave" | "saudavel",
  "confianca": "alta" | "media" | "baixa",
  "descricao": "Descrição do problema em 2-3 frases.",
  "causas": "Possíveis causas. 1-2 frases.",
  "urgencia": "leve" | "moderada" | "urgente",
  "passos": ["Passo 1", "Passo 2", "Passo 3", "Passo 4", "Passo 5"],
  "prevencao": "Dica de prevenção futura. 1-2 frases."
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1000,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: imageType, data: imageBase64 },
              },
              { type: "text", text: "Analise esta planta e retorne o JSON de diagnóstico." },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err?.error?.message || "Erro na API Anthropic." });
    }

    const data = await response.json();
    const raw = data.content.map((b) => b.text || "").join("").trim();
    const clean = raw.replace(/```json|```/g, "").trim();
    const result = JSON.parse(clean);

    res.json(result);
  } catch (err) {
    console.error("Erro:", err.message);
    res.status(500).json({ error: "Erro ao processar a imagem. Tente novamente." });
  }
});

app.listen(PORT, () => {
  console.log(`✅ PlantaMed rodando em http://localhost:${PORT}`);
  if (!API_KEY) console.warn("⚠️  ANTHROPIC_API_KEY não definida!");
});
