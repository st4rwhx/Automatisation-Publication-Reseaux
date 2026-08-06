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

🚧 **Stubs à compléter avant un vrai lancement** :

1. **Moteur de génération non branché en base de données** : les scripts
   `../scripts/generate-daily-post.mjs`, `generate-video-script.mjs`, etc.
   lisent et écrivent des fichiers JSON sur disque (un seul profil). Pour le
   SaaS, il faut les adapter pour lire le `Profil` d'un utilisateur depuis
   Postgres et écrire dans la table `Post`, plutôt que dans
   `data/daily-posts.json`. La logique métier (prompts LLM, pipeline vidéo)
   est réutilisable telle quelle, seule la couche de stockage change.

2. **Cron de génération quotidienne** : il faut un job qui tourne chaque jour
   pour tous les utilisateurs actifs (Vercel Cron ou Supabase Edge Function),
   qui vérifie `peutGenererPost()`/`peutGenererVideo()` avant de lancer la
   génération, puis appelle `incrementerPost()`/`incrementerVideo()`.

3. **Connexion des réseaux sociaux** (`/dashboard/reseaux`) : la page existe
   mais le bouton "Connecter" n'est pas encore relié au flux OAuth de Postiz.
   Chaque connexion réussie doit créer une ligne `CompteReseau`.

4. **Page Entreprise** : actuellement un simple lien `mailto:`, à remplacer
   par un vrai formulaire de contact si le volume le justifie.

## Déploiement

Recommandé : [Vercel](https://vercel.com) (gratuit pour démarrer, intégration
Next.js native, cron jobs inclus). Connecter le repo GitHub, définir
`app/` comme racine du projet dans les réglages Vercel, ajouter les variables
d'environnement, déployer.
