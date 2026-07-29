# Automatisation Publication Réseaux

Quand un nouvel article paraît sur https://cematys.fr/articles.html, il est relayé
automatiquement sur les réseaux sociaux via [Postiz](https://github.com/gitroomhq/postiz-app)
(open source, auto-hébergé, API et webhooks sans limitation en self-hosted).

## Comment ça marche

```
cematys.fr/articles.html
        │  generate-rss.mjs      détecte les nouveaux articles → public/rss.xml
        │  generate-images.mjs   fabrique un visuel de marque par article
        ▼
GitHub Pages  (flux RSS + visuels accessibles publiquement)
        │  publish-to-postiz.mjs   upload du visuel puis création du post
        ▼
     Postiz  ──▶  LinkedIn · Instagram · TikTok · X
```

`articles.html` étant du HTML statique sans CMS ni flux, la détection se fait en
lisant la page. La date de première détection de chaque article est mémorisée : un
article connu n'est jamais republié, même si son texte change.

## Réseaux couverts

| Réseau | État | Remarque |
|---|---|---|
| LinkedIn | ✅ | Texte + visuel paysage |
| X | ✅ | Texte + visuel paysage. Facturé à l'usage (~0,20 $/post avec lien) |
| Instagram | ✅ | **Visuel obligatoire** (carré 1080×1350) |
| TikTok | ✅ | **Visuel obligatoire** — post photo, aucune vidéo requise |
| YouTube | ❌ | Aucune API pour les posts Communauté. Voir docs/DEPLOIEMENT.md |

## Scripts

```bash
npm run generate-rss      # détecte les articles, écrit public/rss.xml
npm run generate-images   # génère les visuels manquants (--force pour tout refaire)
npm run publish:dry       # montre ce qui serait publié, sans rien envoyer
npm run publish           # publie sur les réseaux connectés
npm run all               # enchaîne les trois
```

`publish` a besoin de `POSTIZ_API_URL`, `POSTIZ_API_KEY` et `IMAGES_BASE_URL`.

## Comportement de publication

- **Un appel par réseau** : un refus de X n'empêche pas la publication sur LinkedIn,
  et un nouveau passage ne réessaie que ce qui a échoué.
- **Texte adapté à chaque réseau** : la limite de 280 caractères de X est respectée
  en rognant le résumé, de façon à conserver les hashtags qui portent la visibilité.
- **Garde-fou au premier lancement** : les articles déjà en ligne sont marqués comme
  relayés sans être envoyés, pour ne pas déverser tout l'historique d'un coup.

## État

| Étape | État |
|---|---|
| Détection des articles + flux RSS | Fait, testé |
| Génération des visuels de marque | Fait, testé |
| Publication via l'API Postiz | Fait, testé de bout en bout |
| Stack Docker Postiz (`infra/`) | Fait, validé |
| Workflow GitHub Actions | Fait |
| **Serveur + sous-domaine HTTPS** | **À faire — docs/DEPLOIEMENT.md** |
| **Apps développeur des réseaux** | **À faire — docs/DEPLOIEMENT.md** |

## À savoir

- **Postiz est lourd** : 7 conteneurs (dont Temporal et Elasticsearch), 4 Go de RAM
  minimum. Pas hébergeable sur un mutualisé.
- **Le HTTPS est obligatoire** : les réseaux refusent les callbacks OAuth en HTTP.
- **Instagram et TikTok demandent une validation humaine** de l'app développeur,
  1 à 3 semaines. Pour TikTok, tant que l'audit n'est pas passé, les publications
  restent en visibilité privée.
