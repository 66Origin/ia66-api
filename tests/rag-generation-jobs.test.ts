import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  InvalidRagGenerationIdError,
  LocalRagGenerationService,
} from "../src/lib/rag/generation-jobs";
import type {
  GenerationReport,
  RagManifest,
} from "../src/lib/rag/site-generator";

const NOW = new Date("2026-09-09T12:00:00.000Z");

function result(failed = 0): { manifest: RagManifest; report: GenerationReport } {
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
      failed,
      failures: failed ? [{ url: "https://www.66origin.com/x", error: "test" }] : [],
    },
  };
}

test("lance une génération, persiste son statut et crée le ZIP", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "rag-jobs-"));
  const generatedDir = path.join(root, "generated");
  const runsDir = path.join(root, "runs");
  const id = "rag_test_12345678";
  const service = new LocalRagGenerationService({
    generatedDir,
    runsDir,
    now: () => NOW,
    idFactory: () => id,
    generateDocuments: async ({ outputDir }) => {
      await fs.mkdir(path.join(outputDir!, "works"), { recursive: true });
      await fs.writeFile(path.join(outputDir!, "works", "test.md"), "# Test\n");
      return result();
    },
  });

  const started = await service.start();
  assert.equal(started.started, true);
  assert.equal(started.job.status, "queued");

  await service.waitUntilIdle();
  const completed = await service.get(id);
  assert.equal(completed?.status, "completed");
  assert.equal(completed?.report?.created, 1);
  assert.ok(completed?.archiveFile);

  const archivePath = await service.getArchivePath(id);
  assert.ok(archivePath);
  const signature = await fs.readFile(archivePath!);
  assert.equal(signature.subarray(0, 2).toString(), "PK");
  assert.equal((await service.list())[0]?.id, id);
});

test("refuse deux générations simultanées", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "rag-jobs-lock-"));
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const service = new LocalRagGenerationService({
    generatedDir: path.join(root, "generated"),
    runsDir: path.join(root, "runs"),
    idFactory: () => "rag_lock_12345678",
    generateDocuments: async ({ outputDir }) => {
      await gate;
      await fs.mkdir(outputDir!, { recursive: true });
      await fs.writeFile(path.join(outputDir!, "test.md"), "# Test\n");
      return result();
    },
  });

  const first = await service.start();
  const second = await service.start();
  assert.equal(first.started, true);
  assert.equal(second.started, false);
  assert.equal(second.job.id, first.job.id);
  release();
  await service.waitUntilIdle();
});

test("enregistre un échec sans produire d'archive", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "rag-jobs-fail-"));
  const service = new LocalRagGenerationService({
    generatedDir: path.join(root, "generated"),
    runsDir: path.join(root, "runs"),
    idFactory: () => "rag_fail_12345678",
    generateDocuments: async () => {
      throw new Error("Crawl indisponible");
    },
  });

  await service.start();
  await service.waitUntilIdle();
  const failed = await service.get("rag_fail_12345678");
  assert.equal(failed?.status, "failed");
  assert.equal(failed?.error, "Crawl indisponible");
  assert.equal(await service.getArchivePath("rag_fail_12345678"), null);
});

test("rejette un identifiant impropre à un chemin de fichier", async () => {
  const service = new LocalRagGenerationService();
  await assert.rejects(
    () => service.get("../../secret"),
    InvalidRagGenerationIdError,
  );
});
