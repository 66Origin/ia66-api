import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { RagExportService } from "../src/lib/rag/export-service";
import type {
  GenerationReport,
  RagManifest,
} from "../src/lib/rag/site-generator";

const NOW = new Date("2026-09-09T12:00:00.000Z");

function result(): { manifest: RagManifest; report: GenerationReport } {
  return {
    manifest: {
      schemaVersion: 1,
      source: "https://www.66origin.com",
      generatedAt: NOW.toISOString(),
      documents: [],
    },
    report: {
      startedAt: NOW.toISOString(),
      completedAt: NOW.toISOString(),
      source: "https://www.66origin.com",
      discovered: 1,
      created: 1,
      updated: 0,
      unchanged: 0,
      missing: 0,
      failed: 0,
      failures: [],
    },
  };
}

test("copie le snapshot, génère un ZIP et nettoie /tmp", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "rag-export-test-"));
  const baselineDir = path.join(root, "baseline");
  const temporaryRoot = path.join(root, "tmp");
  await fs.mkdir(path.join(baselineDir, "works"), { recursive: true });
  await fs.mkdir(temporaryRoot, { recursive: true });
  await fs.writeFile(path.join(baselineDir, "works", "baseline.md"), "# Base\n");

  const service = new RagExportService({
    baselineDir,
    temporaryRoot,
    now: () => NOW,
    idFactory: () => "rag_test_12345678",
    generateDocuments: async ({ outputDir }) => {
      assert.equal(
        await fs.readFile(path.join(outputDir!, "works", "baseline.md"), "utf8"),
        "# Base\n",
      );
      await fs.writeFile(path.join(outputDir!, "works", "new.md"), "# New\n");
      return result();
    },
  });

  const exported = await service.run();
  assert.equal(exported.id, "rag_test_12345678");
  assert.equal(exported.report.created, 1);
  assert.equal(exported.archive.subarray(0, 2).toString(), "PK");
  assert.match(exported.archive.toString("latin1"), /works\/baseline\.md/);
  assert.match(exported.archive.toString("latin1"), /works\/new\.md/);
  assert.equal((await fs.readdir(temporaryRoot)).length, 0);
});

test("nettoie le dossier temporaire après un échec", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "rag-export-fail-"));
  const baselineDir = path.join(root, "baseline");
  const temporaryRoot = path.join(root, "tmp");
  await fs.mkdir(baselineDir, { recursive: true });
  await fs.mkdir(temporaryRoot, { recursive: true });

  const service = new RagExportService({
    baselineDir,
    temporaryRoot,
    generateDocuments: async () => {
      throw new Error("Crawl indisponible");
    },
  });

  await assert.rejects(() => service.run(), /Crawl indisponible/);
  assert.equal((await fs.readdir(temporaryRoot)).length, 0);
});
