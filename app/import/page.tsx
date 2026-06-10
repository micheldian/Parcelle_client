/**
 * Page Import : création en masse de clients + parcelles depuis un fichier
 * (xlsx, xls, csv, geojson, kml).
 */
import { ImportWizard } from "@/components/import/import-wizard";

export const dynamic = "force-dynamic";

export default function PageImport() {
  return <ImportWizard />;
}
