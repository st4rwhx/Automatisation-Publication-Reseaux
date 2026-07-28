#!/usr/bin/env node
// Publie sur les réseaux sociaux les articles détectés par generate-rss.mjs et pas encore relayés.
//
//   POSTIZ_API_URL=https://social.cematys.fr POSTIZ_API_KEY=xxx node scripts/publish-to-postiz.mjs
//
// Options :
//   --dry-run            n'appelle pas l'API, affiche ce qui serait publié
//   --include-existing   publie aussi les articles déjà en ligne au moment du 1er lancement
//   --limit N            ne publie que N articles au maximum sur ce passage
//
// Garde-fou : au tout premier lancement, les articles déjà présents sur le site sont
// marqués comme publiés sans être envoyés. Sans ça, brancher l'outil enverrait d'un coup
// les 10 articles de l'historique sur tous les réseaux. --include-existing lève ce garde-fou.

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

// Réglages exigés en plus de __type par certaines plateformes.
// Les réseaux absents de cette table reçoivent seulement { __type }.
const PLATFORM_SETTINGS = {
  youtube: { title: (a) => a.title.slice(0, 100), type: "public" },
  tiktok: {
    privacy_level: "PUBLIC_TO_EVERYONE",
    disclose: false,
    brand_content_toggle: false,
    brand_organic_toggle: false,
  },
  pinterest: { title: (a) => a.title.slice(0, 100) },
  reddit: { subreddit: [] },
};

function buildContent(article) {
  const hashtag = article.tag
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "");
  return `${article.title}\n\n${article.description}\n\n${article.link}\n\n#${hashtag} #informatique #PME #Lyon`;
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
    throw new Error(`${options.method || "GET"} ${pathname} → HTTP ${res.status}: ${body}`);
  }
  return body ? JSON.parse(body) : null;
}

async function loadJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, "utf-8"));
}

async function main() {
  if (!API_URL || !API_KEY) {
    throw new Error("POSTIZ_API_URL et POSTIZ_API_KEY sont requis.");
  }

  const seen = await loadJson(SEEN_PATH, {});
  const articles = Object.values(seen);
  if (articles.length === 0) {
    console.log("Aucun article connu — lancer d'abord `npm run generate-rss`.");
    return;
  }

  const firstRun = !existsSync(PUBLISHED_PATH);
  const published = await loadJson(PUBLISHED_PATH, {});

  if (firstRun && !INCLUDE_EXISTING) {
    const backfill = Object.fromEntries(
      articles.map((a) => [a.link, { title: a.title, publishedAt: null, backfilled: true }])
    );
    if (!DRY_RUN) {
      await writeFile(PUBLISHED_PATH, JSON.stringify(backfill, null, 2) + "\n", "utf-8");
    }
    console.log(
      `Premier lancement : ${articles.length} articles existants marqués comme déjà relayés ` +
        `(aucun envoi). Les prochains nouveaux articles seront publiés.\n` +
        `Pour les publier quand même : --include-existing`
    );
    return;
  }

  const pending = articles
    .filter((a) => !published[a.link])
    .sort((a, b) => new Date(a.firstSeen) - new Date(b.firstSeen))
    .slice(0, LIMIT);

  if (pending.length === 0) {
    console.log("Rien à publier : tous les articles connus ont déjà été relayés.");
    return;
  }

  const integrations = await api("/integrations");
  if (!Array.isArray(integrations) || integrations.length === 0) {
    throw new Error("Aucun compte social connecté dans Postiz.");
  }
  console.log(
    `${integrations.length} compte(s) connecté(s) : ${integrations.map((i) => i.identifier).join(", ")}`
  );

  for (const article of pending) {
    const content = buildContent(article);
    const payload = {
      type: "now",
      date: new Date().toISOString(),
      shortLink: false,
      tags: [],
      posts: integrations.map((integration) => ({
        integration: { id: integration.id },
        value: [{ content, image: [] }],
        settings: buildSettings(integration.identifier, article),
      })),
    };

    if (DRY_RUN) {
      console.log(`\n[dry-run] ${article.title}\n${content}\n`);
      continue;
    }

    await api("/posts", { method: "POST", body: JSON.stringify(payload) });
    published[article.link] = {
      title: article.title,
      publishedAt: new Date().toISOString(),
      platforms: integrations.map((i) => i.identifier),
    };
    await writeFile(PUBLISHED_PATH, JSON.stringify(published, null, 2) + "\n", "utf-8");
    console.log(`Publié : ${article.title}`);
  }

  if (DRY_RUN) console.log(`\n${pending.length} article(s) seraient publiés.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
