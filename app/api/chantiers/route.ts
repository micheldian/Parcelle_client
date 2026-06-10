/**
 * /api/chantiers — liste (GET) et création (POST) de chantiers.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schemaChantier = z.object({
  titre: z.string().trim().min(1, "Le titre est requis"),
  typeTravail: z.enum([
    "TAILLE", "TIRAGE_BOIS", "PALISSAGE", "EBOURGEONNAGE", "RELEVAGE",
    "EFFEUILLAGE", "VENDANGE", "TRAITEMENT", "PLANTATION", "AUTRE",
  ]),
  datePrevue: z.string().datetime().nullable().optional(),
  equipe: z.string().trim().nullable().optional(),
  consignes: z.string().nullable().optional(),
  parcelleIds: z.array(z.string()).default([]),
});

export async function GET() {
  const chantiers = await prisma.chantier.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      parcelles: {
        include: {
          parcelle: {
            select: {
              id: true, commune: true, section: true, numero: true,
              surfaceM2: true, centroidLat: true, centroidLng: true,
              client: { select: { nom: true, couleur: true } },
            },
          },
        },
      },
    },
  });
  return NextResponse.json(chantiers);
}

export async function POST(req: NextRequest) {
  const corps = schemaChantier.safeParse(await req.json());
  if (!corps.success) {
    return NextResponse.json({ erreur: corps.error.errors[0].message }, { status: 400 });
  }
  const d = corps.data;
  const chantier = await prisma.chantier.create({
    data: {
      titre: d.titre,
      typeTravail: d.typeTravail,
      datePrevue: d.datePrevue ? new Date(d.datePrevue) : null,
      equipe: d.equipe || null,
      consignes: d.consignes || null,
      parcelles: {
        create: d.parcelleIds.map((parcelleId) => ({ parcelleId })),
      },
    },
    include: { parcelles: true },
  });
  return NextResponse.json(chantier, { status: 201 });
}
