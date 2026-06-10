"use client";

/**
 * Écran de connexion (NextAuth Credentials).
 */
import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Grape } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function FormulaireLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  async function seConnecter(e: React.FormEvent) {
    e.preventDefault();
    setChargement(true);
    setErreur(null);
    const resultat = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setChargement(false);
    if (resultat?.error) {
      setErreur("Identifiants incorrects");
    } else {
      router.push(searchParams.get("callbackUrl") ?? "/");
      router.refresh();
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <Grape className="h-10 w-10 text-primary" />
        <CardTitle className="text-xl">AGRICONNECT</CardTitle>
        <p className="text-sm text-muted-foreground">Parcelles & dispatch main d&apos;œuvre</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={seConnecter} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {erreur && <p className="text-sm text-destructive">{erreur}</p>}
          <Button type="submit" className="w-full" disabled={chargement}>
            {chargement ? "Connexion..." : "Se connecter"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function PageLogin() {
  return (
    <div className="flex h-full items-center justify-center bg-muted/40 p-4">
      <Suspense>
        <FormulaireLogin />
      </Suspense>
    </div>
  );
}
