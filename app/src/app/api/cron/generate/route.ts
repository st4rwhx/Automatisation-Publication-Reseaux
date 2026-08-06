import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { peutGenererPost, incrementerPost } from "@/lib/usage";
import { genererPostDuJour } from "@/lib/generatePost";
import { genererVisuels } from "@/lib/generateImage";

export const runtime = "nodejs"; // satori/resvg ont besoin de Node, pas de l'Edge Runtime
export const maxDuration = 300; // 5 min : nécessite un plan Vercel Pro pour être honoré au-delà de 60s

// Appelé une fois par jour par Vercel Cron (voir vercel.json) pour tous les
// utilisateurs ayant un profil configuré. Isole les échecs par utilisateur :
// un client en erreur ne bloque jamais les autres, comme dans publish-to-postiz.mjs.
export async function GET(req: Request) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ erreur: "Non autorisé." }, { status: 401 });
  }

  const utilisateurs = await db.utilisateur.findMany({
    where: { profil: { isNot: null } },
    include: { profil: true },
  });

  const resultats: Array<{ utilisateurId: string; ok: boolean; detail: string }> = [];

  for (const utilisateur of utilisateurs) {
    try {
      const autorisation = await peutGenererPost(utilisateur.id);
      if (!autorisation.ok) {
        resultats.push({ utilisateurId: utilisateur.id, ok: false, detail: autorisation.raison! });
        continue;
      }

      const genere = await genererPostDuJour(utilisateur.id);

      const post = await db.post.create({
        data: {
          utilisateurId: utilisateur.id,
          theme: genere.theme,
          sujet: genere.sujet,
          hook: genere.hook,
          corps: genere.corps,
          hashtags: genere.hashtags,
          statut: "BROUILLON",
        },
      });

      // Les visuels ne sont pas bloquants : un post sans image reste utile
      // (LinkedIn ne l'exige pas), on ne fait donc pas échouer tout le post
      // si la génération d'image plante.
      try {
        const visuels = await genererVisuels(
          post.id,
          { titre: genere.visuel, tag: genere.theme },
          { nom: utilisateur.profil!.nom, site: (utilisateur.profil!.site ?? "").replace(/^https?:\/\//, "") }
        );
        await db.post.update({ where: { id: post.id }, data: { imageUrl: visuels.paysage } });
      } catch (errImage) {
        console.error(`Visuel échoué pour ${utilisateur.id} : ${(errImage as Error).message}`);
      }

      await incrementerPost(utilisateur.id);
      resultats.push({ utilisateurId: utilisateur.id, ok: true, detail: `post "${genere.sujet}" créé` });
    } catch (err) {
      resultats.push({ utilisateurId: utilisateur.id, ok: false, detail: (err as Error).message });
    }
  }

  return NextResponse.json({
    traites: resultats.length,
    reussis: resultats.filter((r) => r.ok).length,
    resultats,
  });
}
