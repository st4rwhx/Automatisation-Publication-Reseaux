// Port de scripts/generate-daily-post.mjs pour le SaaS : même prompt, même
// validation, mais le "profil" et l'historique viennent de Postgres au lieu
// de config/profil.json et data/daily-posts.json.

import { genererJson } from "./llm";
import { db } from "./db";
import type { Profil } from "@prisma/client";

export interface PostGenere {
  theme: string;
  sujet: string;
  visuel: string;
  hook: string;
  corps: string;
  hashtags: string[];
}

const MEMOIRE = 20; // nombre de sujets récents transmis au modèle pour éviter les redites

function construirePrompt(profil: Profil, sujetsRecents: string[]): string {
  const entete = profil.type === "PARTICULIER" ? "PROFIL" : "ENTREPRISE";
  return `Tu rédiges le post du jour pour les réseaux sociaux de ${profil.nom}.

${entete}
- Activité : ${profil.activite}
- Zone : ${profil.zone}
- Cible : ${profil.cible}
${profil.depuis ? `- En activité depuis ${profil.depuis}` : ""}

TON À RESPECTER
${profil.ton.map((t) => `- ${t}`).join("\n")}

INTERDITS STRICTS
${profil.interdits.map((t) => `- ${t}`).join("\n")}

SUJETS DÉJÀ TRAITÉS RÉCEMMENT — n'y reviens pas, trouve un angle neuf :
${sujetsRecents.length ? sujetsRecents.map((s) => `- ${s}`).join("\n") : "- (aucun pour l'instant)"}

MISSION
Écris un post utile et autonome : un conseil concret qu'un dirigeant peut appliquer,
ou une erreur fréquente à éviter. Le post doit se suffire à lui-même. Il doit donner
envie de lire dès la première ligne, sans être putaclic.

FORMAT DE RÉPONSE (JSON)
{
  "theme": "un des thèmes suivants : ${profil.themes.join(", ")}",
  "sujet": "résumé du sujet en 8 mots maximum, sert à éviter les redites",
  "visuel": "titre court pour le visuel, 60 caractères maximum, percutant",
  "hook": "première ligne du post, 90 caractères maximum, doit accrocher",
  "corps": "3 à 5 phrases courtes, séparées par des retours à la ligne simples",
  "hashtags": ["5 à 7 hashtags pertinents, sans le caractère #, en minuscules"]
}`;
}

function valider(p: any): PostGenere {
  const manques = ["theme", "sujet", "visuel", "hook", "corps", "hashtags"].filter((k) => !p?.[k]);
  if (manques.length) throw new Error(`Réponse incomplète du modèle, champs manquants : ${manques.join(", ")}`);
  if (!Array.isArray(p.hashtags)) throw new Error("Le champ hashtags doit être une liste.");

  return {
    theme: String(p.theme).trim(),
    sujet: String(p.sujet).trim(),
    visuel: String(p.visuel).trim().slice(0, 80),
    hook: String(p.hook).trim(),
    corps: String(p.corps).trim(),
    hashtags: p.hashtags.map((h: unknown) => String(h).replace(/^#/, "").trim()).filter(Boolean),
  };
}

export async function genererPostDuJour(utilisateurId: string): Promise<PostGenere> {
  const profil = await db.profil.findUnique({ where: { utilisateurId } });
  if (!profil) throw new Error("Profil introuvable — configurez-le avant de générer un post.");

  const postsRecents = await db.post.findMany({
    where: { utilisateurId },
    orderBy: { creeLe: "desc" },
    take: MEMOIRE,
    select: { sujet: true },
  });

  const post = valider(await genererJson(construirePrompt(profil, postsRecents.map((p) => p.sujet))));
  return post;
}
