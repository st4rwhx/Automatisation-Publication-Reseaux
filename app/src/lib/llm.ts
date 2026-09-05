// Port TypeScript de scripts/lib/llm.mjs — même chaîne fallback Gemini → Groq →
// DeepSeek → Kimi, adaptée pour tourner dans une fonction serverless Next.js
// plutôt qu'un script CLI. La logique métier ne change pas.

interface Provider {
  disponible: () => boolean;
  appeler: (prompt: string) => Promise<string | null>;
}

const PROVIDERS: Record<string, Provider> = {
  gemini: {
    disponible: () => Boolean(process.env.GEMINI_API_KEY),
    appeler: async (prompt) => {
      const modele = "gemini-3.7-flash";
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`,
        {
          method: "POST",
          headers: { "x-goog-api-key": process.env.GEMINI_API_KEY!, "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      const body = await res.text();
      if (!res.ok) throw new Error(`Gemini: HTTP ${res.status} — ${body.slice(0, 200)}`);
      const data = JSON.parse(body);
      return data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? null;
    },
  },
  groq: {
    disponible: () => Boolean(process.env.GROQ_API_KEY),
    appeler: async (prompt) => {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "openai/gpt-oss-20b", messages: [{ role: "user", content: prompt }], temperature: 0.7 }),
      });
      const body = await res.text();
      if (!res.ok) throw new Error(`Groq: HTTP ${res.status} — ${body.slice(0, 200)}`);
      return JSON.parse(body).choices?.[0]?.message?.content ?? null;
    },
  },
  deepseek: {
    disponible: () => Boolean(process.env.DEEPSEEK_API_KEY),
    appeler: async (prompt) => {
      const res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: prompt }], temperature: 0.7 }),
      });
      const body = await res.text();
      // HTTP 402 = compte sans crédit, pas de bug côté code : approvisionner
      // le compte sur platform.deepseek.com (pas de palier gratuit ici).
      if (!res.ok) throw new Error(`DeepSeek: HTTP ${res.status} — ${body.slice(0, 200)}`);
      return JSON.parse(body).choices?.[0]?.message?.content ?? null;
    },
  },
  kimi: {
    disponible: () => Boolean(process.env.KIMI_API_KEY),
    appeler: async (prompt) => {
      // .ai = plateforme internationale, .cn = Chine continentale (compte et
      // facturation séparés) : une clé prise sur platform.moonshot.ai échoue
      // en 401 sur .cn, d'où le correctif.
      const res = await fetch("https://api.moonshot.ai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.KIMI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "moonshot-v1-32k", messages: [{ role: "user", content: prompt }], temperature: 0.7 }),
      });
      const body = await res.text();
      if (!res.ok) throw new Error(`Kimi: HTTP ${res.status} — ${body.slice(0, 200)}`);
      return JSON.parse(body).choices?.[0]?.message?.content ?? null;
    },
  },
};

const ORDRE = ["gemini", "groq", "deepseek", "kimi"] as const;

export function llmConfigure(): boolean {
  return ORDRE.some((nom) => PROVIDERS[nom].disponible());
}

export async function generer(prompt: string): Promise<string> {
  let derniereErreur: Error | null = null;

  for (const nom of ORDRE) {
    const provider = PROVIDERS[nom];
    if (!provider.disponible()) continue;

    try {
      const texte = await provider.appeler(prompt);
      if (!texte) throw new Error("Pas de texte dans la réponse");
      return texte.trim();
    } catch (err) {
      derniereErreur = err as Error;
      console.warn(`  ${nom} échoué: ${derniereErreur.message}`);
    }
  }

  throw new Error(`Aucun provider LLM disponible ou tous ont échoué. Dernier: ${derniereErreur?.message ?? "inconnu"}`);
}

export async function genererJson<T = any>(prompt: string): Promise<T> {
  const brut = await generer(`${prompt}\n\nRéponds UNIQUEMENT avec du JSON valide, sans commentaire ni texte autour.`);
  const nettoye = brut.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try {
    return JSON.parse(nettoye);
  } catch {
    throw new Error(`Le modèle n'a pas renvoyé du JSON valide : ${nettoye.slice(0, 300)}`);
  }
}
