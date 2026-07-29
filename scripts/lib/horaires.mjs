// Calcule le prochain créneau de publication d'un réseau, en heure locale de Paris,
// et le renvoie en instant UTC exploitable par l'API.
//
// Le décalage de Paris n'est pas constant (heure d'été/hiver) : on le lit via Intl
// plutôt que de le coder en dur, sinon les publications dérivent d'une heure deux
// fois par an.

// Décalage de Paris, en minutes, à un instant donné.
function decalageMinutes(instant, fuseau) {
  const partie = new Intl.DateTimeFormat("en-US", {
    timeZone: fuseau,
    timeZoneName: "longOffset",
  })
    .formatToParts(instant)
    .find((p) => p.type === "timeZoneName").value; // ex. "GMT+02:00"

  const m = partie.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 0; // "GMT" seul = UTC
  const signe = m[1] === "-" ? -1 : 1;
  return signe * (Number(m[2]) * 60 + Number(m[3]));
}

// Convertit une date/heure locale du fuseau en instant UTC.
// Le décalage dépend de l'instant lui-même : on l'estime, puis on le recalcule sur
// la valeur corrigée pour retomber juste même à cheval sur un changement d'heure.
function localVersUtc(annee, mois, jour, heure, minute, fuseau) {
  const naif = Date.UTC(annee, mois - 1, jour, heure, minute);
  let instant = new Date(naif - decalageMinutes(new Date(naif), fuseau) * 60000);
  instant = new Date(naif - decalageMinutes(instant, fuseau) * 60000);
  return instant;
}

// Jour de la semaine (1 = lundi … 7 = dimanche) dans le fuseau visé.
function jourSemaine(instant, fuseau) {
  const nom = new Intl.DateTimeFormat("en-US", {
    timeZone: fuseau,
    weekday: "short",
  }).format(instant);
  return { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[nom];
}

// Date civile (année, mois, jour) dans le fuseau visé.
function dateCivile(instant, fuseau) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: fuseau,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(instant)
      .map((x) => [x.type, x.value])
  );
  return { annee: Number(p.year), mois: Number(p.month), jour: Number(p.day) };
}

/**
 * Prochain créneau disponible pour un réseau.
 * Renvoie null si le réseau n'a pas de créneau configuré : l'appelant publie alors
 * immédiatement plutôt que de bloquer.
 */
export function prochainCreneau(reseau, config, maintenant = new Date()) {
  const regle = config.reseaux[reseau];
  if (!regle) return null;

  const fuseau = config.fuseau || "Europe/Paris";
  const plancher = new Date(
    maintenant.getTime() + (config.delaiMinimumMinutes ?? 0) * 60000
  );

  // Deux semaines de recherche : largement assez, même pour un réseau limité à un
  // seul jour par semaine.
  for (let decalage = 0; decalage < 14; decalage++) {
    const jourVise = new Date(maintenant.getTime() + decalage * 86400000);
    if (!regle.jours.includes(jourSemaine(jourVise, fuseau))) continue;

    const { annee, mois, jour } = dateCivile(jourVise, fuseau);
    for (const h of regle.heures) {
      const [hh, mm] = h.split(":").map(Number);
      const instant = localVersUtc(annee, mois, jour, hh, mm, fuseau);
      if (instant > plancher) return instant;
    }
  }
  return null;
}

export const _internes = { decalageMinutes, localVersUtc, jourSemaine };
