import { config } from "dotenv";

config({ path: ".env.local" });
config();

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import matter from "gray-matter";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

type LocalDocument = {
  filePath: string;
  displayName: string;
  syncHash: string;
  sourceType: "docs" | "generated";
  metadata: DocumentMetadata;
};

type DocumentMetadata = {
  title?: string;
  slug?: string;
  contentType?: string;
  contentSubtype?: string;
  canonicalUrl?: string;
  sourceHash?: string;
  description?: string;
  datePublished?: string;
  dateModified?: string;
  authorName?: string;
  category?: string;
};

type StoreDocument = {
  name: string;
  displayName: string;
  syncHash?: string;
};

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function extractGeneratedMetadata(filePath: string): DocumentMetadata {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);
  const data = parsed.data;

  return {
    title: getString(data.title),
    slug: getString(data.slug),
    contentType: getString(data.type),
    canonicalUrl: getString(data.source_url),
    sourceHash: getString(data.source_hash),
    description: getString(data.description),
    datePublished: getString(data.date_published),
    authorName: getString(data.author_name),
    category: getString(data.category),
  };
}

function inferContentMetadata(
  displayName: string,
): Pick<DocumentMetadata, "contentType" | "contentSubtype"> {
  if (displayName.startsWith("docs/case-studies/")) {
    return {
      contentType: "work",
    };
  }

  if (displayName.startsWith("docs/contenus/")) {
    return {
      contentType: "content",
    };
  }

  if (displayName.startsWith("docs/personnalite/storytelling/")) {
    return {
      contentType: "personality",
      contentSubtype: "storytelling",
    };
  }

  if (displayName.startsWith("docs/personnalite/")) {
    return {
      contentType: "personality",
    };
  }

  if (displayName.startsWith("generated/works/")) {
    return {
      contentType: "work",
    };
  }

  if (displayName.startsWith("generated/insights/")) {
    return {
      contentType: "insight",
    };
  }

  if (displayName.startsWith("generated/team/")) {
    return {
      contentType: "team",
    };
  }

  if (displayName.startsWith("generated/pages/")) {
    return {
      contentType: "page",
    };
  }

  return {};
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

function normalizeStoreName(store: string): string {
  return store.startsWith("fileSearchStores/")
    ? store
    : `fileSearchStores/${store}`;
}

function listMarkdownFilesRecursive(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...listMarkdownFilesRecursive(fullPath));
      continue;
    }

    if (
      entry.isFile() &&
      entry.name.toLowerCase().endsWith(".md") &&
      entry.name.toLowerCase() !== "readme.md"
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function buildLocalDocuments(): LocalDocument[] {
  const ragDir = path.join(process.cwd(), "rag");

  const sources = [
    {
      prefix: "docs",
      directory: path.join(ragDir, "docs"),
    },
    {
      prefix: "generated",
      directory: path.join(ragDir, "generated"),
    },
  ];

  const documents: LocalDocument[] = [];

  for (const source of sources) {
    const files = listMarkdownFilesRecursive(source.directory);

    for (const filePath of files) {
      const relativePath = path
        .relative(source.directory, filePath)
        .replaceAll("\\", "/");

      if (source.prefix === "docs" && relativePath.startsWith("templates/")) {
        continue;
      }

      const displayName = `${source.prefix}/${relativePath}`;

      const inferredMetadata = inferContentMetadata(displayName);

      const extractedMetadata =
        source.prefix === "generated"
          ? extractGeneratedMetadata(filePath)
          : extractDocsMetadata(filePath);

      const metadata: DocumentMetadata = {
        ...extractedMetadata,
        ...inferredMetadata,
      };

      documents.push({
        filePath,
        displayName,
        syncHash: computeSyncHash(filePath, metadata),
        sourceType: source.prefix as "docs" | "generated",
        metadata,
      });
    }
  }

  return documents.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

async function listStoreDocuments(storeName: string): Promise<StoreDocument[]> {
  const documents: StoreDocument[] = [];

  const pager = await ai.fileSearchStores.documents.list({
    parent: normalizeStoreName(storeName),
    config: {
      pageSize: 20,
    },
  });

  while (true) {
    for (const doc of pager.page) {
      if (!doc.name || !doc.displayName) {
        continue;
      }

      const syncHash = doc.customMetadata?.find(
        (metadata) => metadata.key === "sync_sha256",
      )?.stringValue;

      documents.push({
        name: doc.name,
        displayName: doc.displayName,
        syncHash,
      });
    }

    if (!pager.hasNextPage()) {
      break;
    }

    await pager.nextPage();
  }

  return documents;
}

async function findStoreDocumentsByDisplayName(
  storeName: string,
  displayName: string,
): Promise<StoreDocument[]> {
  const documents = await listStoreDocuments(storeName);

  return documents.filter((document) => document.displayName === displayName);
}

async function uploadDocument(
  storeName: string,
  document: LocalDocument,
): Promise<void> {
  console.log(`Uploading: ${document.displayName}`);

  let operation = await ai.fileSearchStores.uploadToFileSearchStore({
    file: document.filePath,
    fileSearchStoreName: storeName,
    config: {
      displayName: document.displayName,
      mimeType: "text/markdown",
      customMetadata: buildCustomMetadata(document),
    },
  });

  let pollCount = 0;

  while (!operation.done) {
    await sleep(2000);

    operation = await ai.operations.get({
      operation,
    });

    pollCount++;

    if (pollCount % 15 === 0) {
      console.log(
        `Still indexing: ${document.displayName} (${pollCount * 2}s)`,
      );
    }
  }

  if (operation.error) {
    throw new Error(
      `Upload failed for ${document.displayName}: ${JSON.stringify(
        operation.error,
      )}`,
    );
  }

  console.log(`Indexed: ${document.displayName}`);
}

async function updateDocument(
  storeName: string,
  localDocument: LocalDocument,
  storeDocument: StoreDocument,
): Promise<void> {
  console.log(`Updating: ${localDocument.displayName}`);

  let uploadError: unknown;

  try {
    await uploadDocument(storeName, localDocument);
  } catch (error) {
    uploadError = error;

    console.warn(
      `Upload reported an error for ${localDocument.displayName}. Checking store state...`,
    );
  }

  const matchingDocuments = await findStoreDocumentsByDisplayName(
    storeName,
    localDocument.displayName,
  );

  const newDocument = matchingDocuments.find(
    (document) => document.syncHash === localDocument.syncHash,
  );

  if (!newDocument) {
    if (uploadError) {
      throw uploadError;
    }

    throw new Error(
      `Uploaded document could not be verified: ${localDocument.displayName}`,
    );
  }

  if (uploadError) {
    console.log(
      `Upload succeeded despite polling error: ${localDocument.displayName}`,
    );
  }

  if (newDocument.name === storeDocument.name) {
    throw new Error(
      `New and previous document have the same name: ${localDocument.displayName}`,
    );
  }

  console.log(`Verified new version: ${newDocument.name}`);

  console.log(`Deleting previous version: ${storeDocument.name}`);

  await deleteStoreDocument(storeDocument.name);

  console.log(`Updated: ${localDocument.displayName}`);
}

async function deleteStoreDocument(documentName: string): Promise<void> {
  await ai.fileSearchStores.documents.delete({
    name: documentName,
    config: {
      force: true,
    },
  });
}

function findDuplicateDisplayNames<T extends { displayName: string }>(
  documents: T[],
): string[] {
  const counts = new Map<string, number>();

  for (const document of documents) {
    counts.set(
      document.displayName,
      (counts.get(document.displayName) ?? 0) + 1,
    );
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([displayName]) => displayName)
    .sort();
}

function buildCustomMetadata(document: LocalDocument) {
  const metadata = [
    {
      key: "sync_sha256",
      stringValue: document.syncHash,
    },
    {
      key: "source_path",
      stringValue: document.displayName,
    },
    {
      key: "source_type",
      stringValue: document.sourceType,
    },
  ];

  const optionalMetadata: Array<[string, string | undefined]> = [
    ["content_type", document.metadata.contentType],
    ["content_subtype", document.metadata.contentSubtype],
    ["title", document.metadata.title],
    ["slug", document.metadata.slug],
    ["canonical_url", document.metadata.canonicalUrl],
    ["source_hash", document.metadata.sourceHash],
    ["description", document.metadata.description],
    ["date_published", document.metadata.datePublished],
    ["date_modified", document.metadata.dateModified],
    ["author_name", document.metadata.authorName],
    ["category", document.metadata.category],
  ];

  for (const [key, value] of optionalMetadata) {
    if (value) {
      metadata.push({
        key,
        stringValue: value,
      });
    }
  }

  return metadata;
}

function computeSyncHash(filePath: string, metadata: DocumentMetadata): string {
  const content = fs.readFileSync(filePath);

  const normalizedMetadata = JSON.stringify(
    {
      contentType: metadata.contentType,
      contentSubtype: metadata.contentSubtype,
      title: metadata.title,
      slug: metadata.slug,
      canonicalUrl: metadata.canonicalUrl,
      sourceHash: metadata.sourceHash,
      description: metadata.description,
      datePublished: metadata.datePublished,
      dateModified: metadata.dateModified,
      authorName: metadata.authorName,
      category: metadata.category,
    },
    Object.keys({
      contentType: metadata.contentType,
      contentSubtype: metadata.contentSubtype,
      title: metadata.title,
      slug: metadata.slug,
      canonicalUrl: metadata.canonicalUrl,
      sourceHash: metadata.sourceHash,
      description: metadata.description,
      datePublished: metadata.datePublished,
      dateModified: metadata.dateModified,
      authorName: metadata.authorName,
      category: metadata.category,
    }).sort(),
  );

  return crypto
    .createHash("sha256")
    .update(content)
    .update(normalizedMetadata)
    .digest("hex");
}

function extractDocsMetadata(filePath: string): DocumentMetadata {
  const raw = fs.readFileSync(filePath, "utf8");

  try {
    const parsed = matter(raw);
    const data = parsed.data;

    return {
      title: getString(data.title),
      slug: getString(data.slug),

      canonicalUrl: getString(data.canonical_url) ?? getString(data.source_url),

      description: getString(data.description),

      datePublished: getString(data.date_published),
      dateModified: getString(data.date_modified),

      authorName: getString(data.author_name) ?? getString(data.author),

      category: getString(data.category) ?? getString(data.categorie),
    };
  } catch {
    return {};
  }
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const isApply = process.argv.includes("--apply");
  const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
  const onlyDisplayName = onlyArg?.slice("--only=".length);

  if (isDryRun === isApply) {
    throw new Error("Use exactly one mode: --dry-run or --apply");
  }

  const storeName = normalizeStoreName(
    requireEnv("FILE_SEARCH_TEST_STORE_NAME"),
  );

  const allLocalDocuments = buildLocalDocuments();

  const localDocuments = onlyDisplayName
    ? allLocalDocuments.filter(
        (document) => document.displayName === onlyDisplayName,
      )
    : allLocalDocuments;

  const duplicateLocalNames = findDuplicateDisplayNames(localDocuments);

  if (duplicateLocalNames.length > 0) {
    throw new Error(
      [
        "Duplicate local displayName detected:",
        ...duplicateLocalNames.map((name) => `- ${name}`),
      ].join("\n"),
    );
  }

  const storeDocuments = await listStoreDocuments(storeName);

  const duplicateStoreNames = findDuplicateDisplayNames(storeDocuments);

  if (duplicateStoreNames.length > 0) {
    throw new Error(
      [
        "Duplicate store displayName detected:",
        ...duplicateStoreNames.map((name) => `- ${name}`),
        "Clean the store before synchronization.",
      ].join("\n"),
    );
  }

  if (onlyDisplayName) {
    const existsLocally = localDocuments.some(
      (document) => document.displayName === onlyDisplayName,
    );

    const existsInStore = storeDocuments.some(
      (document) => document.displayName === onlyDisplayName,
    );

    if (!existsLocally && !existsInStore) {
      throw new Error(`Document not found: ${onlyDisplayName}`);
    }
  }

  const localByName = new Map(
    localDocuments.map((document) => [document.displayName, document]),
  );

  const storeByName = new Map(
    storeDocuments.map((document) => [document.displayName, document]),
  );

  const created = localDocuments.filter(
    (document) => !storeByName.has(document.displayName),
  );

  const updated = localDocuments.filter((document) => {
    const storeDocument = storeByName.get(document.displayName);

    if (!storeDocument) {
      return false;
    }

    return (
      !storeDocument.syncHash || storeDocument.syncHash !== document.syncHash
    );
  });

  const unchanged = localDocuments.filter((document) => {
    const storeDocument = storeByName.get(document.displayName);

    return (
      Boolean(storeDocument) &&
      Boolean(storeDocument?.syncHash) &&
      storeDocument?.syncHash === document.syncHash
    );
  });

  const deleted = onlyDisplayName
    ? storeDocuments.filter(
        (document) =>
          document.displayName === onlyDisplayName &&
          !localByName.has(document.displayName),
      )
    : storeDocuments.filter(
        (document) => !localByName.has(document.displayName),
      );

  console.log("\nFile Search synchronization preview");
  console.log(`Store: ${storeName}`);

  if (onlyDisplayName) {
    console.log(`Document filter: ${onlyDisplayName}`);
  }

  console.log("\nLocal corpus:");
  console.log(`  ${localDocuments.length} Markdown documents`);

  console.log("\nCurrent store:");
  console.log(`  ${storeDocuments.length} documents`);

  console.log("\nChanges:");
  console.log(`  ${created.length} to create`);
  console.log(`  ${updated.length} to update`);
  console.log(`  ${unchanged.length} unchanged`);
  console.log(`  ${deleted.length} to delete`);

  if (created.length > 0) {
    console.log("\nTo create:");

    for (const document of created) {
      console.log(`  + ${document.displayName}`);
    }
  }

  if (updated.length > 0) {
    console.log("\nTo update:");

    for (const document of updated) {
      console.log(`  ~ ${document.displayName}`);
    }
  }

  if (deleted.length > 0) {
    console.log("\nTo delete:");

    for (const document of deleted) {
      console.log(`  - ${document.displayName}`);
    }
  }

  if (isApply) {
    if (created.length === 0 && updated.length === 0 && deleted.length === 0) {
      console.log("\nNothing to synchronize.");
      return;
    }

    let createdCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;

    const failures: {
      operation: "create" | "update" | "delete";
      displayName: string;
      error: unknown;
    }[] = [];

    if (created.length > 0) {
      console.log(`\nUploading ${created.length} new document(s)...`);

      for (const document of created) {
        try {
          await uploadDocument(storeName, document);
          createdCount++;

          console.log(`Create progress: ${createdCount}/${created.length}`);
        } catch (error) {
          console.error(`Failed to create: ${document.displayName}`, error);

          failures.push({
            operation: "create",
            displayName: document.displayName,
            error,
          });
        }
      }
    }

    if (updated.length > 0) {
      console.log(`\nUpdating ${updated.length} document(s)...`);

      for (const document of updated) {
        const storeDocument = storeByName.get(document.displayName);

        if (!storeDocument) {
          throw new Error(
            `Existing store document not found: ${document.displayName}`,
          );
        }

        try {
          await updateDocument(storeName, document, storeDocument);

          updatedCount++;

          console.log(`Update progress: ${updatedCount}/${updated.length}`);
        } catch (error) {
          console.error(`Failed to update: ${document.displayName}`, error);

          failures.push({
            operation: "update",
            displayName: document.displayName,
            error,
          });
        }
      }
    }

    if (deleted.length > 0) {
      console.log(`\nDeleting ${deleted.length} document(s)...`);

      for (const document of deleted) {
        try {
          console.log(`Deleting: ${document.displayName}`);

          await deleteStoreDocument(document.name);

          deletedCount++;

          console.log(`Deleted: ${document.displayName}`);
          console.log(`Delete progress: ${deletedCount}/${deleted.length}`);
        } catch (error) {
          console.error(`Failed to delete: ${document.displayName}`, error);

          failures.push({
            operation: "delete",
            displayName: document.displayName,
            error,
          });
        }
      }
    }

    console.log("\nSynchronization complete:");
    console.log(`  ${createdCount} created`);
    console.log(`  ${updatedCount} updated`);
    console.log(`  ${deletedCount} deleted`);
    console.log(`  ${failures.length} failed`);

    if (failures.length > 0) {
      console.log("\nFailures:");

      for (const failure of failures) {
        const message =
          failure.error instanceof Error
            ? failure.error.message
            : String(failure.error);

        console.log(
          `  ! [${failure.operation}] ${failure.displayName}: ${message}`,
        );
      }

      process.exitCode = 1;
    }

    return;
  }

  console.log("\nDry run only. No changes applied.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
