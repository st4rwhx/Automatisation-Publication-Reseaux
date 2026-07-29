#!/usr/bin/env node
// Publie sur les réseaux sociaux les articles détectés par generate-rss.mjs et pas encore relayés.
//
//   POSTIZ_API_URL=https://social.cematys.fr POSTIZ_API_KEY=xxx node scripts/publish-to-postiz.mjs
//
// Options :
//   --dry-run            n'appelle pas l'API, affiche ce qui serait publié
//   --include-existing   publie aussi les articles déjà en ligne au moment du 1er lancement
//   --limit N            ne traite que N articles au maximum sur ce passage
//
// Garde-fou : au tout premier lancement, les articles déjà présents sur le site sont
// marqués comme publiés sans être envoyés. Sans ça, brancher l'outil enverrait d'un coup
// tout l'historique sur tous les réseaux. --include-existing lève ce garde-fou.
//
// Chaque réseau reçoit son propre appel API : un refus de X (limite de caractères,
// quota) n'empêche pas la publication sur LinkedIn. L'état est suivi réseau par réseau,
// donc un nouveau passage ne réessaie que ce qui a échoué.

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SEEN_PATH = path.join(ROOT, "data", "seen-articles.json");
const PUBLISHED_PATH = path.join(ROOT, "data", "published.json");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const INCLUDE_EXISTING = args.includes("--include-existing");
const limitFlag = args.indexOf("--limit");
const LIMIT = limitFlag !== -1 ? Number(args[limitFlag + 1]) : Infinity;

const API_URL = (process.env.POSTIZ_API_URL || "").replace(/\/$/, "");
const API_KEY = process.env.POSTIZ_API_KEY || "";
// Base publique où sont hébergés les visuels (GitHub Pages). Postiz va les y chercher.
const IMAGES_BASE_URL = (process.env.IMAGES_BASE_URL || "").replace(/\/$/, "");

// Format de visuel attendu par chaque réseau.
// Instagram et TikTok refusent un post sans média : pour eux le visuel est obligatoire.
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
const MEDIA_REQUIRED = new Set(["instagram", "tiktok", "pinterest"]);

// Hashtags par catégorie d'article, en complément des hashtags génériques.
const HASHTAGS = {
  "Sécurité": ["cybersecurite", "ransomware", "securiteinformatique"],
  "Coûts": ["productivite", "gestion"],
  "Sauvegarde": ["sauvegarde", "backup", "continuite"],
  "Infogérance": ["infogerance", "supportIT"],
  "Étude de cas": ["retourdexperience", "temoignage"],
  "Prévention": ["prevention", "bonnespratiques"],
  "Maintenance": ["maintenance", "infrastructure"],
};
const HASHTAGS_COMMUNS = ["informatique", "PME", "Lyon"];

// Nombre de caractères accepté par réseau. Le texte est adapté pour tenir dedans.
const LIMITS = {
  x: 280,
  bluesky: 300,
  mastodon: 500,
  threads: 500,
  pinterest: 500,
  instagram: 2200,
  tiktok: 2200,
  linkedin: 3000,
  youtube: 5000,
  facebook: 63206,
};
const DEFAULT_LIMIT = 2000;

// Réglages exigés en plus de __type par certaines plateformes.
// Les réseaux absents de cette table reçoivent seulement { __type }.
const PLATFORM_SETTINGS = {
  // Pour un post photo, TikTok prend le titre dans settings.title (tronqué à 90 par
  // Postiz) et le corps du post dans description. duet/stitch/video_made_with_ai ne
  // s'appliquent qu'aux vidéos et sont ignorés ici.
  tiktok: {
    title: (a) => a.title.slice(0, 90),
    privacy_level: "PUBLIC_TO_EVERYONE",
    comment: true,
    autoAddMusic: "yes",
    brand_content_toggle: false,
    brand_organic_toggle: false,
  },
  pinterest: { title: (a) => a.title.slice(0, 100) },
  reddit: { subreddit: [] },
};

function hashtag(tag) {
  return tag
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "");
}

// Construit le texte le plus complet qui tienne dans la limite du réseau.
// Le titre et le lien sont prioritaires : on retire d'abord les hashtags,
// puis le résumé, et en dernier recours on rogne le titre.
function buildContent(article, identifier) {
  const limit = LIMITS[identifier] ?? DEFAULT_LIMIT;
  const { title, description, link } = article;
  const tags = [...(HASHTAGS[article.tag] || [hashtag(article.tag)]), ...HASHTAGS_COMMUNS]
    .map((t) => `#${t}`)
    .join(" ");

  const variantes = [`${title}\n\n${description}\n\n${link}\n\n${tags}`];

  // Sur les réseaux courts (X), le texte complet ne passe pas. Plutôt que de sacrifier
  // les hashtags, qui portent la visibilité, on rogne le résumé pour les conserver.
  const placeResume = limit - `${title}\n\n\n\n${link}\n\n${tags}`.length - 1;
  if (placeResume > 40) {
    variantes.push(
      `${title}\n\n${description.slice(0, placeResume).trimEnd()}…\n\n${link}\n\n${tags}`
    );
  }
  variantes.push(
    `${title}\n\n${link}\n\n${tags}`,
    `${title}\n\n${description}\n\n${link}`,
    `${title}\n\n${link}`
  );

  for (const v of variantes) {
    if (v.length <= limit) return v;
  }

  const place = limit - `\n\n${link}`.length - 1;
  return `${title.slice(0, Math.max(0, place))}…\n\n${link}`;
}

function buildSettings(identifier, article) {
  const extra = PLATFORM_SETTINGS[identifier] || {};
  const resolved = Object.fromEntries(
    Object.entries(extra).map(([k, v]) => [k, typeof v === "function" ? v(article) : v])
  );
  return { __type: identifier, ...resolved };
}

async function api(pathname, options = {}) {
  const res = await fetch(`${API_URL}/public/v1${pathname}`, {
    ...options,
    headers: {
      Authorization: API_KEY,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return body ? JSON.parse(body) : null;
}

async function loadJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, "utf-8"));
}

function slug(link) {
  return path
    .basename(new URL(link).pathname)
    .replace(/\.html?$/, "")
    .replace(/[^a-zA-Z0-9-]/g, "");
}

// Fait récupérer le visuel par Postiz depuis son URL publique et renvoie le média
// à joindre au post. Le résultat est mémorisé : deux réseaux partageant le même
// format ne provoquent qu'un seul upload.
const mediaCache = new Map();
async function uploadImage(article, format) {
  const url = `${IMAGES_BASE_URL}/img/${slug(article.link)}-${format}.png`;
  if (mediaCache.has(url)) return mediaCache.get(url);

  const media = await api("/upload-from-url", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
  if (!media?.id || !media?.path) {
    throw new Error(`upload-from-url n'a pas renvoyé de média exploitable pour ${url}`);
  }
  const dto = { id: media.id, path: media.path, alt: article.title };
  mediaCache.set(url, dto);
  return dto;
}

async function main() {
  if (!API_URL || !API_KEY) {
    throw new Error("POSTIZ_API_URL et POSTIZ_API_KEY sont requis.");
  }

  const seen = await loadJson(SEEN_PATH, {});
  const articles = Object.values(seen);
  if (articles.length === 0) {
    console.log("Aucun article connu — lancer d'abord `npm run generate-rss`.");
    return 0;
  }

  const firstRun = !existsSync(PUBLISHED_PATH);
  const published = await loadJson(PUBLISHED_PATH, {});

  if (firstRun && !INCLUDE_EXISTING) {
    const backfill = Object.fromEntries(
      articles.map((a) => [a.link, { title: a.title, backfilled: true, platforms: {} }])
    );
    if (!DRY_RUN) {
      await writeFile(PUBLISHED_PATH, JSON.stringify(backfill, null, 2) + "\n", "utf-8");
    }
    console.log(
      `Premier lancement : ${articles.length} articles existants marqués comme déjà relayés ` +
        `(aucun envoi). Les prochains nouveaux articles seront publiés.\n` +
        `Pour les publier quand même : --include-existing`
    );
    return 0;
  }

  const integrations = await api("/integrations");
  if (!Array.isArray(integrations) || integrations.length === 0) {
    throw new Error("Aucun compte social connecté dans Postiz.");
  }
  console.log(
    `${integrations.length} compte(s) connecté(s) : ${integrations.map((i) => i.identifier).join(", ")}`
  );

  // Un article reste à traiter tant qu'il n'est pas relayé sur tous les réseaux connectés.
  // Connecter un nouveau réseau plus tard ne rattrape pas l'historique déjà marqué.
  const restant = (article) => {
    const e = published[article.link];
    if (!e) return integrations;
    if (e.backfilled) return [];
    return integrations.filter((i) => !e.platforms?.[i.identifier]?.ok);
  };

  const pending = articles
    .filter((a) => restant(a).length > 0)
    .sort((a, b) => new Date(a.firstSeen) - new Date(b.firstSeen))
    .slice(0, LIMIT);

  if (pending.length === 0) {
    console.log("Rien à publier : tous les articles connus ont déjà été relayés.");
    return 0;
  }

  let echecs = 0;
  for (const article of pending) {
    console.log(`\n${article.title}`);
    const entry = published[article.link] || { title: article.title, platforms: {} };
    entry.platforms = entry.platforms || {};

    for (const integration of restant(article)) {
      const id = integration.identifier;
      const content = buildContent(article, id);
      const format = IMAGE_FORMAT[id];

      if (DRY_RUN) {
        const visuel = format ? `${slug(article.link)}-${format}.png` : "aucun";
        console.log(
          `  [dry-run] ${id} (${content.length} car., visuel ${visuel})\n${content.replace(/^/gm, "    ")}`
        );
        continue;
      }

      try {
        let image = [];
        if (format && IMAGES_BASE_URL) {
          image = [await uploadImage(article, format)];
        } else if (MEDIA_REQUIRED.has(id)) {
          // Publier sans média sur ces réseaux est refusé côté plateforme :
          // mieux vaut un échec explicite qu'un appel voué à l'erreur.
          throw new Error(
            `${id} exige un visuel — définir IMAGES_BASE_URL et lancer generate-images.`
          );
        }

        const payload = {
          type: "now",
          date: new Date().toISOString(),
          shortLink: false,
          tags: [],
          posts: [
            {
              integration: { id: integration.id },
              value: [{ content, image }],
              settings: buildSettings(id, article),
            },
          ],
        };

        await api("/posts", { method: "POST", body: JSON.stringify(payload) });
        entry.platforms[id] = { ok: true, at: new Date().toISOString() };
        console.log(`  ok  ${id} (${content.length} car.)`);
      } catch (err) {
        entry.platforms[id] = { ok: false, error: err.message, at: new Date().toISOString() };
        echecs++;
        console.error(`  ECHEC ${id} : ${err.message}`);
      }
    }

    if (!DRY_RUN) {
      published[article.link] = entry;
      await writeFile(PUBLISHED_PATH, JSON.stringify(published, null, 2) + "\n", "utf-8");
    }
  }

  if (echecs > 0) {
    console.error(`\n${echecs} publication(s) en échec — relancer réessaiera uniquement celles-ci.`);
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
