"use client";

/**
 * Saisie manuelle d'une parcelle :
 *  - Mode A : recherche par référence cadastrale (commune → INSEE via API Géo,
 *    puis section + numéro via API Carto).
 *  - Mode B : confirmation d'une parcelle pointée sur la carte
 *    (candidats fournis via `candidatsInitiaux`).
 * Gère les cas « plusieurs parcelles renvoyées » (choix) et « aucune » (message).
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { calculerCentroide, formaterHectares } from "@/lib/geo";
import type { CommuneApiGeo, ParcelleCadastraleFeature } from "@/types/geo";
import type { ClientResume } from "./page-carte";

interface Props {
  open: boolean;
  onClose: () => void;
  clients: ClientResume[];
  /** Mode B / C : parcelles candidates issues du clic carte ou du tracé */
  candidatsInitiaux: ParcelleCadastraleFeature[] | null;
  /** true si les candidats proviennent d'un tracé manuel (libellés adaptés) */
  estDessin?: boolean;
  /** Affiche la géométrie en surbrillance sur la carte (+ recentrage) */
  onApercu: (geom: GeoJSON.Geometry | null, centre?: { lat: number; lng: number }) => void;
  onSucces: () => void;
}

/** Code INSEE d'une feature cadastrale (code_insee ou code_dep+code_com). */
function codeInseeDe(f: ParcelleCadastraleFeature): string {
  return String(f.properties.code_insee ?? `${f.properties.code_dep ?? ""}${f.properties.code_com ?? ""}`);
}

export function FormulaireParcelle({
  open,
  onClose,
  clients,
  candidatsInitiaux,
  estDessin = false,
  onApercu,
  onSucces,
}: Props) {
  // ---- Recherche par référence (Mode A) ----
  const [rechercheCommune, setRechercheCommune] = useState("");
  const [suggestions, setSuggestions] = useState<CommuneApiGeo[]>([]);
  const [commune, setCommune] = useState<CommuneApiGeo | null>(null);
  const [section, setSection] = useState("");
  const [numero, setNumero] = useState("");
  const [enRecherche, setEnRecherche] = useState(false);

  // ---- Candidats + sélection ----
  const [candidats, setCandidats] = useState<ParcelleCadastraleFeature[]>([]);
  const [choisi, setChoisi] = useState<ParcelleCadastraleFeature | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // ---- Rattachement ----
  const [clientId, setClientId] = useState("");
  const [cepage, setCepage] = useState("");
  const [millesime, setMillesime] = useState("");
  const [notes, setNotes] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);

  // Initialisation Mode B : candidats fournis par le clic carte
  useEffect(() => {
    if (open && candidatsInitiaux) {
      setCandidats(candidatsInitiaux);
      if (candidatsInitiaux.length === 1) choisirCandidat(candidatsInitiaux[0]);
    }
    if (!open) reinitialiser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, candidatsInitiaux]);

  // Autocomplétion commune (debounce 300 ms)
  useEffect(() => {
    if (rechercheCommune.length < 2 || commune?.nom === rechercheCommune) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const reponse = await fetch(`/api/communes?nom=${encodeURIComponent(rechercheCommune)}`);
      if (reponse.ok) setSuggestions(await reponse.json());
    }, 300);
    return () => clearTimeout(timer);
  }, [rechercheCommune, commune]);

  function reinitialiser() {
    setRechercheCommune("");
    setSuggestions([]);
    setCommune(null);
    setSection("");
    setNumero("");
    setCandidats([]);
    setChoisi(null);
    setMessage(null);
    setClientId("");
    setCepage("");
    setMillesime("");
    setNotes("");
  }

  function choisirCandidat(f: ParcelleCadastraleFeature) {
    setChoisi(f);
    const centre = calculerCentroide(f.geometry);
    onApercu(f.geometry, centre);
  }

  /** Mode A : interrogation de l'API Carto par référence. */
  async function rechercher() {
    if (!commune || !section.trim() || !numero.trim()) {
      setMessage("Renseignez la commune, la section et le numéro.");
      return;
    }
    setEnRecherche(true);
    setMessage(null);
    setCandidats([]);
    setChoisi(null);
    try {
      const params = new URLSearchParams({
        code_insee: commune.code,
        section: section.trim(),
        numero: numero.trim(),
      });
      const reponse = await fetch(`/api/cadastre?${params}`);
      const donnees = await reponse.json();
      const features = (donnees.features ?? []) as ParcelleCadastraleFeature[];
      if (features.length === 0) {
        setMessage(
          `Aucune parcelle ${section.toUpperCase()} ${numero} trouvée à ${commune.nom}. ` +
            "Vérifiez la référence cadastrale."
        );
      } else {
        setCandidats(features);
        if (features.length === 1) choisirCandidat(features[0]);
        else setMessage("Plusieurs parcelles correspondent : choisissez ci-dessous.");
      }
    } catch {
      setMessage("Erreur lors de l'interrogation du cadastre IGN.");
    } finally {
      setEnRecherche(false);
    }
  }

  /** Enregistre la parcelle confirmée, rattachée au client. */
  async function enregistrer() {
    if (!choisi || !clientId) {
      setMessage("Sélectionnez une parcelle et un client.");
      return;
    }
    setEnregistrement(true);
    try {
      const reponse = await fetch("/api/parcelles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          codeInsee: codeInseeDe(choisi) || commune?.code || "",
          commune: String(choisi.properties.nom_com ?? commune?.nom ?? ""),
          section: String(choisi.properties.section ?? section).toUpperCase(),
          numero: String(choisi.properties.numero ?? numero),
          geometry: choisi.geometry,
          surfaceM2: choisi.properties.contenance ?? null,
          cepage: cepage || null,
          millesime: millesime ? parseInt(millesime, 10) : null,
          notes: notes || null,
          source: "MANUEL",
        }),
      });
      if (reponse.ok) {
        onSucces();
      } else {
        const donnees = await reponse.json();
        setMessage(donnees.erreur ?? "Erreur lors de l'enregistrement.");
      }
    } finally {
      setEnregistrement(false);
    }
  }

  const modePointage = candidatsInitiaux !== null;

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>
        {estDessin
          ? "Confirmer la zone dessinée"
          : modePointage
            ? "Confirmer la parcelle pointée"
            : "Nouvelle parcelle par référence"}
      </DialogTitle>

      <div className="space-y-4">
        {/* ---- Mode A : recherche par référence cadastrale ---- */}
        {!modePointage && (
          <div className="space-y-3 rounded-md border p-3">
            <div className="relative space-y-2">
              <Label htmlFor="commune">Commune</Label>
              <Input
                id="commune"
                placeholder="Ex : Riquewihr"
                value={rechercheCommune}
                onChange={(e) => {
                  setRechercheCommune(e.target.value);
                  setCommune(null);
                }}
                autoComplete="off"
              />
              {suggestions.length > 0 && (
                <ul className="absolute z-10 max-h-44 w-full overflow-y-auto rounded-md border bg-background shadow">
                  {suggestions.map((c) => (
                    <li key={c.code}>
                      <button
                        type="button"
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
                        onClick={() => {
                          setCommune(c);
                          setRechercheCommune(c.nom);
                          setSuggestions([]);
                        }}
                      >
                        {c.nom} <span className="text-muted-foreground">({c.codeDepartement} — INSEE {c.code})</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="section">Section</Label>
                <Input
                  id="section"
                  placeholder="Ex : AB"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numero">Numéro</Label>
                <Input
                  id="numero"
                  placeholder="Ex : 123"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={rechercher} disabled={enRecherche} className="w-full">
              {enRecherche ? "Recherche…" : "Rechercher la parcelle"}
            </Button>
          </div>
        )}

        {message && <p className="text-sm text-amber-700">{message}</p>}

        {/* ---- Choix parmi plusieurs candidats ---- */}
        {candidats.length > 1 && (
          <div className="space-y-1">
            <Label>Parcelles trouvées</Label>
            {candidats.map((f, i) => (
              <button
                key={i}
                type="button"
                className={`w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-accent ${
                  choisi === f ? "border-primary bg-accent" : ""
                }`}
                onClick={() => choisirCandidat(f)}
              >
                {String(f.properties.nom_com ?? "")} — {String(f.properties.section ?? "")}{" "}
                {String(f.properties.numero ?? "")} —{" "}
                {formaterHectares(f.properties.contenance ?? null)}
              </button>
            ))}
          </div>
        )}

        {/* ---- Confirmation + rattachement ---- */}
        {choisi && (
          <div className="space-y-3 rounded-md border border-primary/40 bg-primary/5 p-3">
            <p className="text-sm">
              ✔ Parcelle <b>{String(choisi.properties.section ?? section)}{" "}
              {String(choisi.properties.numero ?? numero)}</b>
              {choisi.properties.nom_com ? ` à ${choisi.properties.nom_com}` : ""} —{" "}
              {formaterHectares(choisi.properties.contenance ?? null)} (surbrillance sur la carte)
            </p>
            <div className="space-y-2">
              <Label htmlFor="client">Client *</Label>
              <Select id="client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">— Choisir un client —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="cepage">Cépage</Label>
                <Input id="cepage" value={cepage} onChange={(e) => setCepage(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="millesime">Millésime</Label>
                <Input
                  id="millesime"
                  type="number"
                  value={millesime}
                  onChange={(e) => setMillesime(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button onClick={enregistrer} disabled={enregistrement || !clientId} className="w-full">
              {enregistrement ? "Enregistrement…" : "Enregistrer la parcelle"}
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
