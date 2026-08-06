import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export default async function PagePosts() {
  const { userId } = await auth();
  const utilisateur = await db.utilisateur.findUnique({ where: { clerkId: userId! } });
  const posts = utilisateur
    ? await db.post.findMany({ where: { utilisateurId: utilisateur.id }, orderBy: { creeLe: "desc" }, take: 30 })
    : [];

  return (
    <div>
      <h1>Vos posts</h1>
      {posts.length === 0 && (
        <p style={{ color: "#556072" }}>
          Aucun post pour l'instant. Le premier sera généré automatiquement selon votre palier.
        </p>
      )}
      <div style={{ display: "grid", gap: 16 }}>
        {posts.map((post) => (
          <div className="carte" key={post.id}>
            <span className="etiquette">{post.theme}</span>
            <h3 style={{ marginBottom: 4 }}>{post.hook}</h3>
            <p style={{ color: "#556072", whiteSpace: "pre-line" }}>{post.corps}</p>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>
              {post.statut} {post.aVideo ? "· avec vidéo" : "· image"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
