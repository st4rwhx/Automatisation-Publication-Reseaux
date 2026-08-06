// Définition des paliers. Le modèle est "limite d'usage mensuelle", pas un
// système de crédits à consommer : chaque palier a un plafond de posts et de
// vidéos par mois, remis à zéro chaque mois (comme les limites de messages
// Claude), plutôt qu'un solde qu'il faut racheter.

export type Palier = "FREE" | "STARTER" | "PRO" | "ENTREPRISE";

export interface DefinitionPalier {
  id: Palier;
  nom: string;
  prixMensuel: number | null; // null = sur devis
  stripePriceId: string | null; // à renseigner une fois le produit créé dans Stripe
  postsParMois: number; // Infinity = illimité
  videosParMois: number;
  reseauxMax: number;
  description: string;
}

export const PALIERS: Record<Palier, DefinitionPalier> = {
  FREE: {
    id: "FREE",
    nom: "Découverte",
    prixMensuel: 0,
    stripePriceId: null,
    postsParMois: 1,
    videosParMois: 1,
    reseauxMax: 1,
    description: "Un essai complet (1 post + 1 vidéo) pour voir le résultat avant de s'engager.",
  },
  STARTER: {
    id: "STARTER",
    nom: "Starter",
    prixMensuel: 12,
    stripePriceId: process.env.STRIPE_PRICE_STARTER ?? null,
    postsParMois: 30,
    videosParMois: 8,
    reseauxMax: 2,
    description: "Un post quotidien texte + image sur 2 réseaux, quelques vidéos par mois.",
  },
  PRO: {
    id: "PRO",
    nom: "Pro",
    prixMensuel: 39,
    stripePriceId: process.env.STRIPE_PRICE_PRO ?? null,
    postsParMois: Infinity,
    videosParMois: 30,
    reseauxMax: 4,
    description: "Posts illimités, une vidéo par jour, tous les réseaux (LinkedIn, Instagram, TikTok, Facebook).",
  },
  ENTREPRISE: {
    id: "ENTREPRISE",
    nom: "Entreprise",
    prixMensuel: null,
    stripePriceId: null,
    postsParMois: Infinity,
    videosParMois: Infinity,
    reseauxMax: Infinity,
    description: "Multi-comptes, API dédiée, support prioritaire. Sur devis.",
  },
};

export function palierDepuisId(id: string | null | undefined): Palier {
  return id && id in PALIERS ? (id as Palier) : "FREE";
}
