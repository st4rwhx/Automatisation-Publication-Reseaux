# 🚀 Démarrage Rapide

**5 minutes pour mettre en place l'automatisation complète.**

## ✅ Étape 1 : Configurer les Secrets (2 min)

### Via GitHub Web (le plus simple)

1. Allez sur **Settings → Secrets and variables → Actions**
2. Cliquez **New repository secret** et ajoutez ces 4 secrets :

| Nom | Valeur |
|-----|--------|
| `GEMINI_API_KEY` | `AQ.Ab8RN6KBjN6r5Ivnk_2lCHGbK4Jff5lqCTfWitziMKEzKdxjQg` |
| `GROQ_API_KEY` | `sk_live_6f5798f2a5501ea67300edd5570afae4` |
| `DEEPSEEK_API_KEY` | `sk-49c570d1ad9746fe968020009436d5be` |
| `KIMI_API_KEY` | `sk-7nIIAzF0xjA0BEAOn8p8zzV7MDQC9mp3iyzy0xABre8ruHVf` |

✅ **Les secrets LLM sont maintenant configurés.**

## ✅ Étape 2 : Activer GitHub Pages (1 min)

1. Settings → Pages
2. Branch : `main`, dossier : `/ (root)`
3. Attendez 1-2 min pour que le site soit live

Votre URL sera : `https://st4rwhx.github.io/Automatisation-Publication-Reseaux`

## ✅ Étape 3 : Configurer les Secrets Postiz (1 min)

Pour publier sur les réseaux, ajoutez 2 secrets supplémentaires :

| Nom | Valeur |
|-----|--------|
| `POSTIZ_API_URL` | `http://192.168.x.x:3000` (ou votre URL OVH) |
| `POSTIZ_API_KEY` | *Votre clé API Postiz* |
| `IMAGES_BASE_URL` | `https://st4rwhx.github.io/Automatisation-Publication-Reseaux` |

## ✅ Étape 4 : Lancer le Workflow (1 min)

1. Allez sur **Actions**
2. Cliquez sur le workflow "Détecter les articles..."
3. Cliquez **Run workflow**

Attendez 5 min. Vous devriez voir :
- ✓ RSS généré
- ✓ Post du jour généré
- ✓ Visuels créés
- ✓ Publications lancées

## 📊 C'est Prêt !

Le workflow s'exécute maintenant **automatiquement toutes les 2 heures**.

Chaque exécution :
- 🔍 Détecte les nouveaux articles sur cematys.fr
- 🤖 Génère un post autonome via IA
- 🎨 Crée les visuels de marque
- 📱 Publie sur LinkedIn, Instagram, TikTok, Facebook

## 🔧 Configuration Avancée

### Ajouter Postiz sur votre serveur OVH

Voir : [DEPLOYMENT_OVH.md](DEPLOYMENT_OVH.md)

### Personnaliser les horaires de publication

Modifiez `config/horaires.json` :

```json
{
  "linkedin": {
    "jours": [2, 3, 4],
    "heures": ["08:30", "14:00"]
  },
  "instagram": {
    "jours": [1, 2, 3, 4, 5],
    "heures": ["12:30", "18:30"]
  }
}
```

### Modifier le profil de marque

Éditez `config/marque.json` pour changer :
- Ton de rédaction
- Thèmes d'articles
- Règles de contenu

## 📖 Documentation Complète

- [README.md](README.md) — Vue d'ensemble du système
- [SETUP_SECRETS.md](SETUP_SECRETS.md) — Configuration détaillée des secrets
- [DEPLOYMENT_OVH.md](DEPLOYMENT_OVH.md) — Déploiement sur OVH

## 🆘 Troubleshooting

**"Aucun provider LLM disponible"**
→ Vérifiez les secrets sont bien définis dans GitHub

**"Postiz connection refused"**
→ Vérifiez l'URL Postiz et la clé API

**"Articles non détectés"**
→ Vérifiez cematys.fr/articles.html est accessible

## 🎯 Prochaines Étapes

1. ✅ Secrets configurés
2. ✅ Workflow en marche
3. ➜ Mettre en place Postiz sur OVH (voir DEPLOYMENT_OVH.md)
4. ➜ Connecter vos réseaux dans Postiz
5. ➜ Valider les premiers posts (optionnel)

C'est tout ! Le système est maintenant **100% automatisé**.
