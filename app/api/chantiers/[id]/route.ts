/**
 * /api/chantiers/[id] — modification (PATCH : champs + parcelles + statut)
 * et suppression (DELETE).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schemaMaj = z.object({
  titre: z.string().trim().min(1).optional(),
  typeTravail: z.enum([
    "TAILLE", "TIRAGE_BOIS", "PALISSAGE", "EBOURGEONNAGE", "RELEVAGE",
    "EFFEUILLAGE", "VENDANGE", "TRAITEMENT", "PLANTATION", "AUTRE",
  ]).optional(),
  datePrevue: z.string().datetime().nullable().optional(),
  equipe: z.string().trim().nullable().optional(),
  consignes: z.string().nullable().optional(),
  statut: z.enum(["A_FAIRE", "ENVOYE", "EN_COURS", "TERMINE"]).optional(),
  /** Ajout de parcelles au chantier (depuis la carte) */
  ajouterParcelleIds: z.array(z.string()).optional(),
  /** Retrait d'une parcelle */
  retirerParcelleIds: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const corps = schemaMaj.safeParse(await req.json());
  if (!corps.success) {
    return NextResponse.json({ erreur: corps.error.errors[0].message }, { status: 400 });
  }
  const { ajouterParcelleIds, retirerParcelleIds, datePrevue, ...champs } = corps.data;

  const chantier = await prisma.chantier.update({
    where: { id: params.id },
    data: {
      ...champs,
      ...(datePrevue !== undefined
        ? { datePrevue: datePrevue ? new Date(datePrevue) : null }
        : {}),
      parcelles: {
        ...(ajouterParcelleIds?.length
          ? {
              // createMany + skipDuplicates : pas d'erreur si déjà rattachée
              createMany: {
                data: ajouterParcelleIds.map((parcelleId) => ({ parcelleId })),
                skipDuplicates: true,
              },
            }
          : {}),
        ...(retirerParcelleIds?.length
          ? { deleteMany: { parcelleId: { in: retirerParcelleIds } } }
          : {}),
      },
    },
    include: { parcelles: true },
  });
  return NextResponse.json(chantier);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.chantier.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
