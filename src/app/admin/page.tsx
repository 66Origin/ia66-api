import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-guard";
import {
  AdminShell,
  adminStyles as styles,
} from "@/components/admin/AdminShell";

export default async function AdminHomePage() {
  await requireAdminPage("/admin");

  return (
    <AdminShell current="/admin">
      <div>
        <h1 className={styles.title}>Administration de O</h1>
        <p className={styles.lead}>Outils internes de l&apos;assistant.</p>
      </div>

      <div className={styles.tools}>
        <Link className={styles.tool} href="/admin/analytics">
          <strong>Analytics</strong>
          <span>Volumes, sujets, intentions et qualité des réponses.</span>
        </Link>
        <Link className={styles.tool} href="/admin/analytics/questions">
          <strong>Questions en échec</strong>
          <span>
            Questions sans réponse ou non classables des 90 derniers jours.
          </span>
        </Link>
        <Link className={styles.tool} href="/admin/rag-export">
          <strong>Générateur Markdown</strong>
          <span>Export des contenus du site pour le corpus de O.</span>
        </Link>
      </div>
    </AdminShell>
  );
}
