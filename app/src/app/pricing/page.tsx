import { PALIERS } from "@/lib/plans";
import { ChoisirPalierBouton } from "./ChoisirPalierBouton";

export default function PagePricing() {
  return (
    <main className="conteneur" style={{ padding: "64px 0" }}>
      <h1 style={{ textAlign: "center" }}>Tarifs</h1>
      <p style={{ textAlign: "center", color: "#556072", maxWidth: 560, margin: "0 auto 48px" }}>
        Pas de crédits à racheter : une limite mensuelle par palier, comme un abonnement
        classique. Vous changez de palier à tout moment.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
        {Object.values(PALIERS).map((palier) => (
          <div className="carte" key={palier.id} style={{ textAlign: "center" }}>
            <h2 style={{ marginTop: 0 }}>{palier.nom}</h2>
            <p style={{ fontSize: 32, fontWeight: 800, margin: "8px 0" }}>
              {palier.prixMensuel === null
                ? "Sur devis"
                : palier.prixMensuel === 0
                  ? "Gratuit"
                  : `${palier.prixMensuel} €/mois`}
            </p>
            <p style={{ color: "#556072", fontSize: 14, minHeight: 60 }}>{palier.description}</p>
            <ul style={{ textAlign: "left", fontSize: 14, color: "#556072" }}>
              <li>{palier.postsParMois === Infinity ? "Posts illimités" : `${palier.postsParMois} posts/mois`}</li>
              <li>{palier.videosParMois === Infinity ? "Vidéos illimitées" : `${palier.videosParMois} vidéos/mois`}</li>
              <li>{palier.reseauxMax === Infinity ? "Tous les réseaux" : `${palier.reseauxMax} réseau(x)`}</li>
            </ul>
            <ChoisirPalierBouton palier={palier.id} />
          </div>
        ))}
      </div>
    </main>
  );
}
