/**
 * POST /api/import — crée un ImportBatch à partir des lignes parsées côté
 * navigateur (xlsx/csv/geojson/kml) et du mapping de colonnes validé.
 * Le traitement effectif se fait ensuite par lots via /api/import/[id]/process.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schemaLigne = z.object({
  ligne: z.number().int(),
  valeurs: z.record(z.string().optional()),
  geometry: z.record(z.unknown()).nullable().optional(),
});

const schemaImport = z.object({
  nomFichier: z.string().min(1),
  mapping: z.record(z.string()),
  lignes: z.array(schemaLigne).min(1, "Aucune ligne à importer"),
});

export async function POST(req: NextRequest) {
  const corps = schemaImport.safeParse(await req.json());
  if (!corps.success) {
    return NextResponse.json({ erreur: corps.error.errors[0].message }, { status: 400 });
  }
  const { nomFichier, mapping, lignes } = corps.data;

  const batch = await prisma.importBatch.create({
    data: {
      nomFichier,
      mapping,
      payload: lignes as object[],
      totalLignes: lignes.length,
      statut: "EN_ATTENTE",
    },
  });
  return NextResponse.json({ id: batch.id, totalLignes: batch.totalLignes }, { status: 201 });
}

/** GET /api/import — historique des imports. */
export async function GET() {
  const batches = await prisma.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true, nomFichier: true, statut: true, totalLignes: true,
      lignesTraitees: true, clientsCrees: true, parcellesCreees: true,
      parcellesIgnorees: true, createdAt: true,
    },
  });
  return NextResponse.json(batches);
}
