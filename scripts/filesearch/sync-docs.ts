import { config } from "dotenv";

config({ path: ".env.local" });
config();

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

type LocalDocument = {
  filePath: string;
  displayName: string;
  sha256: string;
  sourceType: "docs" | "generated";
};

type StoreDocument = {
  name: string;
  displayName: string;
  sha256?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeSha256(filePath: string): string {
  const content = fs.readFileSync(filePath);

  return crypto.createHash("sha256").update(content).digest("hex");
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

      documents.push({
        filePath,
        displayName: `${source.prefix}/${relativePath}`,
        sha256: computeSha256(filePath),
        sourceType: source.prefix as "docs" | "generated",
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

      const sha256 = doc.customMetadata?.find(
        (metadata) => metadata.key === "content_sha256",
      )?.stringValue;

      documents.push({
        name: doc.name,
        displayName: doc.displayName,
        sha256,
      });
    }

    if (!pager.hasNextPage()) {
      break;
    }

    await pager.nextPage();
  }

  return documents;
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
      customMetadata: [
        {
          key: "content_sha256",
          stringValue: document.sha256,
        },
        {
          key: "source_path",
          stringValue: document.displayName,
        },
        {
          key: "source_type",
          stringValue: document.sourceType,
        },
      ],
    },
  });

  while (!operation.done) {
    await sleep(2000);

    operation = await ai.operations.get({
      operation,
    });
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

  await uploadDocument(storeName, localDocument);

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

    return !storeDocument.sha256 || storeDocument.sha256 !== document.sha256;
  });

  const unchanged = localDocuments.filter((document) => {
    const storeDocument = storeByName.get(document.displayName);

    return (
      Boolean(storeDocument) &&
      Boolean(storeDocument?.sha256) &&
      storeDocument?.sha256 === document.sha256
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
