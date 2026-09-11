import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import archiver from "archiver";
import {
  generateSiteDocuments,
  type GenerationReport,
  type GeneratorOptions,
  type RagManifest,
} from "./site-generator";

type GenerateDocuments = (
  options: GeneratorOptions,
) => Promise<{ manifest: RagManifest; report: GenerationReport }>;

export type RagExport = {
  id: string;
  filename: string;
  archive: Buffer;
  report: GenerationReport;
};

export type RagExportServiceOptions = {
  baselineDir?: string;
  temporaryRoot?: string;
  generateDocuments?: GenerateDocuments;
  now?: () => Date;
  idFactory?: () => string;
  generatorOptions?: Omit<GeneratorOptions, "outputDir">;
};

async function copyBaseline(source: string, destination: string): Promise<void> {
  try {
    await fs.cp(source, destination, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await fs.mkdir(destination, { recursive: true });
  }
}

async function zipDirectory(sourceDir: string, archivePath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(archivePath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    output.on("error", reject);
    archive.on("warning", reject);
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    void archive.finalize();
  });
}

function defaultExportId(now: Date): string {
  const timestamp = now.toISOString().replace(/[-:.TZ]/g, "");
  return `rag_${timestamp}_${randomUUID().slice(0, 8)}`;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export class RagExportService {
  private readonly baselineDir: string;
  private readonly temporaryRoot: string;
  private readonly generateDocuments: GenerateDocuments;
  private readonly now: () => Date;
  private readonly idFactory?: () => string;
  private readonly generatorOptions: Omit<GeneratorOptions, "outputDir">;

  constructor(options: RagExportServiceOptions = {}) {
    this.baselineDir =
      options.baselineDir ?? path.join(process.cwd(), "rag", "generated");
    this.temporaryRoot = options.temporaryRoot ?? os.tmpdir();
    this.generateDocuments = options.generateDocuments ?? generateSiteDocuments;
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory;
    this.generatorOptions = options.generatorOptions ?? {};
  }

  async run(): Promise<RagExport> {
    const id = this.idFactory?.() ?? defaultExportId(this.now());
    const workspace = await fs.mkdtemp(
      path.join(this.temporaryRoot, "66origin-rag-export-"),
    );
    const outputDir = path.join(workspace, "generated");
    const filename = `66origin-rag-${id}.zip`;
    const archivePath = path.join(workspace, filename);

    try {
      await copyBaseline(this.baselineDir, outputDir);
      const { report } = await this.generateDocuments({
        ...this.generatorOptions,
        outputDir,
      });
      await zipDirectory(outputDir, archivePath);

      return {
        id,
        filename,
        archive: await fs.readFile(archivePath),
        report,
      };
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }
  }
}

export const ragExportService = new RagExportService({
  generatorOptions: {
    baseUrl: process.env.RAG_SOURCE_URL,
    requestDelayMs: nonNegativeInteger(process.env.RAG_REQUEST_DELAY_MS, 100),
    concurrency: positiveInteger(process.env.RAG_CRAWL_CONCURRENCY, 4),
  },
});
