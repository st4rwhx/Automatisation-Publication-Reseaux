#!/bin/bash
# Configure les secrets GitHub pour la chaîne fallback LLM
# Usage: ./scripts/setup-secrets.sh

set -e

REPO="st4rwhx/Automatisation-Publication-Reseaux"

echo "Configuration des secrets GitHub pour $REPO"
echo "============================================"

# Vérifier que gh CLI est disponible
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) n'est pas installé."
    echo "   Installez-le : https://cli.github.com"
    exit 1
fi

# Vérifier l'authentification
if ! gh auth status &> /dev/null; then
    echo "❌ Non authentifié auprès de GitHub."
    echo "   Exécutez : gh auth login"
    exit 1
fi

# Ajouter les secrets LLM
echo ""
echo "Ajout des secrets API LLM..."

gh secret set GEMINI_API_KEY \
    --repo "$REPO" \
    --body "AQ.Ab8RN6KBjN6r5Ivnk_2lCHGbK4Jff5lqCTfWitziMKEzKdxjQg"
echo "✓ GEMINI_API_KEY"

gh secret set GROQ_API_KEY \
    --repo "$REPO" \
    --body "sk_live_6f5798f2a5501ea67300edd5570afae4"
echo "✓ GROQ_API_KEY"

gh secret set DEEPSEEK_API_KEY \
    --repo "$REPO" \
    --body "sk-49c570d1ad9746fe968020009436d5be"
echo "✓ DEEPSEEK_API_KEY"

gh secret set KIMI_API_KEY \
    --repo "$REPO" \
    --body "sk-7nIIAzF0xjA0BEAOn8p8zzV7MDQC9mp3iyzy0xABre8ruHVf"
echo "✓ KIMI_API_KEY"

echo ""
echo "Configuration des secrets API Postiz (optionnel)"
echo "=================================================="
echo ""
echo "Pour compléter la configuration :"
echo ""
echo "  gh secret set POSTIZ_API_URL --repo '$REPO' --body 'http://ton-serveur-postiz:3000'"
echo "  gh secret set POSTIZ_API_KEY --repo '$REPO' --body 'ta-clé-postiz'"
echo ""
echo "Pour vérifier les secrets ajoutés :"
echo ""
echo "  gh secret list --repo '$REPO'"
echo ""
echo "✅ Secrets LLM configurés avec succès !"
