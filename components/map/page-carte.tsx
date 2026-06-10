"use client";

/**
 * Écran principal « Carte » : orchestre la carte Leaflet, le panneau latéral,
 * la saisie manuelle de parcelles (Mode A référence / Mode B clic) et
 * l'ajout de parcelles à un chantier.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { BornesCarte } from "./carte-parcelles";
import { PanneauLateral, type Filtres } from "./panneau-lateral";
import { FormulaireParcelle } from "./formulaire-parcelle";
import { DialogChantier } from "./dialog-chantier";
import { DialogEditionParcelle } from "./dialog-edition-parcelle";
import type { ParcelleCadastraleFeature, ParcelleCarte } from "@/types/geo";

// La carte Leaflet ne peut être rendue que côté navigateur
const CarteParcelles = dynamic(() => import("./carte-parcelles"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      Chargement de la carte…
    </div>
  ),
});

export interface ClientResume {
  id: string;
  nom: string;
  couleur: string;
}

export function PageCarte() {
  // ---- Données ----
  const [parcelles, setParcelles] = useState<ParcelleCarte[]>([]);
  const [clients, setClients] = useState<ClientResume[]>([]);
  const dernieresBornes = useRef<BornesCarte | null>(null);

  // ---- Interactions carte ----
  const [selectionIds, setSelectionIds] = useState<Set<string>>(new Set());
  const [parcelleActive, setParcelleActive] = useState<ParcelleCarte | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null);
  const [filtres, setFiltres] = useState<Filtres>({ clientId: "", commune: "", cepage: "", statut: "" });

  // ---- Saisie manuelle ----
  const [formOuvert, setFormOuvert] = useState(false);
  const [modePointage, setModePointage] = useState(false);
  const [candidatsPointage, setCandidatsPointage] = useState<ParcelleCadastraleFeature[] | null>(null);
  const [apercu, setApercu] = useState<GeoJSON.Geometry | null>(null);
  const [recherchePointEnCours, setRecherchePointEnCours] = useState(false);

  // ---- Chantier / édition ----
  const [parcellesPourChantier, setParcellesPourChantier] = useState<string[] | null>(null);
  const [parcelleEnEdition, setParcelleEnEdition] = useState<ParcelleCarte | null>(null);

  /** Charge les parcelles du viewport courant. */
  const chargerParcelles = useCallback(async (bornes?: BornesCarte) => {
    const b = bornes ?? dernieresBornes.current;
    if (bornes) dernieresBornes.current = bornes;
    const params = b
      ? `?sud=${b.sud}&nord=${b.nord}&ouest=${b.ouest}&est=${b.est}`
      : "";
    const reponse = await fetch(`/api/parcelles${params}`);
    if (reponse.ok) setParcelles(await reponse.json());
  }, []);

  /** Charge la liste des clients (filtres + formulaires). */
  const chargerClients = useCallback(async () => {
    const reponse = await fetch("/api/clients");
    if (reponse.ok) {
      const donnees = (await reponse.json()) as ClientResume[];
      setClients(donnees.map(({ id, nom, couleur }) => ({ id, nom, couleur })));
    }
  }, []);

  useEffect(() => {
    chargerClients();
  }, [chargerClients]);

  /** Parcelles après application des filtres du panneau. */
  const parcellesFiltrees = useMemo(() => {
    return parcelles.filter((p) => {
      if (filtres.clientId && p.client.id !== filtres.clientId) return false;
      if (filtres.commune && !p.commune.toLowerCase().includes(filtres.commune.toLowerCase()))
        return false;
      if (filtres.cepage && !(p.cepage ?? "").toLowerCase().includes(filtres.cepage.toLowerCase()))
        return false;
      if (filtres.statut && (p.dernierStatut ?? "A_FAIRE") !== filtres.statut) return false;
      return true;
    });
  }, [parcelles, filtres]);

  /** Clic sur un polygone : Ctrl/Cmd = sélection multiple, sinon popup. */
  function clicParcelle(p: ParcelleCarte, ctrl: boolean) {
    if (ctrl) {
      basculerSelection(p.id);
    } else {
      setParcelleActive(p);
    }
  }

  function basculerSelection(id: string) {
    setSelectionIds((prec) => {
      const suivant = new Set(prec);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });
  }

  /** Mode B : clic sur la carte → recherche de la parcelle intersectée (IGN). */
  async function clicCartePointage(lat: number, lng: number) {
    if (recherchePointEnCours) return;
    setRecherchePointEnCours(true);
    try {
      const reponse = await fetch(`/api/cadastre?lat=${lat}&lng=${lng}`);
      const donnees = await reponse.json();
      const features = (donnees.features ?? []) as ParcelleCadastraleFeature[];
      if (features.length === 0) {
        alert("Aucune parcelle cadastrale trouvée à cet endroit.");
        return;
      }
      setCandidatsPointage(features);
      setModePointage(false);
      setFormOuvert(true);
    } catch {
      alert("Erreur lors de l'interrogation du cadastre.");
    } finally {
      setRecherchePointEnCours(false);
    }
  }

  /** Suppression d'une parcelle (avec confirmation). */
  async function supprimerParcelle(p: ParcelleCarte) {
    if (!confirm(`Supprimer la parcelle ${p.commune} ${p.section} ${p.numero} (${p.client.nom}) ?`))
      return;
    await fetch(`/api/parcelles/${p.id}`, { method: "DELETE" });
    setParcelleActive(null);
    chargerParcelles();
  }

  function fermerFormulaire() {
    setFormOuvert(false);
    setCandidatsPointage(null);
    setApercu(null);
  }

  return (
    <div className="flex h-full">
      {/* Panneau latéral : filtres + liste + actions */}
      <PanneauLateral
        parcelles={parcellesFiltrees}
        clients={clients}
        filtres={filtres}
        onFiltres={setFiltres}
        selectionIds={selectionIds}
        onBasculerSelection={basculerSelection}
        onViderSelection={() => setSelectionIds(new Set())}
        onFocus={(p) => {
          setFocus({ lat: p.centroidLat, lng: p.centroidLng });
          setParcelleActive(p);
        }}
        onNouvelleParcelle={() => setFormOuvert(true)}
        modePointage={modePointage}
        onBasculerPointage={() => setModePointage((m) => !m)}
        onChantierDepuisSelection={() => setParcellesPourChantier(Array.from(selectionIds))}
      />

      {/* Carte */}
      <div className="relative min-w-0 flex-1">
        {modePointage && (
          <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-md bg-yellow-400 px-3 py-1.5 text-sm font-medium shadow">
            {recherchePointEnCours
              ? "Recherche de la parcelle…"
              : "Cliquez sur une parcelle de la carte (Échap. : bouton « Annuler »)"}
          </div>
        )}
        <CarteParcelles
          parcelles={parcellesFiltrees}
          selectionIds={selectionIds}
          parcelleActive={parcelleActive}
          apercu={apercu}
          modePointage={modePointage}
          focus={focus}
          onViewport={chargerParcelles}
          onClicParcelle={clicParcelle}
          onFermerPopup={() => setParcelleActive(null)}
          onClicCarte={clicCartePointage}
          onAjouterChantier={(p) => {
            // Si une sélection multiple existe et inclut la parcelle, on l'utilise
            const ids = selectionIds.has(p.id) && selectionIds.size > 1
              ? Array.from(selectionIds)
              : [p.id];
            setParcellesPourChantier(ids);
          }}
          onEditer={(p) => setParcelleEnEdition(p)}
          onSupprimer={supprimerParcelle}
        />
      </div>

      {/* Saisie manuelle (Mode A référence / Mode B confirmation du pointage) */}
      <FormulaireParcelle
        open={formOuvert}
        onClose={fermerFormulaire}
        clients={clients}
        candidatsInitiaux={candidatsPointage}
        onApercu={(geom, centre) => {
          setApercu(geom);
          if (centre) setFocus(centre);
        }}
        onSucces={() => {
          fermerFormulaire();
          chargerParcelles();
          chargerClients();
        }}
      />

      {/* Ajout à un chantier */}
      <DialogChantier
        open={parcellesPourChantier !== null}
        onClose={() => setParcellesPourChantier(null)}
        parcelleIds={parcellesPourChantier ?? []}
        onSucces={() => {
          setParcellesPourChantier(null);
          setSelectionIds(new Set());
          setParcelleActive(null);
          chargerParcelles();
        }}
      />

      {/* Édition d'une parcelle */}
      <DialogEditionParcelle
        parcelle={parcelleEnEdition}
        clients={clients}
        onClose={() => setParcelleEnEdition(null)}
        onSucces={() => {
          setParcelleEnEdition(null);
          setParcelleActive(null);
          chargerParcelles();
        }}
      />
    </div>
  );
}
