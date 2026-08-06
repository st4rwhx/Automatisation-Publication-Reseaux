// Charge le profil (entreprise ou particulier) qui pilote toute la génération de
// contenu : ton, thèmes, interdits, et paramètres vidéo.
//
// config/profil.json remplace l'ancien config/marque.json ; on lit encore ce
// dernier en repli pour ne pas casser une installation existante.

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const PROFIL_PATH = path.join(ROOT, "config", "profil.json");
const MARQUE_PATH = path.join(ROOT, "config", "marque.json");

export async function chargerProfil() {
  const fichier = existsSync(PROFIL_PATH) ? PROFIL_PATH : MARQUE_PATH;
  if (!existsSync(fichier)) {
    throw new Error(
      "Aucun profil trouvé (config/profil.json). Lancer scripts/onboarding.mjs pour en créer un."
    );
  }
  const brut = JSON.parse(await readFile(fichier, "utf-8"));

  // "entreprise" est l'ancien nom du champ ; "nom" est le nom générique
  // (entreprise ou personne). On garde les deux pour compatibilité.
  return {
    type: brut.type || "entreprise",
    nom: brut.nom || brut.entreprise,
    entreprise: brut.nom || brut.entreprise, // rétro-compatibilité des prompts existants
    ...brut,
  };
}
