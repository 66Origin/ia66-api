export function requireAdmin(req: Request) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return { ok: true as const };

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
