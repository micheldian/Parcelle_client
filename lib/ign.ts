/**
 * Accès serveur aux API publiques IGN / Géo gouv.
 * ⚠️ À n'appeler QUE côté serveur (Route Handlers / Server Actions) :
 * CORS, cache et courtoisie vis-à-vis des API publiques.
 */
import "server-only";
import type { CommuneApiGeo, ParcelleCadastraleFeature } from "@/types/geo";

const API_CARTO = "https://apicarto.ign.fr/api/cadastre/parcelle";
const API_GEO = "https://geo.api.gouv.fr/communes";

interface FeatureCollectionCadastre {
  type: "FeatureCollection";
  features: ParcelleCadastraleFeature[];
}

/** fetch avec timeout (les API publiques peuvent être lentes). */
async function fetchAvecTimeout(url: string, timeoutMs = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
      // Les parcelles cadastrales changent rarement : cache 1h côté Next
      next: { revalidate: 3600 },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Appel API Carto avec repli : si `source_ign=PCI` provoque une erreur,
 * on réessaie sans le paramètre (PCI est la valeur par défaut).
 */
async function appelerApiCarto(params: URLSearchParams): Promise<FeatureCollectionCadastre> {
  const avecSource = new URLSearchParams(params);
  avecSource.set("source_ign", "PCI");

  let reponse = await fetchAvecTimeout(`${API_CARTO}?${avecSource}`);
  if (!reponse.ok) {
    reponse = await fetchAvecTimeout(`${API_CARTO}?${params}`);
  }
  if (!reponse.ok) {
    throw new Error(`API Carto cadastre : erreur HTTP ${reponse.status}`);
  }
  return (await reponse.json()) as FeatureCollectionCadastre;
}

/** Recherche de parcelles par référence cadastrale (INSEE + section + numéro). */
export async function rechercherParcelleParReference(
  codeInsee: string,
  section: string,
  numero: string
): Promise<ParcelleCadastraleFeature[]> {
  const params = new URLSearchParams({
    code_insee: codeInsee,
    section,
    numero,
  });
  const fc = await appelerApiCarto(params);
  return fc.features ?? [];
}

/** Recherche de la parcelle intersectant un point (clic carte ou lat/lng d'import). */
export async function rechercherParcelleParPoint(
  lng: number,
  lat: number
): Promise<ParcelleCadastraleFeature[]> {
  const point = JSON.stringify({ type: "Point", coordinates: [lng, lat] });
  const params = new URLSearchParams({ geom: point });
  const fc = await appelerApiCarto(params);
  return fc.features ?? [];
}

/** Autocomplétion / résolution d'un nom de commune → code INSEE (API Géo gouv). */
export async function rechercherCommunes(nom: string): Promise<CommuneApiGeo[]> {
  const params = new URLSearchParams({
    nom,
    fields: "nom,code,codeDepartement,centre",
    boost: "population",
    limit: "10",
  });
  const reponse = await fetchAvecTimeout(`${API_GEO}?${params}`);
  if (!reponse.ok) {
    throw new Error(`API Géo communes : erreur HTTP ${reponse.status}`);
  }
  return (await reponse.json()) as CommuneApiGeo[];
}

/** Extrait le code INSEE d'une feature cadastrale (code_insee ou dep+com). */
export function extraireCodeInsee(f: ParcelleCadastraleFeature): string {
  if (f.properties.code_insee) return String(f.properties.code_insee);
  return `${f.properties.code_dep ?? ""}${f.properties.code_com ?? ""}`;
}
