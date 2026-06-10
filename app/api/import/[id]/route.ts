/**
 * GET /api/import/[id] — état d'un import (reprise après rechargement de page).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const batch = await prisma.importBatch.findUnique({
    where: { id: params.id },
    select: {
      id: true, nomFichier: true, statut: true, totalLignes: true,
      lignesTraitees: true, clientsCrees: true, parcellesCreees: true,
      parcellesIgnorees: true, erreurs: true, createdAt: true,
    },
  });
  if (!batch) return NextResponse.json({ erreur: "Import introuvable" }, { status: 404 });
  return NextResponse.json(batch);
}
