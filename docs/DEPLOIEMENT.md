# Déploiement

Ce document liste les étapes qui demandent **ton intervention** : elles engagent ton
identité, ton entreprise ou ta carte bancaire, et ne peuvent pas être automatisées.
Tout le reste (code, configuration, scripts) est déjà dans le dépôt.

---

## 1. Un serveur pour Postiz

Postiz n'est pas une petite application. Le stack officiel compte **7 conteneurs** :
Postiz, PostgreSQL, Redis, puis Temporal (moteur de planification) avec son propre
PostgreSQL et un Elasticsearch.

Elasticsearch réserve à lui seul 256 Mo de heap Java, et Temporal ajoute deux services.

| Ressource | Minimum réaliste |
|---|---|
| RAM | 4 Go (2 Go = échecs au démarrage) |
| Disque | 20 Go |
| CPU | 2 vCPU |

Un VPS à ~10-15 €/mois (Hetzner CX22, OVH, Scaleway) convient. Il faut aussi un
sous-domaine, par exemple `social.cematys.fr`, pointant vers ce serveur.

### Installation

```bash
git clone <ce-depot> && cd Automatisation-Publication-Reseaux/infra
cp .env.example .env

# Générer les trois secrets et les coller dans .env
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # POSTGRES_PASSWORD
openssl rand -hex 32   # TEMPORAL_POSTGRES_PASSWORD

docker compose up -d
docker compose logs -f postiz   # le premier démarrage prend ~2 min (migrations)
```

Postiz écoute sur `127.0.0.1:4007`, volontairement fermé à l'extérieur. Il faut un
reverse proxy HTTPS devant : **les APIs sociales refusent les callbacks OAuth en HTTP**.
Exemple avec Caddy (`/etc/caddy/Caddyfile`), qui gère le certificat tout seul :

```
social.cematys.fr {
    reverse_proxy 127.0.0.1:4007
}
```

Puis crée ton compte sur `https://social.cematys.fr`, et repasse
`DISABLE_REGISTRATION=true` dans `.env` suivi de `docker compose up -d` pour fermer
les inscriptions.

---

## 2. Les apps développeur, réseau par réseau

C'est **le vrai goulot d'étranglement**, et la raison pour laquelle "tout automatiser"
prend des semaines et non des heures. Chaque réseau exige que tu crées une application
développeur à ton nom, et la plupart la font relire par un humain avant d'autoriser la
publication automatique.

Pour chacun, l'URL de callback à déclarer est de la forme :
`https://social.cematys.fr/api/integrations/social/<reseau>`

| Réseau | Où | Difficulté | Ce qui bloque |
|---|---|---|---|
| **LinkedIn** | developer.linkedin.com | Faible | Produit "Share on LinkedIn" + "Sign In". Vérification de la Page entreprise. Quelques jours. |
| **X** | developer.x.com | Faible | Depuis février 2026, facturation à l'usage : **0,20 $ par post contenant un lien**. À quelques articles par mois, moins d'1 $/mois. |
| **Facebook + Instagram** | developers.facebook.com | Moyenne | Une seule app Meta couvre les deux. Instagram doit être un compte **Business ou Creator** rattaché à une Page Facebook. Permissions `instagram_content_publish`, `pages_manage_posts` → App Review avec vidéo de démonstration + vérification d'entreprise. Compte 1 à 3 semaines. |
| **TikTok** | developers.tiktok.com | Élevée | Content Posting API, en mode **post photo** (pas besoin de vidéo). Tant que l'app n'est pas auditée, les publications par API restent **en visibilité privée** — limite imposée par TikTok, pas par Postiz. L'audit demande une démo et une vérification de propriété du domaine. |

### YouTube n'est pas dans cette liste, et c'est définitif

La YouTube Data API **n'a aucun endpoint pour créer un post de la Communauté**. Elle
couvre les vidéos, playlists, chaînes et commentaires, mais pas l'onglet Communauté :
ces posts ne peuvent être créés que manuellement dans YouTube Studio. Les seules API
tierces qui touchent aux posts Communauté se contentent de les **lire**.

Ce n'est donc pas une limite de Postiz, et aucun outil ne la contourne. YouTube est
hors périmètre tant qu'il n'y a pas de production vidéo.

Chaque identifiant obtenu se colle dans `infra/.env`, puis `docker compose up -d`.
Un réseau dont les variables restent vides n'apparaît simplement pas dans Postiz —
tu peux donc démarrer avec LinkedIn seul et ajouter les autres au fil des validations.

### Le visuel n'est pas optionnel

Instagram et TikTok **refusent un post sans média**. Les articles du site n'ayant pas
d'`og:image`, `scripts/generate-images.mjs` fabrique une carte de marque CEMATYS à
partir du titre et de la catégorie, en deux formats : 1080×1350 pour Instagram et
TikTok, 1200×628 pour LinkedIn et X.

Ces visuels sont publiés sur GitHub Pages à côté du flux RSS, et Postiz vient les y
chercher via son endpoint `upload-from-url`. C'est pour cette raison que le workflow
publie sur les réseaux **après** le déploiement Pages : sinon Postiz chercherait une
image qui n'est pas encore en ligne.

---

## 3. Brancher la publication automatique

Deux chemins, déjà codés.

### Chemin A — flux RSS (aucun code à lancer)

`scripts/generate-rss.mjs` publie `public/rss.xml` via GitHub Pages. Dans Postiz,
il suffit d'ajouter ce flux dans la fonction RSS : chaque nouvel article y crée un post.

Prérequis côté GitHub, à faire dans l'interface :
1. **Settings → Actions → General** : vérifier que les Actions sont autorisées.
   *(Elles semblent actuellement désactivées sur ce dépôt : l'API ne voit aucun workflow.)*
2. **Settings → Pages → Source : GitHub Actions**.
3. **Actions → "Générer et publier le flux RSS des articles" → Run workflow**.

L'URL du flux sera `https://st4rwhx.github.io/Automatisation-Publication-Reseaux/rss.xml`.

### Chemin B — API Postiz (contrôle fin, recommandé)

`scripts/publish-to-postiz.mjs` appelle directement l'API. Il ne dépend ni de GitHub
Pages ni du polling RSS, et permet d'ajuster le texte par plateforme.

```bash
# Récupérer la clé dans Postiz → Settings → Public API
export POSTIZ_API_URL=https://social.cematys.fr
export POSTIZ_API_KEY=xxx

npm run generate-rss                      # détecte les nouveaux articles
node scripts/publish-to-postiz.mjs --dry-run   # vérifier sans rien envoyer
node scripts/publish-to-postiz.mjs             # publier
```

**Garde-fou** : au tout premier lancement, les 10 articles déjà en ligne sont marqués
comme relayés sans être envoyés. Sans ça, le branchement initial enverrait tout
l'historique d'un coup sur tous les réseaux. Utiliser `--include-existing` pour forcer.

Le texte est adapté à chaque réseau : la limite de 280 caractères de X est respectée en
retirant d'abord les hashtags, puis le résumé, le titre et le lien étant prioritaires.
Chaque réseau reçoit son propre appel API, donc un refus de X n'empêche pas la
publication sur LinkedIn, et un nouveau passage ne réessaie que ce qui a échoué.

### Automatiser le déclenchement

Deux possibilités, au choix.

**Via GitHub Actions** — le workflow tourne déjà toutes les 2 heures. Il suffit
d'ajouter les deux secrets dans **Settings → Secrets and variables → Actions** :

| Secret | Valeur |
|---|---|
| `POSTIZ_API_URL` | `https://social.cematys.fr` |
| `POSTIZ_API_KEY` | la clé de Postiz → Settings → Public API |

L'URL des visuels (`IMAGES_BASE_URL`) est déduite automatiquement de l'adresse
GitHub Pages du dépôt ; il n'y a rien à renseigner sauf si tu héberges les images
ailleurs, auquel cas définis la variable `IMAGES_BASE_URL`.

Tant que ces secrets sont absents, le workflow se contente de tenir le flux RSS à jour
sans rien publier — tu peux donc l'activer avant d'avoir monté le serveur.

**Via un cron sur le serveur** — si tu préfères ne pas dépendre de GitHub :

```cron
0 */2 * * * cd /chemin/du/depot && npm run generate-rss && node scripts/publish-to-postiz.mjs
```
