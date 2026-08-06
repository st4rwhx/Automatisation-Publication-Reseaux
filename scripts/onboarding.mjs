#!/usr/bin/env node
// Crée config/profil.json en posant quelques questions, pour brancher le système
// sur une nouvelle entreprise ou un nouveau créateur sans toucher au code.
//
//   node scripts/onboarding.mjs
//
// Le profil résultant pilote toute la génération : posts quotidiens, visuels,
// vidéos. La détection automatique d'articles (generate-rss.mjs) reste liée à
// la structure HTML de cematys.fr et n'est pas couverte par cet onboarding.

import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PROFIL_PATH = path.join(ROOT, "config", "profil.json");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q, defaut) => rl.question(defaut ? `${q} [${defaut}] ` : `${q} `);
const askListe = async (q, exemple) => {
  const rep = await ask(`${q} (séparés par des virgules, ex: ${exemple})`);
  return rep.split(",").map((s) => s.trim()).filter(Boolean);
};

async function main() {
  if (existsSync(PROFIL_PATH)) {
    const ecraser = await ask("config/profil.json existe déjà — l'écraser ? (o/N)");
    if (!/^o(ui)?$/i.test(ecraser.trim())) {
      console.log("Annulé.");
      rl.close();
      return;
    }
  }

  console.log("\n=== Configuration du profil ===\n");

  const typeRep = await ask("Entreprise ou particulier ? (entreprise/particulier)", "entreprise");
  const type = /^p/i.test(typeRep.trim()) ? "particulier" : "entreprise";

  const nom = await ask(type === "entreprise" ? "Nom de l'entreprise ?" : "Nom / pseudo ?");
  const site = await ask("Site web (https://...) ?", "");
  const activite = await ask(
    type === "entreprise" ? "Activité de l'entreprise en une phrase ?" : "Ce que tu fais / ton domaine en une phrase ?"
  );
  const zone = await ask("Zone géographique ciblée ?", "France");
  const cible = await ask("Public visé (qui doit te lire) ?");
  const depuisRep = await ask("Depuis quelle année (laisser vide si non pertinent) ?", "");

  console.log("\n=== Ton et contenu ===\n");
  const ton = await askListe(
    "Règles de ton à respecter",
    "concret et sans jargon, jamais alarmiste"
  );
  const themes = await askListe("Thèmes de contenu récurrents", "conseils, coulisses, actualité");
  const interdits = await askListe(
    "Interdits stricts",
    "inventer des chiffres, citer un client réel"
  );

  console.log("\n=== Paramètres vidéo (pipeline gratuit) ===\n");
  const voix = await ask("Voix TTS (fr-FR-HenriNeural = homme, fr-FR-DeniseNeural = femme)", "fr-FR-HenriNeural");
  const styleBroll = await ask(
    "Mots-clés pour les images/vidéos d'illustration",
    "bureau, technologie, entreprise"
  );

  const profil = {
    type,
    nom: nom.trim(),
    site: site.trim(),
    activite: activite.trim(),
    zone: zone.trim(),
    cible: cible.trim(),
    ...(depuisRep.trim() ? { depuis: Number(depuisRep.trim()) || depuisRep.trim() } : {}),
    ton,
    themes,
    interdits,
    video: { voix: voix.trim(), styleBroll: styleBroll.trim() },
  };

  await writeFile(PROFIL_PATH, JSON.stringify(profil, null, 2) + "\n", "utf-8");
  console.log(`\n✓ Profil écrit dans ${path.relative(ROOT, PROFIL_PATH)}`);
  console.log("Tu peux le modifier à la main à tout moment.");
  rl.close();
}

main().catch((err) => {
  console.error(err.message);
  rl.close();
  process.exit(1);
});
