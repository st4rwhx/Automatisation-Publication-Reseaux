import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Le repo a deux package-lock.json (racine = scripts d'automatisation, app/ =
  // cette application) : on fixe explicitement la racine pour lever l'ambiguïté.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
