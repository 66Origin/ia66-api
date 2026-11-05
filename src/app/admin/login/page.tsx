import type { Metadata } from "next";
import { safeAdminRedirect } from "@/lib/admin-session";
import { adminStyles as styles } from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "Connexion · Administration de O",
};

const ERRORS: Record<string, string> = {
  password: "Mot de passe incorrect.",
  limit: "Trop de tentatives. Réessayez dans une heure.",
  config: "L'accès n'est pas configuré sur ce déploiement.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? ERRORS[params.error] : null;
  const next = safeAdminRedirect(params.next);

  return (
    <div className={styles.login}>
      <section className={styles.loginPanel}>
        <p className={styles.brand}>66 Origin</p>
        <h1 className={styles.title}>Administration de O</h1>

        <form
          className={styles.loginForm}
          action="/api/v1/admin/login"
          method="post"
        >
          <input type="hidden" name="next" value={next} />
          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
          />
          <button type="submit">Se connecter</button>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </section>
    </div>
  );
}
