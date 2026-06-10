/**
 * Page d'accueil : carte interactive plein écran des parcelles.
 */
import { PageCarte } from "@/components/map/page-carte";

export const dynamic = "force-dynamic";

export default function Accueil() {
  return <PageCarte />;
}
