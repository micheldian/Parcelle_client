/**
 * Traitement par lots d'un ImportBatch (résumable, compatible timeout Vercel).
 *
 * Chaque appel traite ~20 lignes :
 *  1. Résolution des géométries en parallèle (max 5 appels IGN simultanés).
 *  2. Création séquentielle des clients + parcelles (anti-doublon).
 *  3. Mise à jour des compteurs dans ImportBatch → le front boucle tant que
 *     lignesTraitees < totalLignes (reprise possible après rechargement de page).
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import {
  extraireCodeInsee,
  rechercherCommunes,
  rechercherParcelleParPoint,
  rechercherParcelleParReference,
} from "@/lib/ign";
import {
  calculerCentroide,
  calculerSurfaceM2,
  normaliserNomClient,
  normaliserNumero,
  normaliserSection,
} from "@/lib/geo";
import type { ErreurImport, LigneImport } from "@/types/geo";
import type { ParcelleSource } from "@prisma/client";

/** Taille d'un lot (compromis durée d'exécution / nombre de requêtes). */
const TAILLE_LOT = 20;
/** Nombre max d'appels IGN simultanés (courtoisie API publique). */
const CONCURRENCE_IGN = 5;

/** Cache module nom de commune normalisé → { code INSEE, nom officiel }. */
const cacheCommunes = new Map<string, { code: string; nom: string }>();

/** Exécute des tâches asynchrones avec une limite de concurrence. */
async function avecLimite<T>(taches: Array<() => Promise<T>>, limite: number): Promise<T[]> {
  const resultats: T[] = new Array(taches.length);
  let index = 0;
  async function travailleur() {
    while (index < taches.length) {
      const i = index++;
      resultats[i] = await taches[i]();
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limite, taches.length) }, () => travailleur())
  );
  return resultats;
}

/** Résultat de la résolution de géométrie d'une ligne. */
interface GeometrieResolue {
  geometry: GeoJSON.Geometry;
  codeInsee: string;
  commune: string;
  section: string;
  numero: string;
  surfaceM2: number | null;
  source: ParcelleSource;
}

type ResolutionLigne =
  | { ok: true; resultat: GeometrieResolue }
  | { ok: false; raison: string };

/** Résout un nom de commune en code INSEE (avec cache). */
async function resoudreCommune(nom: string): Promise<{ code: string; nom: string } | null> {
  const cle = normaliserNomClient(nom); // même normalisation casse/espaces
  const enCache = cacheCommunes.get(cle);
  if (enCache) return enCache;

  const communes = await rechercherCommunes(nom.trim());
  if (communes.length === 0) return null;

  // Priorité à la correspondance exacte (insensible casse/accents), sinon 1er résultat
  const sansAccents = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const exacte = communes.find((c) => sansAccents(c.nom) === sansAccents(nom));
  const choisie = exacte ?? communes[0];

  const resolution = { code: choisie.code, nom: choisie.nom };
  cacheCommunes.set(cle, resolution);
  return resolution;
}

/**
 * Résout la géométrie d'une ligne selon la priorité :
 * (a) référence cadastrale → API Carto, (b) lat/lng → API Carto par point,
 * (c) géométrie embarquée (GeoJSON/KML) → utilisée directement.
 */
async function resoudreLigne(ligne: LigneImport): Promise<ResolutionLigne> {
  const v = ligne.valeurs;
  const aReference = Boolean((v.code_insee || v.commune) && v.section && v.numero);
  const lat = v.latitude ? parseFloat(String(v.latitude).replace(",", ".")) : NaN;
  const lng = v.longitude ? parseFloat(String(v.longitude).replace(",", ".")) : NaN;
  const aPoint = Number.isFinite(lat) && Number.isFinite(lng);

  try {
    // ---- (a) Référence cadastrale ----
    if (aReference) {
      let codeInsee = v.code_insee?.trim() ?? "";
      let nomCommune = v.commune?.trim() ?? "";
      if (!codeInsee) {
        const commune = await resoudreCommune(nomCommune);
        if (!commune) return { ok: false, raison: `Commune introuvable : « ${nomCommune} »` };
        codeInsee = commune.code;
        nomCommune = commune.nom;
      }
      const section = normaliserSection(v.section!);
      const numero = normaliserNumero(v.numero!);
      const features = await rechercherParcelleParReference(codeInsee, section, numero);
      if (features.length === 0) {
        return {
          ok: false,
          raison: `Parcelle ${codeInsee} ${section} ${numero} inexistante côté IGN`,
        };
      }
      const f = features[0];
      return {
        ok: true,
        resultat: {
          geometry: f.geometry,
          codeInsee: extraireCodeInsee(f) || codeInsee,
          commune: String(f.properties.nom_com ?? nomCommune ?? ""),
          section,
          numero,
          surfaceM2: f.properties.contenance ?? calculerSurfaceM2(f.geometry),
          source: "IMPORT_REFERENCE",
        },
      };
    }

    // ---- (b) Point lat/lng → reverse cadastre ----
    if (aPoint) {
      const features = await rechercherParcelleParPoint(lng, lat);
      if (features.length === 0) {
        return { ok: false, raison: `Aucune parcelle cadastrale au point ${lat}, ${lng}` };
      }
      const f = features[0];
      return {
        ok: true,
        resultat: {
          geometry: f.geometry,
          codeInsee: extraireCodeInsee(f),
          commune: String(f.properties.nom_com ?? v.commune ?? ""),
          section: normaliserSection(String(f.properties.section ?? "")),
          numero: normaliserNumero(String(f.properties.numero ?? "")),
          surfaceM2: f.properties.contenance ?? calculerSurfaceM2(f.geometry),
          source: "IMPORT_POINT",
        },
      };
    }

    // ---- (c) Géométrie embarquée (GeoJSON / KML) : pas d'appel IGN ----
    if (ligne.geometry) {
      const { lat: cLat, lng: cLng } = calculerCentroide(ligne.geometry);
      // Pseudo-référence stable basée sur le centroïde pour respecter
      // la contrainte d'unicité quand le fichier ne fournit pas la référence.
      const pseudoNumero = `${Math.round(cLat * 1e5).toString(36)}${Math.round(cLng * 1e5).toString(36)}`.toUpperCase();
      return {
        ok: true,
        resultat: {
          geometry: ligne.geometry,
          codeInsee: v.code_insee?.trim() || "00000",
          commune: v.commune?.trim() ?? "",
          section: v.section ? normaliserSection(v.section) : "GE",
          numero: v.numero ? normaliserNumero(v.numero) : pseudoNumero,
          surfaceM2: calculerSurfaceM2(ligne.geometry),
          source: "IMPORT_GEOMETRIE",
        },
      };
    }

    return {
      ok: false,
      raison: "Données insuffisantes : ni référence cadastrale, ni lat/lng, ni géométrie",
    };
  } catch (e) {
    return { ok: false, raison: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

/** État renvoyé au front après chaque lot. */
export interface EtatImport {
  statut: string;
  totalLignes: number;
  lignesTraitees: number;
  clientsCrees: number;
  parcellesCreees: number;
  parcellesIgnorees: number;
  nbErreurs: number;
}

/** Traite le prochain lot de lignes d'un batch et renvoie l'état mis à jour. */
export async function traiterLot(batchId: string): Promise<EtatImport> {
  const batch = await prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } });
  const lignes = (batch.payload ?? []) as unknown as LigneImport[];

  // Batch déjà terminé : on renvoie simplement l'état (idempotent)
  if (batch.statut === "TERMINE" || batch.lignesTraitees >= batch.totalLignes) {
    return etatDe(batch.statut === "TERMINE" ? batch : await terminer(batchId));
  }

  if (batch.statut === "EN_ATTENTE") {
    await prisma.importBatch.update({
      where: { id: batchId },
      data: { statut: "EN_COURS" },
    });
  }

  const debut = batch.lignesTraitees;
  const lot = lignes.slice(debut, debut + TAILLE_LOT);

  // ---- Phase 1 : résolution des géométries (parallèle, limité) ----
  const resolutions = await avecLimite(
    lot.map((ligne) => () => resoudreLigne(ligne)),
    CONCURRENCE_IGN
  );

  // ---- Phase 2 : écriture en base (séquentielle pour le dédoublonnage) ----
  // Cache des clients existants par nom normalisé
  const clients = await prisma.client.findMany({ select: { id: true, nom: true } });
  const clientsParNom = new Map(clients.map((c) => [normaliserNomClient(c.nom), c.id]));

  let clientsCrees = 0;
  let parcellesCreees = 0;
  let parcellesIgnorees = 0;
  const erreurs = ((batch.erreurs ?? []) as unknown as ErreurImport[]).slice();

  for (let i = 0; i < lot.length; i++) {
    const ligne = lot[i];
    const resolution = resolutions[i];
    const v = ligne.valeurs;

    const enregistrerErreur = (raison: string) =>
      erreurs.push({
        ligne: ligne.ligne,
        raison,
        donnees: Object.fromEntries(
          Object.entries(v).map(([k, val]) => [k, String(val ?? "")])
        ),
      });

    // Client obligatoire
    const nomClient = v.client_nom?.trim();
    if (!nomClient) {
      enregistrerErreur("Nom de client manquant");
      continue;
    }
    if (!resolution.ok) {
      enregistrerErreur(resolution.raison);
      continue;
    }

    try {
      // 1) Client : réutilisation (insensible casse/espaces) ou création
      let clientId = clientsParNom.get(normaliserNomClient(nomClient));
      if (!clientId) {
        const nouveau = await prisma.client.create({
          data: {
            nom: nomClient,
            contactNom: v.client_contact?.trim() || null,
            telephone: v.client_telephone?.trim() || null,
            email: v.client_email?.trim() || null,
            // Couleur pseudo-aléatoire stable par client (lisibilité carte)
            couleur: couleurDepuisNom(nomClient),
          },
        });
        clientId = nouveau.id;
        clientsParNom.set(normaliserNomClient(nomClient), clientId);
        clientsCrees++;
      }

      // 2) Anti-doublon : la parcelle existe déjà pour ce client → ignorée
      const r = resolution.resultat;
      const existante = await prisma.parcelle.findUnique({
        where: {
          codeInsee_section_numero_clientId: {
            codeInsee: r.codeInsee,
            section: r.section,
            numero: r.numero,
            clientId,
          },
        },
        select: { id: true },
      });
      if (existante) {
        parcellesIgnorees++;
        continue;
      }

      // 3) Création de la parcelle
      const { lat, lng } = calculerCentroide(r.geometry);
      const millesime = v.millesime ? parseInt(String(v.millesime), 10) : NaN;
      await prisma.parcelle.create({
        data: {
          clientId,
          codeInsee: r.codeInsee,
          commune: r.commune,
          section: r.section,
          numero: r.numero,
          geometry: r.geometry as object,
          centroidLat: lat,
          centroidLng: lng,
          surfaceM2: r.surfaceM2,
          cepage: v.cepage?.trim() || null,
          millesime: Number.isFinite(millesime) ? millesime : null,
          notes: v.notes?.trim() || null,
          source: r.source,
        },
      });
      parcellesCreees++;
    } catch (e) {
      enregistrerErreur(e instanceof Error ? e.message : "Erreur d'écriture en base");
    }
  }

  // ---- Mise à jour de l'état du batch ----
  const traitees = debut + lot.length;
  const maj = await prisma.importBatch.update({
    where: { id: batchId },
    data: {
      lignesTraitees: traitees,
      clientsCrees: { increment: clientsCrees },
      parcellesCreees: { increment: parcellesCreees },
      parcellesIgnorees: { increment: parcellesIgnorees },
      erreurs: erreurs as unknown as object,
      statut: traitees >= batch.totalLignes ? "TERMINE" : "EN_COURS",
      // Une fois terminé, on libère le payload (souvent volumineux)
      ...(traitees >= batch.totalLignes ? { payload: [] } : {}),
    },
  });

  return etatDe(maj);
}

/** Marque un batch comme terminé (cas limite : compteur déjà au bout). */
async function terminer(batchId: string) {
  return prisma.importBatch.update({
    where: { id: batchId },
    data: { statut: "TERMINE", payload: [] },
  });
}

function etatDe(batch: {
  statut: string;
  totalLignes: number;
  lignesTraitees: number;
  clientsCrees: number;
  parcellesCreees: number;
  parcellesIgnorees: number;
  erreurs: unknown;
}): EtatImport {
  return {
    statut: batch.statut,
    totalLignes: batch.totalLignes,
    lignesTraitees: batch.lignesTraitees,
    clientsCrees: batch.clientsCrees,
    parcellesCreees: batch.parcellesCreees,
    parcellesIgnorees: batch.parcellesIgnorees,
    nbErreurs: Array.isArray(batch.erreurs) ? batch.erreurs.length : 0,
  };
}

/** Couleur HSL déterministe à partir du nom (chaque client a sa teinte). */
export function couleurDepuisNom(nom: string): string {
  let hash = 0;
  for (const c of nom) hash = (hash * 31 + c.charCodeAt(0)) % 360;
  // Conversion HSL → hex (saturation/luminosité fixes, lisibles sur ortho)
  return hslVersHex(hash, 75, 50);
}

function hslVersHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) =>
    Math.round(255 * (ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  const hex = (x: number) => x.toString(16).padStart(2, "0");
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}
