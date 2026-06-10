/**
 * /api/clients — liste (GET) et création (POST) de clients.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schemaClient = z.object({
  nom: z.string().trim().min(1, "Le nom est requis"),
  contactNom: z.string().trim().optional().nullable(),
  telephone: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal("")),
  couleur: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur hexadécimale attendue"),
  notes: z.string().optional().nullable(),
});

export async function GET() {
  // Liste avec agrégats : nombre de parcelles et surface totale
  const clients = await prisma.client.findMany({
    orderBy: { nom: "asc" },
    include: { parcelles: { select: { surfaceM2: true } } },
  });
  return NextResponse.json(
    clients.map(({ parcelles, ...client }) => ({
      ...client,
      nbParcelles: parcelles.length,
      surfaceTotaleM2: parcelles.reduce((acc, p) => acc + (p.surfaceM2 ?? 0), 0),
    }))
  );
}

export async function POST(req: NextRequest) {
  const corps = schemaClient.safeParse(await req.json());
  if (!corps.success) {
    return NextResponse.json({ erreur: corps.error.errors[0].message }, { status: 400 });
  }
  try {
    const client = await prisma.client.create({
      data: { ...corps.data, email: corps.data.email || null },
    });
    return NextResponse.json(client, { status: 201 });
  } catch {
    return NextResponse.json({ erreur: "Un client porte déjà ce nom" }, { status: 409 });
  }
}
