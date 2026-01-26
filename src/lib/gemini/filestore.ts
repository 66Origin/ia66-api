import { getGeminiClient } from "./client";

export type FileSearchStoreSummary = {
  name?: string;
  displayName?: string;
  createTime?: string;
};

export type FileSearchDocumentSummary = {
  name?: string;
  displayName?: string;
  createTime?: string;
};

function normalizeStoreParent(store: string) {
  return store.startsWith("fileSearchStores/")
    ? store
    : `fileSearchStores/${store}`;
}

function normalizeDocumentName(storeParent: string, doc: string) {
  if (doc.startsWith("fileSearchStores/")) return doc;
  if (doc.startsWith("documents/")) return `${storeParent}/${doc}`;
  return `${storeParent}/documents/${doc}`;
}

/**
 * Liste tous les File Search Stores.
 */
export async function listFileSearchStores(): Promise<
  FileSearchStoreSummary[]
> {
  const ai = getGeminiClient();

  const stores: FileSearchStoreSummary[] = [];
  const iterable = await ai.fileSearchStores.list();

  for await (const store of iterable) {
    stores.push({
      name: store?.name,
      displayName: store?.displayName,
      createTime: store?.createTime,
    });
  }

  return stores;
}

/**
 * Supprime un store (force = true).
 */
export async function deleteFileSearchStore(store: string) {
  const ai = getGeminiClient();
  const name = normalizeStoreParent(store);

  await ai.fileSearchStores.delete({
    name,
    config: { force: true },
  });

  return { deletedStore: name };
}

/**
 * Supprime tous les stores.
 */
export async function deleteAllFileSearchStores() {
  const ai = getGeminiClient();

  const stores = await listFileSearchStores();
  let deleted = 0;

  for (const store of stores) {
    if (!store.name) continue;

    await ai.fileSearchStores.delete({
      name: store.name,
      config: { force: true },
    });

    deleted++;
  }

  return { deleted };
}

/**
 * Liste les documents d’un store.
 */
export async function listFileSearchDocuments(
  store: string
): Promise<FileSearchDocumentSummary[]> {
  const ai = getGeminiClient();
  const parent = normalizeStoreParent(store);

  const documents: FileSearchDocumentSummary[] = [];
  const iterable = await ai.fileSearchStores.documents.list({ parent });

  for await (const doc of iterable) {
    documents.push({
      name: doc?.name,
      displayName: doc?.displayName,
      createTime: doc?.createTime,
    });
  }

  return documents;
}

/**
 * Supprime un document d’un store.
 * doc peut être :
 * - "xxx"
 * - "documents/xxx"
 * - "fileSearchStores/<store>/documents/xxx"
 */
export async function deleteFileSearchDocument(store: string, doc: string) {
  const ai = getGeminiClient();
  const storeParent = normalizeStoreParent(store);
  const name = normalizeDocumentName(storeParent, doc);

  await ai.fileSearchStores.documents.delete({ name, config: { force: true } });

  return { deletedDocument: name };
}

/**
 * Supprime tous les documents d’un store.
 */
export async function deleteAllDocumentsFromStore(store: string) {
  const ai = getGeminiClient();
  const parent = normalizeStoreParent(store);

  let deleted = 0;
  const iterable = await ai.fileSearchStores.documents.list({ parent });

  for await (const doc of iterable) {
    if (!doc?.name) continue;
    await ai.fileSearchStores.documents.delete({
      name: doc.name,
      config: { force: true },
    });
    deleted++;
  }

  return { deleted, store: parent };
}
