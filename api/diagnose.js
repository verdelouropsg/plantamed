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

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: "Chave de API não configurada." });

  const { imageBase64, imageType } = req.body;
  if (!imageBase64 || !imageType) {
    return res.status(400).json({ error: "Imagem não enviada corretamente." });
  }

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

    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao processar. Tente novamente." });
  }
};
