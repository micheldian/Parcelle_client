"use client";

/**
 * Page Chantiers : kanban par statut (À faire / Envoyé / En cours / Terminé),
 * création de chantier et envoi à la main d'œuvre (dispatch Telegram).
 */
import { useCallback, useEffect, useState } from "react";
import { Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import {
  COULEURS_STATUT,
  LIBELLES_STATUT_CHANTIER,
  LIBELLES_TYPE_TRAVAIL,
} from "@/lib/constants";
import { formaterHectares } from "@/lib/geo";

interface ParcelleChantier {
  parcelle: {
    id: string;
    commune: string;
    section: string;
    numero: string;
    surfaceM2: number | null;
    client: { nom: string; couleur: string };
  };
}

interface Chantier {
  id: string;
  titre: string;
  typeTravail: string;
  datePrevue: string | null;
  equipe: string | null;
  statut: "A_FAIRE" | "ENVOYE" | "EN_COURS" | "TERMINE";
  consignes: string | null;
  parcelles: ParcelleChantier[];
}

const STATUTS: Chantier["statut"][] = ["A_FAIRE", "ENVOYE", "EN_COURS", "TERMINE"];

export default function PageChantiers() {
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [dialogOuvert, setDialogOuvert] = useState(false);
  const [parcellesDisponibles, setParcellesDisponibles] = useState<
    { id: string; libelle: string }[]
  >([]);
  const [message, setMessage] = useState<string | null>(null);

  // Formulaire de création
  const [titre, setTitre] = useState("");
  const [typeTravail, setTypeTravail] = useState("TAILLE");
  const [datePrevue, setDatePrevue] = useState("");
  const [equipe, setEquipe] = useState("");
  const [consignes, setConsignes] = useState("");
  const [parcelleIds, setParcelleIds] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(async () => {
    const reponse = await fetch("/api/chantiers");
    if (reponse.ok) setChantiers(await reponse.json());
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  /** Charge toutes les parcelles pour la sélection multiple du formulaire. */
  async function ouvrirCreation() {
    setTitre(""); setTypeTravail("TAILLE"); setDatePrevue("");
    setEquipe(""); setConsignes(""); setParcelleIds([]);
    const reponse = await fetch("/api/parcelles");
    if (reponse.ok) {
      const parcelles = (await reponse.json()) as {
        id: string; commune: string; section: string; numero: string;
        client: { nom: string };
      }[];
      setParcellesDisponibles(
        parcelles.map((p) => ({
          id: p.id,
          libelle: `${p.client.nom} — ${p.commune} ${p.section} ${p.numero}`,
        }))
      );
    }
    setDialogOuvert(true);
  }

  async function creer() {
    setEnvoi(true);
    try {
      const reponse = await fetch("/api/chantiers", {
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
      if (reponse.ok) {
        setDialogOuvert(false);
        charger();
      }
    } finally {
      setEnvoi(false);
    }
  }

  /** Dispatch Telegram : récap + une position GPS par parcelle. */
  async function dispatcher(c: Chantier) {
    if (!confirm(`Envoyer le chantier « ${c.titre} » à la main d'œuvre sur Telegram ?`)) return;
    setMessage(null);
    const reponse = await fetch(`/api/chantiers/${c.id}/dispatch`, { method: "POST" });
    const donnees = await reponse.json();
    if (reponse.ok) {
      setMessage(`✔ Chantier « ${c.titre} » envoyé à l'équipe.`);
      charger();
    } else {
      setMessage(`✖ ${donnees.erreur ?? "Échec de l'envoi"}`);
    }
  }

  async function changerStatut(c: Chantier, statut: string) {
    await fetch(`/api/chantiers/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut }),
    });
    charger();
  }

  async function supprimer(c: Chantier) {
    if (!confirm(`Supprimer le chantier « ${c.titre} » ?`)) return;
    await fetch(`/api/chantiers/${c.id}`, { method: "DELETE" });
    charger();
  }

  function basculerParcelle(id: string) {
    setParcelleIds((prec) =>
      prec.includes(id) ? prec.filter((x) => x !== id) : [...prec, id]
    );
  }

  return (
    <div className="flex h-full flex-col space-y-4 overflow-y-auto p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Chantiers</h1>
        <Button onClick={ouvrirCreation}>
          <Plus className="h-4 w-4" /> Nouveau chantier
        </Button>
      </div>

      {message && <p className="text-sm font-medium">{message}</p>}

      {/* Kanban par statut */}
      <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-4">
        {STATUTS.map((statut) => (
          <div key={statut} className="rounded-lg bg-muted/50 p-2">
            <div className="mb-2 flex items-center gap-2 px-1">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: COULEURS_STATUT[statut] }}
              />
              <h2 className="text-sm font-semibold">{LIBELLES_STATUT_CHANTIER[statut]}</h2>
              <span className="text-xs text-muted-foreground">
                {chantiers.filter((c) => c.statut === statut).length}
              </span>
            </div>
            <div className="space-y-2">
              {chantiers
                .filter((c) => c.statut === statut)
                .map((c) => (
                  <Card key={c.id}>
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="text-sm">{c.titre}</CardTitle>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary">{LIBELLES_TYPE_TRAVAIL[c.typeTravail]}</Badge>
                        {c.datePrevue && (
                          <Badge variant="outline">
                            {new Date(c.datePrevue).toLocaleDateString("fr-FR")}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 p-3 pt-1 text-xs">
                      {c.equipe && <p className="text-muted-foreground">Équipe : {c.equipe}</p>}
                      <ul className="space-y-0.5">
                        {c.parcelles.slice(0, 4).map(({ parcelle: p }) => (
                          <li key={p.id} className="flex items-center gap-1.5">
                            <span
                              className="inline-block h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: p.client.couleur }}
                            />
                            <span className="truncate">
                              {p.client.nom} — {p.commune} {p.section} {p.numero} (
                              {formaterHectares(p.surfaceM2)})
                            </span>
                          </li>
                        ))}
                        {c.parcelles.length > 4 && (
                          <li className="text-muted-foreground">
                            + {c.parcelles.length - 4} autre(s)…
                          </li>
                        )}
                        {c.parcelles.length === 0 && (
                          <li className="text-muted-foreground">Aucune parcelle rattachée</li>
                        )}
                      </ul>
                      <div className="flex items-center gap-1 pt-1">
                        {statut !== "TERMINE" && (
                          <Button
                            size="sm"
                            onClick={() => dispatcher(c)}
                            disabled={c.parcelles.length === 0}
                            title="Envoyer à la main d'œuvre (Telegram)"
                          >
                            <Send className="h-3.5 w-3.5" />
                            Envoyer
                          </Button>
                        )}
                        <Select
                          value={c.statut}
                          onChange={(e) => changerStatut(c, e.target.value)}
                          className="h-8 flex-1 text-xs"
                        >
                          {STATUTS.map((s) => (
                            <option key={s} value={s}>
                              {LIBELLES_STATUT_CHANTIER[s]}
                            </option>
                          ))}
                        </Select>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => supprimer(c)}
                          aria-label="Supprimer"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Dialogue de création */}
      <Dialog open={dialogOuvert} onClose={() => setDialogOuvert(false)}>
        <DialogTitle>Nouveau chantier</DialogTitle>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="titre">Titre *</Label>
            <Input id="titre" value={titre} onChange={(e) => setTitre(e.target.value)} />
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
              <Input type="date" value={datePrevue} onChange={(e) => setDatePrevue(e.target.value)} />
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
          <div className="space-y-2">
            <Label>Parcelles rattachées ({parcelleIds.length})</Label>
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border p-2">
              {parcellesDisponibles.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={parcelleIds.includes(p.id)}
                    onChange={() => basculerParcelle(p.id)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="truncate">{p.libelle}</span>
                </label>
              ))}
              {parcellesDisponibles.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune parcelle enregistrée.</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Astuce : vous pouvez aussi sélectionner les parcelles directement sur la carte
              (Ctrl+clic) puis « Créer un chantier ».
            </p>
          </div>
          <Button onClick={creer} disabled={envoi || !titre.trim()} className="w-full">
            {envoi ? "Création…" : "Créer le chantier"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
