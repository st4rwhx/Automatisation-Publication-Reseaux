#!/usr/bin/env node
// Télécharge un clip vidéo libre de droits par scène, via l'API gratuite Pexels.
// Nécessite PEXELS_API_KEY (gratuite, sans carte bancaire : pexels.com/api).
//
//   PEXELS_API_KEY=xxx node scripts/fetch-broll.mjs [--date AAAA-MM-JJ]

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chargerProfil } from "./lib/profil.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCRIPTS_PATH = path.join(ROOT, "data", "video-scripts.json");
const BROLL_DIR = path.join(ROOT, "data", "video", "broll");

const args = process.argv.slice(2);
const dateFlag = args.indexOf("--date");
const JOUR = dateFlag !== -1 ? args[dateFlag + 1] : new Date().toISOString().slice(0, 10);

const PEXELS_KEY = process.env.PEXELS_API_KEY || "";

async function loadJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, "utf-8"));
}

// Choisit le fichier vertical le plus proche de 1080x1920 parmi les qualités
// proposées par Pexels pour une vidéo donnée.
function meilleurFichier(video) {
  const verticaux = video.video_files.filter((f) => f.height > f.width);
  const pool = verticaux.length ? verticaux : video.video_files;
  return pool.reduce((meilleur, f) => {
    const ecart = Math.abs((f.height || 0) - 1920);
    const ecartMeilleur = Math.abs((meilleur.height || 0) - 1920);
    return ecart < ecartMeilleur ? f : meilleur;
  }, pool[0]);
}

async function chercherClip(motCle, styleBroll) {
  const requete = [motCle, styleBroll].filter(Boolean).join(" ");
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(requete)}&orientation=portrait&per_page=5`;
  const res = await fetch(url, { headers: { Authorization: PEXELS_KEY } });
  if (!res.ok) throw new Error(`Pexels : HTTP ${res.status}`);
  const data = await res.json();
  if (!data.videos?.length) throw new Error(`Aucun clip Pexels pour "${requete}"`);
  return meilleurFichier(data.videos[0]);
}

async function telecharger(url, dest) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Téléchargement échoué : HTTP ${res.status}`);
  await pipeline(res.body, createWriteStream(dest));
}

async function main() {
  if (!PEXELS_KEY) {
    throw new Error("PEXELS_API_KEY manquante — clé gratuite sur pexels.com/api.");
  }

  const scripts = await loadJson(SCRIPTS_PATH, {});
  const script = scripts[JOUR];
  if (!script) {
    throw new Error(`Pas de script vidéo pour le ${JOUR} — lancer generate-video-script.mjs d'abord.`);
  }

  const profil = await chargerProfil();
  await mkdir(BROLL_DIR, { recursive: true });

  let telecharges = 0;
  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    const dest = path.join(BROLL_DIR, `${JOUR}-scene${i}.mp4`);

    if (!existsSync(dest)) {
      const fichier = await chercherClip(scene.motCle, profil.video?.styleBroll);
      await telecharger(fichier.link, dest);
      telecharges++;
    }
    scene.broll = path.relative(ROOT, dest);
  }

  await writeFile(SCRIPTS_PATH, JSON.stringify(scripts, null, 2) + "\n", "utf-8");
  console.log(
    `B-roll du ${JOUR} : ${telecharges} clip(s) téléchargé(s), ${script.scenes.length - telecharges} déjà présent(s).`
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
