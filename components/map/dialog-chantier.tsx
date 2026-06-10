"use client";

/**
 * Dialogue « Ajouter à un chantier » : rattache les parcelles sélectionnées
 * à un chantier existant (non terminé) ou à un nouveau chantier.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { LIBELLES_STATUT_CHANTIER, LIBELLES_TYPE_TRAVAIL } from "@/lib/constants";

interface ChantierResume {
  id: string;
  titre: string;
  typeTravail: string;
  statut: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  parcelleIds: string[];
  onSucces: () => void;
}

export function DialogChantier({ open, onClose, parcelleIds, onSucces }: Props) {
  const [chantiers, setChantiers] = useState<ChantierResume[]>([]);
  const [chantierId, setChantierId] = useState("");
  const [mode, setMode] = useState<"existant" | "nouveau">("nouveau");

  // Champs du nouveau chantier
  const [titre, setTitre] = useState("");
  const [typeTravail, setTypeTravail] = useState("TAILLE");
  const [datePrevue, setDatePrevue] = useState("");
  const [equipe, setEquipe] = useState("");
  const [consignes, setConsignes] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErreur(null);
    // Chantiers non terminés, pour rattachement
    fetch("/api/chantiers")
      .then((r) => r.json())
      .then((donnees: ChantierResume[]) => {
        const ouverts = donnees.filter((c) => c.statut !== "TERMINE");
        setChantiers(ouverts);
        setMode(ouverts.length > 0 ? "existant" : "nouveau");
        setChantierId(ouverts[0]?.id ?? "");
      })
      .catch(() => setChantiers([]));
  }, [open]);

  async function valider() {
    setEnvoi(true);
    setErreur(null);
    try {
      let reponse: Response;
      if (mode === "existant" && chantierId) {
        reponse = await fetch(`/api/chantiers/${chantierId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ajouterParcelleIds: parcelleIds }),
        });
      } else {
        reponse = await fetch("/api/chantiers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            titre,
            typeTravail,
            datePrevue: datePrevue ? new Date(datePrevue).toISOString() : null,
            equipe: equipe || null,
            consignes: consignes || null,
            parcelleIds,
          }),
        });
      }
      if (reponse.ok) {
        onSucces();
      } else {
        const donnees = await reponse.json();
        setErreur(donnees.erreur ?? "Erreur lors de l'enregistrement");
      }
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>
        Ajouter {parcelleIds.length} parcelle(s) à un chantier
      </DialogTitle>

      <div className="space-y-4">
        {/* Choix : chantier existant ou nouveau */}
        <div className="flex gap-2">
          <Button
            variant={mode === "existant" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("existant")}
            disabled={chantiers.length === 0}
          >
            Chantier existant
          </Button>
          <Button
            variant={mode === "nouveau" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("nouveau")}
          >
            Nouveau chantier
          </Button>
        </div>

        {mode === "existant" ? (
          <div className="space-y-2">
            <Label>Chantier</Label>
            <Select value={chantierId} onChange={(e) => setChantierId(e.target.value)}>
              {chantiers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titre} — {LIBELLES_TYPE_TRAVAIL[c.typeTravail]} (
                  {LIBELLES_STATUT_CHANTIER[c.statut]})
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="titre">Titre *</Label>
              <Input
                id="titre"
                placeholder="Ex : Taille — Domaine Muller"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Type de travail</Label>
                <Select value={typeTravail} onChange={(e) => setTypeTravail(e.target.value)}>
                  {Object.entries(LIBELLES_TYPE_TRAVAIL).map(([valeur, libelle]) => (
                    <option key={valeur} value={valeur}>
                      {libelle}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date prévue</Label>
                <Input
                  type="date"
                  value={datePrevue}
                  onChange={(e) => setDatePrevue(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Équipe / responsable</Label>
              <Input value={equipe} onChange={(e) => setEquipe(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Consignes</Label>
              <Textarea value={consignes} onChange={(e) => setConsignes(e.target.value)} />
            </div>
          </div>
        )}

        {erreur && <p className="text-sm text-destructive">{erreur}</p>}

        <Button
          onClick={valider}
          disabled={envoi || (mode === "nouveau" && !titre.trim()) || (mode === "existant" && !chantierId)}
          className="w-full"
        >
          {envoi ? "Enregistrement…" : "Valider"}
        </Button>
      </div>
    </Dialog>
  );
}
