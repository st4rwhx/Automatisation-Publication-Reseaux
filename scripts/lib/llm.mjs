// Petite couche d'accès au modèle de langage, volontairement minimale pour rester
// remplaçable : si le palier gratuit de Gemini change, seul ce fichier bouge.
//
// Variables d'environnement :
//   LLM_API_KEY    obligatoire — clé Google AI Studio (gratuite, sans carte bancaire)
//   LLM_MODEL      défaut gemini-3.5-flash-lite
//   LLM_ENDPOINT   défaut https://generativelanguage.googleapis.com/v1beta/interactions
//
// Palier gratuit : largement suffisant ici (un article et quelques posts par jour
// consomment une fraction du quota quotidien). À noter : sur le palier gratuit,
// Google se réserve le droit d'exploiter les échanges pour améliorer ses produits.

const ENDPOINT =
  process.env.LLM_ENDPOINT ||
  "https://generativelanguage.googleapis.com/v1beta/interactions";
const MODEL = process.env.LLM_MODEL || "gemini-3.5-flash-lite";

export function llmConfigured() {
  return Boolean(process.env.LLM_API_KEY);
}

export async function generate(prompt) {
  const key = process.env.LLM_API_KEY;
  if (!key) throw new Error("LLM_API_KEY manquante.");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, input: prompt }),
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Modèle: HTTP ${res.status} — ${body.slice(0, 300)}`);
  }

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(`Réponse du modèle illisible : ${body.slice(0, 200)}`);
  }

  // On accepte les deux formes d'API : la récente (output_text) et l'historique
  // (candidates[].content.parts[].text), pour ne pas casser si le compte bascule.
  const texte =
    data.output_text ??
    data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ??
    null;

  if (!texte) {
    throw new Error(`Réponse du modèle sans texte exploitable : ${body.slice(0, 200)}`);
  }
  return texte.trim();
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
