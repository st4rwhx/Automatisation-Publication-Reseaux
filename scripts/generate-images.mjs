#!/usr/bin/env node
// Génère un visuel de marque CEMATYS par article, dans les formats attendus par les réseaux.
//
//   node scripts/generate-images.mjs [--force]
//
// Instagram et TikTok refusent un post sans média : ces visuels ne sont pas décoratifs,
// ils conditionnent la publication. Les articles du site n'ayant pas d'og:image, on
// fabrique une carte à partir du titre et de la catégorie.
//
// Deux formats par article :
//   - carre   1080x1350 (4:5) — Instagram, TikTok
//   - paysage 1200x628        — LinkedIn, X
//
// Les fichiers vont dans public/img/, publiés avec le flux RSS sur GitHub Pages, d'où
// Postiz les récupère via son endpoint upload-from-url.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { chargerProfil } from "./lib/profil.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SEEN_PATH = path.join(ROOT, "data", "seen-articles.json");
const DAILY_PATH = path.join(ROOT, "data", "daily-posts.json");
const OUT_DIR = path.join(ROOT, "public", "img");
const FONT_DIR = path.join(ROOT, "assets", "fonts");

const FORCE = process.argv.includes("--force");

// Charte reprise de cematys.fr/style.css
const C = {
  ink: "#1B2E44",
  ink2: "#24405C",
  paper: "#F6F7FA",
  teal: "#3E6693",
  amber: "#C03743",
  muted: "#9AA7BC",
};

const FORMATS = {
  // titleSize est la taille idéale ; elle est réduite si le titre est trop long.
  // titleSpace = hauteur réellement disponible pour le titre, une fois l'étiquette,
  // le pied de carte et les marges retirés.
  carre: {
    width: 1080, height: 1350, padding: 80,
    titleSize: 78, titleMin: 44, titleSpace: 1000, tagSize: 30, brandSize: 34,
  },
  paysage: {
    width: 1200, height: 628, padding: 72,
    titleSize: 62, titleMin: 30, titleSpace: 340, tagSize: 26, brandSize: 30,
  },
};

const LINE_HEIGHT = 1.15;
// Largeur moyenne d'un caractère en Manrope 800, relative à la taille de police.
// Mesurée empiriquement sur les titres du site ; sert uniquement à estimer le
// nombre de lignes, une légère marge d'erreur est absorbée par titleSpace.
const CHAR_RATIO = 0.52;

// Réduit la taille du titre jusqu'à ce qu'il tienne dans l'espace disponible.
// Sans ça, un titre long chevauche le pied de carte.
function fitTitleSize(title, fmt) {
  const contentWidth = fmt.width - fmt.padding * 2;
  for (let size = fmt.titleSize; size > fmt.titleMin; size -= 2) {
    const charsPerLine = Math.max(1, Math.floor(contentWidth / (size * CHAR_RATIO)));
    const lines = Math.ceil(title.length / charsPerLine);
    if (lines * size * LINE_HEIGHT <= fmt.titleSpace) return size;
  }
  return fmt.titleMin;
}

function slug(link) {
  return path
    .basename(new URL(link).pathname)
    .replace(/\.html?$/, "")
    .replace(/[^a-zA-Z0-9-]/g, "");
}

// satori n'accepte pas de JSX ici : on décrit l'arbre à la main.
function card(article, fmt, marque) {
  const { tagSize, brandSize } = fmt;
  const titleSize = fitTitleSize(article.title, fmt);
  return {
    type: "div",
    props: {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: C.ink,
        // Léger dégradé pour éviter un aplat trop plat sur les grands formats.
        backgroundImage: `linear-gradient(135deg, ${C.ink} 0%, ${C.ink2} 100%)`,
        padding: fmt.padding,
        fontFamily: "Inter",
      },
      children: [
        // Étiquette de catégorie
        {
          type: "div",
          props: {
            style: { display: "flex" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    backgroundColor: C.amber,
                    color: "#FFFFFF",
                    fontFamily: "Manrope",
                    fontSize: tagSize,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    padding: `${Math.round(tagSize * 0.45)}px ${Math.round(tagSize * 0.9)}px`,
                    borderRadius: 6,
                  },
                  children: article.tag,
                },
              },
            ],
          },
        },
        // Titre
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              color: "#FFFFFF",
              fontFamily: "Manrope",
              fontSize: titleSize,
              fontWeight: 800,
              lineHeight: LINE_HEIGHT,
              letterSpacing: -1,
            },
            children: article.title,
          },
        },
        // Pied : marque + accent
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    width: 90,
                    height: 6,
                    backgroundColor: C.teal,
                    marginBottom: 26,
                  },
                  children: "",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          color: "#FFFFFF",
                          fontFamily: "Manrope",
                          fontSize: brandSize,
                          fontWeight: 800,
                          letterSpacing: 3,
                        },
                        children: marque.nom,
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          color: C.muted,
                          fontSize: Math.round(brandSize * 0.75),
                          fontWeight: 500,
                        },
                        children: marque.site,
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };
}

async function lireJson(fichier) {
  if (!existsSync(fichier)) return {};
  return JSON.parse(await readFile(fichier, "utf-8"));
}

async function main() {
  const profil = await chargerProfil();
  const marque = {
    nom: profil.nom,
    site: profil.site ? profil.site.replace(/^https?:\/\//, "") : "",
  };

  // Deux sources de visuels : les articles du site, et les posts quotidiens
  // générés pour les réseaux. Les deux utilisent la même carte de marque.
  const articles = Object.values(await lireJson(SEEN_PATH)).map((a) => ({
    base: slug(a.link),
    tag: a.tag,
    title: a.title,
  }));

  const quotidiens = Object.entries(await lireJson(DAILY_PATH)).map(([jour, p]) => ({
    base: `quotidien-${jour}`,
    tag: p.theme,
    title: p.visuel,
  }));

  const sujets = [...articles, ...quotidiens];
  if (sujets.length === 0) {
    console.log("Rien à illustrer — lancer d'abord generate-rss ou generate-daily-post.");
    return;
  }

  const fonts = [
    { name: "Manrope", data: await readFile(path.join(FONT_DIR, "Manrope-800.woff")), weight: 800, style: "normal" },
    { name: "Inter", data: await readFile(path.join(FONT_DIR, "Inter-500.woff")), weight: 500, style: "normal" },
  ];

  await mkdir(OUT_DIR, { recursive: true });
  let crees = 0;
  let ignores = 0;

  for (const sujet of sujets) {
    const base = sujet.base;
    for (const [nom, fmt] of Object.entries(FORMATS)) {
      const dest = path.join(OUT_DIR, `${base}-${nom}.png`);
      if (existsSync(dest) && !FORCE) {
        ignores++;
        continue;
      }
      const svg = await satori(card(sujet, fmt, marque), {
        width: fmt.width,
        height: fmt.height,
        fonts,
      });
      const png = new Resvg(svg, { fitTo: { mode: "width", value: fmt.width } })
        .render()
        .asPng();
      await writeFile(dest, png);
      crees++;
    }
  }

  console.log(
    `Visuels : ${crees} généré(s), ${ignores} déjà présent(s).` +
      (ignores && !FORCE ? " Utiliser --force pour tout regénérer." : "")
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
