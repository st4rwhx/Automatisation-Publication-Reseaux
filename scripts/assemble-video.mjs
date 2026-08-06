#!/usr/bin/env node
// Monte la vidéo finale à partir des scènes (b-roll + voix off + sous-titres
// incrustés), via ffmpeg. Nécessite ffmpeg installé sur la machine (déjà présent
// sur les runners GitHub Actions Ubuntu après `apt-get install ffmpeg`).
//
//   node scripts/assemble-video.mjs [--date AAAA-MM-JJ]
//
// Sortie : public/video/quotidien-AAAA-MM-JJ.mp4 (1080x1920, format vertical
// TikTok/Reels), repris par publish-to-postiz.mjs.

import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCRIPTS_PATH = path.join(ROOT, "data", "video-scripts.json");
const TMP_DIR = path.join(ROOT, "data", "video", "tmp");
const OUT_DIR = path.join(ROOT, "public", "video");

const args = process.argv.slice(2);
const dateFlag = args.indexOf("--date");
const JOUR = dateFlag !== -1 ? args[dateFlag + 1] : new Date().toISOString().slice(0, 10);
const FORCE = args.includes("--force");

// Polices connues sur les runners Ubuntu (paquet fonts-dejavu-core, présent par
// défaut sur ubuntu-latest). Sert de repli si fontconfig ne résout pas "Sans".
const POLICES_CANDIDATES = [
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
];

async function loadJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, "utf-8"));
}

function trouverPolice() {
  return POLICES_CANDIDATES.find((p) => existsSync(p)) || null;
}

async function monterScene(scene, index, police) {
  const brollPath = path.join(ROOT, scene.broll);
  const audioPath = path.join(ROOT, scene.audio);
  const txtPath = path.join(TMP_DIR, `${JOUR}-scene${index}.txt`);
  const destPath = path.join(TMP_DIR, `${JOUR}-scene${index}.mp4`);

  // Le filtre drawtext lit le texte depuis un fichier : évite tout problème
  // d'échappement des apostrophes, deux-points ou % dans le texte généré.
  await writeFile(txtPath, scene.texte, "utf-8");

  const drawtext = [
    `textfile=${txtPath}`,
    police ? `fontfile=${police}` : `font=Sans`,
    "fontsize=58",
    "fontcolor=white",
    "box=1",
    "boxcolor=black@0.55",
    "boxborderw=26",
    "line_spacing=10",
    "x=(w-text_w)/2",
    "y=h-420",
  ].join(":");

  const filtre = `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,drawtext=${drawtext}`;

  await execFileAsync("ffmpeg", [
    "-y",
    "-stream_loop", "-1",
    "-i", brollPath,
    "-i", audioPath,
    "-t", String(scene.duree),
    "-vf", filtre,
    "-map", "0:v",
    "-map", "1:a",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "128k",
    destPath,
  ]);

  return destPath;
}

async function main() {
  const scripts = await loadJson(SCRIPTS_PATH, {});
  const script = scripts[JOUR];
  if (!script) {
    throw new Error(`Pas de script vidéo pour le ${JOUR} — lancer generate-video-script.mjs d'abord.`);
  }

  const manquantes = script.scenes.filter((s) => !s.broll || !s.audio || !s.duree);
  if (manquantes.length) {
    throw new Error(
      "Scènes incomplètes : lancer generate-voiceover.mjs et fetch-broll.mjs avant assemble-video.mjs."
    );
  }

  const destFinale = path.join(OUT_DIR, `quotidien-${JOUR}.mp4`);
  if (existsSync(destFinale) && !FORCE) {
    console.log(`Vidéo du ${JOUR} déjà assemblée — utiliser --force pour refaire.`);
    return;
  }

  await mkdir(TMP_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });

  const police = trouverPolice();
  if (!police) {
    console.warn("Aucune police TTF connue trouvée, repli sur fontconfig (font=Sans).");
  }

  console.log(`Montage de ${script.scenes.length} scène(s)...`);
  const segments = [];
  for (let i = 0; i < script.scenes.length; i++) {
    segments.push(await monterScene(script.scenes[i], i, police));
    console.log(`  scène ${i + 1}/${script.scenes.length} montée`);
  }

  const listePath = path.join(TMP_DIR, `${JOUR}-liste.txt`);
  await writeFile(listePath, segments.map((s) => `file '${s}'`).join("\n") + "\n", "utf-8");

  await execFileAsync("ffmpeg", [
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", listePath,
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    destFinale,
  ]);

  await rm(TMP_DIR, { recursive: true, force: true });
  console.log(`Vidéo assemblée : ${path.relative(ROOT, destFinale)}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
