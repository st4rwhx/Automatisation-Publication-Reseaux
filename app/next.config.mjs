import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Le repo a deux package-lock.json (racine = scripts d'automatisation, app/ =
  // cette application) : on fixe explicitement la racine pour lever l'ambiguïté.
  outputFileTracingRoot: __dirname,
  // @resvg/resvg-js embarque un binaire natif (.node) : Webpack ne sait pas le
  // parser et ne doit pas essayer de le bundler, seulement le require() tel quel.
  serverExternalPackages: ["@resvg/resvg-js"],
  // generateImage.ts construit le chemin des polices dynamiquement (template
  // literal) : Next ne peut pas le détecter statiquement pour le bundle
  // serverless, on le déclare donc explicitement.
  outputFileTracingIncludes: {
    "/api/cron/generate/**": ["./assets/fonts/**"],
  },
};

export default nextConfig;
