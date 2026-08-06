import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { FormulaireProfil } from "./FormulaireProfil";

export default async function PageProfil() {
  const { userId } = await auth();
  const utilisateur = await db.utilisateur.findUnique({
    where: { clerkId: userId! },
    include: { profil: true },
  });

  return (
    <div className="carte" style={{ maxWidth: 640 }}>
      <h1 style={{ marginTop: 0 }}>Votre profil</h1>
      <p style={{ color: "#556072" }}>
        Ces informations pilotent tout ce que l'IA génère : ton, thèmes, contenu interdit.
      </p>
      <FormulaireProfil profilExistant={utilisateur?.profil ?? null} />
    </div>
  );
}
