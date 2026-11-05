import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin-guard";
import {
  AdminShell,
  adminStyles as styles,
} from "@/components/admin/AdminShell";
import { RagExportForm } from "./RagExportForm";

export const metadata: Metadata = {
  title: "Générateur Markdown · Administration de O",
};

export default async function RagExportPage() {
  await requireAdminPage("/admin/rag-export");

  return (
    <AdminShell current="/admin/rag-export">
      <div>
        <h1 className={styles.title}>Générateur de fichiers Markdown</h1>
        <p className={styles.lead}>
          Analyse le site 66origin.com, compare les contenus au dernier
          instantané et génère une archive ZIP prête à être vérifiée.
        </p>
      </div>

      <RagExportForm />
    </AdminShell>
  );
}
