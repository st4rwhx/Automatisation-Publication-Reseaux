// Couche d'accès LLM avec fallback chain : Gemini → Groq → DeepSeek → Kimi.
// Chaque provider a son propre format d'API ; on essaie chacun jusqu'au succès.
//
// Variables d'environnement :
//   GEMINI_API_KEY     clé Google AI Studio (gratuite)
//   GROQ_API_KEY       clé Groq (30 RPM gratuit)
//   DEEPSEEK_API_KEY   clé DeepSeek
//   KIMI_API_KEY       clé Moonshot Kimi
//
// Au moins une clé doit être définie. La chaîne essaie Gemini d'abord, puis
// Groq, DeepSeek, Kimi en dernier recours. Si toutes échouent, l'erreur porte
// sur le dernier provider.

const PROVIDERS = {
  gemini: {
    available: () => Boolean(process.env.GEMINI_API_KEY),
    call: async (prompt) => {
      const key = process.env.GEMINI_API_KEY;
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        {
          method: "POST",
          headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gemini-3.5-flash-lite",
            input: prompt,
          }),
        }
      );
      const body = await res.text();
      if (!res.ok) throw new Error(`Gemini: HTTP ${res.status}`);
      const data = JSON.parse(body);
      return (
        data.output_text ??
        data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ??
        null
      );
    },
  },

  groq: {
    available: () => Boolean(process.env.GROQ_API_KEY),
    call: async (prompt) => {
      const key = process.env.GROQ_API_KEY;
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mixtral-8x7b-32768",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        }),
      });
      const body = await res.text();
      if (!res.ok) throw new Error(`Groq: HTTP ${res.status}`);
      const data = JSON.parse(body);
      return data.choices?.[0]?.message?.content ?? null;
    },
  },

  deepseek: {
    available: () => Boolean(process.env.DEEPSEEK_API_KEY),
    call: async (prompt) => {
      const key = process.env.DEEPSEEK_API_KEY;
      const res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        }),
      });
      const body = await res.text();
      if (!res.ok) throw new Error(`DeepSeek: HTTP ${res.status}`);
      const data = JSON.parse(body);
      return data.choices?.[0]?.message?.content ?? null;
    },
  },

  kimi: {
    available: () => Boolean(process.env.KIMI_API_KEY),
    call: async (prompt) => {
      const key = process.env.KIMI_API_KEY;
      const res = await fetch("https://api.moonshot.cn/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "moonshot-v1-32k",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        }),
      });
      const body = await res.text();
      if (!res.ok) throw new Error(`Kimi: HTTP ${res.status}`);
      const data = JSON.parse(body);
      return data.choices?.[0]?.message?.content ?? null;
    },
  },
};

export function llmConfigured() {
  return Object.values(PROVIDERS).some((p) => p.available());
}

export async function generate(prompt) {
  const order = ["gemini", "groq", "deepseek", "kimi"];
  let lastError = null;

  for (const name of order) {
    const provider = PROVIDERS[name];
    if (!provider.available()) continue;

    try {
      const texte = await provider.call(prompt);
      if (!texte) throw new Error("Pas de texte dans la réponse");
      return texte.trim();
    } catch (err) {
      lastError = err;
      console.warn(`  ${name} échoué: ${err.message}`);
      continue;
    }
  }

  throw new Error(
    `Aucun provider LLM disponible ou tous ont échoué. Dernier: ${lastError?.message || "inconnu"}`
  );
}

// Demande du JSON au modèle et le parse. Les modèles encadrent souvent leur réponse
// d'un bloc ```json : on le retire avant de parser plutôt que d'échouer dessus.
export async function generateJson(prompt) {
  const brut = await generate(
    `${prompt}\n\nRéponds UNIQUEMENT avec du JSON valide, sans commentaire ni texte autour.`
  );
  const nettoye = brut
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  try {
    return JSON.parse(nettoye);
  } catch {
    throw new Error(`Le modèle n'a pas renvoyé du JSON valide : ${nettoye.slice(0, 300)}`);
  }
}
