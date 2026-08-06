#!/usr/bin/env node
// Génère la voix off de chaque scène via l'API gratuite "Read Aloud" de Microsoft
// Edge (aucune clé requise). Mesure aussi la durée de chaque fichier avec ffprobe,
// nécessaire pour caler la durée du b-roll sur assemble-video.mjs.
//
//   node scripts/generate-voiceover.mjs [--date AAAA-MM-JJ]

import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { chargerProfil } from "./lib/profil.mjs";

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCRIPTS_PATH = path.join(ROOT, "data", "video-scripts.json");
const AUDIO_DIR = path.join(ROOT, "data", "video", "audio");

const args = process.argv.slice(2);
const dateFlag = args.indexOf("--date");
const JOUR = dateFlag !== -1 ? args[dateFlag + 1] : new Date().toISOString().slice(0, 10);

async function loadJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, "utf-8"));
}

async function dureeSecondes(fichier) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    fichier,
  ]);
  return parseFloat(stdout.trim());
}

async function main() {
  const scripts = await loadJson(SCRIPTS_PATH, {});
  const script = scripts[JOUR];
  if (!script) {
    throw new Error(`Pas de script vidéo pour le ${JOUR} — lancer generate-video-script.mjs d'abord.`);
  }

  const profil = await chargerProfil();
  const voix = profil.video?.voix || "fr-FR-HenriNeural";

  await mkdir(AUDIO_DIR, { recursive: true });

  let generes = 0;
  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    const dest = path.join(AUDIO_DIR, `${JOUR}-scene${i}.mp3`);

    if (!existsSync(dest)) {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(voix, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const { audioFilePath } = await tts.toFile(AUDIO_DIR, scene.texte);
      if (audioFilePath !== dest) await rename(audioFilePath, dest);
      generes++;
    }

    scene.audio = path.relative(ROOT, dest);
    scene.duree = await dureeSecondes(dest);
  }

  await writeFile(SCRIPTS_PATH, JSON.stringify(scripts, null, 2) + "\n", "utf-8");
  console.log(
    `Voix off du ${JOUR} : ${generes} fichier(s) généré(s), ${script.scenes.length - generes} déjà présent(s).`
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
