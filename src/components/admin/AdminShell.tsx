import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./admin.module.css";

const LINKS = [
  { href: "/admin", label: "Accueil" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/analytics/questions", label: "Questions en échec" },
  { href: "/admin/rag-export", label: "Générateur Markdown" },
] as const;

export function AdminShell({
  current,
  children,
}: {
  current: (typeof LINKS)[number]["href"];
  children: ReactNode;
}) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.brand}>66 Origin · Administration de O</p>

        <nav className={styles.nav} aria-label="Administration">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.href === current ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}

          <form action="/api/v1/admin/logout" method="post">
            <button type="submit">Se déconnecter</button>
          </form>
        </nav>
      </header>

      <main className={styles.main}>{children}</main>
    </div>
  );
}

export function Bars({
  rows,
  total,
}: {
  rows: Array<{ label: string; count: number }>;
  total: number;
}) {
  const max = Math.max(1, ...rows.map((row) => row.count));

  return (
    <div className={styles.bars}>
      {rows.map((row) => (
        <div className={styles.barRow} key={row.label}>
          <span>{row.label}</span>
          <div className={styles.barTrack} aria-hidden="true">
            <div
              className={styles.barFill}
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </div>
          <span className={styles.barValue}>
            {row.count.toLocaleString("fr-FR")}
            {total > 0 ? ` · ${Math.round((row.count / total) * 100)} %` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

export { styles as adminStyles };
