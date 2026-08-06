// Port de scripts/generate-images.mjs pour le SaaS : même carte de marque
// (satori → SVG → PNG via Resvg), mais le résultat est uploadé sur Vercel Blob
// au lieu d'être écrit dans public/img/ — chaque utilisateur a ses propres
// visuels, hébergés indépendamment du repo.

import { readFile } from "node:fs/promises";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { put } from "@vercel/blob";

const C = {
  ink: "#1B2E44",
  ink2: "#24405C",
  paper: "#F6F7FA",
  teal: "#3E6693",
  amber: "#C03743",
  muted: "#9AA7BC",
};

interface Format {
  width: number;
  height: number;
  padding: number;
  titleSize: number;
  titleMin: number;
  titleSpace: number;
  tagSize: number;
  brandSize: number;
}

const FORMATS: Record<"carre" | "paysage", Format> = {
  carre: { width: 1080, height: 1350, padding: 80, titleSize: 78, titleMin: 44, titleSpace: 1000, tagSize: 30, brandSize: 34 },
  paysage: { width: 1200, height: 628, padding: 72, titleSize: 62, titleMin: 30, titleSpace: 340, tagSize: 26, brandSize: 30 },
};

const LINE_HEIGHT = 1.15;
const CHAR_RATIO = 0.52;

function fitTitleSize(title: string, fmt: Format): number {
  const contentWidth = fmt.width - fmt.padding * 2;
  for (let size = fmt.titleSize; size > fmt.titleMin; size -= 2) {
    const charsPerLine = Math.max(1, Math.floor(contentWidth / (size * CHAR_RATIO)));
    const lignes = Math.ceil(title.length / charsPerLine);
    if (lignes * size * LINE_HEIGHT <= fmt.titleSpace) return size;
  }
  return fmt.titleMin;
}

function carte(sujet: { titre: string; tag: string }, fmt: Format, marque: { nom: string; site: string }) {
  const { tagSize, brandSize } = fmt;
  const titleSize = fitTitleSize(sujet.titre, fmt);
  return {
    type: "div",
    props: {
      style: {
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        justifyContent: "space-between", backgroundColor: C.ink,
        backgroundImage: `linear-gradient(135deg, ${C.ink} 0%, ${C.ink2} 100%)`,
        padding: fmt.padding, fontFamily: "Inter",
      },
      children: [
        {
          type: "div",
          props: {
            style: { display: "flex" },
            children: [{
              type: "div",
              props: {
                style: {
                  display: "flex", backgroundColor: C.amber, color: "#FFFFFF", fontFamily: "Manrope",
                  fontSize: tagSize, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
                  padding: `${Math.round(tagSize * 0.45)}px ${Math.round(tagSize * 0.9)}px`, borderRadius: 6,
                },
                children: sujet.tag,
              },
            }],
          },
        },
        {
          type: "div",
          props: {
            style: {
              display: "flex", color: "#FFFFFF", fontFamily: "Manrope", fontSize: titleSize,
              fontWeight: 800, lineHeight: LINE_HEIGHT, letterSpacing: -1,
            },
            children: sujet.titre,
          },
        },
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column" },
            children: [
              { type: "div", props: { style: { display: "flex", width: 90, height: 6, backgroundColor: C.teal, marginBottom: 26 }, children: "" } },
              {
                type: "div",
                props: {
                  style: { display: "flex", justifyContent: "space-between", alignItems: "center" },
                  children: [
                    { type: "div", props: { style: { display: "flex", color: "#FFFFFF", fontFamily: "Manrope", fontSize: brandSize, fontWeight: 800, letterSpacing: 3 }, children: marque.nom } },
                    { type: "div", props: { style: { display: "flex", color: C.muted, fontSize: Math.round(brandSize * 0.75), fontWeight: 500 }, children: marque.site } },
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

let fontsCache: any[] | null = null;
async function chargerFonts() {
  if (fontsCache) return fontsCache;
  const fontDir = path.join(process.cwd(), "assets", "fonts");
  fontsCache = [
    { name: "Manrope", data: await readFile(path.join(fontDir, "Manrope-800.woff")), weight: 800 as const, style: "normal" as const },
    { name: "Inter", data: await readFile(path.join(fontDir, "Inter-500.woff")), weight: 500 as const, style: "normal" as const },
  ];
  return fontsCache;
}

async function rendrePng(sujet: { titre: string; tag: string }, formatNom: keyof typeof FORMATS, marque: { nom: string; site: string }) {
  const fmt = FORMATS[formatNom];
  const fonts = await chargerFonts();
  const svg = await satori(carte(sujet, fmt, marque) as any, { width: fmt.width, height: fmt.height, fonts });
  return new Resvg(svg, { fitTo: { mode: "width", value: fmt.width } }).render().asPng();
}

// Génère les deux formats (carré Instagram/TikTok, paysage LinkedIn/Facebook)
// et retourne leurs URLs publiques sur Vercel Blob.
export async function genererVisuels(
  postId: string,
  sujet: { titre: string; tag: string },
  marque: { nom: string; site: string }
): Promise<{ carre: string; paysage: string }> {
  const [carrePng, paysagePng] = await Promise.all([
    rendrePng(sujet, "carre", marque),
    rendrePng(sujet, "paysage", marque),
  ]);

  const [carreBlob, paysageBlob] = await Promise.all([
    put(`posts/${postId}-carre.png`, carrePng, { access: "public", contentType: "image/png" }),
    put(`posts/${postId}-paysage.png`, paysagePng, { access: "public", contentType: "image/png" }),
  ]);

  return { carre: carreBlob.url, paysage: paysageBlob.url };
}
