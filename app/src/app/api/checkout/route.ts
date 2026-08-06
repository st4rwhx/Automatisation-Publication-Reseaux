import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { PALIERS, type Palier } from "@/lib/plans";

// Crée une session Stripe Checkout pour un palier payant, et rattache le
// customer Stripe à l'utilisateur (créé au besoin) pour retrouver l'abonnement
// plus tard via le webhook.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ erreur: "Non connecté." }, { status: 401 });

  const { palier } = (await req.json()) as { palier: Palier };
  const definition = PALIERS[palier];
  if (!definition?.stripePriceId) {
    return NextResponse.json({ erreur: "Palier invalide ou non configuré côté Stripe." }, { status: 400 });
  }

  const utilisateur = await db.utilisateur.findUnique({
    where: { clerkId: userId },
    include: { abonnement: true },
  });
  if (!utilisateur) return NextResponse.json({ erreur: "Utilisateur introuvable." }, { status: 404 });

  let customerId = utilisateur.abonnement?.stripeCustomerId;
  if (!customerId) {
    const clerkUser = await currentUser();
    const customer = await stripe.customers.create({
      email: utilisateur.email,
      metadata: { utilisateurId: utilisateur.id, clerkId: userId },
      name: clerkUser?.fullName ?? undefined,
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: definition.stripePriceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?paiement=succes`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    metadata: { utilisateurId: utilisateur.id, palier },
  });

  return NextResponse.json({ url: session.url });
}
