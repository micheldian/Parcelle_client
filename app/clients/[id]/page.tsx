"use client";

/**
 * Vue détail d'un client : coordonnées, liste de ses parcelles
 * et surface totale.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formaterHectares } from "@/lib/geo";

interface ParcelleLigne {
  id: string;
  commune: string;
  section: string;
  numero: string;
  surfaceM2: number | null;
  cepage: string | null;
  millesime: number | null;
  notes: string | null;
}

interface ClientDetail {
  id: string;
  nom: string;
  contactNom: string | null;
  telephone: string | null;
  email: string | null;
  couleur: string;
  notes: string | null;
  parcelles: ParcelleLigne[];
}

export default function PageDetailClient() {
  const params = useParams<{ id: string }>();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    fetch(`/api/clients/${params.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setClient)
      .finally(() => setChargement(false));
  }, [params.id]);

  if (chargement) {
    return <p className="p-6 text-muted-foreground">Chargement…</p>;
  }
  if (!client) {
    return <p className="p-6 text-destructive">Client introuvable.</p>;
  }

  const surfaceTotale = client.parcelles.reduce((acc, p) => acc + (p.surfaceM2 ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-4 overflow-y-auto p-6" style={{ maxHeight: "100%" }}>
      <Link href="/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="h-4 w-4" /> Retour aux clients
      </Link>

      <div className="flex items-center gap-3">
        <span className="inline-block h-5 w-5 rounded-full" style={{ backgroundColor: client.couleur }} />
        <h1 className="text-2xl font-bold">{client.nom}</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Coordonnées</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Contact : {client.contactNom ?? "—"}</p>
            <p>Téléphone : {client.telephone ?? "—"}</p>
            <p>Email : {client.email ?? "—"}</p>
            {client.notes && <p className="text-muted-foreground">{client.notes}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Parcellaire</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="text-3xl font-bold">{client.parcelles.length}</p>
            <p className="text-muted-foreground">
              parcelle(s) — surface totale : <b>{formaterHectares(surfaceTotale)}</b>
            </p>
          </CardContent>
        </Card>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Commune</TableHead>
            <TableHead>Section</TableHead>
            <TableHead>Numéro</TableHead>
            <TableHead>Cépage</TableHead>
            <TableHead>Millésime</TableHead>
            <TableHead className="text-right">Surface</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {client.parcelles.map((p) => (
            <TableRow key={p.id}>
              <TableCell>{p.commune}</TableCell>
              <TableCell>{p.section}</TableCell>
              <TableCell>{p.numero}</TableCell>
              <TableCell>{p.cepage ?? "—"}</TableCell>
              <TableCell>{p.millesime ?? "—"}</TableCell>
              <TableCell className="text-right">{formaterHectares(p.surfaceM2)}</TableCell>
            </TableRow>
          ))}
          {client.parcelles.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                Aucune parcelle enregistrée pour ce client.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
