/**
 * /api/clients/[id] — détail (GET), modification (PATCH), suppression (DELETE).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schemaMaj = z.object({
  nom: z.string().trim().min(1).optional(),
  contactNom: z.string().trim().nullable().optional(),
  telephone: z.string().trim().nullable().optional(),
  email: z.string().trim().nullable().optional(),
  couleur: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: { parcelles: { orderBy: [{ commune: "asc" }, { section: "asc" }] } },
  });
  if (!client) return NextResponse.json({ erreur: "Client introuvable" }, { status: 404 });
  return NextResponse.json(client);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const corps = schemaMaj.safeParse(await req.json());
  if (!corps.success) {
    return NextResponse.json({ erreur: corps.error.errors[0].message }, { status: 400 });
  }
  try {
    const client = await prisma.client.update({ where: { id: params.id }, data: corps.data });
    return NextResponse.json(client);
  } catch {
    return NextResponse.json({ erreur: "Mise à jour impossible (nom déjà pris ?)" }, { status: 409 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  // onDelete: Cascade → supprime aussi les parcelles du client
  await prisma.client.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
