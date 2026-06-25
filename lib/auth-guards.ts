/**
 * Garde-fous d'autorisation côté serveur (Route Handlers / Server Actions).
 */
import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/** Rôle de l'utilisateur connecté (null si non connecté). */
export async function roleCourant(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as { role?: string } | undefined)?.role ?? null;
}

/** Vrai si l'utilisateur connecté est ADMIN. */
export async function estAdmin(): Promise<boolean> {
  return (await roleCourant()) === "ADMIN";
}
