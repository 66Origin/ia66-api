export function requireAdmin(req: Request) {
  const token = process.env.ADMIN_TOKEN;

  // Refuse everything when the token is missing instead of leaving the
  // routes open.
  if (!token) {
    return {
      ok: false as const,
      status: 503,
      error: "Admin token is not configured",
    };
  }

  const headerToken =
    req.headers.get("x-admin-token") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (headerToken !== token) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  return { ok: true as const };
}

export function normalizeStoreParent(store: string) {
  return store.startsWith("fileSearchStores/")
    ? store
    : `fileSearchStores/${store}`;
}

export function normalizeDocumentName(storeParent: string, doc: string) {
  if (doc.startsWith("fileSearchStores/")) return doc;
  if (doc.startsWith("documents/")) return `${storeParent}/${doc}`;
  return `${storeParent}/documents/${doc}`;
}
