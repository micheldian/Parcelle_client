/**
 * /api/users — gestion des utilisateurs internes (réservé ADMIN).
 *  - GET  : liste des comptes
 *  - POST : création d'un compte (email, mot de passe, rôle)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { estAdmin } from "@/lib/auth-guards";

export const dynamic = "force-dynamic";

const schemaUser = z.object({
  email: z.string().trim().toLowerCase().email("Email invalide"),
  password: z.string().min(6, "Mot de passe : 6 caractères minimum"),
  role: z.enum(["ADMIN", "OPERATEUR"]).default("OPERATEUR"),
});

export async function GET() {
  if (!(await estAdmin())) {
    return NextResponse.json({ erreur: "Accès réservé aux administrateurs" }, { status: 403 });
  }
  // Jamais renvoyer le hash du mot de passe
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true },
    orderBy: { email: "asc" },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  if (!(await estAdmin())) {
    return NextResponse.json({ erreur: "Accès réservé aux administrateurs" }, { status: 403 });
  }
  const corps = schemaUser.safeParse(await req.json());
  if (!corps.success) {
    return NextResponse.json({ erreur: corps.error.errors[0].message }, { status: 400 });
  }
  try {
    const user = await prisma.user.create({
      data: {
        email: corps.data.email,
        password: await bcrypt.hash(corps.data.password, 10),
        role: corps.data.role,
      },
      select: { id: true, email: true, role: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch {
    return NextResponse.json({ erreur: "Cet email est déjà utilisé" }, { status: 409 });
  }
}
