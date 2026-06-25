/**
 * /api/users/[id] — modification (rôle / mot de passe) et suppression.
 * Réservé ADMIN. Garde-fou : on ne peut pas supprimer le dernier administrateur.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { estAdmin } from "@/lib/auth-guards";

export const dynamic = "force-dynamic";

const schemaMaj = z.object({
  password: z.string().min(6, "Mot de passe : 6 caractères minimum").optional(),
  role: z.enum(["ADMIN", "OPERATEUR"]).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await estAdmin())) {
    return NextResponse.json({ erreur: "Accès réservé aux administrateurs" }, { status: 403 });
  }
  const corps = schemaMaj.safeParse(await req.json());
  if (!corps.success) {
    return NextResponse.json({ erreur: corps.error.errors[0].message }, { status: 400 });
  }

  // Empêcher de rétrograder le dernier admin
  if (corps.data.role === "OPERATEUR") {
    const cible = await prisma.user.findUnique({ where: { id: params.id } });
    if (cible?.role === "ADMIN") {
      const nbAdmins = await prisma.user.count({ where: { role: "ADMIN" } });
      if (nbAdmins <= 1) {
        return NextResponse.json(
          { erreur: "Impossible : il doit rester au moins un administrateur" },
          { status: 400 }
        );
      }
    }
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data: {
      ...(corps.data.role ? { role: corps.data.role } : {}),
      ...(corps.data.password ? { password: await bcrypt.hash(corps.data.password, 10) } : {}),
    },
    select: { id: true, email: true, role: true },
  });
  return NextResponse.json(user);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await estAdmin())) {
    return NextResponse.json({ erreur: "Accès réservé aux administrateurs" }, { status: 403 });
  }
  // Garde-fou : ne pas supprimer le dernier administrateur
  const cible = await prisma.user.findUnique({ where: { id: params.id } });
  if (cible?.role === "ADMIN") {
    const nbAdmins = await prisma.user.count({ where: { role: "ADMIN" } });
    if (nbAdmins <= 1) {
      return NextResponse.json(
        { erreur: "Impossible de supprimer le dernier administrateur" },
        { status: 400 }
      );
    }
  }
  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
