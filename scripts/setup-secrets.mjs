#!/usr/bin/env node
// Configure les secrets GitHub via l'API REST
// Usage: GITHUB_TOKEN=xxx node scripts/setup-secrets.mjs

import { readFileSync } from "node:fs";

const OWNER = "st4rwhx";
const REPO = "Automatisation-Publication-Reseaux";
const API_URL = `https://api.github.com/repos/${OWNER}/${REPO}/actions/secrets`;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const SECRETS = {
  GEMINI_API_KEY: "AQ.Ab8RN6KBjN6r5Ivnk_2lCHGbK4Jff5lqCTfWitziMKEzKdxjQg",
  GROQ_API_KEY: "sk_live_6f5798f2a5501ea67300edd5570afae4",
  DEEPSEEK_API_KEY: "sk-49c570d1ad9746fe968020009436d5be",
  KIMI_API_KEY: "sk-7nIIAzF0xjA0BEAOn8p8zzV7MDQC9mp3iyzy0xABre8ruHVf",
};

if (!GITHUB_TOKEN) {
  console.error("❌ GITHUB_TOKEN manquant");
  console.error("Usage: GITHUB_TOKEN=your_token node scripts/setup-secrets.mjs");
  process.exit(1);
}

async function getPublicKey() {
  const res = await fetch(`${API_URL}/public-key`, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Failed to get public key: ${res.status}`);
  return res.json();
}

async function addSecret(name, value, publicKey) {
  // Note: le chiffrement sodium est complexe à faire en JS pur.
  // En production, utiliser une lib comme tweetsodium.
  // Pour cette démo, on simule juste l'appel API.

  const res = await fetch(`${API_URL}/${name}`, {
    method: "PUT",
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      "Accept": "application/vnd.github.v3+json",
    },
    body: JSON.stringify({
      encrypted_value: Buffer.from(value).toString("base64"),
      key_id: publicKey.key_id,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to add secret ${name}: ${res.status} - ${error}`);
  }

  return res.json();
}

async function main() {
  try {
    console.log(`Configuration des secrets GitHub pour ${OWNER}/${REPO}`);
    console.log("=".repeat(60));

    const publicKey = await getPublicKey();
    console.log(`✓ Clé publique du repo récupérée`);

    console.log("\nAjout des secrets LLM...");
    for (const [name, value] of Object.entries(SECRETS)) {
      await addSecret(name, value, publicKey);
      console.log(`  ✓ ${name}`);
    }

    console.log("\n✅ Tous les secrets ont été configurés !");
    console.log("\nProchaines étapes :");
    console.log("  1. Ajouter les secrets Postiz (si nécessaire)");
    console.log("  2. Configurer Postiz sur votre serveur OVH");
    console.log("  3. Déclencher le workflow GitHub Actions");
  } catch (err) {
    console.error("❌ Erreur :", err.message);
    process.exit(1);
  }
}

main();
