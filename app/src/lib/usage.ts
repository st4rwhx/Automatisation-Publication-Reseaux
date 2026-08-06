// Vérifie et incrémente la consommation mensuelle d'un utilisateur. C'est ici
// qu'on empêche un compte Free de générer un 2e post, ou un compte Starter
// d'aller au-delà de sa limite mensuelle.

import { db } from "./db";
import { PALIERS, palierDepuisId, type Palier } from "./plans";

function moisCourant(): string {
  return new Date().toISOString().slice(0, 7); // "AAAA-MM"
}

async function chargerConsommation(utilisateurId: string) {
  const mois = moisCourant();
  return db.consommation.upsert({
    where: { utilisateurId_mois: { utilisateurId, mois } },
    update: {},
    create: { utilisateurId, mois },
  });
}

export async function palierActif(utilisateurId: string): Promise<Palier> {
  const abonnement = await db.abonnement.findUnique({ where: { utilisateurId } });
  if (!abonnement) return "FREE";
  // Un abonnement Stripe non actif (impayé, résilié) retombe sur Free plutôt
  // que de bloquer complètement l'accès au compte.
  if (abonnement.palier !== "FREE" && abonnement.statutStripe !== "active") return "FREE";
  return abonnement.palier as Palier;
}

export async function peutGenererPost(utilisateurId: string): Promise<{ ok: boolean; raison?: string }> {
  const palier = await palierActif(utilisateurId);
  const limite = PALIERS[palier].postsParMois;
  const conso = await chargerConsommation(utilisateurId);

  if (conso.postsUtilises >= limite) {
    return { ok: false, raison: `Limite de ${limite} post(s)/mois atteinte pour le palier ${PALIERS[palier].nom}.` };
  }
  return { ok: true };
}

export async function peutGenererVideo(utilisateurId: string): Promise<{ ok: boolean; raison?: string }> {
  const palier = await palierActif(utilisateurId);
  const limite = PALIERS[palier].videosParMois;
  const conso = await chargerConsommation(utilisateurId);

  if (conso.videosUtilisees >= limite) {
    return { ok: false, raison: `Limite de ${limite} vidéo(s)/mois atteinte pour le palier ${PALIERS[palier].nom}.` };
  }
  return { ok: true };
}

export async function incrementerPost(utilisateurId: string) {
  const mois = moisCourant();
  await db.consommation.update({
    where: { utilisateurId_mois: { utilisateurId, mois } },
    data: { postsUtilises: { increment: 1 } },
  });
}

export async function incrementerVideo(utilisateurId: string) {
  const mois = moisCourant();
  await db.consommation.update({
    where: { utilisateurId_mois: { utilisateurId, mois } },
    data: { videosUtilisees: { increment: 1 } },
  });
}

export async function resumeConsommation(utilisateurId: string) {
  const palier = await palierActif(utilisateurId);
  const conso = await chargerConsommation(utilisateurId);
  const def = PALIERS[palier];
  return {
    palier,
    nomPalier: def.nom,
    posts: { utilises: conso.postsUtilises, limite: def.postsParMois },
    videos: { utilisees: conso.videosUtilisees, limite: def.videosParMois },
  };
}
