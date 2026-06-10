"use client";

/**
 * Assistant d'import en 5 étapes :
 *  1. Upload + parsing du fichier (navigateur)
 *  2. Mapping interactif colonnes → champs cibles (pré-rempli automatiquement)
 *  3. Aperçu des 20 premières lignes + validation à blanc
 *  4. Traitement par lots résumable (barre de progression)
 *  5. Rapport final + téléchargement du rapport d'erreurs (.xlsx)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileUp, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  mappingAutomatique,
  parserFichier,
  type FichierParse,
} from "@/lib/import/parse-client";
import { CHAMPS_IMPORT, type ChampImport, type LigneImport } from "@/types/geo";

type Etape = "upload" | "mapping" | "apercu" | "traitement" | "rapport";

/** Libellés et caractère requis des champs cibles. */
const DESCRIPTION_CHAMPS: Record<ChampImport, { libelle: string; aide: string }> = {
  client_nom: { libelle: "Nom du client *", aide: "Regroupe/crée le client" },
  client_contact: { libelle: "Contact", aide: "" },
  client_telephone: { libelle: "Téléphone", aide: "" },
  client_email: { libelle: "Email", aide: "" },
  commune: { libelle: "Commune", aide: "Résolue en code INSEE" },
  code_insee: { libelle: "Code INSEE", aide: "Prioritaire sur la commune" },
  section: { libelle: "Section", aide: "Référence cadastrale" },
  numero: { libelle: "Numéro", aide: "Référence cadastrale" },
  latitude: { libelle: "Latitude", aide: "Alternative : géométrie par point" },
  longitude: { libelle: "Longitude", aide: "Alternative : géométrie par point" },
  cepage: { libelle: "Cépage", aide: "" },
  millesime: { libelle: "Millésime", aide: "" },
  notes: { libelle: "Notes", aide: "" },
};

interface EtatBatch {
  statut: string;
  totalLignes: number;
  lignesTraitees: number;
  clientsCrees: number;
  parcellesCreees: number;
  parcellesIgnorees: number;
  nbErreurs: number;
}

interface ImportHistorique {
  id: string;
  nomFichier: string;
  statut: string;
  totalLignes: number;
  lignesTraitees: number;
  parcellesCreees: number;
  createdAt: string;
}

export function ImportWizard() {
  const [etape, setEtape] = useState<Etape>("upload");
  const [nomFichier, setNomFichier] = useState("");
  const [parse, setParse] = useState<FichierParse | null>(null);
  const [mapping, setMapping] = useState<Record<ChampImport, string>>(
    Object.fromEntries(CHAMPS_IMPORT.map((c) => [c, ""])) as Record<ChampImport, string>
  );
  const [erreur, setErreur] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [etat, setEtat] = useState<EtatBatch | null>(null);
  const [historique, setHistorique] = useState<ImportHistorique[]>([]);
  const traitementActif = useRef(false);

  // Historique des imports (et reprise éventuelle)
  const chargerHistorique = useCallback(async () => {
    const reponse = await fetch("/api/import");
    if (reponse.ok) setHistorique(await reponse.json());
  }, []);

  useEffect(() => {
    chargerHistorique();
  }, [chargerHistorique]);

  // ---------- Étape 1 : upload ----------
  async function chargerFichier(fichier: File) {
    setErreur(null);
    try {
      const resultat = await parserFichier(fichier);
      if (resultat.lignes.length === 0) {
        setErreur("Le fichier ne contient aucune ligne de données.");
        return;
      }
      setNomFichier(fichier.name);
      setParse(resultat);
      setMapping(mappingAutomatique(resultat.colonnes));
      setEtape("mapping");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Impossible de lire ce fichier.");
    }
  }

  // ---------- Étapes 2-3 : mapping + aperçu ----------
  /** Applique le mapping courant à une ligne brute. */
  function appliquerMapping(valeurs: Record<string, string>): Partial<Record<ChampImport, string>> {
    const resultat: Partial<Record<ChampImport, string>> = {};
    for (const champ of CHAMPS_IMPORT) {
      const colonne = mapping[champ];
      if (colonne && valeurs[colonne] !== undefined && valeurs[colonne] !== "") {
        resultat[champ] = valeurs[colonne];
      }
    }
    return resultat;
  }

  /** Validation à blanc : lignes sans client ou sans aucune source de géométrie. */
  function validerLignes() {
    if (!parse) return { sansClient: 0, sansGeometrie: 0 };
    let sansClient = 0;
    let sansGeometrie = 0;
    for (const ligne of parse.lignes) {
      const v = appliquerMapping(ligne.valeurs);
      if (!v.client_nom?.trim()) sansClient++;
      const aReference = (v.code_insee || v.commune) && v.section && v.numero;
      const aPoint = v.latitude && v.longitude;
      if (!aReference && !aPoint && !ligne.geometry) sansGeometrie++;
    }
    return { sansClient, sansGeometrie };
  }

  // ---------- Étape 4 : lancement + boucle de traitement ----------
  async function lancerImport() {
    if (!parse) return;
    setErreur(null);

    const lignes: LigneImport[] = parse.lignes.map((l) => ({
      ligne: l.ligne,
      valeurs: appliquerMapping(l.valeurs),
      geometry: l.geometry ?? null,
    }));

    const reponse = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomFichier, mapping, lignes }),
    });
    if (!reponse.ok) {
      const donnees = await reponse.json();
      setErreur(donnees.erreur ?? "Impossible de créer l'import.");
      return;
    }
    const { id } = await reponse.json();
    setBatchId(id);
    setEtape("traitement");
    boucleTraitement(id);
  }

  /** Reprend un import interrompu (état conservé dans ImportBatch). */
  function reprendreImport(b: ImportHistorique) {
    setBatchId(b.id);
    setNomFichier(b.nomFichier);
    setEtat(null);
    setEtape("traitement");
    boucleTraitement(b.id);
  }

  /**
   * Boucle côté navigateur : appelle /process tant que lignesTraitees < total.
   * Chaque appel serveur traite ~20 lignes (timeout Vercel respecté).
   */
  async function boucleTraitement(id: string) {
    if (traitementActif.current) return;
    traitementActif.current = true;
    try {
      // Boucle jusqu'à épuisement des lignes
      for (;;) {
        const reponse = await fetch(`/api/import/${id}/process`, { method: "POST" });
        if (!reponse.ok) {
          const donnees = await reponse.json().catch(() => ({}));
          setErreur(donnees.erreur ?? "Erreur pendant le traitement.");
          return;
        }
        const nouvelEtat = (await reponse.json()) as EtatBatch;
        setEtat(nouvelEtat);
        if (nouvelEtat.statut === "TERMINE" || nouvelEtat.lignesTraitees >= nouvelEtat.totalLignes) {
          setEtape("rapport");
          chargerHistorique();
          return;
        }
        // Petit délai entre lots : courtoisie vis-à-vis des API IGN
        await new Promise((r) => setTimeout(r, 300));
      }
    } finally {
      traitementActif.current = false;
    }
  }

  function recommencer() {
    setEtape("upload");
    setParse(null);
    setBatchId(null);
    setEtat(null);
    setErreur(null);
  }

  const validation = etape === "apercu" ? validerLignes() : null;
  const progression = etat && etat.totalLignes > 0
    ? (etat.lignesTraitees / etat.totalLignes) * 100
    : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 overflow-y-auto p-6" style={{ maxHeight: "100%" }}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Import de fichier</h1>
        <Button variant="outline" onClick={() => window.open("/api/import/template", "_blank")}>
          <Download className="h-4 w-4" /> Télécharger le modèle Excel
        </Button>
      </div>

      {erreur && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erreur}</p>
      )}

      {/* ========== Étape 1 : upload ========== */}
      {etape === "upload" && (
        <>
          <Card>
            <CardContent className="p-8">
              <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-10 text-center hover:bg-accent">
                <FileUp className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="font-medium">Choisir un fichier à importer</p>
                  <p className="text-sm text-muted-foreground">
                    Formats acceptés : .xlsx, .xls, .csv (tableaux) — .geojson, .kml (géométries)
                  </p>
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.geojson,.json,.kml"
                  className="hidden"
                  onChange={(e) => {
                    const fichier = e.target.files?.[0];
                    if (fichier) chargerFichier(fichier);
                  }}
                />
              </label>
            </CardContent>
          </Card>

          {/* Historique + reprise des imports interrompus */}
          {historique.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Imports récents</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fichier</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Progression</TableHead>
                      <TableHead className="text-right">Parcelles créées</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historique.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.nomFichier}</TableCell>
                        <TableCell>{b.statut}</TableCell>
                        <TableCell className="text-right">
                          {b.lignesTraitees}/{b.totalLignes}
                        </TableCell>
                        <TableCell className="text-right">{b.parcellesCreees}</TableCell>
                        <TableCell className="text-right">
                          {(b.statut === "EN_COURS" || b.statut === "EN_ATTENTE") && (
                            <Button size="sm" variant="secondary" onClick={() => reprendreImport(b)}>
                              <Play className="h-3.5 w-3.5" /> Reprendre
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ========== Étape 2 : mapping ========== */}
      {etape === "mapping" && parse && (
        <Card>
          <CardHeader>
            <CardTitle>
              Correspondance des colonnes — {nomFichier} ({parse.lignes.length} lignes)
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Associez chaque champ cible à une colonne de votre fichier. Le pré-remplissage est
              automatique : vérifiez puis ajustez si besoin.
              {parse.avecGeometrie &&
                " Les géométries du fichier seront utilisées directement (pas d'appel IGN)."}
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {CHAMPS_IMPORT.map((champ) => (
              <div key={champ} className="grid grid-cols-2 items-center gap-3">
                <div>
                  <p className="text-sm font-medium">{DESCRIPTION_CHAMPS[champ].libelle}</p>
                  {DESCRIPTION_CHAMPS[champ].aide && (
                    <p className="text-xs text-muted-foreground">{DESCRIPTION_CHAMPS[champ].aide}</p>
                  )}
                </div>
                <Select
                  value={mapping[champ]}
                  onChange={(e) => setMapping({ ...mapping, [champ]: e.target.value })}
                >
                  <option value="">— Non importé —</option>
                  {parse.colonnes.map((colonne) => (
                    <option key={colonne} value={colonne}>
                      {colonne}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={recommencer}>
                Annuler
              </Button>
              <Button onClick={() => setEtape("apercu")} disabled={!mapping.client_nom && !parse.avecGeometrie}>
                Aperçu →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========== Étape 3 : aperçu + validation à blanc ========== */}
      {etape === "apercu" && parse && (
        <Card>
          <CardHeader>
            <CardTitle>Aperçu (20 premières lignes sur {parse.lignes.length})</CardTitle>
            {validation && (validation.sansClient > 0 || validation.sansGeometrie > 0) && (
              <p className="text-sm text-amber-700">
                ⚠ {validation.sansClient} ligne(s) sans nom de client et{" "}
                {validation.sansGeometrie} ligne(s) sans aucune source de géométrie (référence
                cadastrale, lat/lng ou géométrie). Elles seront consignées dans le rapport
                d&apos;erreurs.
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  {CHAMPS_IMPORT.filter((c) => mapping[c]).map((c) => (
                    <TableHead key={c}>{c}</TableHead>
                  ))}
                  {parse.avecGeometrie && <TableHead>géométrie</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {parse.lignes.slice(0, 20).map((l) => {
                  const v = appliquerMapping(l.valeurs);
                  return (
                    <TableRow key={l.ligne}>
                      <TableCell className="text-muted-foreground">{l.ligne}</TableCell>
                      {CHAMPS_IMPORT.filter((c) => mapping[c]).map((c) => (
                        <TableCell key={c}>{v[c] ?? ""}</TableCell>
                      ))}
                      {parse.avecGeometrie && (
                        <TableCell>{l.geometry ? `✔ ${l.geometry.type}` : "—"}</TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setEtape("mapping")}>
                ← Mapping
              </Button>
              <Button onClick={lancerImport}>
                <Play className="h-4 w-4" /> Lancer l&apos;import ({parse.lignes.length} lignes)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========== Étape 4 : traitement ========== */}
      {etape === "traitement" && (
        <Card>
          <CardHeader>
            <CardTitle>Import en cours — {nomFichier}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Les géométries cadastrales sont récupérées auprès de l&apos;IGN par lots de 20
              lignes. Vous pouvez laisser cette page ouverte ; en cas de rechargement,
              l&apos;import est repris là où il s&apos;était arrêté.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progression} />
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Statistique libelle="Lignes traitées" valeur={`${etat?.lignesTraitees ?? 0} / ${etat?.totalLignes ?? "…"}`} />
              <Statistique libelle="Clients créés" valeur={String(etat?.clientsCrees ?? 0)} />
              <Statistique libelle="Parcelles créées" valeur={String(etat?.parcellesCreees ?? 0)} />
              <Statistique libelle="Erreurs" valeur={String(etat?.nbErreurs ?? 0)} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========== Étape 5 : rapport final ========== */}
      {etape === "rapport" && etat && (
        <Card>
          <CardHeader>
            <CardTitle>✔ Import terminé — {nomFichier}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Statistique libelle="Clients créés" valeur={String(etat.clientsCrees)} />
              <Statistique libelle="Parcelles créées" valeur={String(etat.parcellesCreees)} />
              <Statistique libelle="Ignorées (doublons)" valeur={String(etat.parcellesIgnorees)} />
              <Statistique libelle="Erreurs" valeur={String(etat.nbErreurs)} accent={etat.nbErreurs > 0} />
            </div>
            <div className="flex flex-wrap gap-2">
              {etat.nbErreurs > 0 && batchId && (
                <Button
                  variant="destructive"
                  onClick={() => window.open(`/api/import/${batchId}/rapport`, "_blank")}
                >
                  <Download className="h-4 w-4" /> Télécharger le rapport d&apos;erreurs
                </Button>
              )}
              <Button variant="outline" onClick={() => (window.location.href = "/")}>
                Voir les parcelles sur la carte
              </Button>
              <Button variant="ghost" onClick={recommencer}>
                <RotateCcw className="h-4 w-4" /> Nouvel import
              </Button>
            </div>
            {etat.nbErreurs > 0 && (
              <p className="text-sm text-muted-foreground">
                Le rapport contient les données d&apos;origine de chaque ligne en échec et la
                raison : corrigez-les puis réimportez uniquement ces lignes.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Petite tuile de statistique. */
function Statistique({ libelle, valeur, accent }: { libelle: string; valeur: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{libelle}</p>
      <p className={`text-xl font-bold ${accent ? "text-destructive" : ""}`}>{valeur}</p>
    </div>
  );
}
