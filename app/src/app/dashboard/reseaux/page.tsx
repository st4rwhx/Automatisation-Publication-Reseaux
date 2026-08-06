import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

const RESEAUX = [
  { id: "linkedin", nom: "LinkedIn" },
  { id: "instagram", nom: "Instagram" },
  { id: "tiktok", nom: "TikTok" },
  { id: "facebook", nom: "Facebook" },
];

export default async function PageReseaux() {
  const { userId } = await auth();
  const utilisateur = await db.utilisateur.findUnique({
    where: { clerkId: userId! },
    include: { comptesReseaux: true },
  });
  const connectes = new Set(utilisateur?.comptesReseaux.map((c) => c.reseau));

  return (
    <div>
      <h1>Réseaux connectés</h1>
      <p style={{ color: "#556072" }}>
        La connexion OAuth de chaque réseau passe par Postiz (déjà utilisé pour la
        publication). Cette page redirige vers le flux de connexion Postiz — non
        implémenté dans ce prototype, à brancher une fois Postiz déployé.
      </p>
      <div style={{ display: "grid", gap: 12, maxWidth: 400 }}>
        {RESEAUX.map((r) => (
          <div key={r.id} className="carte" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{r.nom}</span>
            {connectes.has(r.id) ? (
              <span style={{ color: "green", fontWeight: 700 }}>Connecté</span>
            ) : (
              <button className="bouton contour" disabled>
                Connecter (à venir)
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
