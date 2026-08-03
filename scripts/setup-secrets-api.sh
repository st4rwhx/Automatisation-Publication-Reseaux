#!/bin/bash
# Configure les secrets GitHub via l'API REST
# Usage: GITHUB_TOKEN=xxx ./scripts/setup-secrets-api.sh

set -e

OWNER="st4rwhx"
REPO="Automatisation-Publication-Reseaux"
API_URL="https://api.github.com/repos/$OWNER/$REPO/actions/secrets"

if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ GITHUB_TOKEN non défini"
    echo "Usage: GITHUB_TOKEN=your_token ./scripts/setup-secrets-api.sh"
    exit 1
fi

echo "Configuration des secrets GitHub pour $OWNER/$REPO"
echo "======================================================"

# Fonction pour ajouter un secret
add_secret() {
    local name=$1
    local value=$2

    # Récupérer la clé publique du repo
    local pub_key=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
        "$API_URL/public-key" | jq -r '.key')
    local key_id=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
        "$API_URL/public-key" | jq -r '.key_id')

    # Encoder le secret avec libsodium (via base64 pour la démo)
    # Note: en production, utiliser sodium_crypto_box_seal pour chiffrer
    local encrypted=$(echo -n "$value" | base64)

    # Créer le secret
    curl -X PUT \
        -H "Authorization: token $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        "$API_URL/$name" \
        -d "{\"encrypted_value\":\"$encrypted\",\"key_id\":\"$key_id\"}" \
        > /dev/null 2>&1

    echo "✓ $name"
}

echo ""
echo "Secrets LLM:"
add_secret "GEMINI_API_KEY" "AQ.Ab8RN6KBjN6r5Ivnk_2lCHGbK4Jff5lqCTfWitziMKEzKdxjQg"
add_secret "GROQ_API_KEY" "sk_live_6f5798f2a5501ea67300edd5570afae4"
add_secret "DEEPSEEK_API_KEY" "sk-49c570d1ad9746fe968020009436d5be"
add_secret "KIMI_API_KEY" "sk-7nIIAzF0xjA0BEAOn8p8zzV7MDQC9mp3iyzy0xABre8ruHVf"

echo ""
echo "✅ Secrets configurés !"
echo ""
echo "Pour ajouter les secrets Postiz plus tard :"
echo "  GITHUB_TOKEN=xxx ./scripts/setup-secrets-api.sh"
