import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resumeConsommation } from "@/lib/usage";
import { PALIERS } from "@/lib/plans";
import Link from "next/link";

export default async function PageAccueilDashboard() {
  const { userId } = await auth();
  const utilisateur = await db.utilisateur.findUnique({
    where: { clerkId: userId! },
    include: { profil: true },
  });

  if (!utilisateur) {
    return <p>Compte en cours de création, réessayez dans un instant.</p>;
  }

  if (!utilisateur.profil) {
    return (
      <div className="carte">
        <h2>Bienvenue 👋</h2>
        <p>Avant de générer votre premier post, configurez votre profil (2 minutes).</p>
        <Link href="/dashboard/profil" className="bouton amber">
          Configurer mon profil
        </Link>
      </div>
    );
  }

  const conso = await resumeConsommation(utilisateur.id);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div className="carte">
        <span className="etiquette">{conso.nomPalier}</span>
        <h2 style={{ marginTop: 12 }}>Consommation de ce mois-ci</h2>
        <p>
          Posts : {conso.posts.utilises} / {conso.posts.limite === Infinity ? "∞" : conso.posts.limite}
        </p>
        <p>
          Vidéos : {conso.videos.utilisees} / {conso.videos.limite === Infinity ? "∞" : conso.videos.limite}
        </p>
        {conso.palier === "FREE" && (
          <Link href="/pricing" className="bouton amber">
            Passer à un palier payant
          </Link>
        )}
      </div>

      <div className="carte">
        <h2 style={{ marginTop: 0 }}>Votre profil</h2>
        <p><strong>{utilisateur.profil.nom}</strong> — {utilisateur.profil.activite}</p>
        <p style={{ color: "#556072" }}>{utilisateur.profil.zone}</p>
        <Link href="/dashboard/profil" className="bouton contour">
          Modifier
        </Link>
      </div>
    </div>
  );
}
