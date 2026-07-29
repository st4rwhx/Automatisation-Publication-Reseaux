#!/usr/bin/env node
// Scanne https://cematys.fr/articles.html, détecte les nouveaux articles et régénère public/rss.xml.
// L'ordre du flux RSS suit la date de première détection ("firstSeen"), stockée dans data/seen-articles.json,
// pour qu'un article existant ne soit jamais re-publié même si son texte est modifié plus tard.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SOURCE_URL = "https://cematys.fr/articles.html";
const SITE_BASE = "https://cematys.fr/";
const STATE_PATH = path.join(ROOT, "data", "seen-articles.json");
const RSS_PATH = path.join(ROOT, "public", "rss.xml");
const MAX_ITEMS = 30;

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function parseArticleCards(html) {
  const cardRegex =
    /<div class="card">\s*<span class="tag">(.*?)<\/span>\s*<h3>(.*?)<\/h3>\s*<p>(.*?)<\/p>\s*<a href="(.*?)" class="card-link">/gs;

  const articles = [];
  let match;
  while ((match = cardRegex.exec(html)) !== null) {
    const [, tag, title, description, href] = match;
    articles.push({
      tag: decodeHtmlEntities(tag),
      title: decodeHtmlEntities(title),
      description: decodeHtmlEntities(description),
      link: new URL(href, SITE_BASE).toString(),
    });
  }
  return articles;
}

async function loadState() {
  if (!existsSync(STATE_PATH)) return {};
  const raw = await readFile(STATE_PATH, "utf-8");
  return JSON.parse(raw);
}

function buildRss(items) {
  // Daté du dernier article détecté, et non de l'heure courante : le fichier reste
  // identique tant qu'aucun article n'a bougé, ce qui évite un commit à chaque passage.
  const lastBuild = items.length
    ? new Date(Math.max(...items.map((i) => new Date(i.firstSeen)))).toUTCString()
    : new Date(0).toUTCString();
  const entries = items
    .map(
      (item) => `  <item>
    <title>${escapeXml(item.title)}</title>
    <link>${escapeXml(item.link)}</link>
    <guid isPermaLink="true">${escapeXml(item.link)}</guid>
    <category>${escapeXml(item.tag)}</category>
    <description>${escapeXml(item.description)}</description>
    <pubDate>${new Date(item.firstSeen).toUTCString()}</pubDate>
  </item>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>CEMATYS — Articles &amp; conseils</title>
  <link>${SOURCE_URL}</link>
  <description>Conseils et retours d'expérience CEMATYS pour protéger votre entreprise.</description>
  <language>fr-fr</language>
  <lastBuildDate>${lastBuild}</lastBuildDate>
${entries}
</channel>
</rss>
`;
}

async function main() {
  const res = await fetch(SOURCE_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; CematysRssBot/1.0)" },
  });
  if (!res.ok) {
    throw new Error(`Échec du téléchargement de ${SOURCE_URL}: HTTP ${res.status}`);
  }
  const html = await res.text();
  const articles = parseArticleCards(html);
  if (articles.length === 0) {
    throw new Error("Aucun article détecté — la structure de articles.html a peut-être changé.");
  }

  const state = await loadState();
  const nowIso = new Date().toISOString();
  let hasNewArticle = false;

  for (const article of articles) {
    const key = article.link;
    if (!state[key]) {
      state[key] = { ...article, firstSeen: nowIso };
      hasNewArticle = true;
      console.log(`Nouvel article détecté : ${article.title}`);
    } else {
      // Met à jour titre/tag/description si l'article a été édité, en gardant la date de première détection.
      state[key] = { ...article, firstSeen: state[key].firstSeen };
    }
  }

  const items = Object.values(state)
    .sort((a, b) => new Date(b.firstSeen) - new Date(a.firstSeen))
    .slice(0, MAX_ITEMS);

  await mkdir(path.dirname(STATE_PATH), { recursive: true });
  await mkdir(path.dirname(RSS_PATH), { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf-8");
  await writeFile(RSS_PATH, buildRss(items), "utf-8");

  console.log(
    hasNewArticle
      ? "rss.xml régénéré avec au moins un nouvel article."
      : "rss.xml régénéré, aucun nouvel article."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
