"use client";

/**
 * Dialogue d'édition d'une parcelle : client de rattachement,
 * cépage, millésime, notes (la géométrie cadastrale ne se modifie pas).
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import type { ParcelleCarte } from "@/types/geo";
import type { ClientResume } from "./page-carte";

interface Props {
  parcelle: ParcelleCarte | null;
  clients: ClientResume[];
  onClose: () => void;
  onSucces: () => void;
}

export function DialogEditionParcelle({ parcelle, clients, onClose, onSucces }: Props) {
  const [clientId, setClientId] = useState("");
  const [cepage, setCepage] = useState("");
  const [millesime, setMillesime] = useState("");
  const [notes, setNotes] = useState("");
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (parcelle) {
      setClientId(parcelle.client.id);
      setCepage(parcelle.cepage ?? "");
      setMillesime(parcelle.millesime?.toString() ?? "");
      setNotes(parcelle.notes ?? "");
    }
  }, [parcelle]);

  async function enregistrer() {
    if (!parcelle) return;
    setEnvoi(true);
    try {
      await fetch(`/api/parcelles/${parcelle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          cepage: cepage || null,
          millesime: millesime ? parseInt(millesime, 10) : null,
          notes: notes || null,
        }),
      });
      onSucces();
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Dialog open={parcelle !== null} onClose={onClose}>
      <DialogTitle>
        Éditer {parcelle?.commune} {parcelle?.section} {parcelle?.numero}
      </DialogTitle>
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Client</Label>
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label>Cépage</Label>
            <Input value={cepage} onChange={(e) => setCepage(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Millésime</Label>
            <Input
              type="number"
              value={millesime}
              onChange={(e) => setMillesime(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <Button onClick={enregistrer} disabled={envoi} className="w-full">
          {envoi ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </Dialog>
  );
}
