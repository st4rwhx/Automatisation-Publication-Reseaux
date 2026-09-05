# Déploiement sur OVH

Guide de configuration pour héberger le système d'automatisation sur OVH.

## Architecture

```
GitHub Actions (toutes les 2h)
        │
        ├─► Détecte articles et génère posts quotidiens
        ├─► Crée les visuels de marque
        └─► Publie sur Postiz
        
        │
        ▼
    OVH VPS / Serveur
        │
        ├─► Postiz (port 3000)
        │   └─ Publie sur LinkedIn, Instagram, TikTok, Facebook
        │
        └─► Stockage des visuels (accessible publiquement)
```

## 1. Configuration des Secrets GitHub

Les secrets sont gérés directement dans GitHub et utilisés par les workflows.

### Option A : Via le script Node.js (automatisé)

```bash
# Récupérez un token GitHub avec permission repo:secrets
# https://github.com/settings/tokens/new (cochez "repo" et "admin:repo_hook")

export GITHUB_TOKEN="ghp_xxxxx"
node scripts/setup-secrets.mjs
```

### Option B : Via GitHub Web UI (manuel)

1. Allez sur https://github.com/st4rwhx/Automatisation-Publication-Reseaux/settings/secrets/actions
2. Cliquez "New repository secret" pour chacun :
   - `GEMINI_API_KEY`: `AQ.Ab8RN6KBjN6r5Ivnk_2lCHGbK4Jff5lqCTfWitziMKEzKdxjQg`
   - `GROQ_API_KEY`: `sk_live_6f5798f2a5501ea67300edd5570afae4`
   - `OPENROUTER_API_KEY`: à créer sur [openrouter.ai](https://openrouter.ai) (gratuit, sans carte bancaire)
   - `KIMI_API_KEY`: `sk-7nIIAzF0xjA0BEAOn8p8zzV7MDQC9mp3iyzy0xABre8ruHVf`

## 2. Configuration de Postiz sur OVH

### Prérequis

- Serveur OVH avec Docker installé (2+ cores, 4GB RAM minimum)
- Domaine pointant vers le serveur (HTTPS obligatoire)
- Accès SSH

### Déploiement

```bash
# Clonez le repo
git clone https://github.com/st4rwhx/Automatisation-Publication-Reseaux.git
cd Automatisation-Publication-Reseaux

# Lancez Postiz avec Docker Compose
docker-compose -f infra/docker-compose.yml up -d

# Postiz sera accessible sur http://votre-serveur:3000
```

### Configuration Postiz

1. Accédez à `http://votre-serveur:3000`
2. Créez un compte admin
3. Connectez vos réseaux :
   - **LinkedIn** : OAuth via LinkedIn
   - **Instagram** : App ID/Secret (demander via Meta Business)
   - **TikTok** : App ID/Secret
   - **Facebook** : Token d'accès

### Récupérez l'API Key

1. Dans Postiz, allez à Settings → API
2. Générez une clé API
3. Copiez-la dans les secrets GitHub :

```bash
export GITHUB_TOKEN="ghp_xxxxx"

# Ajouter les secrets Postiz
gh secret set POSTIZ_API_URL --repo st4rwhx/Automatisation-Publication-Reseaux \
  --body "http://votre-serveur:3000"

gh secret set POSTIZ_API_KEY --repo st4rwhx/Automatisation-Publication-Reseaux \
  --body "votre-api-key"
```

## 3. Configuration des Visuels (GitHub Pages)

Les visuels sont générés et stockés dans `public/` puis poussés sur GitHub Pages.

### Activez GitHub Pages

1. Settings → Pages
2. Source : Deploy from a branch
3. Branch : `main` (dossier `/ (root)`)

### Récupérez l'URL

Elle sera au format : `https://st4rwhx.github.io/Automatisation-Publication-Reseaux/`

Ajoutez-la aux secrets GitHub :

```bash
gh secret set IMAGES_BASE_URL --repo st4rwhx/Automatisation-Publication-Reseaux \
  --body "https://st4rwhx.github.io/Automatisation-Publication-Reseaux"
```

## 4. Workflow GitHub Actions

Le workflow s'exécute toutes les 2 heures automatiquement.

### Vérifier l'exécution

1. Allez sur GitHub → Actions
2. Regardez le workflow "Détecter les articles, publier et mettre à jour le flux RSS"

### Logs

Chaque exécution affiche :
- Détection des articles
- Génération du post quotidien
- Création des visuels
- Publication sur les réseaux

## 5. DNS et HTTPS (OVH)

Si vous hébergez Postiz sur votre propre domaine :

### A. Configurez DNS sur OVH

1. OVH Panel → Domaines → Enregistrements DNS
2. Créez un enregistrement A pointant vers votre serveur
3. Exemple : `postiz.example.com` → `IP_VPS`

### B. SSL via Let's Encrypt

```bash
# Sur votre serveur OVH
apt-get install certbot
certbot certonly --standalone -d postiz.example.com

# Ou avec Docker via Traefik (si utilisé)
```

### C. Proxy reverse (nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name postiz.example.com;

    ssl_certificate /etc/letsencrypt/live/postiz.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/postiz.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 6. Monitoring

### Logs Postiz

```bash
docker-compose -f infra/docker-compose.yml logs -f postiz
```

### Vérifier publication

1. GitHub Actions → Workflow run
2. Cherchez "ok  linkedin" ou "ECHEC"
3. Vérifiez les posts sur vos réseaux

## 7. Dépannage

### "Aucun provider LLM disponible"

- Vérifiez les secrets GitHub sont bien définis
- Attendez que le workflow re-s'exécute

### "Postiz connection refused"

- Vérifiez Postiz est lancé : `docker ps`
- Vérifiez `POSTIZ_API_URL` est correct dans les secrets

### Articles non détectés

- Vérifiez `https://cematys.fr/articles.html` est accessible
- Vérifiez la structure HTML n'a pas changé
- Relancez le workflow manuellement

## 8. Support

- OVH Documentation : https://docs.ovh.com
- Postiz Issues : https://github.com/gitroomhq/postiz-app
- Ce repo : Issues et Discussions GitHub
