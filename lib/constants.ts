/**
 * Constantes partagées : libellés français des enums, couleurs de statut,
 * configuration des fonds de carte IGN.
 */

export const LIBELLES_TYPE_TRAVAIL: Record<string, string> = {
  TAILLE: "Taille",
  TIRAGE_BOIS: "Tirage des bois",
  PALISSAGE: "Palissage",
  EBOURGEONNAGE: "Ébourgeonnage",
  RELEVAGE: "Relevage",
  EFFEUILLAGE: "Effeuillage",
  VENDANGE: "Vendange",
  TRAITEMENT: "Traitement",
  PLANTATION: "Plantation",
  AUTRE: "Autre",
};

export const LIBELLES_STATUT_CHANTIER: Record<string, string> = {
  A_FAIRE: "À faire",
  ENVOYE: "Envoyé",
  EN_COURS: "En cours",
  TERMINE: "Terminé",
};

/** Couleur de bordure des polygones selon le statut du dernier chantier. */
export const COULEURS_STATUT: Record<string, string> = {
  A_FAIRE: "#6b7280", // gris
  ENVOYE: "#f97316", // orange
  EN_COURS: "#3b82f6", // bleu
  TERMINE: "#22c55e", // vert
};

/** Fonds de carte IGN Géoplateforme (WMTS, gratuits, sans clé). */
export const FONDS_IGN = {
  satellite: {
    nom: "Satellite (ortho)",
    layer: "ORTHOIMAGERY.ORTHOPHOTOS",
    format: "image/jpeg",
  },
  plan: {
    nom: "Plan IGN",
    layer: "GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2",
    format: "image/png",
  },
  cadastre: {
    nom: "Cadastre (overlay)",
    layer: "CADASTRALPARCELS.PARCELLAIRE_EXPRESS",
    format: "image/png",
  },
} as const;

/** Construit l'URL de tuiles WMTS Géoplateforme pour Leaflet. */
export function urlTuilesIGN(layer: string, format: string): string {
  return (
    "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
    `&LAYER=${layer}&STYLE=normal&FORMAT=${format}` +
    "&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}"
  );
}

export const ATTRIBUTION_IGN = "© IGN / Géoplateforme";

/** Centre par défaut de la carte : Alsace (Colmar). */
export const CENTRE_DEFAUT: [number, number] = [48.08, 7.36];
export const ZOOM_DEFAUT = 10;
