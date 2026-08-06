import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { Webhook } from "svix";
import { db } from "@/lib/db";

// Crée l'utilisateur en base dès son inscription (Google ou email/mdp géré
// par Clerk), pour qu'il existe déjà quand le dashboard se charge la première
// fois. Vérifié par signature svix : Clerk signe chaque webhook.
export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ erreur: "CLERK_WEBHOOK_SECRET manquant." }, { status: 500 });

  const corps = await req.text();
  const en_tete = await headers();
  const webhook = new Webhook(secret);

  let event: any;
  try {
    event = webhook.verify(corps, {
      "svix-id": en_tete.get("svix-id")!,
      "svix-timestamp": en_tete.get("svix-timestamp")!,
      "svix-signature": en_tete.get("svix-signature")!,
    });
  } catch {
    return NextResponse.json({ erreur: "Signature svix invalide." }, { status: 400 });
  }

  if (event.type === "user.created") {
    const { id, email_addresses } = event.data;
    const email = email_addresses?.[0]?.email_address;
    if (email) {
      await db.utilisateur.upsert({
        where: { clerkId: id },
        create: { clerkId: id, email },
        update: { email },
      });
    }
  }

  if (event.type === "user.deleted") {
    await db.utilisateur.deleteMany({ where: { clerkId: event.data.id } });
  }

  return NextResponse.json({ recu: true });
}
