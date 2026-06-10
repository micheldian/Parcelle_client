/**
 * Calculs géométriques (turf) : centroïde, surface, normalisation.
 */
import { centroid as turfCentroid, area as turfArea } from "@turf/turf";

/** Calcule le centroïde [lat, lng] d'une géométrie GeoJSON. */
export function calculerCentroide(geometry: GeoJSON.Geometry): {
  lat: number;
  lng: number;
} {
  if (geometry.type === "Point") {
    return { lat: geometry.coordinates[1], lng: geometry.coordinates[0] };
  }
  const c = turfCentroid({ type: "Feature", geometry, properties: {} });
  return {
    lat: c.geometry.coordinates[1],
    lng: c.geometry.coordinates[0],
  };
}

/** Surface en m² calculée par turf (fallback quand l'IGN ne fournit pas la contenance). */
export function calculerSurfaceM2(geometry: GeoJSON.Geometry): number | null {
  if (geometry.type === "Point" || geometry.type === "LineString") return null;
  try {
    return Math.round(turfArea({ type: "Feature", geometry, properties: {} }));
  } catch {
    return null;
  }
}

/** Formate une surface m² en hectares lisibles (ex : 0,85 ha). */
export function formaterHectares(surfaceM2: number | null | undefined): string {
  if (surfaceM2 == null) return "—";
  return `${(surfaceM2 / 10000).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ha`;
}

/** Normalise une section cadastrale ("a" -> "0A", "AB" -> "AB"). */
export function normaliserSection(section: string): string {
  return section.trim().toUpperCase().padStart(2, "0");
}

/** Normalise un numéro de parcelle ("12" -> "0012"). */
export function normaliserNumero(numero: string): string {
  return numero.trim().replace(/^0+(?=\d)/, "").padStart(4, "0");
}

/** Normalise un nom de client pour le dédoublonnage (casse + espaces). */
export function normaliserNomClient(nom: string): string {
  return nom.trim().replace(/\s+/g, " ").toLowerCase();
}
