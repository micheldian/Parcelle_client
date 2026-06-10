"use client";

/**
 * Panneau latéral de la carte : filtres (client, commune, cépage, statut),
 * liste des parcelles visibles, sélection multiple, actions de saisie.
 */
import { useState } from "react";
import { ChevronLeft, ChevronRight, Crosshair, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formaterHectares } from "@/lib/geo";
import { LIBELLES_STATUT_CHANTIER, COULEURS_STATUT } from "@/lib/constants";
import type { ParcelleCarte } from "@/types/geo";
import type { ClientResume } from "./page-carte";

export interface Filtres {
  clientId: string;
  commune: string;
  cepage: string;
  statut: string;
}

interface Props {
  parcelles: ParcelleCarte[];
  clients: ClientResume[];
  filtres: Filtres;
  onFiltres: (f: Filtres) => void;
  selectionIds: Set<string>;
  onBasculerSelection: (id: string) => void;
  onViderSelection: () => void;
  onFocus: (p: ParcelleCarte) => void;
  onNouvelleParcelle: () => void;
  modePointage: boolean;
  onBasculerPointage: () => void;
  onChantierDepuisSelection: () => void;
}

export function PanneauLateral({
  parcelles,
  clients,
  filtres,
  onFiltres,
  selectionIds,
  onBasculerSelection,
  onViderSelection,
  onFocus,
  onNouvelleParcelle,
  modePointage,
  onBasculerPointage,
  onChantierDepuisSelection,
}: Props) {
  const [replie, setReplie] = useState(false);

  const surfaceTotale = parcelles.reduce((acc, p) => acc + (p.surfaceM2 ?? 0), 0);

  if (replie) {
    return (
      <button
        onClick={() => setReplie(false)}
        className="flex w-8 shrink-0 items-center justify-center border-r bg-background hover:bg-accent"
        aria-label="Ouvrir le panneau"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    );
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-r bg-background">
      {/* Actions de saisie */}
      <div className="space-y-2 border-b p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Parcelles</h2>
          <button onClick={() => setReplie(true)} aria-label="Replier le panneau">
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={onNouvelleParcelle}>
            <Plus className="h-4 w-4" /> Par référence
          </Button>
          <Button
            size="sm"
            variant={modePointage ? "destructive" : "secondary"}
            className="flex-1"
            onClick={onBasculerPointage}
          >
            <Crosshair className="h-4 w-4" />
            {modePointage ? "Annuler" : "Pointer"}
          </Button>
        </div>
      </div>

      {/* Filtres */}
      <div className="space-y-2 border-b p-3">
        <Select
          value={filtres.clientId}
          onChange={(e) => onFiltres({ ...filtres, clientId: e.target.value })}
        >
          <option value="">Tous les clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </Select>
        <div className="flex gap-2">
          <Input
            placeholder="Commune"
            value={filtres.commune}
            onChange={(e) => onFiltres({ ...filtres, commune: e.target.value })}
          />
          <Input
            placeholder="Cépage"
            value={filtres.cepage}
            onChange={(e) => onFiltres({ ...filtres, cepage: e.target.value })}
          />
        </div>
        <Select
          value={filtres.statut}
          onChange={(e) => onFiltres({ ...filtres, statut: e.target.value })}
        >
          <option value="">Tous les statuts</option>
          {Object.entries(LIBELLES_STATUT_CHANTIER).map(([valeur, libelle]) => (
            <option key={valeur} value={valeur}>
              {libelle}
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">
          {parcelles.length} parcelle(s) visible(s) — {formaterHectares(surfaceTotale)}
        </p>
      </div>

      {/* Sélection multiple → chantier */}
      {selectionIds.size > 0 && (
        <div className="flex items-center gap-2 border-b bg-yellow-50 p-3">
          <span className="flex-1 text-xs font-medium">
            {selectionIds.size} sélectionnée(s)
          </span>
          <Button size="sm" onClick={onChantierDepuisSelection}>
            Créer un chantier
          </Button>
          <Button size="sm" variant="ghost" onClick={onViderSelection}>
            Vider
          </Button>
        </div>
      )}

      {/* Liste des parcelles */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {parcelles.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            Aucune parcelle dans la zone affichée. Déplacez la carte, ajustez les filtres
            ou importez votre fichier clients.
          </p>
        )}
        {parcelles.map((p) => (
          <div
            key={p.id}
            className="flex cursor-pointer items-center gap-2 border-b px-3 py-2 text-sm hover:bg-accent"
            onClick={() => onFocus(p)}
          >
            {/* Case de sélection multiple (équivalent Ctrl+clic carte) */}
            <input
              type="checkbox"
              checked={selectionIds.has(p.id)}
              onChange={() => onBasculerSelection(p.id)}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 accent-primary"
            />
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: p.client.couleur }}
              title={p.client.nom}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{p.client.nom}</div>
              <div className="truncate text-xs text-muted-foreground">
                {p.commune} {p.section} {p.numero}
                {p.cepage ? ` — ${p.cepage}` : ""} — {formaterHectares(p.surfaceM2)}
              </div>
            </div>
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: COULEURS_STATUT[p.dernierStatut ?? "A_FAIRE"] }}
              title={LIBELLES_STATUT_CHANTIER[p.dernierStatut ?? "A_FAIRE"]}
            />
          </div>
        ))}
      </div>
    </aside>
  );
}
