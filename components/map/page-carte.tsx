"use client";

/**
 * Écran principal « Carte » : orchestre la carte Leaflet, le panneau latéral,
 * la saisie manuelle de parcelles (Mode A référence, Mode B clic/cadastre,
 * Mode C dessin libre) et l'ajout de parcelles à un chantier.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { BornesCarte } from "./carte-parcelles";
import { PanneauLateral, type Filtres } from "./panneau-lateral";
import { FormulaireParcelle } from "./formulaire-parcelle";
import { DialogChantier } from "./dialog-chantier";
import { DialogEditionParcelle } from "./dialog-edition-parcelle";
import { calculerCentroide, calculerSurfaceM2 } from "@/lib/geo";
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
  const [formEstDessin, setFormEstDessin] = useState(false);

  // ---- Mode dessin (tracé manuel) ----
  const [modeDessin, setModeDessin] = useState(false);
  const [pointsDessin, setPointsDessin] = useState<[number, number][]>([]);
  const [dessinEnCours, setDessinEnCours] = useState(false); // reverse cadastre en cours

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

  /** Active le mode pointage (et coupe le mode dessin). */
  function basculerPointage() {
    setModeDessin(false);
    setPointsDessin([]);
    setModePointage((m) => !m);
  }

  /** Active le mode dessin (et coupe le mode pointage). */
  function basculerDessin() {
    setModePointage(false);
    setPointsDessin([]);
    setModeDessin((m) => !m);
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
      setFormEstDessin(false);
      setCandidatsPointage(features);
      setModePointage(false);
      setFormOuvert(true);
    } catch {
      alert("Erreur lors de l'interrogation du cadastre.");
    } finally {
      setRecherchePointEnCours(false);
    }
  }

  /** Mode C : chaque clic ajoute un sommet au tracé. */
  function clicCarteDessin(lat: number, lng: number) {
    setPointsDessin((prec) => [...prec, [lat, lng]]);
  }

  /**
   * Termine le tracé : construit le polygone GeoJSON, tente de récupérer la
   * référence cadastrale (commune/section/numéro) au centre via l'IGN, puis
   * ouvre le formulaire de rattachement avec la géométrie dessinée.
   */
  async function terminerDessin() {
    if (pointsDessin.length < 3 || dessinEnCours) return;
    setDessinEnCours(true);
    try {
      // GeoJSON Polygon : [lng, lat] + anneau fermé
      const anneau = pointsDessin.map(([la, ln]) => [ln, la]);
      anneau.push(anneau[0]);
      const geometry: GeoJSON.Polygon = { type: "Polygon", coordinates: [anneau] };
      const { lat, lng } = calculerCentroide(geometry);

      // Reverse cadastre au centre (best effort, on garde le tracé dessiné)
      let props: ParcelleCadastraleFeature["properties"] = {};
      try {
        const reponse = await fetch(`/api/cadastre?lat=${lat}&lng=${lng}`);
        if (reponse.ok) {
          const f = ((await reponse.json()).features ?? [])[0] as ParcelleCadastraleFeature | undefined;
          if (f) props = f.properties;
        }
      } catch {
        // tracé conservé même si l'IGN ne répond pas
      }

      // Pseudo-numéro stable basé sur le centre (anti-doublon quand pas de réf)
      const pseudoNumero = `${Math.round(lat * 1e5).toString(36)}${Math.round(lng * 1e5).toString(36)}`.toUpperCase();
      const codeInsee =
        (props.code_insee as string) ||
        `${props.code_dep ?? ""}${props.code_com ?? ""}` ||
        "00000";

      // Feature synthétique : géométrie = tracé, métadonnées = cadastre (si trouvé)
      const synthetique: ParcelleCadastraleFeature = {
        type: "Feature",
        geometry,
        properties: {
          nom_com: (props.nom_com as string) || "Zone dessinée",
          code_insee: codeInsee,
          section: (props.section as string) || "GE",
          numero: (props.numero as string) || pseudoNumero,
          // Surface du tracé réel (pas la contenance cadastrale)
          contenance: calculerSurfaceM2(geometry) ?? undefined,
        },
      };

      setFormEstDessin(true);
      setCandidatsPointage([synthetique]);
      setModeDessin(false);
      setPointsDessin([]);
      setFormOuvert(true);
    } finally {
      setDessinEnCours(false);
    }
  }

  function annulerDernierPoint() {
    setPointsDessin((prec) => prec.slice(0, -1));
  }

  function annulerDessin() {
    setPointsDessin([]);
    setModeDessin(false);
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
    setFormEstDessin(false);
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
        onNouvelleParcelle={() => {
          setFormEstDessin(false);
          setFormOuvert(true);
        }}
        modePointage={modePointage}
        onBasculerPointage={basculerPointage}
        modeDessin={modeDessin}
        onBasculerDessin={basculerDessin}
        onChantierDepuisSelection={() => setParcellesPourChantier(Array.from(selectionIds))}
      />

      {/* Carte */}
      <div className="relative min-w-0 flex-1">
        {modePointage && (
          <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-md bg-yellow-400 px-3 py-1.5 text-sm font-medium shadow">
            {recherchePointEnCours
              ? "Recherche de la parcelle…"
              : "Cliquez sur une parcelle (les limites cadastrales sont affichées)"}
          </div>
        )}
        {modeDessin && (
          <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-md bg-yellow-400 px-3 py-1.5 text-sm font-medium shadow">
            <span>
              {dessinEnCours
                ? "Enregistrement du tracé…"
                : `Cliquez les coins de la zone — ${pointsDessin.length} point(s)`}
            </span>
            <button
              onClick={terminerDessin}
              disabled={pointsDessin.length < 3 || dessinEnCours}
              className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground disabled:opacity-50"
            >
              Terminer
            </button>
            <button
              onClick={annulerDernierPoint}
              disabled={pointsDessin.length === 0}
              className="rounded bg-white px-2 py-0.5 text-xs disabled:opacity-50"
            >
              Annuler le dernier
            </button>
            <button onClick={annulerDessin} className="rounded bg-white px-2 py-0.5 text-xs">
              Annuler
            </button>
          </div>
        )}
        <CarteParcelles
          parcelles={parcellesFiltrees}
          selectionIds={selectionIds}
          parcelleActive={parcelleActive}
          apercu={apercu}
          modePointage={modePointage}
          modeDessin={modeDessin}
          pointsDessin={pointsDessin}
          focus={focus}
          onViewport={chargerParcelles}
          onClicParcelle={clicParcelle}
          onFermerPopup={() => setParcelleActive(null)}
          onClicCarte={clicCartePointage}
          onClicCarteDessin={clicCarteDessin}
          onAjouterChantier={(p) => {
            const ids = selectionIds.has(p.id) && selectionIds.size > 1
              ? Array.from(selectionIds)
              : [p.id];
            setParcellesPourChantier(ids);
          }}
          onEditer={(p) => setParcelleEnEdition(p)}
          onSupprimer={supprimerParcelle}
        />
      </div>

      {/* Saisie manuelle (référence / pointage cadastre / tracé dessiné) */}
      <FormulaireParcelle
        open={formOuvert}
        onClose={fermerFormulaire}
        clients={clients}
        candidatsInitiaux={candidatsPointage}
        estDessin={formEstDessin}
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
