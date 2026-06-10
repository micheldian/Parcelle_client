# AGRICONNECT — Parcelles cadastrales & dispatch main d'œuvre

Web app interne remplaçant Process2wine :

1. **Parcelles cadastrales** de chaque client, enregistrées par référence cadastrale,
   par clic sur la carte, ou **importées en masse depuis votre fichier existant**
   (Excel / CSV / GeoJSON / KML).
2. **Carte interactive** (fonds IGN gratuits : satellite, plan, overlay cadastre),
   parcelles colorées par client, bordure selon le statut du dernier chantier.
3. **Dispatch main d'œuvre** : un clic envoie le chantier (récap + positions GPS
   de chaque parcelle) au groupe Telegram de l'équipe.

## Stack

- Next.js 14 (App Router) · TypeScript strict · Tailwind CSS + composants type shadcn/ui
- Prisma + PostgreSQL (Supabase) — géométries stockées en **GeoJSON** (pas de PostGIS)
- Leaflet (`react-leaflet`) + tuiles WMTS **IGN Géoplateforme** (gratuites, sans clé)
- API Carto cadastre + API Géo gouv (résolution commune → INSEE), appelées **côté serveur**
- `@turf/turf` (centroïdes, surfaces) · `papaparse` / SheetJS / `@tmcw/togeojson` (import)
- NextAuth (Credentials, bcrypt) · Telegram Bot API (abstraction `lib/notifier.ts`)

## Installation

```bash
npm install
cp .env.example .env        # puis renseigner les variables (voir ci-dessous)
npx prisma migrate deploy   # applique la migration initiale (prisma/migrations/0_init)
npm run db:seed             # crée le compte ADMIN (ADMIN_EMAIL / ADMIN_PASSWORD)
npm run dev                 # http://localhost:3000
```

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | URI Supabase **pooler** (port 6543, `?pgbouncer=true`) |
| `DIRECT_URL` | Connexion directe Supabase (port 5432) pour les migrations |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | URL publique de l'app (`http://localhost:3000` en dev) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Compte admin créé par le seed |
| `TELEGRAM_BOT_TOKEN` | Token du bot dédié (voir ci-dessous) |
| `TELEGRAM_DISPATCH_CHAT_ID` | `chat_id` du groupe « Chantiers » |

## Configuration Telegram (dispatch)

1. Créer un **bot dédié** via [@BotFather](https://t.me/BotFather) (ex. `@PickajobChantiers_bot`)
   — distinct des bots agents existants pour ne pas polluer leur canal.
2. Créer un groupe Telegram « Chantiers », y ajouter le bot et les ouvriers.
3. Récupérer le `chat_id` du groupe : envoyer un message dans le groupe puis ouvrir
   `https://api.telegram.org/bot<TOKEN>/getUpdates` → champ `chat.id` (négatif pour un groupe).
4. Renseigner `TELEGRAM_BOT_TOKEN` et `TELEGRAM_DISPATCH_CHAT_ID`.

Le bouton « Envoyer » d'un chantier envoie un récap HTML (`sendMessage`) puis une
position GPS par parcelle (`sendLocation`) : l'ouvrier ouvre l'itinéraire en un tap.

## Import de fichier (`/import`)

- **Formats** : `.xlsx`, `.xls`, `.csv` (tabulaires) — `.geojson`, `.kml` (géométries embarquées).
- **Modèle Excel téléchargeable** depuis la page (colonnes + ligne d'exemple).
- **Mapping interactif** : chaque champ cible est associé à une colonne du fichier
  (pré-rempli automatiquement par correspondance de noms) → importez n'importe quel format.
- **Géométrie de chaque ligne**, par ordre de priorité :
  1. Référence cadastrale (`commune` ou `code_insee` + `section` + `numero`) → API Carto IGN ;
  2. `latitude` + `longitude` → parcelle intersectée (API Carto par point) ;
  3. Géométrie embarquée (GeoJSON/KML) → utilisée directement.
- **Dédoublonnage** : clients par nom (insensible casse/espaces), parcelles par
  contrainte unique `(codeInsee, section, numero, clientId)` — les doublons sont
  comptés « ignorés », pas en erreur.
- **Traitement par lots résumable** : le serveur traite ~20 lignes par requête
  (max 5 appels IGN simultanés), le navigateur boucle et affiche la progression ;
  l'état vit en base (`ImportBatch`) → reprise possible après rechargement
  (bouton « Reprendre » dans l'historique).
- **Rapport d'erreurs** téléchargeable (.xlsx, ligne d'origine + raison) pour
  corriger et réimporter uniquement les lignes en échec.

## Écrans

| Route | Contenu |
|---|---|
| `/` | Carte plein écran : fonds IGN, polygones colorés par client, panneau latéral filtrable (client/commune/cépage/statut), sélection multiple (Ctrl+clic ou cases), popup (chantier, itinéraire, éditer, supprimer), saisie manuelle Mode A (référence) et Mode B (pointer sur la carte), chargement des parcelles par viewport |
| `/clients` | CRUD clients (couleur d'affichage carte) + nb parcelles + surface totale ; vue détail |
| `/chantiers` | Kanban (À faire / Envoyé / En cours / Terminé), création avec parcelles rattachées, bouton « Envoyer » (Telegram) |
| `/import` | Assistant d'import en 5 étapes |

## Déploiement (Vercel + Supabase)

1. Créer le projet Supabase, récupérer les deux URI (pooler + direct).
2. `npx prisma migrate deploy` puis `npm run db:seed` (en local, pointé sur Supabase).
3. Importer le repo dans Vercel, renseigner toutes les variables d'environnement.
4. Build : `npm run build` (lance `prisma generate` automatiquement).

> Les appels IGN et Telegram sont exclusivement côté serveur (Route Handlers).
> La route `/api/import/[id]/process` déclare `maxDuration = 60`.

## Modèle de données

`Client` 1—n `Parcelle` n—n `Chantier` (via `ChantierParcelle`), plus `ImportBatch`
(état des imports) et `User` (NextAuth). Géométrie : colonne `Json` (GeoJSON
MultiPolygon), index B-tree sur `(centroidLat, centroidLng)` pour le filtrage
par viewport. Voir `prisma/schema.prisma`.

## V2 envisagée (non codée)

Badge AOC viticole (API Carto), photos de chantier (Supabase Storage), pointage
début/fin + statut live (Supabase Realtime), export PDF feuille de route,
historique des travaux par parcelle.
