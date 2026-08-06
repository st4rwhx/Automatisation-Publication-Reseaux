#!/usr/bin/env node
// Découpe le post du jour en script vidéo : une suite de scènes courtes, chacune
// avec son texte de voix off et un mot-clé pour trouver le b-roll correspondant.
//
//   node scripts/generate-video-script.mjs [--dry-run] [--date AAAA-MM-JJ]
//
// Dépend du post du jour déjà généré (data/daily-posts.json). Le script est
// écrit dans data/video-scripts.json, repris par generate-voiceover.mjs puis
// fetch-broll.mjs et assemble-video.mjs.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateJson, llmConfigured } from "./lib/llm.mjs";
import { chargerProfil } from "./lib/profil.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const POSTS_PATH = path.join(ROOT, "data", "daily-posts.json");
const SCRIPTS_PATH = path.join(ROOT, "data", "video-scripts.json");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const dateFlag = args.indexOf("--date");
const JOUR = dateFlag !== -1 ? args[dateFlag + 1] : new Date().toISOString().slice(0, 10);

async function loadJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, "utf-8"));
}

function buildPrompt(profil, post) {
  return `Tu transformes un post en script pour une vidéo courte verticale (type TikTok/Reels,
30 à 45 secondes) pour ${profil.nom}.

SUJET DU POST
- Thème : ${post.theme}
- Accroche : ${post.hook}
- Contenu : ${post.corps}

CONTRAINTES DE VOIX OFF
- Langue française, phrases courtes et orales (pas de tournures écrites).
- Découpe en 4 à 6 scènes. Chaque scène = 1 à 2 phrases, 12 à 20 mots maximum,
  car elle doit tenir en 4-6 secondes de voix off.
- La première scène est l'accroche : doit capter l'attention en une phrase.
- La dernière scène est une conclusion ou un conseil à retenir, pas d'appel
  commercial appuyé.
- Pour chaque scène, donne 2-3 mots-clés en anglais décrivant une image
  d'illustration générique (bureau, ordinateur, ville, etc.) — ce mot-clé sert
  à chercher un clip vidéo libre de droits, il doit rester générique et neutre,
  jamais une marque ou un lieu précis.

FORMAT DE RÉPONSE (JSON)
{
  "scenes": [
    { "texte": "phrase de la voix off pour cette scène", "motCle": "mots-clés anglais pour le b-roll" }
  ]
}`;
}

function valider(p) {
  if (!Array.isArray(p?.scenes) || p.scenes.length < 3) {
    throw new Error("Le modèle n'a pas renvoyé au moins 3 scènes exploitables.");
  }
  return {
    scenes: p.scenes.map((s, i) => {
      if (!s?.texte || !s?.motCle) {
        throw new Error(`Scène ${i + 1} incomplète (texte ou motCle manquant).`);
      }
      return { texte: String(s.texte).trim(), motCle: String(s.motCle).trim() };
    }),
  };
}

async function main() {
  if (!llmConfigured()) {
    throw new Error("Aucun provider LLM configuré — voir SETUP_SECRETS.md.");
  }

  const posts = await loadJson(POSTS_PATH, {});
  const post = posts[JOUR];
  if (!post) {
    throw new Error(`Pas de post du ${JOUR} — lancer generate-daily-post.mjs d'abord.`);
  }

  const scripts = await loadJson(SCRIPTS_PATH, {});
  if (scripts[JOUR] && !DRY_RUN) {
    console.log(`Le script vidéo du ${JOUR} existe déjà — rien à faire.`);
    return;
  }

  const profil = await chargerProfil();
  const script = valider(await generateJson(buildPrompt(profil, post)));

  if (DRY_RUN) {
    console.log(JSON.stringify(script, null, 2));
    return;
  }

  scripts[JOUR] = { ...script, genereLe: new Date().toISOString() };
  await mkdir(path.dirname(SCRIPTS_PATH), { recursive: true });
  await writeFile(SCRIPTS_PATH, JSON.stringify(scripts, null, 2) + "\n", "utf-8");
  console.log(`Script vidéo du ${JOUR} généré — ${script.scenes.length} scènes.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
