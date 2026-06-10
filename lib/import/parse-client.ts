/**
 * Parsing des fichiers d'import CÔTÉ NAVIGATEUR :
 *  - .csv (papaparse), .xlsx/.xls (SheetJS) → données tabulaires
 *  - .geojson, .kml (@tmcw/togeojson) → features avec géométrie embarquée
 * Le résultat (colonnes + lignes brutes) alimente l'écran de mapping.
 */
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { kml as kmlVersGeojson } from "@tmcw/togeojson";
import type { ChampImport } from "@/types/geo";
import { CHAMPS_IMPORT } from "@/types/geo";

/** Ligne brute parsée : valeurs par nom de colonne + géométrie éventuelle. */
export interface LigneBrute {
  ligne: number; // numéro de ligne dans le fichier d'origine (1 = première donnée)
  valeurs: Record<string, string>;
  geometry?: GeoJSON.Geometry | null;
}

export interface FichierParse {
  colonnes: string[];
  lignes: LigneBrute[];
  /** true si le fichier transporte déjà des géométries (GeoJSON / KML) */
  avecGeometrie: boolean;
}

/** Convertit toute valeur de cellule en chaîne propre. */
function enChaine(valeur: unknown): string {
  if (valeur == null) return "";
  return String(valeur).trim();
}

/** Transforme une liste d'objets (clé colonne → valeur) en FichierParse. */
function depuisObjets(objets: Record<string, unknown>[]): FichierParse {
  const colonnes = Array.from(
    new Set(objets.flatMap((o) => Object.keys(o)))
  ).filter((c) => c.trim() !== "");
  const lignes: LigneBrute[] = objets.map((o, i) => ({
    ligne: i + 2, // +2 : ligne 1 = en-têtes du fichier
    valeurs: Object.fromEntries(colonnes.map((c) => [c, enChaine(o[c])])),
  }));
  return { colonnes, lignes, avecGeometrie: false };
}

/** Transforme une FeatureCollection (GeoJSON/KML) en FichierParse. */
function depuisFeatures(fc: GeoJSON.FeatureCollection): FichierParse {
  const features = (fc.features ?? []).filter((f) => f.geometry);
  const colonnes = Array.from(
    new Set(features.flatMap((f) => Object.keys(f.properties ?? {})))
  );
  // KML : la propriété "name" sert souvent de nom de client/parcelle
  const lignes: LigneBrute[] = features.map((f, i) => ({
    ligne: i + 1,
    valeurs: Object.fromEntries(
      colonnes.map((c) => [c, enChaine((f.properties ?? {})[c])])
    ),
    geometry: f.geometry,
  }));
  return { colonnes, lignes, avecGeometrie: true };
}

/** Parse un fichier d'import selon son extension. */
export async function parserFichier(fichier: File): Promise<FichierParse> {
  const extension = fichier.name.split(".").pop()?.toLowerCase() ?? "";

  if (extension === "csv") {
    const texte = await fichier.text();
    const resultat = Papa.parse<Record<string, unknown>>(texte, {
      header: true,
      skipEmptyLines: true,
    });
    return depuisObjets(resultat.data);
  }

  if (extension === "xlsx" || extension === "xls") {
    const tampon = await fichier.arrayBuffer();
    const classeur = XLSX.read(tampon, { type: "array" });
    const feuille = classeur.Sheets[classeur.SheetNames[0]];
    const objets = XLSX.utils.sheet_to_json<Record<string, unknown>>(feuille, {
      defval: "",
      raw: false,
    });
    return depuisObjets(objets);
  }

  if (extension === "geojson" || extension === "json") {
    const texte = await fichier.text();
    const fc = JSON.parse(texte) as GeoJSON.FeatureCollection;
    if (fc.type !== "FeatureCollection") {
      throw new Error("Le fichier GeoJSON doit contenir une FeatureCollection");
    }
    return depuisFeatures(fc);
  }

  if (extension === "kml") {
    const texte = await fichier.text();
    const dom = new DOMParser().parseFromString(texte, "text/xml");
    return depuisFeatures(kmlVersGeojson(dom) as GeoJSON.FeatureCollection);
  }

  throw new Error(`Format non pris en charge : .${extension} (attendu : xlsx, xls, csv, geojson, kml)`);
}

/** Synonymes reconnus pour le pré-remplissage automatique du mapping. */
const SYNONYMES: Record<ChampImport, string[]> = {
  client_nom: ["client_nom", "client", "nom_client", "domaine", "exploitation", "name", "nom"],
  client_contact: ["client_contact", "contact", "responsable"],
  client_telephone: ["client_telephone", "telephone", "tel", "portable", "mobile"],
  client_email: ["client_email", "email", "mail", "courriel"],
  commune: ["commune", "ville", "localite", "village"],
  code_insee: ["code_insee", "insee", "codeinsee", "code_commune"],
  section: ["section", "section_cadastrale"],
  numero: ["numero", "num", "numero_parcelle", "parcelle", "n_parcelle"],
  latitude: ["latitude", "lat", "y", "gps_lat"],
  longitude: ["longitude", "lng", "lon", "long", "x", "gps_lng"],
  cepage: ["cepage", "variete", "culture"],
  millesime: ["millesime", "annee", "annee_plantation"],
  notes: ["notes", "note", "remarques", "commentaire", "commentaires", "observations", "description"],
};

/** Normalise un nom de colonne pour la comparaison (casse, accents, séparateurs). */
function normaliserColonne(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Propose un mapping automatique colonnes du fichier → champs cibles. */
export function mappingAutomatique(colonnes: string[]): Record<ChampImport, string> {
  const mapping = Object.fromEntries(CHAMPS_IMPORT.map((c) => [c, ""])) as Record<ChampImport, string>;
  const normalisees = colonnes.map((c) => ({ origine: c, normalise: normaliserColonne(c) }));

  for (const champ of CHAMPS_IMPORT) {
    for (const synonyme of SYNONYMES[champ]) {
      const trouvee = normalisees.find((c) => c.normalise === synonyme);
      // Une colonne déjà affectée n'est pas réutilisée
      if (trouvee && !Object.values(mapping).includes(trouvee.origine)) {
        mapping[champ] = trouvee.origine;
        break;
      }
    }
  }
  return mapping;
}
