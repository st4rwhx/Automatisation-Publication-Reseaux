#!/usr/bin/env node
// Produit le post du jour pour les réseaux : un conseil autonome sur l'expertise
// CEMATYS, sans dépendre de la parution d'un nouvel article.
//
//   LLM_API_KEY=xxx node scripts/generate-daily-post.mjs [--dry-run] [--date AAAA-MM-JJ]
//
// Le post est écrit dans data/daily-posts.json, puis repris par publish-to-postiz.mjs.
// Les thèmes des dernières semaines sont transmis au modèle pour éviter qu'il
// ne tourne en boucle sur les mêmes sujets.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateJson, llmConfigured } from "./lib/llm.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MARQUE_PATH = path.join(ROOT, "config", "marque.json");
const POSTS_PATH = path.join(ROOT, "data", "daily-posts.json");
const SEEN_PATH = path.join(ROOT, "data", "seen-articles.json");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const dateFlag = args.indexOf("--date");
const JOUR =
  dateFlag !== -1 ? args[dateFlag + 1] : new Date().toISOString().slice(0, 10);

// Nombre de posts passés dont on rappelle le sujet au modèle pour éviter les redites.
const MEMOIRE = 20;

async function loadJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, "utf-8"));
}

function buildPrompt(marque, recents, titresArticles) {
  return `Tu rédiges le post du jour pour les réseaux sociaux de ${marque.entreprise}.

ENTREPRISE
- Activité : ${marque.activite}
- Zone : ${marque.zone}
- Clients : ${marque.cible}
- En activité depuis ${marque.depuis}

TON À RESPECTER
${marque.ton.map((t) => `- ${t}`).join("\n")}

INTERDITS STRICTS
${marque.interdits.map((t) => `- ${t}`).join("\n")}

SUJETS DÉJÀ TRAITÉS RÉCEMMENT — n'y reviens pas, trouve un angle neuf :
${recents.length ? recents.map((r) => `- ${r}`).join("\n") : "- (aucun pour l'instant)"}

ARTICLES DÉJÀ EN LIGNE SUR LE SITE — ne les paraphrase pas :
${titresArticles.map((t) => `- ${t}`).join("\n")}

MISSION
Écris un post utile et autonome : un conseil concret qu'un dirigeant peut appliquer,
ou une erreur fréquente à éviter. Le post doit se suffire à lui-même, sans renvoyer
vers un article. Il doit donner envie de lire dès la première ligne, sans être putaclic.

FORMAT DE RÉPONSE (JSON)
{
  "theme": "un des thèmes suivants : ${marque.themes.join(", ")}",
  "sujet": "résumé du sujet en 8 mots maximum, sert à éviter les redites",
  "visuel": "titre court pour le visuel, 60 caractères maximum, percutant",
  "hook": "première ligne du post, 90 caractères maximum, doit accrocher",
  "corps": "3 à 5 phrases courtes, séparées par des retours à la ligne simples",
  "hashtags": ["5 à 7 hashtags pertinents, sans le caractère #, en minuscules"]
}`;
}

function valider(p) {
  const manques = ["theme", "sujet", "visuel", "hook", "corps", "hashtags"].filter(
    (k) => !p?.[k]
  );
  if (manques.length) {
    throw new Error(`Réponse incomplète du modèle, champs manquants : ${manques.join(", ")}`);
  }
  if (!Array.isArray(p.hashtags)) {
    throw new Error("Le champ hashtags doit être une liste.");
  }
  return {
    theme: String(p.theme).trim(),
    sujet: String(p.sujet).trim(),
    visuel: String(p.visuel).trim().slice(0, 80),
    hook: String(p.hook).trim(),
    corps: String(p.corps).trim(),
    hashtags: p.hashtags.map((h) => String(h).replace(/^#/, "").trim()).filter(Boolean),
  };
}

async function main() {
  if (!llmConfigured()) {
    throw new Error("LLM_API_KEY manquante — voir docs/DEPLOIEMENT.md.");
  }

  const marque = JSON.parse(await readFile(MARQUE_PATH, "utf-8"));
  const posts = await loadJson(POSTS_PATH, {});

  if (posts[JOUR] && !DRY_RUN) {
    console.log(`Le post du ${JOUR} existe déjà — rien à faire.`);
    return;
  }

  const recents = Object.values(posts)
    .sort((a, b) => (a.genereLe < b.genereLe ? 1 : -1))
    .slice(0, MEMOIRE)
    .map((p) => p.sujet);

  const articles = Object.values(await loadJson(SEEN_PATH, {})).map((a) => a.title);

  const post = valider(await generateJson(buildPrompt(marque, recents, articles)));

  if (DRY_RUN) {
    console.log(JSON.stringify(post, null, 2));
    return;
  }

  posts[JOUR] = { ...post, genereLe: new Date().toISOString() };
  await mkdir(path.dirname(POSTS_PATH), { recursive: true });
  await writeFile(POSTS_PATH, JSON.stringify(posts, null, 2) + "\n", "utf-8");
  console.log(`Post du ${JOUR} généré — thème ${post.theme} : ${post.sujet}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
