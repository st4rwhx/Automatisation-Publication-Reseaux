import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// Équivalent web de scripts/onboarding.mjs : au lieu d'écrire config/profil.json
// sur disque, on écrit la ligne Profil correspondant à l'utilisateur connecté.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ erreur: "Non connecté." }, { status: 401 });

  const utilisateur = await db.utilisateur.findUnique({ where: { clerkId: userId } });
  if (!utilisateur) return NextResponse.json({ erreur: "Utilisateur introuvable." }, { status: 404 });

  const donnees = await req.json();

  const profil = await db.profil.upsert({
    where: { utilisateurId: utilisateur.id },
    create: {
      utilisateurId: utilisateur.id,
      type: donnees.type,
      nom: donnees.nom,
      site: donnees.site || null,
      activite: donnees.activite,
      zone: donnees.zone,
      cible: donnees.cible,
      depuis: donnees.depuis ? Number(donnees.depuis) : null,
      ton: donnees.ton,
      themes: donnees.themes,
      interdits: donnees.interdits,
      voixTts: donnees.voixTts,
      styleBroll: donnees.styleBroll,
    },
    update: {
      type: donnees.type,
      nom: donnees.nom,
      site: donnees.site || null,
      activite: donnees.activite,
      zone: donnees.zone,
      cible: donnees.cible,
      depuis: donnees.depuis ? Number(donnees.depuis) : null,
      ton: donnees.ton,
      themes: donnees.themes,
      interdits: donnees.interdits,
      voixTts: donnees.voixTts,
      styleBroll: donnees.styleBroll,
    },
  });

  return NextResponse.json({ profil });
}
