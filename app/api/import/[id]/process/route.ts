/**
 * POST /api/import/[id]/process — traite UN lot (~20 lignes) du batch.
 * Le front appelle cette route en boucle tant que lignesTraitees < totalLignes :
 * chaque appel reste sous le timeout Vercel, et l'état vit dans ImportBatch
 * (reprise possible si la page est rechargée).
 */
import { NextRequest, NextResponse } from "next/server";
import { traiterLot } from "@/lib/import/process";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // secondes (Vercel)

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const etat = await traiterLot(params.id);
    return NextResponse.json(etat);
  } catch (e) {
    // Erreur fatale (batch introuvable, DB inaccessible...) → statut ECHEC
    await prisma.importBatch
      .update({ where: { id: params.id }, data: { statut: "ECHEC" } })
      .catch(() => undefined);
    return NextResponse.json(
      { erreur: e instanceof Error ? e.message : "Erreur de traitement" },
      { status: 500 }
    );
  }
}
