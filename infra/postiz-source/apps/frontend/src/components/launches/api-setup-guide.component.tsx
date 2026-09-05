'use client';

import React, { FC } from 'react';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import copy from 'copy-to-clipboard';
import { useToaster } from '@gitroom/react/toaster/toaster';

// Guide de configuration intégré : évite de devoir aller chercher dans une
// doc externe comment créer l'app développeur de chaque réseau. Rempli à
// partir des scopes et de l'URI de callback réellement utilisés par ce
// projet (voir libraries/nestjs-libraries/src/integrations/social/*.provider.ts),
// donc toujours cohérent avec ce que le code attend réellement.

interface Etape {
  texte: string;
  lien?: { url: string; label: string };
}

interface Guide {
  nom: string;
  console: { url: string; label: string };
  envVars: string[];
  delaiValidation: string;
  etapes: Etape[];
  note?: string;
}

function callbackUrl(identifier: string) {
  if (typeof window === 'undefined') return `<votre-url>/integrations/social/${identifier}`;
  return `${window.location.origin}/integrations/social/${identifier}`;
}

const GUIDES: Record<string, Guide> = {
  linkedin: {
    nom: 'LinkedIn',
    console: { url: 'https://www.linkedin.com/developers/apps', label: 'LinkedIn Developer Portal' },
    envVars: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
    delaiValidation: 'Immédiat pour un usage personnel (page LinkedIn requiert une validation manuelle si vous ajoutez le produit "Community Management API").',
    etapes: [
      { texte: 'Créez une app sur le portail développeur LinkedIn (nécessite une page LinkedIn associée, même une page vide suffit pour démarrer).' },
      { texte: 'Dans l\'onglet "Products" de l\'app, demandez l\'accès au produit "Sign In with LinkedIn using OpenID Connect".' },
      { texte: 'Demandez aussi "Share on LinkedIn" pour pouvoir publier des posts au nom du compte connecté.' },
      { texte: 'Dans l\'onglet "Auth", ajoutez cette URL dans "Authorized redirect URLs for your app" :' },
      { texte: 'Copiez le Client ID et le Client Secret affichés dans l\'onglet "Auth".' },
    ],
  },
  youtube: {
    nom: 'YouTube',
    console: { url: 'https://console.cloud.google.com/apis/credentials', label: 'Google Cloud Console — Credentials' },
    envVars: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'],
    delaiValidation: 'Fonctionne immédiatement en mode "Test" avec jusqu\'à 100 comptes testeurs ajoutés manuellement. Passer en production (accès illimité) demande une vérification Google qui peut prendre plusieurs semaines pour les scopes YouTube sensibles.',
    etapes: [
      { texte: 'Créez un projet sur Google Cloud Console.', lien: { url: 'https://console.cloud.google.com/projectcreate', label: 'Créer un projet' } },
      { texte: 'Activez "YouTube Data API v3" dans la bibliothèque d\'API.', lien: { url: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com', label: 'Activer l\'API' } },
      { texte: 'Configurez l\'écran de consentement OAuth ("OAuth consent screen") : type "External", renseignez le nom de l\'app et votre email.' },
      { texte: 'Tant que l\'app n\'est pas vérifiée par Google, ajoutez votre propre compte Google (et ceux de vos clients) comme "Test users" dans cet écran de consentement — sinon la connexion sera refusée.' },
      { texte: 'Dans "Credentials", créez un "OAuth client ID" de type "Web application".' },
      { texte: 'Dans "Authorized redirect URIs", ajoutez :' },
      { texte: 'Copiez le Client ID et le Client Secret générés.' },
    ],
    note: 'Scopes demandés par ce projet : gestion complète de la chaîne YouTube (upload, lecture, statistiques). Google classe ces scopes comme "sensibles" — la vérification officielle est plus longue que pour LinkedIn ou TikTok.',
  },
  facebook: {
    nom: 'Facebook',
    console: { url: 'https://developers.facebook.com/apps', label: 'Meta for Developers' },
    envVars: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],
    delaiValidation: 'Fonctionne immédiatement en mode développement avec les comptes ajoutés comme "Testeurs". La publication sur des comptes tiers demande une revue Meta (2 à 4 semaines).',
    etapes: [
      { texte: 'Créez une app sur Meta for Developers, type "Business".' },
      { texte: 'Ajoutez le produit "Facebook Login for Business".' },
      { texte: 'Dans les réglages de ce produit, ajoutez cette URL dans "Valid OAuth Redirect URIs" :' },
      { texte: 'Sous "App roles" → "Testers/Roles", ajoutez les comptes Facebook qui doivent pouvoir se connecter tant que l\'app n\'est pas passée en revue.' },
      { texte: 'Récupérez l\'App ID et l\'App Secret dans "Settings" → "Basic".' },
    ],
    note: 'La même app Meta sert aussi pour Instagram (voir ci-contre) — inutile d\'en créer une deuxième.',
  },
  instagram: {
    nom: 'Instagram',
    console: { url: 'https://developers.facebook.com/apps', label: 'Meta for Developers' },
    envVars: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],
    delaiValidation: 'Fonctionne immédiatement en mode test. La publication sur des comptes tiers demande une revue Meta (2 à 4 semaines) — la permission instagram_content_publish n\'est jamais validée automatiquement.',
    etapes: [
      { texte: 'Utilisez la même app Meta que pour Facebook (une seule app couvre les deux réseaux).' },
      { texte: 'Le compte Instagram à connecter doit être un compte "Professionnel" (Business ou Créateur), pas un compte personnel — sinon la connexion échoue silencieusement.' },
      { texte: 'Ce compte Instagram professionnel doit être relié à une Page Facebook (Réglages Instagram → Compte → Comptes liés).' },
      { texte: 'Dans l\'app Meta, ajoutez le produit "Instagram Graph API".' },
      { texte: 'Redirect URI à ajouter (même que Facebook) :' },
      { texte: 'Demandez la revue Meta pour la permission "instagram_content_publish" avant un usage en production avec des comptes clients.' },
    ],
  },
  tiktok: {
    nom: 'TikTok',
    console: { url: 'https://developers.tiktok.com/apps', label: 'TikTok for Developers' },
    envVars: ['TIKTOK_CLIENT_ID', 'TIKTOK_CLIENT_SECRET'],
    delaiValidation: 'Le mode "Sandbox" fonctionne immédiatement mais publie en privé uniquement. La revue pour publier en public prend 5 à 10 jours ouvrés.',
    etapes: [
      { texte: 'Créez une app sur TikTok for Developers.' },
      { texte: 'Ajoutez le produit "Content Posting API" (et "Login Kit" pour l\'authentification).' },
      { texte: 'Renseignez cette URL de redirection :' },
      { texte: 'Avant de soumettre l\'app en revue, vérifiez la propriété du domaine utilisé (obligatoire pour toute URL de redirection ou de partage de lien).' },
      { texte: 'Testez d\'abord en mode "Sandbox" (les publications restent privées) avant de soumettre l\'app à la revue officielle.' },
      { texte: 'Copiez la Client Key et le Client Secret.' },
    ],
  },
};

export const ApiSetupGuideButton: FC<{ identifier: string }> = ({ identifier }) => {
  const modal = useModals();
  const guide = GUIDES[identifier];
  if (!guide) return null;

  const ouvrir = (e: React.MouseEvent) => {
    e.stopPropagation();
    modal.openModal({
      title: `Configurer ${guide.nom}`,
      withCloseButton: true,
      children: <GuideContent identifier={identifier} guide={guide} />,
    });
  };

  return (
    <button
      onClick={ouvrir}
      title={`Comment obtenir les identifiants API ${guide.nom}`}
      className="absolute top-[4px] right-[4px] w-[20px] h-[20px] rounded-full bg-black/40 text-white text-[12px] flex items-center justify-center hover:bg-black/70"
    >
      ?
    </button>
  );
};

const GuideContent: FC<{ identifier: string; guide: Guide }> = ({ identifier, guide }) => {
  const toaster = useToaster();
  const url = callbackUrl(identifier);

  const copier = (texte: string) => {
    copy(texte);
    toaster.show('Copié dans le presse-papier', 'success');
  };

  return (
    <div className="flex flex-col gap-[16px] max-w-[560px]">
      <div className="text-[13px] p-[10px] rounded-[6px] bg-[#3E6693]/15">
        <strong>Délai de validation :</strong> {guide.delaiValidation}
      </div>

      <ol className="flex flex-col gap-[10px] list-decimal ps-[20px]">
        {guide.etapes.map((etape, i) => (
          <li key={i}>
            {etape.texte}
            {etape.lien && (
              <>
                {' '}
                <a
                  href={etape.lien.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {etape.lien.label}
                </a>
              </>
            )}
            {/* Les étapes qui mentionnent l'URL de redirection l'affichent juste en dessous, prête à copier */}
            {etape.texte.toLowerCase().includes('url') &&
              (etape.texte.toLowerCase().includes('redirect') ||
                etape.texte.toLowerCase().includes('redirection')) && (
                <div className="mt-[6px] flex items-center gap-[8px]">
                  <code className="text-[12px] bg-black/30 px-[8px] py-[4px] rounded-[4px] break-all">
                    {url}
                  </code>
                  <button
                    className="text-[12px] underline shrink-0"
                    onClick={() => copier(url)}
                  >
                    Copier
                  </button>
                </div>
              )}
          </li>
        ))}
      </ol>

      {guide.note && <div className="text-[12px] opacity-70">{guide.note}</div>}

      <div className="flex flex-col gap-[4px] pt-[8px] border-t border-white/10">
        <div className="text-[13px]">
          Console développeur :{' '}
          <a href={guide.console.url} target="_blank" rel="noreferrer" className="underline">
            {guide.console.label}
          </a>
        </div>
        <div className="text-[13px]">
          Variables à renseigner dans <code>infra/.env</code> :{' '}
          {guide.envVars.map((v, i) => (
            <React.Fragment key={v}>
              {i > 0 && ', '}
              <code className="bg-black/30 px-[6px] py-[2px] rounded-[4px]">{v}</code>
            </React.Fragment>
          ))}
        </div>
        <div className="text-[12px] opacity-70 pt-[4px]">
          Après avoir renseigné ces variables, redémarrez Postiz :{' '}
          <code className="bg-black/30 px-[6px] py-[2px] rounded-[4px]">
            docker compose up -d --build
          </code>
        </div>
      </div>
    </div>
  );
};
