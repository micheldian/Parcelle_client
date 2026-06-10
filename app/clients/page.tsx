"use client";

/**
 * Page Clients : CRUD complet (nom, contact, téléphone, email,
 * couleur d'affichage carte, notes) + agrégats parcelles/surface.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formaterHectares } from "@/lib/geo";

interface ClientLigne {
  id: string;
  nom: string;
  contactNom: string | null;
  telephone: string | null;
  email: string | null;
  couleur: string;
  notes: string | null;
  nbParcelles: number;
  surfaceTotaleM2: number;
}

const FORMULAIRE_VIDE = {
  nom: "", contactNom: "", telephone: "", email: "", couleur: "#FF5722", notes: "",
};

export default function PageClients() {
  const [clients, setClients] = useState<ClientLigne[]>([]);
  const [recherche, setRecherche] = useState("");
  const [dialogOuvert, setDialogOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState<string | null>(null); // id client édité
  const [form, setForm] = useState(FORMULAIRE_VIDE);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(async () => {
    const reponse = await fetch("/api/clients");
    if (reponse.ok) setClients(await reponse.json());
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  function ouvrirCreation() {
    setEnEdition(null);
    setForm(FORMULAIRE_VIDE);
    setErreur(null);
    setDialogOuvert(true);
  }

  function ouvrirEdition(c: ClientLigne) {
    setEnEdition(c.id);
    setForm({
      nom: c.nom,
      contactNom: c.contactNom ?? "",
      telephone: c.telephone ?? "",
      email: c.email ?? "",
      couleur: c.couleur,
      notes: c.notes ?? "",
    });
    setErreur(null);
    setDialogOuvert(true);
  }

  async function enregistrer() {
    setEnvoi(true);
    setErreur(null);
    try {
      const corps = {
        nom: form.nom,
        contactNom: form.contactNom || null,
        telephone: form.telephone || null,
        email: form.email || null,
        couleur: form.couleur,
        notes: form.notes || null,
      };
      const reponse = enEdition
        ? await fetch(`/api/clients/${enEdition}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(corps),
          })
        : await fetch("/api/clients", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(corps),
          });
      if (reponse.ok) {
        setDialogOuvert(false);
        charger();
      } else {
        const donnees = await reponse.json();
        setErreur(donnees.erreur ?? "Erreur lors de l'enregistrement");
      }
    } finally {
      setEnvoi(false);
    }
  }

  async function supprimer(c: ClientLigne) {
    if (
      !confirm(
        `Supprimer le client « ${c.nom} » et ses ${c.nbParcelles} parcelle(s) ? Cette action est définitive.`
      )
    )
      return;
    await fetch(`/api/clients/${c.id}`, { method: "DELETE" });
    charger();
  }

  const clientsFiltres = clients.filter((c) =>
    c.nom.toLowerCase().includes(recherche.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4 overflow-y-auto p-6" style={{ maxHeight: "100%" }}>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Clients</h1>
        <div className="flex gap-2">
          <Input
            placeholder="Rechercher…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="w-48"
          />
          <Button onClick={ouvrirCreation}>
            <Plus className="h-4 w-4" /> Nouveau client
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Téléphone</TableHead>
            <TableHead className="text-right">Parcelles</TableHead>
            <TableHead className="text-right">Surface totale</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {clientsFiltres.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <Link href={`/clients/${c.id}`} className="flex items-center gap-2 font-medium hover:underline">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: c.couleur }}
                  />
                  {c.nom}
                </Link>
              </TableCell>
              <TableCell>{c.contactNom ?? "—"}</TableCell>
              <TableCell>{c.telephone ?? "—"}</TableCell>
              <TableCell className="text-right">{c.nbParcelles}</TableCell>
              <TableCell className="text-right">{formaterHectares(c.surfaceTotaleM2)}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => ouvrirEdition(c)} aria-label="Éditer">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => supprimer(c)} aria-label="Supprimer">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {clientsFiltres.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                Aucun client. Créez-en un ou utilisez l&apos;import de fichier.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Dialogue création / édition */}
      <Dialog open={dialogOuvert} onClose={() => setDialogOuvert(false)}>
        <DialogTitle>{enEdition ? "Modifier le client" : "Nouveau client"}</DialogTitle>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="nom">Nom *</Label>
            <Input id="nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="contact">Contact</Label>
              <Input
                id="contact"
                value={form.contactNom}
                onChange={(e) => setForm({ ...form, contactNom: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tel">Téléphone</Label>
              <Input
                id="tel"
                value={form.telephone}
                onChange={(e) => setForm({ ...form, telephone: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="couleur">Couleur carte</Label>
              <Input
                id="couleur"
                type="color"
                value={form.couleur}
                onChange={(e) => setForm({ ...form, couleur: e.target.value })}
                className="h-9 p-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          {erreur && <p className="text-sm text-destructive">{erreur}</p>}
          <Button onClick={enregistrer} disabled={envoi || !form.nom.trim()} className="w-full">
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
