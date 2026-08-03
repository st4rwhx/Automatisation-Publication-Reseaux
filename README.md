# Automatisation Publication Réseaux

Deux flux de publication automatisés :

1. **Détection articles** : quand un nouvel article paraît sur https://cematys.fr/articles.html,
   il est relayé automatiquement via [Postiz](https://github.com/gitroomhq/postiz-app)
   (open source, auto-hébergé).

2. **Posts quotidiens** : chaque jour, un conseil autonome est généré par IA selon la marque
   CEMATYS et publié aux heures optimales par réseau.

## Comment ça marche

```
┌─── cematys.fr/articles.html
│         │  generate-rss.mjs       détecte les articles → public/rss.xml
│         │  generate-images.mjs    fabrique un visuel de marque
│         ▼
├─── GitHub Pages  (flux + visuels publics)
│         │  publish-to-postiz.mjs
│         ▼
├─── config/marque.json + LLM
│         │  generate-daily-post.mjs  génère 1 post autonome/jour
│         │  generate-images.mjs      visuel du post quotidien
│         ▼
└─── Postiz (scheduling)  ──▶  LinkedIn · Instagram · TikTok · Facebook
         (publié aux heures optimales par réseau)
```

**Articles** : la date de première détection est mémorisée, on ne republié jamais deux fois.

**Posts quotidiens** : idempotent (une seule génération par date, même si le workflow s'exécute plusieurs fois).

## Réseaux couverts

| Réseau | État | Remarque |
|---|---|---|
| LinkedIn | ✅ | Texte + visuel paysage |
| Instagram | ✅ | **Visuel obligatoire** (carré 1080×1350) |
| TikTok | ✅ | **Visuel obligatoire** — post photo, pas de vidéo requise |
| Facebook | ✅ | Texte + visuel paysage |
| X | ⚠️ | Exclus par défaut (payant depuis fév 2026 : ~0,20 $/post avec lien). Activable avec `RESEAUX_EXCLUS=""` |
| YouTube | ❌ | Aucune API pour les posts Communauté |

## Scripts

```bash
npm run generate-rss      # détecte les articles du site
npm run daily-post        # génère le post du jour (si LLM configuré)
npm run generate-images   # fabrique les visuels manquants (--force = tout refaire)
npm run publish:dry       # affiche ce qui serait publié, sans rien envoyer
npm run publish           # publie les nouveaux articles + posts sur les réseaux
npm run all               # enchaîne tout : RSS → daily-post → images → publish
```

**Variables d'environnement requises :**
- Au moins un provider LLM : `GEMINI_API_KEY` ou `GROQ_API_KEY` ou `DEEPSEEK_API_KEY` ou `KIMI_API_KEY`
  → voir [`SETUP_SECRETS.md`](SETUP_SECRETS.md)
- Pour la publication : `POSTIZ_API_URL`, `POSTIZ_API_KEY`, `IMAGES_BASE_URL`

## Configuration

### `config/marque.json` — Profil de la marque
Définit :
- **Ton** : 5+ règles de rédaction (ex: "concret pas jargon", "sérieux pas alarmiste")
- **Thèmes** : 7 catégories pour les articles (Sécurité, Sauvegarde, etc.)
- **Interdits** : 4 règles strictes (pas de chiffres inventés, pas de noms de clients, etc.)

Utilisé par `generate-daily-post.mjs` pour générer des posts cohérents avec la marque.

### `config/horaires.json` — Heures de publication optimales
Définit par réseau :
- Jours de la semaine (1-7)
- Heures HH:MM
- Fuseau (ex: Europe/Paris)

Chaque publication est planifiée à l'heure optimale via l'API Postiz.

Exemple :
```json
{
  "linkedin": {
    "jours": [2, 3, 4],
    "heures": ["08:30"],
    "note": "Pic professionnel mardi-jeudi 8h30"
  },
  "instagram": {
    "jours": [1, 2, 3, 4, 5],
    "heures": ["12:30", "18:30"],
    "note": "Pic déjeuner et soirée"
  }
}
```

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
| Détection des articles + flux RSS | ✅ Fait |
| Génération des visuels de marque | ✅ Fait |
| Posts quotidiens générés par IA | ✅ Fait |
| Chaîne fallback LLM (Gemini → Groq → DeepSeek → Kimi) | ✅ Fait |
| Scheduling optimisé par réseau | ✅ Fait |
| Publication via API Postiz | ✅ Fait |
| Workflow GitHub Actions (2h) | ✅ Fait |
| Stack Docker Postiz (`infra/`) | ✅ Fait |
| **Setup API keys** | **➜ Voir SETUP_SECRETS.md** |
| **Serveur Postiz + HTTPS** | **À faire** |
| **Apps développeur des réseaux** | **À faire** |

## À savoir

- **Postiz est lourd** : 7 conteneurs (dont Temporal et Elasticsearch), 4 Go de RAM
  minimum. Pas hébergeable sur un mutualisé.
- **Le HTTPS est obligatoire** : les réseaux refusent les callbacks OAuth en HTTP.
- **Instagram et TikTok demandent une validation humaine** de l'app développeur,
  1 à 3 semaines. Pour TikTok, tant que l'audit n'est pas passé, les publications
  restent en visibilité privée.
