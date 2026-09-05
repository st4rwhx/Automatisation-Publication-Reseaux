# Notice de modification — CEMATYS Auto Post AI

Ce dossier contient une version modifiée de [Postiz](https://github.com/gitroomhq/postiz-app),
publié par ses auteurs sous licence **GNU Affero General Public License v3.0
(AGPL-3.0)**. Conformément à cette licence :

- Le fichier `LICENSE` original est conservé tel quel dans ce dossier.
- Cette notice documente les modifications apportées par CEMATYS.
- Le code source ainsi modifié est mis à disposition ici même (dans le repo
  `st4rwhx/Automatisation-Publication-Reseaux`), conformément à l'obligation
  de l'AGPL-3.0 de fournir le code source d'une version modifiée tournant
  comme service réseau accessible à des utilisateurs.

## Modifications apportées

Remplacement de l'identité visuelle "Postiz" par "CEMATYS Auto Post AI" dans
les écrans destinés aux utilisateurs finaux :

- `apps/frontend/public/logo.svg` et `logo-text.svg` : logo et nom remplacés
  par une identité CEMATYS (charte graphique : bleu marine #1B2E44, rouge
  #C03743, cf. `../../scripts/generate-images.mjs` du projet CEMATYS).
- `apps/frontend/public/favicon.png` et `favicon.ico` : régénérés à partir
  du nouveau logo.
- Titres de pages (`isGeneralServerSide() ? 'Postiz' : ...`) : ~18 fichiers
  dans `apps/frontend/src/app/` et `apps/frontend/src/components/` — le nom
  affiché devient "CEMATYS Auto Post AI".
- Suppression du lien de menu "Affiliate" (`top.menu.tsx`) pointant vers le
  programme d'affiliation de Postiz — non pertinent hors de leur produit.
- Suppression des témoignages clients et statistiques marketing de Postiz
  (page de connexion `auth/layout.tsx`, page de facturation
  `first.billing.component.tsx`, `billing.after.tsx`) — ces témoignages
  concernent des utilisateurs de Postiz, pas de CEMATYS Auto Post AI, les
  afficher sous notre marque aurait été trompeur.
- `register.tsx` : liens "Terms of Service" / "Privacy Policy" pointant vers
  `postiz.com` remplacés temporairement par `cematys.fr` — **à remplacer par
  de vraies pages CGU/confidentialité avant un lancement public**, marqué
  `TODO` dans le code.

## Ce qui n'a volontairement PAS été modifié

- Les mentions techniques internes (`postiz://` deep link du navigateur,
  domaines d'analytics, identifiants de variables d'environnement comme
  `IS_GENERAL`) : renommer casserait le fonctionnement sans bénéfice visible
  pour l'utilisateur.
- Le lien vers l'extension navigateur Chrome de Postiz
  (`chrome.extension.component.tsx`, `add.provider.component.tsx`) : cette
  extension est un composant technique séparé de Postiz nécessaire à la
  connexion de certains réseaux ; en publier une équivalente sous marque
  CEMATYS serait un projet à part entière.
- Les pages développeur avancées (OAuth apps tierces, CLI, MCP, webhooks —
  `developer.component.tsx`, `public-api/public.component.tsx`,
  `onboarding.modal.tsx`, `webhooks.tsx`) : fonctionnalités de bas niveau,
  peu visitées par un utilisateur final, mentions "Postiz" encore présentes.
  À traiter dans une passe ultérieure si ces écrans deviennent pertinents
  pour les clients CEMATYS.
- Le fichier `LICENSE` et les mentions légales du code source lui-même : la
  licence AGPL-3.0 l'exige.

## Reconstruire l'image

```bash
cd infra
docker compose up -d --build
```

Le service `postiz` du `docker-compose.yaml` référence ce dossier comme
contexte de build (`build: context: ./postiz-source`) au lieu de l'image
publique `ghcr.io/gitroomhq/postiz-app`.
