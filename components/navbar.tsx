"use client";

/**
 * Barre de navigation principale (masquée sur la page de login).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Grape, Map, Users, Hammer, Upload, LogOut, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const LIENS = [
  { href: "/", libelle: "Carte", icone: Map },
  { href: "/clients", libelle: "Clients", icone: Users },
  { href: "/chantiers", libelle: "Chantiers", icone: Hammer },
  { href: "/import", libelle: "Import", icone: Upload },
];

// Liens réservés aux administrateurs
const LIENS_ADMIN = [
  { href: "/utilisateurs", libelle: "Utilisateurs", icone: ShieldCheck },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const estAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  // Liens visibles selon le rôle
  const liens = estAdmin ? [...LIENS, ...LIENS_ADMIN] : LIENS;

  // Pas de barre sur l'écran de connexion
  if (pathname === "/login") return null;

  return (
    <header className="z-20 flex h-14 shrink-0 items-center gap-4 border-b bg-background px-4">
      <Link href="/" className="flex items-center gap-2 font-bold text-primary">
        <Grape className="h-5 w-5" />
        AGRICONNECT
      </Link>
      <nav className="flex flex-1 items-center gap-1">
        {liens.map(({ href, libelle, icone: Icone }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent",
              pathname === href ? "bg-accent text-accent-foreground" : "text-muted-foreground"
            )}
          >
            <Icone className="h-4 w-4" />
            {libelle}
          </Link>
        ))}
      </nav>
      {session?.user?.email && (
        <span className="hidden text-xs text-muted-foreground sm:block">
          {session.user.email}
        </span>
      )}
      <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
        <LogOut className="h-4 w-4" />
        Déconnexion
      </Button>
    </header>
  );
}
