import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export default function LayoutDashboard({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 24px",
          background: "var(--ink)",
          color: "white",
        }}
      >
        <nav style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <strong>CEMATYS Auto Post AI</strong>
          <Link href="/dashboard" style={{ color: "var(--muted)" }}>Aperçu</Link>
          <Link href="/dashboard/profil" style={{ color: "var(--muted)" }}>Profil</Link>
          <Link href="/dashboard/posts" style={{ color: "var(--muted)" }}>Posts</Link>
          <Link href="/dashboard/reseaux" style={{ color: "var(--muted)" }}>Réseaux</Link>
          <Link href="/pricing" style={{ color: "var(--muted)" }}>Abonnement</Link>
        </nav>
        <UserButton afterSignOutUrl="/" />
      </header>
      <main className="conteneur" style={{ padding: "32px 0" }}>
        {children}
      </main>
    </div>
  );
}
