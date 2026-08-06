# Automatisation Publication Réseaux

Trois flux de publication automatisés, sans intervention humaine quotidienne :

1. **Détection articles** : quand un nouvel article paraît sur le site configuré,
   il est relayé automatiquement via [Postiz](https://github.com/gitroomhq/postiz-app)
   (open source, auto-hébergé). *Spécifique au site cematys.fr — voir limitation plus bas.*

2. **Posts quotidiens** : chaque jour, un conseil autonome est généré par IA selon le
   profil configuré (`config/profil.json`) et publié aux heures optimales par réseau.

3. **Vidéos quotidiennes** : le post du jour est aussi transformé en courte vidéo verticale
   (script → voix off → b-roll → montage), 100% gratuite, publiée sur TikTok/Instagram/Facebook.

> **Prototype SaaS** : ce même moteur existe aussi en version produit multi-clients
> dans [`app/`](app/README.md) — "CEMATYS Auto Post AI", avec inscription (Google ou
> email), paliers d'abonnement (Free/Starter/Pro/Entreprise) et facturation Stripe.
> Ce dossier `scripts/` reste l'automatisation interne dédiée à CEMATYS elle-même.

Le système est **générique** : `config/profil.json` peut décrire une entreprise ou un
particulier. Lance `npm run onboarding` pour le configurer sans toucher au code.

## Comment ça marche

```
┌─── Site web (optionnel, structure spécifique requise)
│         │  generate-rss.mjs       détecte les articles → public/rss.xml
│         │  generate-images.mjs    fabrique un visuel de marque
│         ▼
├─── GitHub Pages  (flux + visuels + vidéos publics)
│         │  publish-to-postiz.mjs
│         ▼
├─── config/profil.json + LLM
│         │  generate-daily-post.mjs    génère 1 post autonome/jour
│         │  generate-video-script.mjs  découpe le post en scènes
│         │  generate-voiceover.mjs     voix off gratuite (TTS)
│         │  fetch-broll.mjs            clips vidéo libres de droits (Pexels)
│         │  assemble-video.mjs         montage ffmpeg + sous-titres
│         ▼
└─── Postiz (scheduling)  ──▶  LinkedIn · Instagram · TikTok · Facebook
         (publié aux heures optimales par réseau, vidéo si disponible sinon image)
```

**Articles** : la date de première détection est mémorisée, on ne republie jamais deux fois.

**Posts quotidiens et vidéos** : idempotents (une seule génération par date, même si le
workflow s'exécute plusieurs fois dans la journée).

## Réseaux couverts

| Réseau | État | Remarque |
|---|---|---|
| LinkedIn | ✅ | Texte + visuel paysage |
| Instagram | ✅ | **Visuel obligatoire** (carré 1080×1350) |
| TikTok | ✅ | Vidéo si le pipeline vidéo est actif, sinon post photo (visuel obligatoire) |
| Facebook | ✅ | Texte + visuel paysage |
| X | ⚠️ | Exclus par défaut (payant depuis fév 2026 : ~0,20 $/post avec lien). Activable avec `RESEAUX_EXCLUS=""` |
| YouTube | ❌ | Aucune API pour les posts Communauté |

## Scripts

```bash
npm run onboarding        # configure config/profil.json (entreprise ou particulier)

npm run generate-rss      # détecte les articles du site (spécifique cematys.fr)
npm run daily-post        # génère le post du jour (si LLM configuré)
npm run generate-images   # fabrique les visuels manquants (--force = tout refaire)

npm run video-script      # découpe le post du jour en scènes vidéo
npm run voiceover         # génère la voix off de chaque scène (gratuit, sans clé)
npm run broll             # télécharge les clips vidéo libres de droits (Pexels)
npm run assemble-video    # monte la vidéo finale avec ffmpeg
npm run video             # enchaîne les 4 étapes vidéo ci-dessus

npm run publish:dry       # affiche ce qui serait publié, sans rien envoyer
npm run publish           # publie les nouveaux articles + posts sur les réseaux
npm run all               # enchaîne tout : RSS → daily-post → images → vidéo → publish
```

**Variables d'environnement requises :**
- Au moins un provider LLM : `GEMINI_API_KEY` ou `GROQ_API_KEY` ou `DEEPSEEK_API_KEY` ou `KIMI_API_KEY`
  → voir [`SETUP_SECRETS.md`](SETUP_SECRETS.md)
- Pour la vidéo (optionnel) : `PEXELS_API_KEY` (gratuite) + `ffmpeg` installé sur la machine
- Pour la publication : `POSTIZ_API_URL`, `POSTIZ_API_KEY`, `IMAGES_BASE_URL`

Sans `PEXELS_API_KEY`, le pipeline vidéo est simplement ignoré : le système continue
de publier avec le visuel statique, comme avant.

## Configuration

### `config/profil.json` — Profil (entreprise ou particulier)
Le plus simple est `npm run onboarding` (questions guidées). Le fichier définit :
- **type** : `entreprise` ou `particulier`
- **nom, site, activité, zone, cible** : qui tu es, ce que tu fais, à qui tu t'adresses
- **ton** : règles de rédaction (ex: "concret pas jargon", "sérieux pas alarmiste")
- **thèmes** : catégories de contenu récurrentes
- **interdits** : règles strictes (pas de chiffres inventés, pas de faux témoignages, etc.)
- **video.voix** : voix TTS pour la voix off (ex: `fr-FR-HenriNeural`, `fr-FR-DeniseNeural`)
- **video.styleBroll** : mots-clés ajoutés aux recherches de clips d'illustration

Utilisé par `generate-daily-post.mjs`, `generate-images.mjs`, `generate-video-script.mjs`
pour produire un contenu cohérent avec qui tu es.

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
| Détection des articles + flux RSS | ✅ Fait (spécifique cematys.fr) |
| Génération des visuels de marque | ✅ Fait |
| Posts quotidiens générés par IA | ✅ Fait |
| Profil générique (entreprise/particulier) + onboarding | ✅ Fait |
| Chaîne fallback LLM (Gemini → Groq → DeepSeek → Kimi) | ✅ Fait |
| Pipeline vidéo gratuit (script → voix → b-roll → montage) | ✅ Fait |
| Scheduling optimisé par réseau | ✅ Fait |
| Publication via API Postiz (image ou vidéo) | ✅ Fait |
| Workflow GitHub Actions (2h) | ✅ Fait |
| Stack Docker Postiz (`infra/`) | ✅ Fait |
| **Setup API keys** | **➜ Voir SETUP_SECRETS.md** |
| **Serveur Postiz + HTTPS** | **À faire** |
| **Apps développeur des réseaux** | **À faire** |

## Limitations connues

- **Détection d'articles spécifique à cematys.fr** : `generate-rss.mjs` parse la structure
  HTML précise de ce site. Pour un autre site, il faudrait soit adapter ce script à sa
  structure, soit ignorer ce flux et ne garder que les posts/vidéos quotidiens.
- **Qualité vidéo "assemblage"**, pas génération IA pure : le pipeline combine voix off
  synthétique + b-roll libre de droits + sous-titres, pas une vidéo générée frame par frame
  par un modèle. C'est le compromis qui reste gratuit — une vraie génération vidéo IA
  (Runway, Sora...) est payante à l'usage.
- **La voix off Microsoft Edge n'est pas une API officiellement supportée** : c'est
  l'API interne utilisée par la fonction "Lire à voix haute" du navigateur Edge, largement
  utilisée par la communauté mais pouvant changer sans préavis côté Microsoft.

## À savoir

- **Postiz est lourd** : 7 conteneurs (dont Temporal et Elasticsearch), 4 Go de RAM
  minimum. Pas hébergeable sur un mutualisé.
- **Le HTTPS est obligatoire** : les réseaux refusent les callbacks OAuth en HTTP.
- **Instagram et TikTok demandent une validation humaine** de l'app développeur,
  1 à 3 semaines. Pour TikTok, tant que l'audit n'est pas passé, les publications
  restent en visibilité privée.
