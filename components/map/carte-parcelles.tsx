"use client";

/**
 * Carte Leaflet : fonds IGN (satellite / plan / overlay cadastre),
 * polygones des parcelles colorés par client, bordure selon le statut
 * du dernier chantier, popup d'actions, mode « pointer une parcelle »
 * (sélection cadastre IGN) et mode « dessiner » (tracé manuel).
 *
 * ⚠️ Chargé exclusivement côté client (dynamic import, ssr: false).
 */
import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  LayersControl,
  GeoJSON,
  Polygon,
  Polyline,
  CircleMarker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { PathOptions } from "leaflet";
import {
  ATTRIBUTION_IGN,
  CENTRE_DEFAUT,
  COULEURS_STATUT,
  FONDS_IGN,
  urlTuilesIGN,
  ZOOM_DEFAUT,
} from "@/lib/constants";
import { formaterHectares } from "@/lib/geo";
import type { ParcelleCarte } from "@/types/geo";
import { Button } from "@/components/ui/button";

export interface BornesCarte {
  sud: number;
  nord: number;
  ouest: number;
  est: number;
}

interface Props {
  parcelles: ParcelleCarte[];
  selectionIds: Set<string>;
  parcelleActive: ParcelleCarte | null;
  /** Géométrie en cours de confirmation (saisie manuelle) : surbrillance jaune */
  apercu: GeoJSON.Geometry | null;
  modePointage: boolean;
  /** Mode dessin : le clic ajoute un sommet au tracé en cours */
  modeDessin: boolean;
  /** Sommets du tracé en cours, en [lat, lng] */
  pointsDessin: [number, number][];
  /** Position vers laquelle recentrer la carte (clic dans le panneau latéral) */
  focus: { lat: number; lng: number } | null;
  onViewport: (bornes: BornesCarte) => void;
  onClicParcelle: (parcelle: ParcelleCarte, ctrl: boolean) => void;
  onFermerPopup: () => void;
  onClicCarte: (lat: number, lng: number) => void;
  onClicCarteDessin: (lat: number, lng: number) => void;
  onAjouterChantier: (parcelle: ParcelleCarte) => void;
  onEditer: (parcelle: ParcelleCarte) => void;
  onSupprimer: (parcelle: ParcelleCarte) => void;
}

/** Remonte les bornes du viewport à chaque déplacement + gère le clic carte. */
function Evenements({
  onViewport,
  onClicCarte,
  onClicCarteDessin,
  modePointage,
  modeDessin,
}: Pick<
  Props,
  "onViewport" | "onClicCarte" | "onClicCarteDessin" | "modePointage" | "modeDessin"
>) {
  const map = useMapEvents({
    moveend: () => signalerBornes(),
    click: (e) => {
      if (modePointage) onClicCarte(e.latlng.lat, e.latlng.lng);
      else if (modeDessin) onClicCarteDessin(e.latlng.lat, e.latlng.lng);
    },
  });

  function signalerBornes() {
    const b = map.getBounds();
    onViewport({
      sud: b.getSouth(),
      nord: b.getNorth(),
      ouest: b.getWest(),
      est: b.getEast(),
    });
  }

  // Chargement initial du viewport
  useEffect(() => {
    signalerBornes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

/** Recentre la carte quand `focus` change. */
function Recentrage({ focus }: { focus: Props["focus"] }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 16));
  }, [focus, map]);
  return null;
}

export default function CarteParcelles(props: Props) {
  const {
    parcelles,
    selectionIds,
    parcelleActive,
    apercu,
    modePointage,
    modeDessin,
    pointsDessin,
    focus,
    onViewport,
    onClicParcelle,
    onFermerPopup,
    onClicCarte,
    onClicCarteDessin,
    onAjouterChantier,
    onEditer,
    onSupprimer,
  } = props;

  // En mode pointage/dessin, les parcelles ne doivent pas intercepter le clic
  // (sinon impossible de pointer/dessiner par-dessus une parcelle existante).
  const modeSaisie = modePointage || modeDessin;

  /** Style d'un polygone : remplissage = couleur client, bordure = statut chantier. */
  function styleParcelle(p: ParcelleCarte): PathOptions {
    const selectionnee = selectionIds.has(p.id);
    return {
      fillColor: p.client.couleur,
      fillOpacity: selectionnee ? 0.65 : 0.35,
      color: selectionnee ? "#facc15" : COULEURS_STATUT[p.dernierStatut ?? "A_FAIRE"],
      weight: selectionnee ? 4 : 2.5,
      interactive: !modeSaisie,
    };
  }

  return (
    <div className={`h-full w-full ${modeSaisie ? "[&_.leaflet-container]:!cursor-crosshair" : ""}`}>
      <MapContainer
        center={CENTRE_DEFAUT}
        zoom={ZOOM_DEFAUT}
        className="h-full w-full"
        preferCanvas
      >
        <LayersControl position="topright">
          {/* Fonds de carte IGN Géoplateforme (gratuits, sans clé) */}
          <LayersControl.BaseLayer checked name={FONDS_IGN.satellite.nom}>
            <TileLayer
              url={urlTuilesIGN(FONDS_IGN.satellite.layer, FONDS_IGN.satellite.format)}
              attribution={ATTRIBUTION_IGN}
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name={FONDS_IGN.plan.nom}>
            <TileLayer
              url={urlTuilesIGN(FONDS_IGN.plan.layer, FONDS_IGN.plan.format)}
              attribution={ATTRIBUTION_IGN}
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          {/* Cadastre en overlay semi-transparent (activable manuellement) */}
          <LayersControl.Overlay name={FONDS_IGN.cadastre.nom}>
            <TileLayer
              url={urlTuilesIGN(FONDS_IGN.cadastre.layer, FONDS_IGN.cadastre.format)}
              attribution={ATTRIBUTION_IGN}
              opacity={0.7}
              maxZoom={19}
            />
          </LayersControl.Overlay>
        </LayersControl>

        {/* En saisie : on force l'affichage du cadastre pour viser juste */}
        {modeSaisie && (
          <TileLayer
            url={urlTuilesIGN(FONDS_IGN.cadastre.layer, FONDS_IGN.cadastre.format)}
            attribution={ATTRIBUTION_IGN}
            opacity={0.7}
            maxZoom={19}
          />
        )}

        <Evenements
          onViewport={onViewport}
          onClicCarte={onClicCarte}
          onClicCarteDessin={onClicCarteDessin}
          modePointage={modePointage}
          modeDessin={modeDessin}
        />
        <Recentrage focus={focus} />

        {/* Polygones des parcelles (clé inclut le mode pour réappliquer l'interactivité) */}
        {parcelles.map((p) => (
          <GeoJSON
            key={`${p.id}-${p.dernierStatut}-${selectionIds.has(p.id)}-${p.client.couleur}-${modeSaisie}`}
            data={p.geometry}
            style={() => styleParcelle(p)}
            eventHandlers={{
              click: (e) => {
                const ev = e.originalEvent as MouseEvent;
                onClicParcelle(p, ev.ctrlKey || ev.metaKey);
              },
            }}
          />
        ))}

        {/* Aperçu de la parcelle en cours de confirmation (saisie manuelle) */}
        {apercu && (
          <GeoJSON
            key={`apercu-${JSON.stringify(apercu).length}`}
            data={apercu}
            style={() => ({
              fillColor: "#facc15",
              fillOpacity: 0.5,
              color: "#facc15",
              weight: 3,
              dashArray: "6 4",
            })}
          />
        )}

        {/* Tracé en cours (mode dessin) : sommets + lignes + remplissage */}
        {modeDessin && pointsDessin.length >= 3 && (
          <Polygon
            positions={pointsDessin}
            pathOptions={{ color: "#facc15", weight: 3, fillColor: "#facc15", fillOpacity: 0.35 }}
          />
        )}
        {modeDessin && pointsDessin.length === 2 && (
          <Polyline positions={pointsDessin} pathOptions={{ color: "#facc15", weight: 3 }} />
        )}
        {modeDessin &&
          pointsDessin.map((pt, i) => (
            <CircleMarker
              key={`sommet-${i}`}
              center={pt}
              radius={5}
              pathOptions={{ color: "#ca8a04", fillColor: "#facc15", fillOpacity: 1, weight: 2 }}
            />
          ))}

        {/* Popup de la parcelle cliquée */}
        {parcelleActive && (
          <Popup
            position={[parcelleActive.centroidLat, parcelleActive.centroidLng]}
            eventHandlers={{ remove: onFermerPopup }}
            maxWidth={300}
          >
            <div className="space-y-2">
              <div>
                <div className="flex items-center gap-2 font-semibold">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: parcelleActive.client.couleur }}
                  />
                  {parcelleActive.client.nom}
                </div>
                <div className="text-xs text-gray-600">
                  {parcelleActive.commune} — {parcelleActive.section} {parcelleActive.numero}
                  <br />
                  Surface : {formaterHectares(parcelleActive.surfaceM2)}
                  {parcelleActive.cepage && (
                    <>
                      <br />
                      Cépage : {parcelleActive.cepage}
                      {parcelleActive.millesime ? ` (${parcelleActive.millesime})` : ""}
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" onClick={() => onAjouterChantier(parcelleActive)}>
                  Ajouter à un chantier
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    window.open(
                      `https://www.google.com/maps?q=${parcelleActive.centroidLat},${parcelleActive.centroidLng}`,
                      "_blank"
                    )
                  }
                >
                  Itinéraire
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onEditer(parcelleActive)}>
                  Éditer
                </Button>
                <Button size="sm" variant="destructive" onClick={() => onSupprimer(parcelleActive)}>
                  Supprimer
                </Button>
              </div>
            </div>
          </Popup>
        )}
      </MapContainer>
    </div>
  );
}
