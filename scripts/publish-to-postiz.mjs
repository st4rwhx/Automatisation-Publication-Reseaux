#!/usr/bin/env node
// Publie sur les réseaux ce qui ne l'a pas encore été : les nouveaux articles du site
// et les posts quotidiens générés par generate-daily-post.mjs.
//
//   POSTIZ_API_URL=... POSTIZ_API_KEY=... IMAGES_BASE_URL=... node scripts/publish-to-postiz.mjs
//
// Options :
//   --dry-run            n'appelle pas l'API, affiche ce qui serait publié
//   --include-existing   publie aussi les articles déjà en ligne au 1er lancement
//   --limit N            ne traite que N éléments au maximum
//   --now                publie immédiatement au lieu d'attendre le créneau optimal
//
// Chaque réseau reçoit son propre appel : un refus sur l'un n'empêche pas les autres,
// et un nouveau passage ne réessaie que ce qui a échoué.

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prochainCreneau } from "./lib/horaires.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SEEN_PATH = path.join(ROOT, "data", "seen-articles.json");
const DAILY_PATH = path.join(ROOT, "data", "daily-posts.json");
const PUBLISHED_PATH = path.join(ROOT, "data", "published.json");
const HORAIRES_PATH = path.join(ROOT, "config", "horaires.json");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const INCLUDE_EXISTING = args.includes("--include-existing");
const PUBLIER_MAINTENANT = args.includes("--now");
const limitFlag = args.indexOf("--limit");
const LIMIT = limitFlag !== -1 ? Number(args[limitFlag + 1]) : Infinity;

const API_URL = (process.env.POSTIZ_API_URL || "").replace(/\/$/, "");
const API_KEY = process.env.POSTIZ_API_KEY || "";
const IMAGES_BASE_URL = (process.env.IMAGES_BASE_URL || "").replace(/\/$/, "");

// Réseaux volontairement écartés. X est exclu par défaut : depuis février 2026 il
// facture 0,20 $ par post contenant un lien, seul réseau payant du dispositif.
// Vider la variable pour le réactiver.
const EXCLUS = new Set(
  (process.env.RESEAUX_EXCLUS ?? "x").split(",").map((s) => s.trim()).filter(Boolean)
);

const LIMITS = {
  x: 280,
  bluesky: 300,
  mastodon: 500,
  threads: 500,
  pinterest: 500,
  instagram: 2200,
  tiktok: 2200,
  linkedin: 3000,
  facebook: 63206,
};
const DEFAULT_LIMIT = 2000;

const IMAGE_FORMAT = {
  instagram: "carre",
  tiktok: "carre",
  linkedin: "paysage",
  x: "paysage",
  facebook: "paysage",
  threads: "paysage",
  mastodon: "paysage",
  bluesky: "paysage",
};
const MEDIA_REQUIS = new Set(["instagram", "tiktok", "pinterest"]);

const PLATFORM_SETTINGS = {
  // En post photo, TikTok lit le titre dans settings.title et le corps dans
  // description. duet/stitch/video_made_with_ai ne concernent que les vidéos.
  tiktok: {
    title: (e) => e.titre.slice(0, 90),
    privacy_level: "PUBLIC_TO_EVERYONE",
    comment: true,
    autoAddMusic: "yes",
    brand_content_toggle: false,
    brand_organic_toggle: false,
  },
  pinterest: { title: (e) => e.titre.slice(0, 100) },
  reddit: { subreddit: [] },
};

const HASHTAGS_ARTICLE = {
  "Sécurité": ["cybersecurite", "ransomware", "securiteinformatique"],
  "Coûts": ["productivite", "gestion"],
  "Sauvegarde": ["sauvegarde", "backup", "continuite"],
  "Infogérance": ["infogerance", "supportIT"],
  "Étude de cas": ["retourdexperience", "temoignage"],
  "Prévention": ["prevention", "bonnespratiques"],
  "Maintenance": ["maintenance", "infrastructure"],
};
const HASHTAGS_COMMUNS = ["informatique", "PME", "Lyon"];

function sansAccents(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "");
}

function slug(link) {
  return path
    .basename(new URL(link).pathname)
    .replace(/\.html?$/, "")
    .replace(/[^a-zA-Z0-9-]/g, "");
}

// Assemble le texte le plus complet qui tienne dans la limite du réseau.
// Le titre reste prioritaire ; sur les réseaux courts on rogne le corps plutôt que
// de sacrifier les hashtags, qui portent la visibilité.
function buildContent(element, reseau) {
  const limite = LIMITS[reseau] ?? DEFAULT_LIMIT;
  const tags = element.hashtags.map((t) => `#${t}`).join(" ");
  const { titre, corps, lien } = element;

  // Un post quotidien n'a pas de lien d'article : le pied de post renvoie au site.
  const pied = lien || "";
  const bloc = (c) => [titre, c, pied, tags].filter(Boolean).join("\n\n");

  const variantes = [bloc(corps)];

  const place = limite - bloc("").length - 1;
  if (place > 40) variantes.push(bloc(corps.slice(0, place).trimEnd() + "…"));
  variantes.push(bloc(""), [titre, corps, pied].filter(Boolean).join("\n\n"), titre);

  for (const v of variantes) if (v.length <= limite) return v;
  return titre.slice(0, limite - 1) + "…";
}

function buildSettings(reseau, element) {
  const extra = PLATFORM_SETTINGS[reseau] || {};
  const resolus = Object.fromEntries(
    Object.entries(extra).map(([k, v]) => [k, typeof v === "function" ? v(element) : v])
  );
  return { __type: reseau, ...resolus };
}

async function api(chemin, options = {}) {
  const res = await fetch(`${API_URL}/public/v1${chemin}`, {
    ...options,
    headers: { Authorization: API_KEY, "Content-Type": "application/json", ...options.headers },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  return body ? JSON.parse(body) : null;
}

async function lireJson(fichier, defaut) {
  if (!existsSync(fichier)) return defaut;
  return JSON.parse(await readFile(fichier, "utf-8"));
}

const cacheMedia = new Map();
async function envoyerVisuel(element, format) {
  const url = `${IMAGES_BASE_URL}/img/${element.imageBase}-${format}.png`;
  if (cacheMedia.has(url)) return cacheMedia.get(url);

  const media = await api("/upload-from-url", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
  if (!media?.id || !media?.path) {
    throw new Error(`upload-from-url n'a rien renvoyé d'exploitable pour ${url}`);
  }
  const dto = { id: media.id, path: media.path, alt: element.titre };
  cacheMedia.set(url, dto);
  return dto;
}

// Rassemble articles et posts quotidiens sous une forme commune.
async function collecterElements(siteUrl) {
  const articles = Object.values(await lireJson(SEEN_PATH, {})).map((a) => ({
    cle: a.link,
    type: "article",
    titre: a.title,
    corps: a.description,
    lien: a.link,
    tag: a.tag,
    imageBase: slug(a.link),
    date: a.firstSeen,
    hashtags: [...(HASHTAGS_ARTICLE[a.tag] || [sansAccents(a.tag)]), ...HASHTAGS_COMMUNS],
  }));

  const quotidiens = Object.entries(await lireJson(DAILY_PATH, {})).map(([jour, p]) => ({
    cle: `quotidien:${jour}`,
    type: "quotidien",
    titre: p.hook,
    corps: p.corps,
    lien: siteUrl,
    tag: p.theme,
    imageBase: `quotidien-${jour}`,
    date: p.genereLe,
    hashtags: p.hashtags?.length ? p.hashtags : HASHTAGS_COMMUNS,
  }));

  return [...articles, ...quotidiens];
}

async function main() {
  if (!API_URL || !API_KEY) throw new Error("POSTIZ_API_URL et POSTIZ_API_KEY sont requis.");

  const horaires = await lireJson(HORAIRES_PATH, { reseaux: {} });
  const elements = await collecterElements("https://cematys.fr/articles.html");
  if (elements.length === 0) {
    console.log("Rien à publier — lancer generate-rss ou generate-daily-post.");
    return 0;
  }

  const premierLancement = !existsSync(PUBLISHED_PATH);
  const publies = await lireJson(PUBLISHED_PATH, {});

  // Au tout premier lancement, l'historique du site est marqué comme déjà relayé :
  // sans ça, brancher l'outil déverserait tous les articles d'un coup.
  if (premierLancement && !INCLUDE_EXISTING) {
    const rattrapage = Object.fromEntries(
      elements
        .filter((e) => e.type === "article")
        .map((e) => [e.cle, { titre: e.titre, rattrape: true, reseaux: {} }])
    );
    if (!DRY_RUN) {
      await writeFile(PUBLISHED_PATH, JSON.stringify(rattrapage, null, 2) + "\n", "utf-8");
    }
    console.log(
      `Premier lancement : ${Object.keys(rattrapage).length} articles existants marqués ` +
        `comme déjà relayés (aucun envoi). Utiliser --include-existing pour les publier.`
    );
    return 0;
  }

  const comptes = (await api("/integrations")).filter((i) => !EXCLUS.has(i.identifier));
  if (comptes.length === 0) {
    throw new Error("Aucun compte social exploitable (tous exclus ou aucun connecté).");
  }
  console.log(`Comptes : ${comptes.map((i) => i.identifier).join(", ")}`);
  if (EXCLUS.size) console.log(`Exclus : ${[...EXCLUS].join(", ")}`);

  const restants = (e) => {
    const suivi = publies[e.cle];
    if (!suivi) return comptes;
    if (suivi.rattrape) return [];
    return comptes.filter((i) => !suivi.reseaux?.[i.identifier]?.ok);
  };

  const aTraiter = elements
    .filter((e) => restants(e).length > 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, LIMIT);

  if (aTraiter.length === 0) {
    console.log("Rien à publier : tout est déjà relayé.");
    return 0;
  }

  let echecs = 0;
  for (const element of aTraiter) {
    console.log(`\n[${element.type}] ${element.titre}`);
    const suivi = publies[element.cle] || { titre: element.titre, reseaux: {} };
    suivi.reseaux = suivi.reseaux || {};

    for (const compte of restants(element)) {
      const reseau = compte.identifier;
      const texte = buildContent(element, reseau);
      const format = IMAGE_FORMAT[reseau];

      // Sans créneau configuré, on publie immédiatement plutôt que de bloquer.
      const creneau = PUBLIER_MAINTENANT ? null : prochainCreneau(reseau, horaires);
      const quand = creneau ? creneau.toISOString() : new Date().toISOString();
      const mode = creneau ? "schedule" : "now";

      if (DRY_RUN) {
        const heure = creneau
          ? new Intl.DateTimeFormat("fr-FR", {
              timeZone: horaires.fuseau || "Europe/Paris",
              weekday: "short", day: "2-digit", month: "2-digit",
              hour: "2-digit", minute: "2-digit",
            }).format(creneau)
          : "immédiat";
        console.log(`  [dry-run] ${reseau} — ${heure} — ${texte.length} car.`);
        console.log(texte.replace(/^/gm, "      "));
        continue;
      }

      try {
        let image = [];
        if (format && IMAGES_BASE_URL) {
          image = [await envoyerVisuel(element, format)];
        } else if (MEDIA_REQUIS.has(reseau)) {
          throw new Error(`${reseau} exige un visuel — définir IMAGES_BASE_URL.`);
        }

        await api("/posts", {
          method: "POST",
          body: JSON.stringify({
            type: mode,
            date: quand,
            shortLink: false,
            tags: [],
            posts: [
              {
                integration: { id: compte.id },
                value: [{ content: texte, image }],
                settings: buildSettings(reseau, element),
              },
            ],
          }),
        });

        suivi.reseaux[reseau] = { ok: true, at: new Date().toISOString(), prevu: quand };
        console.log(`  ok  ${reseau} (${texte.length} car., ${mode === "schedule" ? quand : "immédiat"})`);
      } catch (err) {
        suivi.reseaux[reseau] = { ok: false, error: err.message, at: new Date().toISOString() };
        echecs++;
        console.error(`  ECHEC ${reseau} : ${err.message}`);
      }
    }

    if (!DRY_RUN) {
      publies[element.cle] = suivi;
      await writeFile(PUBLISHED_PATH, JSON.stringify(publies, null, 2) + "\n", "utf-8");
    }
  }

  if (echecs > 0) {
    console.error(`\n${echecs} publication(s) en échec — la prochaine exécution les réessaiera.`);
    return 1;
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
