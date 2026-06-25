"use client";

/**
 * Page Utilisateurs (réservée ADMIN) : créer, lister, modifier le mot de passe,
 * changer le rôle et supprimer les comptes internes.
 */
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface Utilisateur {
  id: string;
  email: string;
  role: "ADMIN" | "OPERATEUR";
}

export default function PageUtilisateurs() {
  const { data: session, status } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  const [users, setUsers] = useState<Utilisateur[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  // Création
  const [dialogOuvert, setDialogOuvert] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nouveauRole, setNouveauRole] = useState<"ADMIN" | "OPERATEUR">("OPERATEUR");
  const [envoi, setEnvoi] = useState(false);

  // Réinitialisation du mot de passe
  const [resetUser, setResetUser] = useState<Utilisateur | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const charger = useCallback(async () => {
    const reponse = await fetch("/api/users");
    if (reponse.ok) setUsers(await reponse.json());
    else setErreur("Accès réservé aux administrateurs.");
  }, []);

  useEffect(() => {
    if (role === "ADMIN") charger();
  }, [role, charger]);

  async function creer() {
    setEnvoi(true);
    setErreur(null);
    try {
      const reponse = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role: nouveauRole }),
      });
      if (reponse.ok) {
        setDialogOuvert(false);
        setEmail(""); setPassword(""); setNouveauRole("OPERATEUR");
        charger();
      } else {
        setErreur((await reponse.json()).erreur ?? "Erreur lors de la création");
      }
    } finally {
      setEnvoi(false);
    }
  }

  async function changerRole(u: Utilisateur, role: string) {
    const reponse = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!reponse.ok) alert((await reponse.json()).erreur ?? "Erreur");
    charger();
  }

  async function reinitialiser() {
    if (!resetUser) return;
    const reponse = await fetch(`/api/users/${resetUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: resetPassword }),
    });
    if (reponse.ok) {
      setResetUser(null);
      setResetPassword("");
      alert("Mot de passe mis à jour.");
    } else {
      alert((await reponse.json()).erreur ?? "Erreur");
    }
  }

  async function supprimer(u: Utilisateur) {
    if (!confirm(`Supprimer l'utilisateur ${u.email} ?`)) return;
    const reponse = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    if (!reponse.ok) alert((await reponse.json()).erreur ?? "Erreur");
    charger();
  }

  if (status === "loading") {
    return <p className="p-6 text-muted-foreground">Chargement…</p>;
  }
  if (role !== "ADMIN") {
    return (
      <p className="p-6 text-destructive">
        Cette page est réservée aux administrateurs.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 overflow-y-auto p-6" style={{ maxHeight: "100%" }}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Utilisateurs</h1>
        <Button onClick={() => { setErreur(null); setDialogOuvert(true); }}>
          <Plus className="h-4 w-4" /> Nouvel utilisateur
        </Button>
      </div>

      {erreur && <p className="text-sm text-destructive">{erreur}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Rôle</TableHead>
            <TableHead className="w-40 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">
                {u.email}
                {u.email === session?.user?.email && (
                  <Badge variant="secondary" className="ml-2">vous</Badge>
                )}
              </TableCell>
              <TableCell>
                <Select
                  value={u.role}
                  onChange={(e) => changerRole(u, e.target.value)}
                  className="h-8 w-36 text-xs"
                >
                  <option value="OPERATEUR">Opérateur</option>
                  <option value="ADMIN">Administrateur</option>
                </Select>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setResetUser(u); setResetPassword(""); }}
                    title="Réinitialiser le mot de passe"
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => supprimer(u)}
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <p className="text-xs text-muted-foreground">
        <b>Opérateur</b> : accès aux parcelles, chantiers et import.{" "}
        <b>Administrateur</b> : en plus, gestion des utilisateurs.
      </p>

      {/* Création */}
      <Dialog open={dialogOuvert} onClose={() => setDialogOuvert(false)}>
        <DialogTitle>Nouvel utilisateur</DialogTitle>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe (6 caractères min.)</Label>
            <Input id="password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Rôle</Label>
            <Select value={nouveauRole} onChange={(e) => setNouveauRole(e.target.value as "ADMIN" | "OPERATEUR")}>
              <option value="OPERATEUR">Opérateur</option>
              <option value="ADMIN">Administrateur</option>
            </Select>
          </div>
          {erreur && <p className="text-sm text-destructive">{erreur}</p>}
          <Button
            onClick={creer}
            disabled={envoi || !email.trim() || password.length < 6}
            className="w-full"
          >
            {envoi ? "Création…" : "Créer l'utilisateur"}
          </Button>
        </div>
      </Dialog>

      {/* Réinitialisation du mot de passe */}
      <Dialog open={resetUser !== null} onClose={() => setResetUser(null)}>
        <DialogTitle>Mot de passe — {resetUser?.email}</DialogTitle>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="reset">Nouveau mot de passe (6 caractères min.)</Label>
            <Input id="reset" type="text" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
          </div>
          <Button onClick={reinitialiser} disabled={resetPassword.length < 6} className="w-full">
            Mettre à jour le mot de passe
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
