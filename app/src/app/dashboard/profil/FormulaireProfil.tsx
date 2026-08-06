"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Profil {
  type: string;
  nom: string;
  site: string | null;
  activite: string;
  zone: string;
  cible: string;
  depuis: number | null;
  ton: string[];
  themes: string[];
  interdits: string[];
  voixTts: string;
  styleBroll: string;
}

const VIDE: Profil = {
  type: "ENTREPRISE",
  nom: "",
  site: "",
  activite: "",
  zone: "",
  cible: "",
  depuis: null,
  ton: [],
  themes: [],
  interdits: [],
  voixTts: "fr-FR-HenriNeural",
  styleBroll: "",
};

// Champ texte simple → tableau (une valeur par ligne), pour rester lisible
// sans devoir construire un composant "liste éditable" pour ce prototype.
function texteVersListe(texte: string) {
  return texte.split("\n").map((l) => l.trim()).filter(Boolean);
}

export function FormulaireProfil({ profilExistant }: { profilExistant: Profil | null }) {
  const router = useRouter();
  const [profil, setProfil] = useState<Profil>(profilExistant ?? VIDE);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    await fetch("/api/profil", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profil),
    });
    setEnvoi(false);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={soumettre} style={{ display: "grid", gap: 16 }}>
      <label>
        Type
        <select value={profil.type} onChange={(e) => setProfil({ ...profil, type: e.target.value })}>
          <option value="ENTREPRISE">Entreprise</option>
          <option value="PARTICULIER">Particulier</option>
        </select>
      </label>

      <label>
        Nom
        <input required value={profil.nom} onChange={(e) => setProfil({ ...profil, nom: e.target.value })} />
      </label>

      <label>
        Site web
        <input value={profil.site ?? ""} onChange={(e) => setProfil({ ...profil, site: e.target.value })} />
      </label>

      <label>
        Activité
        <textarea required value={profil.activite} onChange={(e) => setProfil({ ...profil, activite: e.target.value })} />
      </label>

      <label>
        Zone géographique
        <input required value={profil.zone} onChange={(e) => setProfil({ ...profil, zone: e.target.value })} />
      </label>

      <label>
        Cible
        <input required value={profil.cible} onChange={(e) => setProfil({ ...profil, cible: e.target.value })} />
      </label>

      <label>
        Ton (une règle par ligne)
        <textarea
          value={profil.ton.join("\n")}
          onChange={(e) => setProfil({ ...profil, ton: texteVersListe(e.target.value) })}
        />
      </label>

      <label>
        Thèmes (un par ligne)
        <textarea
          value={profil.themes.join("\n")}
          onChange={(e) => setProfil({ ...profil, themes: texteVersListe(e.target.value) })}
        />
      </label>

      <label>
        Interdits stricts (un par ligne)
        <textarea
          value={profil.interdits.join("\n")}
          onChange={(e) => setProfil({ ...profil, interdits: texteVersListe(e.target.value) })}
        />
      </label>

      <label>
        Voix TTS
        <select value={profil.voixTts} onChange={(e) => setProfil({ ...profil, voixTts: e.target.value })}>
          <option value="fr-FR-HenriNeural">Henri (homme)</option>
          <option value="fr-FR-DeniseNeural">Denise (femme)</option>
        </select>
      </label>

      <label>
        Style des images/vidéos d'illustration
        <input value={profil.styleBroll} onChange={(e) => setProfil({ ...profil, styleBroll: e.target.value })} />
      </label>

      <button type="submit" className="bouton amber" disabled={envoi}>
        {envoi ? "Enregistrement..." : "Enregistrer"}
      </button>
    </form>
  );
}
