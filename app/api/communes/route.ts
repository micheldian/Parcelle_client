/**
 * GET /api/communes?nom=... → autocomplétion des communes (proxy API Géo gouv).
 * Appel côté serveur uniquement (CORS + cache).
 */
import { NextRequest, NextResponse } from "next/server";
import { rechercherCommunes } from "@/lib/ign";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const nom = req.nextUrl.searchParams.get("nom")?.trim();
  if (!nom || nom.length < 2) {
    return NextResponse.json([]);
  }
  try {
    const communes = await rechercherCommunes(nom);
    return NextResponse.json(communes);
  } catch (e) {
    return NextResponse.json(
      { erreur: e instanceof Error ? e.message : "Erreur API Géo" },
      { status: 502 }
    );
  }
}
