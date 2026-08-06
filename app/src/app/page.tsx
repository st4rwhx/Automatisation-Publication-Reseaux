import Link from "next/link";
import { PALIERS } from "@/lib/plans";

export default function Accueil() {
  return (
    <main>
      <section style={{ background: "var(--ink)", color: "white", padding: "80px 0" }}>
        <div className="conteneur" style={{ textAlign: "center" }}>
          <span className="etiquette">Propulsé par CEMATYS</span>
          <h1 style={{ fontSize: 48, fontWeight: 800, margin: "24px 0 16px", lineHeight: 1.15 }}>
            Vos réseaux sociaux publiés tout seuls,
            <br />
            chaque jour, sans y penser.
          </h1>
          <p style={{ fontSize: 20, color: "var(--muted)", maxWidth: 640, margin: "0 auto 32px" }}>
            L'IA génère un post et une vidéo par jour, adaptés à votre activité, et les
            publie aux meilleures heures sur LinkedIn, Instagram, TikTok et Facebook.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
            <Link href="/sign-up" className="bouton amber">
              Essayer gratuitement
            </Link>
            <Link href="/pricing" className="bouton contour" style={{ borderColor: "white", color: "white" }}>
              Voir les tarifs
            </Link>
          </div>
        </div>
      </section>

      <section style={{ padding: "72px 0" }}>
        <div className="conteneur">
          <h2 style={{ textAlign: "center", fontSize: 32, marginBottom: 48 }}>Comment ça marche</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24 }}>
            {[
              { titre: "1. Vous répondez à quelques questions", texte: "Votre activité, votre ton, votre cible. 5 minutes, une seule fois." },
              { titre: "2. L'IA génère votre contenu", texte: "Un post texte + image chaque jour, et une courte vidéo verticale." },
              { titre: "3. Publication automatique", texte: "Aux heures optimales pour chaque réseau, sans aucune action de votre part." },
            ].map((etape) => (
              <div className="carte" key={etape.titre}>
                <h3 style={{ marginTop: 0 }}>{etape.titre}</h3>
                <p style={{ color: "#556072" }}>{etape.texte}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "72px 0", background: "white" }}>
        <div className="conteneur">
          <h2 style={{ textAlign: "center", fontSize: 32, marginBottom: 48 }}>Tarifs</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
            {Object.values(PALIERS).map((palier) => (
              <div className="carte" key={palier.id} style={{ textAlign: "center" }}>
                <h3 style={{ marginTop: 0 }}>{palier.nom}</h3>
                <p style={{ fontSize: 32, fontWeight: 800, margin: "8px 0" }}>
                  {palier.prixMensuel === null ? "Sur devis" : palier.prixMensuel === 0 ? "Gratuit" : `${palier.prixMensuel} €/mois`}
                </p>
                <p style={{ color: "#556072", fontSize: 14, minHeight: 60 }}>{palier.description}</p>
                <Link href="/sign-up" className="bouton contour" style={{ display: "block", marginTop: 16 }}>
                  Choisir
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
