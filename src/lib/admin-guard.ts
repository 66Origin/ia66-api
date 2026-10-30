import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "./admin-session";

/**
 * Checked in every protected page, in addition to src/proxy.ts, as the
 * Next.js documentation recommends not to rely on the proxy alone.
 */
export async function requireAdminPage(currentPath: string): Promise<void> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;

  if (!verifyAdminSessionToken(token)) {
    redirect(`/admin/login?next=${encodeURIComponent(currentPath)}`);
  }
}
