-- CreateEnum
CREATE TYPE "ParcelleSource" AS ENUM ('MANUEL', 'IMPORT_REFERENCE', 'IMPORT_POINT', 'IMPORT_GEOMETRIE');

-- CreateEnum
CREATE TYPE "ImportStatut" AS ENUM ('EN_ATTENTE', 'EN_COURS', 'TERMINE', 'ECHEC');

-- CreateEnum
CREATE TYPE "TypeTravail" AS ENUM ('TAILLE', 'TIRAGE_BOIS', 'PALISSAGE', 'EBOURGEONNAGE', 'RELEVAGE', 'EFFEUILLAGE', 'VENDANGE', 'TRAITEMENT', 'PLANTATION', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutChantier" AS ENUM ('A_FAIRE', 'ENVOYE', 'EN_COURS', 'TERMINE');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OPERATEUR');

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "contactNom" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "couleur" TEXT NOT NULL DEFAULT '#FF5722',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parcelle" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "codeInsee" TEXT NOT NULL,
    "commune" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "geometry" JSONB NOT NULL,
    "centroidLat" DOUBLE PRECISION NOT NULL,
    "centroidLng" DOUBLE PRECISION NOT NULL,
    "surfaceM2" DOUBLE PRECISION,
    "cepage" TEXT,
    "millesime" INTEGER,
    "notes" TEXT,
    "source" "ParcelleSource" NOT NULL DEFAULT 'MANUEL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Parcelle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chantier" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "typeTravail" "TypeTravail" NOT NULL,
    "datePrevue" TIMESTAMP(3),
    "equipe" TEXT,
    "statut" "StatutChantier" NOT NULL DEFAULT 'A_FAIRE',
    "consignes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chantier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChantierParcelle" (
    "chantierId" TEXT NOT NULL,
    "parcelleId" TEXT NOT NULL,

    CONSTRAINT "ChantierParcelle_pkey" PRIMARY KEY ("chantierId","parcelleId")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "statut" "ImportStatut" NOT NULL DEFAULT 'EN_ATTENTE',
    "totalLignes" INTEGER NOT NULL DEFAULT 0,
    "lignesTraitees" INTEGER NOT NULL DEFAULT 0,
    "clientsCrees" INTEGER NOT NULL DEFAULT 0,
    "parcellesCreees" INTEGER NOT NULL DEFAULT 0,
    "parcellesIgnorees" INTEGER NOT NULL DEFAULT 0,
    "erreurs" JSONB,
    "mapping" JSONB,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OPERATEUR',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_nom_key" ON "Client"("nom");

-- CreateIndex
CREATE INDEX "Parcelle_centroidLat_centroidLng_idx" ON "Parcelle"("centroidLat", "centroidLng");

-- CreateIndex
CREATE UNIQUE INDEX "Parcelle_codeInsee_section_numero_clientId_key" ON "Parcelle"("codeInsee", "section", "numero", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Parcelle" ADD CONSTRAINT "Parcelle_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChantierParcelle" ADD CONSTRAINT "ChantierParcelle_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChantierParcelle" ADD CONSTRAINT "ChantierParcelle_parcelleId_fkey" FOREIGN KEY ("parcelleId") REFERENCES "Parcelle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

