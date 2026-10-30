import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-guard";
import {
  AdminShell,
  adminStyles as styles,
} from "@/components/admin/AdminShell";
import { getUnansweredQuestions } from "@/lib/analytics/dashboard-queries";
import { REASON_LABELS } from "@/lib/analytics/dashboard-labels";
import {
  UNANSWERED_REASONS,
  type UnansweredReason,
} from "@/lib/analytics/record-unanswered-question";

export const metadata: Metadata = {
  title: "Questions en échec · Administration de O",
};

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

function isReason(value: unknown): value is UnansweredReason {
  return (
    typeof value === "string" &&
    (UNANSWERED_REASONS as readonly string[]).includes(value)
  );
}

export default async function UnansweredQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const reason = isReason(params.reason) ? params.reason : null;

  await requireAdminPage(
    reason
      ? `/admin/analytics/questions?reason=${reason}`
      : "/admin/analytics/questions",
  );

  let content;

  try {
    const { rows, counts } = await getUnansweredQuestions(reason);
    const countOf = (key: string) =>
      counts.find((row) => row.key === key)?.count ?? 0;
    const total = counts.reduce((sum, row) => sum + row.count, 0);

    content = (
      <>
        <section className={styles.panel} aria-label="Filtre">
          <div className={styles.filters}>
            <Link
              href="/admin/analytics/questions"
              aria-current={reason === null ? "true" : undefined}
            >
              Toutes ({total.toLocaleString("fr-FR")})
            </Link>
            {UNANSWERED_REASONS.map((key) => (
              <Link
                key={key}
                href={`/admin/analytics/questions?reason=${key}`}
                aria-current={reason === key ? "true" : undefined}
              >
                {REASON_LABELS[key]} ({countOf(key).toLocaleString("fr-FR")})
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.panel}>
          {rows.length > 0 ? (
            <div className={styles.tableWrapper}>
              <table className={styles.table} aria-label="Questions en échec">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Motif</th>
                    <th scope="col">Question</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={index}>
                      <td>{dateFormatter.format(row.created_at)}</td>
                      <td>{REASON_LABELS[row.reason]}</td>
                      <td className={styles.question}>{row.question}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.note}>Aucune question sur cette sélection.</p>
          )}
          <p className={styles.note}>
            200 questions au plus, les plus récentes d&apos;abord. Les
            adresses e-mail et numéros de téléphone sont masqués à
            l&apos;enregistrement. Ces questions servent uniquement à
            améliorer le corpus de O.
          </p>
        </section>
      </>
    );
  } catch {
    console.error("[admin] Could not load unanswered questions.");

    content = (
      <p className={styles.error}>
        Les questions ne peuvent pas être chargées. Vérifiez la variable
        O_ANALYTICS_READER_DATABASE_URL et l&apos;accès à la base.
      </p>
    );
  }

  return (
    <AdminShell current="/admin/analytics/questions">
      <div>
        <h1 className={styles.title}>Questions en échec</h1>
        <p className={styles.lead}>
          Questions auxquelles O n&apos;a pas pu répondre, ou qu&apos;il
          n&apos;a pas pu classer, sur les 90 derniers jours.
        </p>
      </div>
      {content}
    </AdminShell>
  );
}
