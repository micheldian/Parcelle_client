/**
 * POST /api/chantiers/[id]/dispatch
 * Envoie le chantier à la main d'œuvre via Telegram :
 *  1. sendMessage : récapitulatif HTML du chantier
 *  2. sendLocation : une position GPS par parcelle (itinéraire en un tap)
 *  3. Statut du chantier → ENVOYE
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { creerNotifier } from "@/lib/notifier";
import { formaterHectares } from "@/lib/geo";
import { LIBELLES_TYPE_TRAVAIL } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** Échappe les caractères HTML pour le parse_mode HTML de Telegram. */
function echapperHtml(texte: string): string {
  return texte.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const chantier = await prisma.chantier.findUnique({
    where: { id: params.id },
    include: {
      parcelles: {
        include: {
          parcelle: { include: { client: { select: { nom: true } } } },
        },
      },
    },
  });
  if (!chantier) {
    return NextResponse.json({ erreur: "Chantier introuvable" }, { status: 404 });
  }
  if (chantier.parcelles.length === 0) {
    return NextResponse.json(
      { erreur: "Aucune parcelle rattachée à ce chantier" },
      { status: 400 }
    );
  }

  try {
    const notifier = creerNotifier();
    const parcelles = chantier.parcelles.map((cp) => cp.parcelle);

    // ---- Construction du message récapitulatif ----
    const lignesParcelles = parcelles
      .map((p, i) => {
        const ref = `${p.commune} ${p.section} ${p.numero}`.trim();
        return (
          `${i + 1}. ${echapperHtml(p.client.nom)} — ${echapperHtml(ref)} — ${formaterHectares(p.surfaceM2)}\n` +
          `   📍 https://www.google.com/maps?q=${p.centroidLat},${p.centroidLng}`
        );
      })
      .join("\n");

    const date = chantier.datePrevue
      ? chantier.datePrevue.toLocaleDateString("fr-FR", {
          weekday: "long", day: "numeric", month: "long", year: "numeric",
        })
      : "non précisée";

    const message =
      `🍇 <b>NOUVEAU CHANTIER — ${echapperHtml(chantier.titre)}</b>\n` +
      `Type : ${LIBELLES_TYPE_TRAVAIL[chantier.typeTravail]}\n` +
      `Date : ${date}\n` +
      `Équipe : ${echapperHtml(chantier.equipe ?? "non précisée")}\n\n` +
      `Parcelles (${parcelles.length}) :\n${lignesParcelles}\n\n` +
      `Consignes : ${echapperHtml(chantier.consignes ?? "—")}`;

    await notifier.envoyerMessage(message);

    // ---- Une position par parcelle ----
    for (const p of parcelles) {
      await notifier.envoyerPosition(p.centroidLat, p.centroidLng);
    }

    // ---- Statut → ENVOYE ----
    const maj = await prisma.chantier.update({
      where: { id: chantier.id },
      data: { statut: "ENVOYE" },
    });
    return NextResponse.json(maj);
  } catch (e) {
    return NextResponse.json(
      { erreur: e instanceof Error ? e.message : "Échec de l'envoi Telegram" },
      { status: 502 }
    );
  }
}
