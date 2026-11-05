/**
 * Dashboard periods. Bounds are computed in SQL, in Europe/Paris time, from
 * these parameters (see dashboard-queries.ts).
 */
export type DashboardPeriod =
  | { kind: "days"; days: number; key: string; label: string }
  | { kind: "months"; months: number; key: string; label: string }
  | { kind: "month"; month: string; key: string; label: string };

export const ROLLING_PERIODS = [
  { key: "30d", label: "30 derniers jours", kind: "days", days: 30 },
  { key: "3m", label: "3 derniers mois", kind: "months", months: 3 },
  { key: "12m", label: "12 derniers mois", kind: "months", months: 12 },
] as const;

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

const monthFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);

  return monthFormatter.format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

/**
 * Reads ?period=30d|3m|12m or ?period=YYYY-MM. A month is accepted only if
 * it is listed in availableMonths (months still present in detail).
 */
export function resolvePeriod(
  value: unknown,
  availableMonths: string[],
): DashboardPeriod {
  const rolling = ROLLING_PERIODS.find((period) => period.key === value);

  if (rolling) {
    return rolling.kind === "days"
      ? { kind: "days", days: rolling.days, key: rolling.key, label: rolling.label }
      : {
          kind: "months",
          months: rolling.months,
          key: rolling.key,
          label: rolling.label,
        };
  }

  if (
    typeof value === "string" &&
    MONTH_PATTERN.test(value) &&
    availableMonths.includes(value)
  ) {
    return { kind: "month", month: value, key: value, label: formatMonth(value) };
  }

  const fallback = ROLLING_PERIODS[0];

  return {
    kind: "days",
    days: fallback.days,
    key: fallback.key,
    label: fallback.label,
  };
}

/** Threshold below which crossed counts are not displayed. */
export const SMALL_COUNT_THRESHOLD = 10;

/**
 * Masks small values in crossed tables so that a combination of criteria
 * cannot single out a person. Zero is shown as a dash.
 */
export function maskSmallCount(
  count: number,
  threshold = SMALL_COUNT_THRESHOLD,
): string {
  if (count === 0) return "—";
  if (count < threshold) return `< ${threshold}`;

  return count.toLocaleString("fr-FR");
}

export function formatPercent(part: number, total: number): string {
  if (total === 0) return "—";

  return `${Math.round((part / total) * 100)} %`;
}
