/**
 * /api/parcelles/[id] — modification (PATCH) et suppression (DELETE).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schemaMaj = z.object({
  clientId: z.string().optional(),
  cepage: z.string().trim().nullable().optional(),
  millesime: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const corps = schemaMaj.safeParse(await req.json());
  if (!corps.success) {
    return NextResponse.json({ erreur: corps.error.errors[0].message }, { status: 400 });
  }
  const parcelle = await prisma.parcelle.update({
    where: { id: params.id },
    data: corps.data,
  });
  return NextResponse.json(parcelle);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.parcelle.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
