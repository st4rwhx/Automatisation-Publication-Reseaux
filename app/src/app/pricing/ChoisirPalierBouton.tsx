"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import type { Palier } from "@/lib/plans";

// Redirige vers Stripe Checkout pour les paliers payants, ou directement vers
// le dashboard pour le palier gratuit. Si l'utilisateur n'est pas connecté,
// on l'envoie s'inscrire d'abord.
export function ChoisirPalierBouton({ palier }: { palier: Palier }) {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const [chargement, setChargement] = useState(false);

  async function choisir() {
    if (!isSignedIn) {
      router.push(`/sign-up?redirect_url=/pricing`);
      return;
    }
    if (palier === "FREE") {
      router.push("/dashboard");
      return;
    }
    if (palier === "ENTREPRISE") {
      window.location.href = "mailto:contact@cematys.fr?subject=Palier Entreprise";
      return;
    }

    setChargement(true);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ palier }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setChargement(false);
  }

  return (
    <button className="bouton contour" style={{ display: "block", width: "100%", marginTop: 16 }} onClick={choisir} disabled={chargement}>
      {chargement ? "..." : "Choisir"}
    </button>
  );
}
