/**
 * GET /api/import/template — génère le modèle Excel d'import (.xlsx)
 * avec les colonnes attendues et une ligne d'exemple.
 */
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function GET() {
  const exemple = [
    {
      client_nom: "Domaine Exemple",
      client_contact: "Jean Dupont",
      client_telephone: "06 12 34 56 78",
      client_email: "contact@domaine-exemple.fr",
      commune: "Riquewihr",
      code_insee: "68277",
      section: "AB",
      numero: "123",
      latitude: "",
      longitude: "",
      cepage: "Riesling",
      millesime: 1998,
      notes: "Parcelle en coteau",
    },
  ];

  const feuille = XLSX.utils.json_to_sheet(exemple);
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, "Parcelles");
  const buffer = XLSX.write(classeur, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modele-import-parcelles.xlsx"',
    },
  });
}
