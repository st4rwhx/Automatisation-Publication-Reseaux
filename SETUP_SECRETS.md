# Configuration des secrets GitHub

Ce document explique comment configurer les clés API nécessaires pour le système d'automatisation de publication.

## Secrets requis

Quatre secrets d'API doivent être ajoutés au repository GitHub. Accédez à **Settings > Secrets and variables > Actions** pour les ajouter.

### 1. GEMINI_API_KEY
**Fournisseur:** Google AI Studio (gratuit, 1500 requêtes/jour)
- Obtenir la clé: https://aistudio.google.com/apikey
- Format: `AQ.Ab8RN6...`
- Priorité: Première tentative

### 2. GROQ_API_KEY
**Fournisseur:** Groq (gratuit, 30 RPM)
- Obtenir la clé: https://console.groq.com
- Format: `sk_live_...`
- Priorité: Fallback si Gemini épuisé

### 3. DEEPSEEK_API_KEY
**Fournisseur:** DeepSeek
- Obtenir la clé: https://platform.deepseek.com
- Format: `sk-...`
- Priorité: Troisième tentative

### 4. KIMI_API_KEY
**Fournisseur:** Moonshot (Kimi)
- Obtenir la clé: https://platform.moonshot.cn
- Format: `sk-...`
- Priorité: Dernier recours

## Secrets optionnels (pour la publication)

### POSTIZ_API_URL
URL de l'API Postiz auto-hébergée (ex: `http://192.168.x.x:3000`)

### POSTIZ_API_KEY
Clé d'authentification de l'API Postiz

## Secret optionnel (pour la vidéo)

### PEXELS_API_KEY
**Fournisseur:** Pexels (gratuit, illimité, sans carte bancaire)
- Obtenir la clé: https://www.pexels.com/api/
- Sert à télécharger des clips vidéo libres de droits pour le b-roll
- Sans cette clé, le pipeline vidéo est simplement ignoré : le système continue
  de publier avec le visuel statique (image), comme avant

La voix off, elle, ne nécessite aucune clé : elle utilise l'API gratuite
"Read Aloud" de Microsoft Edge via le paquet `msedge-tts`.

## Comment ajouter les secrets

1. Allez sur le repository GitHub
2. Cliquez sur **Settings** (en haut à droite)
3. Cliquez sur **Secrets and variables** dans le menu latéral
4. Cliquez sur **Actions**
5. Cliquez sur **New repository secret**
6. Entrez le nom du secret (ex: `GEMINI_API_KEY`)
7. Collez la valeur de la clé
8. Cliquez sur **Add secret**

Répétez l'opération pour chaque clé API.

## Mécanisme de fallback

Le système essaie les providers dans cet ordre :

1. **Gemini** — Premier choix (quota quotidien généreux)
2. **Groq** — Si Gemini épuisé (gratuit mais limité à 30 RPM)
3. **DeepSeek** — Alternative sans limite de RPM
4. **Kimi** — Dernier recours

Si au moins une clé est configurée, le script `generate-daily-post.mjs` fonctionnera.

## Vérification du setup

Le workflow GitHub Actions affichera un message de confirmation après chaque exécution :

```
[article] Titre de l'article
  ok  linkedin (123 car., 2026-08-03T08:30:00Z)
  ok  instagram (456 car., 2026-08-03T12:30:00Z)
```

Si aucun secret n'est configuré, le step "Écrire le post du jour" sera ignoré, mais le flux RSS se régénérera quand même.

## Exemple d'erreur si pas de secrets

```
Error: Aucun provider LLM disponible ou tous ont échoué.
```

Cela signifie qu'aucune clé API n'a été trouvée dans les variables d'environnement.

## Sécurité

- Les secrets GitHub sont chiffrés et ne s'affichent jamais en clair
- Chaque exécution du workflow reçoit les valeurs décryptées
- Les logs des workflows ne montrent jamais les valeurs des secrets
