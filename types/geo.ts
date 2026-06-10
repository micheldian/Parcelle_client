/**
 * Types partagés pour les données géographiques et l'import.
 */

/** Feature GeoJSON renvoyée par l'API Carto cadastre (PCI Express). */
export interface ParcelleCadastraleFeature {
  type: "Feature";
  geometry: GeoJSON.MultiPolygon | GeoJSON.Polygon;
  properties: {
    numero?: string;
    section?: string;
    code_insee?: string;
    code_dep?: string;
    code_com?: string;
    nom_com?: string;
    contenance?: number; // surface cadastrale en m²
    [cle: string]: unknown;
  };
}

/** Commune renvoyée par l'API Géo (geo.api.gouv.fr). */
export interface CommuneApiGeo {
  nom: string;
  code: string; // code INSEE
  codeDepartement: string;
  centre?: { type: "Point"; coordinates: [number, number] };
}

/** Champs cibles du mapping d'import. */
export const CHAMPS_IMPORT = [
  "client_nom",
  "client_contact",
  "client_telephone",
  "client_email",
  "commune",
  "code_insee",
  "section",
  "numero",
  "latitude",
  "longitude",
  "cepage",
  "millesime",
  "notes",
] as const;

export type ChampImport = (typeof CHAMPS_IMPORT)[number];

/** Une ligne d'import après application du mapping. */
export interface LigneImport {
  /** numéro de ligne dans le fichier d'origine (pour le rapport d'erreurs) */
  ligne: number;
  valeurs: Partial<Record<ChampImport, string>>;
  /** géométrie déjà présente (fichiers GeoJSON / KML) */
  geometry?: GeoJSON.Geometry | null;
}

/** Erreur d'import consignée dans ImportBatch.erreurs. */
export interface ErreurImport {
  ligne: number;
  raison: string;
  donnees: Record<string, string>;
}

/** Parcelle sérialisée pour la carte (réponse de /api/parcelles). */
export interface ParcelleCarte {
  id: string;
  codeInsee: string;
  commune: string;
  section: string;
  numero: string;
  geometry: GeoJSON.MultiPolygon | GeoJSON.Polygon;
  centroidLat: number;
  centroidLng: number;
  surfaceM2: number | null;
  cepage: string | null;
  millesime: number | null;
  notes: string | null;
  client: { id: string; nom: string; couleur: string };
  /** statut du chantier le plus récent rattaché (null si aucun) */
  dernierStatut: "A_FAIRE" | "ENVOYE" | "EN_COURS" | "TERMINE" | null;
}
