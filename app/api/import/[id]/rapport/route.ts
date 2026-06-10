/**
 * GET /api/import/[id]/rapport — rapport d'erreurs téléchargeable (.xlsx).
 * Contient les données d'origine de chaque ligne en échec + la raison :
 * il suffit de corriger le fichier et de le réimporter.
 */
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import type { ErreurImport } from "@/types/geo";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const batch = await prisma.importBatch.findUnique({ where: { id: params.id } });
  if (!batch) return NextResponse.json({ erreur: "Import introuvable" }, { status: 404 });

  const erreurs = ((batch.erreurs ?? []) as unknown as ErreurImport[]) || [];

  // Une ligne par erreur : n° de ligne d'origine, raison, puis les données mappées
  const lignes = erreurs.map((e) => ({
    ligne_origine: e.ligne,
    raison: e.raison,
    ...e.donnees,
  }));

  const feuille = XLSX.utils.json_to_sheet(
    lignes.length > 0 ? lignes : [{ info: "Aucune erreur 🎉" }]
  );
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, "Erreurs");
  const buffer = XLSX.write(classeur, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="erreurs-import-${params.id}.xlsx"`,
    },
  });
}
