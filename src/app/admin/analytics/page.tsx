import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-guard";
import {
  AdminShell,
  Bars,
  adminStyles as styles,
} from "@/components/admin/AdminShell";
import {
  ROLLING_PERIODS,
  SMALL_COUNT_THRESHOLD,
  formatMonth,
  formatPercent,
  maskSmallCount,
  resolvePeriod,
} from "@/lib/analytics/dashboard-period";
import {
  getAvailableMonths,
  getDashboardData,
  getMonthlyEvolution,
  type CrossRow,
} from "@/lib/analytics/dashboard-queries";
import {
  INTENT_LABELS,
  PLACEMENT_LABELS,
  SUBJECT_LABELS,
  labelOf,
} from "@/lib/analytics/dashboard-labels";
import {
  CLASSIFICATION_INTENTS,
  CLASSIFICATION_SUBJECTS,
} from "@/lib/analytics/classification";

export const metadata: Metadata = {
  title: "Analytics · Administration de O",
};

export const dynamic = "force-dynamic";

function Kpi({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className={styles.kpi}>
      <p className={styles.kpiLabel}>{label}</p>
      <p className={styles.kpiValue}>{value}</p>
      {detail ? <p className={styles.kpiDetail}>{detail}</p> : null}
    </div>
  );
}

function CrossTable({
  rows,
  rowKeys,
  rowLabels,
  columnKeys,
  columnLabels,
  caption,
}: {
  rows: CrossRow[];
  rowKeys: readonly string[];
  rowLabels: Record<string, string>;
  columnKeys: readonly string[];
  columnLabels: Record<string, string>;
  caption: string;
}) {
  const counts = new Map(
    rows.map((row) => [`${row.row}|${row.column}`, row.count]),
  );
  const visibleRows = rowKeys.filter((row) =>
    columnKeys.some((column) => counts.has(`${row}|${column}`)),
  );

  if (visibleRows.length === 0) {
    return <p className={styles.note}>Aucune donnée sur la période.</p>;
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table} aria-label={caption}>
        <thead>
          <tr>
            <th scope="col">Sujet</th>
            {columnKeys.map((column) => (
              <th key={column} scope="col" className={styles.number}>
                {columnLabels[column]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => (
            <tr key={row}>
              <th scope="row">{rowLabels[row]}</th>
              {columnKeys.map((column) => (
                <td key={column} className={styles.number}>
                  {maskSmallCount(counts.get(`${row}|${column}`) ?? 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = typeof params.period === "string" ? params.period : "";

  await requireAdminPage(
    requested ? `/admin/analytics?period=${requested}` : "/admin/analytics",
  );

  let content;

  try {
    const months = await getAvailableMonths();
    const period = resolvePeriod(requested, months);
    const [data, evolution] = await Promise.all([
      getDashboardData(period),
      getMonthlyEvolution(),
    ]);

    const { summary } = data;
    const evolutionTotal = evolution.reduce((sum, row) => sum + row.requests, 0);

    content = (
      <>
        <section className={styles.panel} aria-label="Période">
          <div className={styles.filters}>
            {ROLLING_PERIODS.map((option) => (
              <Link
                key={option.key}
                href={`/admin/analytics?period=${option.key}`}
                aria-current={option.key === period.key ? "true" : undefined}
              >
                {option.label}
              </Link>
            ))}
            {months.map((month) => (
              <Link
                key={month}
                href={`/admin/analytics?period=${month}`}
                aria-current={month === period.key ? "true" : undefined}
              >
                {formatMonth(month)}
              </Link>
            ))}
          </div>
        </section>

        <div className={styles.kpis}>
          <Kpi
            label="Conversations"
            value={summary.conversations.toLocaleString("fr-FR")}
          />
          <Kpi
            label="Demandes"
            value={summary.requests.toLocaleString("fr-FR")}
            detail={
              summary.conversations > 0
                ? `${(summary.requests / summary.conversations).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} par conversation`
                : undefined
            }
          />
          <Kpi
            label="Échecs de génération"
            value={formatPercent(summary.failed, summary.requests)}
            detail={`${summary.failed.toLocaleString("fr-FR")} demandes`}
          />
          <Kpi
            label="Non classables"
            value={formatPercent(summary.unclassifiable, summary.requests)}
            detail={`${summary.unclassifiable.toLocaleString("fr-FR")} demandes`}
          />
          <Kpi
            label="Temps de génération médian"
            value={
              summary.medianGenerationMs === null
                ? "—"
                : `${(summary.medianGenerationMs / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} s`
            }
          />
        </div>

        <div className={styles.grid}>
          <section className={styles.panel}>
            <h2>Sujets</h2>
            {data.subjects.length > 0 ? (
              <Bars
                total={summary.classified}
                rows={data.subjects.map((row) => ({
                  label: labelOf(SUBJECT_LABELS, row.key),
                  count: row.count,
                }))}
              />
            ) : (
              <p className={styles.note}>Aucune demande classée.</p>
            )}
          </section>

          <section className={styles.panel}>
            <h2>Intentions</h2>
            {data.intents.length > 0 ? (
              <Bars
                total={summary.classified}
                rows={data.intents.map((row) => ({
                  label: labelOf(INTENT_LABELS, row.key),
                  count: row.count,
                }))}
              />
            ) : (
              <p className={styles.note}>Aucune demande classée.</p>
            )}
          </section>
        </div>

        <div className={styles.grid}>
          <section className={styles.panel}>
            <h2>Messages par conversation</h2>
            <Bars
              total={summary.conversations}
              rows={[
                { label: "1 message", count: summary.conversations1 },
                { label: "2 à 3 messages", count: summary.conversations2To3 },
                { label: "4 messages et plus", count: summary.conversations4Plus },
              ]}
            />
            <p className={styles.note}>
              Un rechargement de page démarre une nouvelle conversation.
            </p>
          </section>

          <section className={styles.panel}>
            <h2>Évolution mensuelle</h2>
            {evolutionTotal > 0 ? (
              <Bars
                total={0}
                rows={evolution.map((row) => ({
                  label: formatMonth(row.month),
                  count: row.requests,
                }))}
              />
            ) : (
              <p className={styles.note}>Pas encore de données mensuelles.</p>
            )}
            <p className={styles.note}>
              Demandes par mois. Les mois terminés proviennent des statistiques
              mensuelles, calculées chaque nuit.
            </p>
          </section>
        </div>

        <section className={styles.panel}>
          <h2>Sujets × intentions</h2>
          <CrossTable
            caption="Demandes par sujet et intention"
            rows={data.subjectByIntent}
            rowKeys={CLASSIFICATION_SUBJECTS}
            rowLabels={SUBJECT_LABELS}
            columnKeys={CLASSIFICATION_INTENTS}
            columnLabels={INTENT_LABELS}
          />
        </section>

        <section className={styles.panel}>
          <h2>Sujets × emplacement du chat</h2>
          <CrossTable
            caption="Demandes par sujet et emplacement"
            rows={data.subjectByPlacement}
            rowKeys={CLASSIFICATION_SUBJECTS}
            rowLabels={SUBJECT_LABELS}
            columnKeys={["home", "global"]}
            columnLabels={PLACEMENT_LABELS}
          />
          <p className={styles.note}>
            Dans les tableaux croisés, les valeurs inférieures à{" "}
            {SMALL_COUNT_THRESHOLD} sont masquées pour qu&apos;aucune
            combinaison ne permette d&apos;isoler une personne.
          </p>
        </section>
      </>
    );

    content = (
      <>
        <div>
          <h1 className={styles.title}>Analytics</h1>
          <p className={styles.lead}>
            {period.label}. Les demandes sont rattachées à la période où leur
            conversation a commencé.
          </p>
        </div>
        {content}
      </>
    );
  } catch {
    // Database details stay in the server logs.
    console.error("[admin] Could not load analytics dashboard.");

    content = (
      <>
        <h1 className={styles.title}>Analytics</h1>
        <p className={styles.error}>
          Les données ne peuvent pas être chargées. Vérifiez la variable
          O_ANALYTICS_READER_DATABASE_URL et l&apos;accès à la base.
        </p>
      </>
    );
  }

  return <AdminShell current="/admin/analytics">{content}</AdminShell>;
}
