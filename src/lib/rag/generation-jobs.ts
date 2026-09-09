import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import archiver from "archiver";
import {
  generateSiteDocuments,
  type GenerationReport,
  type GeneratorOptions,
  type RagManifest,
} from "./site-generator";

export type RagGenerationStatus =
  | "queued"
  | "running"
  | "completed"
  | "completed_with_errors"
  | "failed";

export type RagGenerationJob = {
  id: string;
  status: RagGenerationStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  archiveFile?: string;
  report?: GenerationReport;
  error?: string;
};

type GenerateDocuments = (
  options: GeneratorOptions,
) => Promise<{ manifest: RagManifest; report: GenerationReport }>;

export type LocalRagGenerationServiceOptions = {
  generatedDir?: string;
  runsDir?: string;
  generateDocuments?: GenerateDocuments;
  now?: () => Date;
  idFactory?: () => string;
  generatorOptions?: Omit<GeneratorOptions, "outputDir">;
};

export class InvalidRagGenerationIdError extends Error {}

function isSafeGenerationId(id: string): boolean {
  return /^rag_[a-zA-Z0-9_-]{8,80}$/.test(id);
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(temporaryPath, filePath);
}

async function zipDirectory(sourceDir: string, archivePath: string) {
  await fs.mkdir(path.dirname(archivePath), { recursive: true });
  const temporaryPath = `${archivePath}.tmp`;

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(temporaryPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    output.on("error", reject);
    archive.on("warning", reject);
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    void archive.finalize();
  });

  await fs.rename(temporaryPath, archivePath);
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function defaultGenerationId(now: Date): string {
  const timestamp = now.toISOString().replace(/[-:.TZ]/g, "");
  return `rag_${timestamp}_${randomUUID().slice(0, 8)}`;
}

export class LocalRagGenerationService {
  private readonly generatedDir: string;
  private readonly runsDir: string;
  private readonly generateDocuments: GenerateDocuments;
  private readonly now: () => Date;
  private readonly idFactory?: () => string;
  private readonly generatorOptions: Omit<GeneratorOptions, "outputDir">;
  private activeRunId: string | null = null;
  private activePromise: Promise<void> | null = null;

  constructor(options: LocalRagGenerationServiceOptions = {}) {
    this.generatedDir =
      options.generatedDir ?? path.join(process.cwd(), "rag", "generated");
    this.runsDir =
      options.runsDir ?? path.join(process.cwd(), "data", "rag-runs");
    this.generateDocuments = options.generateDocuments ?? generateSiteDocuments;
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory;
    this.generatorOptions = options.generatorOptions ?? {};
  }

  async start(): Promise<{ job: RagGenerationJob; started: boolean }> {
    if (this.activeRunId) {
      const activeJob = await this.get(this.activeRunId);
      if (activeJob) return { job: activeJob, started: false };
    }

    const createdAt = this.now().toISOString();
    const id = this.idFactory?.() ?? defaultGenerationId(this.now());
    if (!isSafeGenerationId(id)) {
      throw new InvalidRagGenerationIdError(
        "Identifiant de génération invalide",
      );
    }

    const job: RagGenerationJob = { id, status: "queued", createdAt };
    this.activeRunId = id;

    try {
      await this.save(job);
    } catch (error) {
      this.activeRunId = null;
      throw error;
    }

    this.activePromise = this.execute(job).finally(() => {
      if (this.activeRunId === id) this.activeRunId = null;
      this.activePromise = null;
    });

    // The request returns immediately; execute() persists its own failure state.
    void this.activePromise.catch(() => undefined);

    return { job, started: true };
  }

  async get(id: string): Promise<RagGenerationJob | null> {
    if (!isSafeGenerationId(id)) {
      throw new InvalidRagGenerationIdError(
        "Identifiant de génération invalide",
      );
    }

    try {
      return JSON.parse(
        await fs.readFile(this.jobPath(id), "utf8"),
      ) as RagGenerationJob;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async list(limit = 10): Promise<RagGenerationJob[]> {
    try {
      const entries = await fs.readdir(this.runsDir);
      const jobs = await Promise.all(
        entries
          .filter((entry) => entry.endsWith(".json"))
          .map((entry) => this.get(entry.slice(0, -5))),
      );

      return jobs
        .filter((job): job is RagGenerationJob => job !== null)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, Math.max(1, Math.min(limit, 50)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async getArchivePath(id: string): Promise<string | null> {
    const job = await this.get(id);
    if (!job?.archiveFile) return null;
    return path.join(this.runsDir, path.basename(job.archiveFile));
  }

  async waitUntilIdle(): Promise<void> {
    await this.activePromise;
  }

  private jobPath(id: string): string {
    return path.join(this.runsDir, `${id}.json`);
  }

  private async save(job: RagGenerationJob): Promise<void> {
    await writeJson(this.jobPath(job.id), job);
  }

  private async execute(initialJob: RagGenerationJob): Promise<void> {
    const runningJob: RagGenerationJob = {
      ...initialJob,
      status: "running",
      startedAt: this.now().toISOString(),
    };
    try {
      await this.save(runningJob);
      const { report } = await this.generateDocuments({
        ...this.generatorOptions,
        outputDir: this.generatedDir,
      });
      const archiveFile = `66origin-rag-${initialJob.id}.zip`;
      await zipDirectory(
        this.generatedDir,
        path.join(this.runsDir, archiveFile),
      );

      await this.save({
        ...runningJob,
        status: report.failed > 0 ? "completed_with_errors" : "completed",
        completedAt: this.now().toISOString(),
        archiveFile,
        report,
      });
    } catch (error) {
      try {
        await this.save({
          ...runningJob,
          status: "failed",
          completedAt: this.now().toISOString(),
          error: error instanceof Error ? error.message : String(error),
        });
      } catch {
        // If local persistence itself is unavailable, start()'s detached promise
        // must still be contained. The next request will expose the last saved state.
      }
    }
  }
}

export const ragGenerationService = new LocalRagGenerationService({
  generatorOptions: {
    baseUrl: process.env.RAG_SOURCE_URL,
    requestDelayMs: nonNegativeInteger(process.env.RAG_REQUEST_DELAY_MS, 100),
    concurrency: positiveInteger(process.env.RAG_CRAWL_CONCURRENCY, 4),
  },
});
