import { SignUp } from "@clerk/nextjs";

export default function PageInscription() {
  return (
    <main style={{ display: "flex", justifyContent: "center", padding: "80px 24px" }}>
      {/* Clerk gère nativement Google OAuth ET email/mot de passe : les deux
          boutons apparaissent automatiquement selon la config du dashboard Clerk. */}
      <SignUp />
    </main>
  );
}
