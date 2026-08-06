# CEMATYS Auto Post AI

Prototype d'application SaaS : chaque client s'inscrit (Google ou email/mdp),
configure son profil, et l'IA génère + publie ses posts et vidéos à sa place.
C'est la version "produit multi-clients" de l'automatisation qui existe dans
`../scripts/` (celle-ci reste dédiée à CEMATYS elle-même).

## Stack

| Brique | Choix | Pourquoi |
|---|---|---|
| Framework | Next.js 15 (App Router) | Frontend + backend dans un seul projet, déploiement Vercel en 1 clic |
| Authentification | [Clerk](https://clerk.com) | Google OAuth + email/mdp inclus, gratuit jusqu'à 10k utilisateurs actifs/mois |
| Base de données | Postgres ([Supabase](https://supabase.com) recommandé) | Gratuit jusqu'à 500 Mo, largement suffisant pour démarrer |
| ORM | Prisma | Schéma dans `prisma/schema.prisma`, migrations versionnées |
| Facturation | [Stripe](https://stripe.com) | Checkout + Billing Portal + webhooks, standard du marché |
| Publication | Postiz (déjà utilisé par `../scripts/`) | Chaque compte social connecté = une intégration Postiz par utilisateur |

## Modèle économique

Limites d'usage mensuelles par palier (façon Claude), **pas** un système de
crédits à racheter. Défini dans `src/lib/plans.ts` :

| Palier | Prix | Posts/mois | Vidéos/mois |
|---|---|---|---|
| Découverte (Free) | 0 € | 1 (essai unique) | 1 |
| Starter | 12 €/mois | 30 | 8 |
| Pro | 39 €/mois | Illimité | 30 |
| Entreprise | Sur devis | Illimité | Illimité |

Prix et limites sont volontairement dans un seul fichier (`src/lib/plans.ts`)
pour être ajustés facilement avant lancement.

## Setup local

### 1. Base de données

Créer un projet sur [supabase.com](https://supabase.com) (gratuit), récupérer
la chaîne de connexion Postgres (Settings → Database → Connection string).

### 2. Authentification (Clerk)

1. Créer une app sur [dashboard.clerk.com](https://dashboard.clerk.com)
2. Activer **Google** dans User & Authentication → Social Connections
3. Activer **Email + mot de passe** dans User & Authentication → Email, Phone, Username
4. Copier `Publishable key` et `Secret key`
5. Créer un webhook (Webhooks → Add Endpoint) pointant vers
   `https://votre-domaine/api/webhooks/clerk`, événements `user.created` et
   `user.deleted`. Copier le `Signing Secret`.

### 3. Facturation (Stripe)

1. Créer un compte sur [stripe.com](https://stripe.com)
2. Créer 2 produits récurrents mensuels : **Starter** (12€) et **Pro** (39€)
3. Copier leurs `price_id` (commence par `price_...`)
4. Créer un webhook (Developers → Webhooks) pointant vers
   `https://votre-domaine/api/webhooks/stripe`, événements
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Copier le `Signing Secret`.

### 4. Variables d'environnement

```bash
cp .env.example .env.local
# puis remplir avec les valeurs récupérées ci-dessus
```

### 5. Lancer

```bash
npm install
npm run db:push      # applique le schéma Prisma à la base
npm run dev           # http://localhost:3000
```

## Ce qui est fait vs ce qui reste à brancher

✅ **Fait et testé** (compile, build Next.js réussi) :
- Authentification Google + email/mdp (Clerk)
- Landing page + page de tarifs
- Dashboard : aperçu, formulaire de profil, liste des posts
- Modèle de données multi-tenant (Prisma)
- Stripe Checkout + webhook de synchronisation d'abonnement
- Système de limites d'usage mensuelles par palier (`src/lib/usage.ts`)
- **Génération de posts par utilisateur** (`src/lib/generatePost.ts`) : port de
  `../scripts/generate-daily-post.mjs`, lit le `Profil` Postgres de l'utilisateur
  et son historique de posts au lieu de fichiers JSON
- **Génération de visuels par utilisateur** (`src/lib/generateImage.ts`) : port
  de `../scripts/generate-images.mjs`, upload sur Vercel Blob au lieu de
  `public/img/`
- **Cron quotidien** (`src/app/api/cron/generate/route.ts` + `vercel.json`) :
  parcourt tous les utilisateurs avec un profil, vérifie leur limite du mois
  (`peutGenererPost`), génère post + visuels, incrémente la consommation.
  Isole les échecs par utilisateur (un client en erreur ne bloque pas les
  autres). Protégé par `CRON_SECRET` (Vercel l'injecte automatiquement dans
  l'en-tête `Authorization` des appels cron si la variable porte ce nom exact).

🚧 **Stubs à compléter avant un vrai lancement** :

1. **Pipeline vidéo non branché** : `../scripts/generate-video-script.mjs`,
   `generate-voiceover.mjs`, `fetch-broll.mjs`, `assemble-video.mjs` ne sont
   pas encore portés côté SaaS. Contrainte propre au serverless : ces scripts
   utilisent `ffmpeg` installé sur la machine (présent sur les runners GitHub
   Actions, absent par défaut sur les fonctions Vercel). Il faudra soit
   embarquer `ffmpeg` via un package comme `ffmpeg-static`, soit déporter le
   montage vidéo vers un worker à part (Vercel a une limite de durée
   d'exécution même sur les plans payants) — à trancher avant de s'y attaquer.

2. **Connexion des réseaux sociaux** (`/dashboard/reseaux`) : la page existe
   mais le bouton "Connecter" n'est pas encore relié au flux OAuth de Postiz.
   Chaque connexion réussie doit créer une ligne `CompteReseau`.

3. **Publication effective** : le cron crée les posts en base (statut
   `BROUILLON`) mais ne les envoie pas encore à Postiz. Il manque l'appel
   équivalent à `../scripts/publish-to-postiz.mjs`, adapté pour utiliser les
   `CompteReseau` de chaque utilisateur au lieu d'un compte Postiz unique.

4. **Page Entreprise** : actuellement un simple lien `mailto:`, à remplacer
   par un vrai formulaire de contact si le volume le justifie.

## Déploiement

Recommandé : [Vercel](https://vercel.com) (gratuit pour démarrer, intégration
Next.js native, cron jobs inclus). Connecter le repo GitHub, définir
`app/` comme racine du projet dans les réglages Vercel, ajouter les variables
d'environnement, déployer.
