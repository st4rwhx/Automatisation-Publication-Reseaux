# Automatisation Publication Réseaux

Quand un nouvel article paraît sur https://cematys.fr/articles.html, il est relayé
automatiquement sur les réseaux sociaux via [Postiz](https://github.com/gitroomhq/postiz-app)
(open source, auto-hébergé, Apache 2.0 — API et webhooks sans limitation en self-hosted).

## Comment ça marche

```
cematys.fr/articles.html
        │  scripts/generate-rss.mjs   (détecte les nouveaux articles)
        ▼
data/seen-articles.json + public/rss.xml
        │  scripts/publish-to-postiz.mjs   (appelle l'API Postiz)
        ▼
     Postiz  ──▶  LinkedIn · Facebook · Instagram · TikTok · YouTube · X …
```

`articles.html` étant du HTML statique sans CMS ni flux, la détection des nouveaux
articles se fait en lisant la page. La date de première détection de chaque article
est mémorisée : un article connu n'est jamais republié, même si son texte change.

## Scripts

```bash
npm run generate-rss    # détecte les articles, écrit public/rss.xml
npm run publish:dry     # montre ce qui serait publié, sans rien envoyer
npm run publish         # publie sur les réseaux connectés
```

`publish` a besoin de `POSTIZ_API_URL` et `POSTIZ_API_KEY`.

## État

| Étape | État |
|---|---|
| Détection des articles + flux RSS | Fait, testé (10 articles détectés) |
| Script de publication via l'API Postiz | Fait, testé de bout en bout |
| Stack Docker Postiz (`infra/`) | Fait, à déployer sur un serveur |
| Serveur + sous-domaine HTTPS | **À faire — voir docs/DEPLOIEMENT.md** |
| Apps développeur des réseaux | **À faire — voir docs/DEPLOIEMENT.md** |

Les deux dernières lignes demandent ton intervention : elles engagent ton identité et
ton entreprise (vérification Meta, audit TikTok, hébergement). Elles sont détaillées
étape par étape dans **[docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md)**.

## À savoir avant de commencer

- **Postiz est lourd** : 7 conteneurs (dont Temporal et Elasticsearch), 4 Go de RAM
  minimum. Ce n'est pas hébergeable sur un mutualisé.
- **Le HTTPS est obligatoire** : les réseaux refusent les callbacks OAuth en HTTP.
- **TikTok et Instagram demandent une validation humaine** de ton app développeur,
  comptez 1 à 3 semaines. LinkedIn et YouTube sont bien plus rapides.
- **TikTok et YouTube sont des plateformes vidéo** : sans production de vidéo, il n'y
  a rien à y publier depuis un article texte. LinkedIn et Facebook sont les cibles
  utiles tout de suite.
