/**
 * /api/parcelles
 *  - GET  : parcelles du viewport (filtre BETWEEN sur le centroïde) pour la carte.
 *           Sans bornes → toutes les parcelles (panneau latéral / listes).
 *  - POST : création manuelle d'une parcelle (Mode A référence / Mode B clic).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { calculerCentroide, calculerSurfaceM2 } from "@/lib/geo";
import type { ParcelleCarte } from "@/types/geo";

export const dynamic = "force-dynamic";

const schemaCreation = z.object({
  clientId: z.string().min(1, "Client requis"),
  codeInsee: z.string().trim().min(1),
  commune: z.string().trim(),
  section: z.string().trim().min(1),
  numero: z.string().trim().min(1),
  geometry: z.record(z.unknown()), // GeoJSON (Multi)Polygon validé en amont
  surfaceM2: z.number().nullable().optional(),
  cepage: z.string().trim().nullable().optional(),
  millesime: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
  source: z.enum(["MANUEL", "IMPORT_REFERENCE", "IMPORT_POINT", "IMPORT_GEOMETRIE"]).default("MANUEL"),
});

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const sud = parseFloat(p.get("sud") ?? "");
  const nord = parseFloat(p.get("nord") ?? "");
  const ouest = parseFloat(p.get("ouest") ?? "");
  const est = parseFloat(p.get("est") ?? "");
  const avecBornes = [sud, nord, ouest, est].every(Number.isFinite);

  const parcelles = await prisma.parcelle.findMany({
    where: avecBornes
      ? {
          centroidLat: { gte: sud, lte: nord },
          centroidLng: { gte: ouest, lte: est },
        }
      : undefined,
    include: {
      client: { select: { id: true, nom: true, couleur: true } },
      // Statuts des chantiers rattachés (peu nombreux par parcelle)
      chantiers: {
        select: { chantier: { select: { statut: true, createdAt: true } } },
      },
    },
    take: 3000, // garde-fou
  });

  const resultat: ParcelleCarte[] = parcelles.map((p) => {
    // Statut du chantier le plus récent (pour la couleur de bordure)
    const dernier = p.chantiers
      .map((cp) => cp.chantier)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    return {
      id: p.id,
      codeInsee: p.codeInsee,
      commune: p.commune,
      section: p.section,
      numero: p.numero,
      geometry: p.geometry as unknown as GeoJSON.MultiPolygon,
      centroidLat: p.centroidLat,
      centroidLng: p.centroidLng,
      surfaceM2: p.surfaceM2,
      cepage: p.cepage,
      millesime: p.millesime,
      notes: p.notes,
      client: p.client,
      dernierStatut: dernier?.statut ?? null,
    };
  });

  return NextResponse.json(resultat);
}

export async function POST(req: NextRequest) {
  const corps = schemaCreation.safeParse(await req.json());
  if (!corps.success) {
    return NextResponse.json({ erreur: corps.error.errors[0].message }, { status: 400 });
  }
  const d = corps.data;
  const geometry = d.geometry as unknown as GeoJSON.Geometry;
  const { lat, lng } = calculerCentroide(geometry);

  try {
    const parcelle = await prisma.parcelle.create({
      data: {
        clientId: d.clientId,
        codeInsee: d.codeInsee,
        commune: d.commune,
        section: d.section,
        numero: d.numero,
        geometry: d.geometry as object,
        centroidLat: lat,
        centroidLng: lng,
        surfaceM2: d.surfaceM2 ?? calculerSurfaceM2(geometry),
        cepage: d.cepage || null,
        millesime: d.millesime ?? null,
        notes: d.notes || null,
        source: d.source,
      },
    });
    return NextResponse.json(parcelle, { status: 201 });
  } catch {
    return NextResponse.json(
      { erreur: "Cette parcelle existe déjà pour ce client" },
      { status: 409 }
    );
  }
}
