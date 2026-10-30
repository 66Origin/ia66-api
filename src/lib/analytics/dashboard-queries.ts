import { getAnalyticsReaderPool } from "./db";
import type { DashboardPeriod } from "./dashboard-period";
import type { UnansweredReason } from "./record-unanswered-question";

/*
 * All queries run with the read-only role. Requests are attached to the
 * period in which their conversation started, like the monthly statistics.
 */

const PARIS_MONTH_START =
  "date_trunc('month', now() AT TIME ZONE 'Europe/Paris')";

const PERIOD_REQUESTS = `
  WITH bounds AS (
    SELECT
      CASE $1::text
        WHEN 'days' THEN now() - make_interval(days => $2::integer)
        WHEN 'months' THEN now() - make_interval(months => $2::integer)
        ELSE ($3::date)::timestamp AT TIME ZONE 'Europe/Paris'
      END AS from_at,
      CASE $1::text
        WHEN 'month'
          THEN (($3::date) + interval '1 month')::timestamp
               AT TIME ZONE 'Europe/Paris'
        ELSE now()
      END AS to_at
  ),
  period_requests AS (
    SELECT
      c.conversation_id,
      c.placement,
      r.request_id,
      r.status,
      r.generation_duration_ms,
      k.classification_status,
      k.subject,
      k.intent
    FROM bounds AS b
    JOIN analytics.conversations AS c
      ON c.started_at >= b.from_at
     AND c.started_at < b.to_at
    LEFT JOIN analytics.chat_requests AS r
      ON r.conversation_id = c.conversation_id
    LEFT JOIN analytics.request_classifications AS k
      ON k.request_id = r.request_id
  )
`;

function periodParameters(period: DashboardPeriod) {
  switch (period.kind) {
    case "days":
      return [period.kind, period.days, null];
    case "months":
      return [period.kind, period.months, null];
    case "month":
      return [period.kind, null, `${period.month}-01`];
  }
}

export type DashboardSummary = {
  conversations: number;
  requests: number;
  failed: number;
  classified: number;
  unclassifiable: number;
  classificationFailed: number;
  medianGenerationMs: number | null;
  conversations1: number;
  conversations2To3: number;
  conversations4Plus: number;
};

export type CountRow = { key: string; count: number };

export type CrossRow = { row: string; column: string; count: number };

export type MonthRow = { month: string; conversations: number; requests: number };

export type DashboardData = {
  summary: DashboardSummary;
  subjects: CountRow[];
  intents: CountRow[];
  subjectByIntent: CrossRow[];
  subjectByPlacement: CrossRow[];
};

export async function getDashboardData(
  period: DashboardPeriod,
): Promise<DashboardData> {
  const pool = getAnalyticsReaderPool();
  const parameters = periodParameters(period);

  const [summary, buckets, subjects, intents, subjectByIntent, subjectByPlacement] =
    await Promise.all([
      pool.query(
        `${PERIOD_REQUESTS}
         SELECT
           count(DISTINCT conversation_id)::integer AS conversations,
           count(request_id)::integer AS requests,
           count(*) FILTER (WHERE status = 'failed')::integer AS failed,
           count(*) FILTER (
             WHERE classification_status = 'classified'
           )::integer AS classified,
           count(*) FILTER (
             WHERE classification_status = 'unclassifiable'
           )::integer AS unclassifiable,
           count(*) FILTER (
             WHERE classification_status = 'failed'
           )::integer AS classification_failed,
           percentile_disc(0.5) WITHIN GROUP (
             ORDER BY generation_duration_ms
           ) FILTER (WHERE status = 'generated') AS median_generation_ms
         FROM period_requests`,
        parameters,
      ),
      pool.query(
        `${PERIOD_REQUESTS}
         SELECT
           count(*) FILTER (WHERE requests = 1)::integer AS one,
           count(*) FILTER (WHERE requests BETWEEN 2 AND 3)::integer AS two_to_three,
           count(*) FILTER (WHERE requests >= 4)::integer AS four_plus
         FROM (
           SELECT conversation_id, count(request_id) AS requests
           FROM period_requests
           GROUP BY conversation_id
         ) AS per_conversation`,
        parameters,
      ),
      pool.query<CountRow>(
        `${PERIOD_REQUESTS}
         SELECT subject AS key, count(*)::integer AS count
         FROM period_requests
         WHERE classification_status = 'classified'
         GROUP BY subject
         ORDER BY count DESC`,
        parameters,
      ),
      pool.query<CountRow>(
        `${PERIOD_REQUESTS}
         SELECT intent AS key, count(*)::integer AS count
         FROM period_requests
         WHERE classification_status = 'classified'
         GROUP BY intent
         ORDER BY count DESC`,
        parameters,
      ),
      pool.query<CrossRow>(
        `${PERIOD_REQUESTS}
         SELECT subject AS row, intent AS column, count(*)::integer AS count
         FROM period_requests
         WHERE classification_status = 'classified'
         GROUP BY subject, intent`,
        parameters,
      ),
      pool.query<CrossRow>(
        `${PERIOD_REQUESTS}
         SELECT subject AS row, placement AS column, count(*)::integer AS count
         FROM period_requests
         WHERE classification_status = 'classified'
         GROUP BY subject, placement`,
        parameters,
      ),
    ]);

  const s = summary.rows[0];
  const b = buckets.rows[0];

  return {
    summary: {
      conversations: s.conversations,
      requests: s.requests,
      failed: s.failed,
      classified: s.classified,
      unclassifiable: s.unclassifiable,
      classificationFailed: s.classification_failed,
      medianGenerationMs:
        s.median_generation_ms === null ? null : Number(s.median_generation_ms),
      conversations1: b.one,
      conversations2To3: b.two_to_three,
      conversations4Plus: b.four_plus,
    },
    subjects: subjects.rows,
    intents: intents.rows,
    subjectByIntent: subjectByIntent.rows,
    subjectByPlacement: subjectByPlacement.rows,
  };
}

/**
 * Completed months come from the monthly statistics (kept beyond the
 * 12-month detail), the current month from the detailed tables.
 */
export async function getMonthlyEvolution(): Promise<MonthRow[]> {
  const result = await getAnalyticsReaderPool().query<MonthRow>(
    `SELECT to_char(month, 'YYYY-MM') AS month, conversations, requests
     FROM (
       SELECT
         month,
         sum(conversations)::integer AS conversations,
         sum(requests)::integer AS requests
       FROM analytics.monthly_conversation_stats
       WHERE month >= (${PARIS_MONTH_START} - interval '12 months')::date
       GROUP BY month

       UNION ALL

       SELECT
         ${PARIS_MONTH_START}::date,
         count(DISTINCT c.conversation_id)::integer,
         count(r.request_id)::integer
       FROM analytics.conversations AS c
       LEFT JOIN analytics.chat_requests AS r
         ON r.conversation_id = c.conversation_id
       WHERE c.started_at >= ${PARIS_MONTH_START} AT TIME ZONE 'Europe/Paris'
     ) AS months
     ORDER BY month`,
  );

  return result.rows;
}

/** Months still present in the detailed tables, newest first. */
export async function getAvailableMonths(): Promise<string[]> {
  const result = await getAnalyticsReaderPool().query<{ month: string }>(
    `SELECT to_char(month, 'YYYY-MM') AS month
     FROM generate_series(
       date_trunc(
         'month',
         (SELECT min(started_at) FROM analytics.conversations)
           AT TIME ZONE 'Europe/Paris'
       ),
       ${PARIS_MONTH_START},
       interval '1 month'
     ) AS month
     ORDER BY month DESC`,
  );

  return result.rows.map((row) => row.month);
}

export type UnansweredRow = {
  question: string;
  reason: UnansweredReason;
  created_at: Date;
};

export async function getUnansweredQuestions(
  reason: UnansweredReason | null,
): Promise<{ rows: UnansweredRow[]; counts: CountRow[] }> {
  const pool = getAnalyticsReaderPool();

  const [rows, counts] = await Promise.all([
    pool.query<UnansweredRow>(
      `SELECT question, reason, created_at
       FROM analytics.unanswered_questions
       WHERE $1::text IS NULL OR reason = $1::text
       ORDER BY created_at DESC
       LIMIT 200`,
      [reason],
    ),
    pool.query<CountRow>(
      `SELECT reason AS key, count(*)::integer AS count
       FROM analytics.unanswered_questions
       GROUP BY reason`,
    ),
  ]);

  return { rows: rows.rows, counts: counts.rows };
}
