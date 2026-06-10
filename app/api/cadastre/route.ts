/**
 * GET /api/cadastre — proxy serveur de l'API Carto cadastre (IGN).
 *  - ?code_insee=&section=&numero=  → recherche par référence cadastrale
 *  - ?lat=&lng=                     → recherche par point (clic carte)
 */
import { NextRequest, NextResponse } from "next/server";
import {
  rechercherParcelleParPoint,
  rechercherParcelleParReference,
} from "@/lib/ign";
import { normaliserNumero, normaliserSection } from "@/lib/geo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  try {
    // Recherche par référence cadastrale
    const codeInsee = p.get("code_insee");
    const section = p.get("section");
    const numero = p.get("numero");
    if (codeInsee && section && numero) {
      const features = await rechercherParcelleParReference(
        codeInsee.trim(),
        normaliserSection(section),
        normaliserNumero(numero)
      );
      return NextResponse.json({ features });
    }

    // Recherche par point
    const lat = parseFloat(p.get("lat") ?? "");
    const lng = parseFloat(p.get("lng") ?? "");
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const features = await rechercherParcelleParPoint(lng, lat);
      return NextResponse.json({ features });
    }

    return NextResponse.json(
      { erreur: "Paramètres requis : (code_insee, section, numero) ou (lat, lng)" },
      { status: 400 }
    );
  } catch (e) {
    return NextResponse.json(
      { erreur: e instanceof Error ? e.message : "Erreur API Carto" },
      { status: 502 }
    );
  }
}
