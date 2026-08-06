import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { palierDepuisId } from "@/lib/plans";
import type Stripe from "stripe";

// Source de vérité de l'abonnement : Stripe, pas l'app. On ne fait ici que
// refléter en base ce que Stripe nous annonce, jamais l'inverse.
export async function POST(req: Request) {
  const corps = await req.text();
  const signature = (await headers()).get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(corps, signature!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ erreur: `Signature invalide : ${(err as Error).message}` }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const utilisateurId = session.metadata?.utilisateurId;
      const palier = palierDepuisId(session.metadata?.palier);
      if (!utilisateurId) break;

      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

      await db.abonnement.upsert({
        where: { utilisateurId },
        create: {
          utilisateurId,
          palier,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: subscription.id,
          statutStripe: subscription.status,
          finPeriode: new Date(subscription.current_period_end * 1000),
        },
        update: {
          palier,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: subscription.id,
          statutStripe: subscription.status,
          finPeriode: new Date(subscription.current_period_end * 1000),
        },
      });
      break;
    }

    // Résiliation, échec de paiement, renouvellement : on garde le statut à jour
    // pour que peutGenererPost/Video() retombe sur Free en cas de souci.
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await db.abonnement.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          statutStripe: subscription.status,
          finPeriode: new Date(subscription.current_period_end * 1000),
        },
      });
      break;
    }
  }

  return NextResponse.json({ recu: true });
}
