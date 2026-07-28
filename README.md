# Automatisation Publication Réseaux

Objectif : quand un nouvel article est publié sur https://cematys.fr/articles.html,
il est automatiquement relayé sur les réseaux sociaux (LinkedIn, Instagram, TikTok,
YouTube, Facebook, X...) via [Postiz](https://github.com/gitroomhq/postiz-app)
(auto-hébergé, open source).

## Étape 1 — Flux RSS des articles (fait)

`scripts/generate-rss.mjs` télécharge `articles.html`, détecte les articles présents
dans les cartes de la page, et génère `public/rss.xml`. La date de première détection
de chaque article est mémorisée dans `data/seen-articles.json` : un article déjà connu
n'est jamais republié, même si son texte est modifié plus tard.

```bash
npm run generate-rss
```

Le workflow `.github/workflows/generate-rss.yml` exécute ce script toutes les 2 heures
et publie `public/` sur GitHub Pages.

### Mise en route (une seule fois)

1. Pousser ce dépôt sur GitHub (branche `main` ou celle utilisée par défaut).
2. Dans **Settings → Pages** du dépôt, choisir **Source : GitHub Actions**.
3. Lancer le workflow une première fois manuellement (**Actions → Générer et publier
   le flux RSS des articles → Run workflow**) pour obtenir l'URL de Pages, généralement
   `https://<utilisateur>.github.io/<depot>/rss.xml`.

## Étape 2 — Déployer Postiz (à faire)

Postiz auto-hébergé (Docker) pour connecter les comptes sociaux et brancher le flux RSS
ci-dessus dans sa fonctionnalité "RSS → post automatique".

## Étape 3 — Comptes développeur par plateforme (à faire)

LinkedIn et YouTube sont simples à activer. Instagram/Facebook (Meta) et TikTok
nécessitent la création d'une app développeur et une validation par la plateforme
avant de pouvoir publier automatiquement.
