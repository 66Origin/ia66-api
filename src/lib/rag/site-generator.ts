import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import TurndownService from "turndown";

export type PageType = "work" | "insight" | "team" | "page";
export type DocumentStatus = "active" | "missing" | "failed";

export type PageTarget = {
  type: PageType;
  url: string;
  slug: string;
};

export type ExtractedPage = PageTarget & {
  canonicalUrl: string;
  title: string;
  description?: string;
  markdown: string;
  sourceHash: string;
};

export type ManifestDocument = {
  type: PageType;
  slug: string;
  sourceUrl: string;
  canonicalUrl: string;
  outputFile: string;
  sourceHash: string;
  version: number;
  status: DocumentStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  lastGeneratedAt: string;
  error?: string;
};

export type RagManifest = {
  schemaVersion: 1;
  source: string;
  generatedAt: string;
  documents: ManifestDocument[];
};

export type GenerationReport = {
  startedAt: string;
  completedAt: string;
  source: string;
  discovered: number;
  created: number;
  updated: number;
  unchanged: number;
  missing: number;
  failed: number;
  failures: Array<{ url: string; error: string }>;
};

export type GeneratorOptions = {
  baseUrl?: string;
  outputDir?: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  requestDelayMs?: number;
  concurrency?: number;
  logger?: Pick<Console, "log" | "warn">;
};

const DEFAULT_BASE_URL = "https://www.66origin.com";
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), "rag", "generated");
const INDEX_PATHS: Record<Exclude<PageType, "page">, string> = {
  work: "/works",
  insight: "/insights",
  team: "/team",
};
const STATIC_PATHS = ["/", "/approche", "/maison", "/diagnostic-ia"];
const TYPE_DIRECTORIES: Record<PageType, string> = {
  work: "works",
  insight: "insights",
  team: "team",
  page: "pages",
};

function cleanText(value: string): string {
  return value
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function pageSlug(url: URL, type: PageType): string {
  if (type === "page") {
    return url.pathname === "/"
      ? "home"
      : (url.pathname.split("/").filter(Boolean).at(-1) ?? "page");
  }

  return url.pathname.split("/").filter(Boolean).at(-1) ?? type;
}

function normalizeUrl(value: string | URL, baseUrl: string): URL | null {
  try {
    const url = new URL(value.toString(), baseUrl);
    const base = new URL(baseUrl);

    if (url.origin !== base.origin) return null;

    url.hash = "";
    url.search = "";
    if (url.pathname.length > 1)
      url.pathname = url.pathname.replace(/\/+$/, "");

    return url;
  } catch {
    return null;
  }
}

export function discoverTargetsFromHtml(
  html: string,
  type: Exclude<PageType, "page">,
  baseUrl = DEFAULT_BASE_URL,
): PageTarget[] {
  const $ = load(html);
  const expectedPrefix = `/${INDEX_PATHS[type].split("/").filter(Boolean)[0]}/`;
  const found = new Map<string, PageTarget>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;

    const url = normalizeUrl(href, baseUrl);
    if (!url || !url.pathname.startsWith(expectedPrefix)) return;
    if (url.pathname === INDEX_PATHS[type]) return;

    const slug = pageSlug(url, type);
    found.set(url.href, { type, url: url.href, slug });
  });

  return [...found.values()].sort((a, b) => a.url.localeCompare(b.url));
}

export function extractPage(
  html: string,
  target: PageTarget,
  baseUrl = DEFAULT_BASE_URL,
): ExtractedPage {
  const $ = load(html);
  const semanticMain = $("main").first();
  const main = semanticMain.length ? semanticMain : $(".main").first();

  if (!main.length) {
    throw new Error("Aucun conteneur de contenu principal trouvé");
  }

  main
    .find(
      [
        "script",
        "style",
        "noscript",
        "template",
        "svg",
        "iframe",
        "form",
        "button",
        "video",
        "audio",
        "picture",
        "img",
        "[hidden]",
        '[aria-hidden="true"]',
        ".w-condition-invisible",
        ".w-dyn-empty",
      ].join(","),
    )
    .remove();

  main.find("a").each((_, element) => {
    if (cleanText($(element).text()).toLocaleLowerCase("fr") === "retour") {
      $(element).remove();
    }
  });

  const canonicalHref = $('link[rel="canonical"]').attr("href") ?? target.url;
  const canonical = normalizeUrl(canonicalHref, baseUrl);
  const canonicalUrl = canonical?.href ?? target.url;
  const title = cleanText($("h1").first().text() || $("title").text());
  const description = cleanText(
    $('meta[name="description"]').attr("content") ?? "",
  );

  if (!title) throw new Error("Titre de page introuvable");

  const turndown = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "_",
    strongDelimiter: "**",
  });
  turndown.remove(["script", "style", "noscript", "iframe", "form"]);

  const markdown = cleanText(turndown.turndown(main.html() ?? ""));
  if (!markdown) throw new Error("Contenu principal vide");

  const sourceHash = sha256(
    [target.type, canonicalUrl, title, description, markdown].join("\n"),
  );

  return {
    ...target,
    canonicalUrl,
    title,
    description: description || undefined,
    markdown,
    sourceHash,
  };
}

export function renderMarkdown(page: ExtractedPage): string {
  const frontmatter = [
    "---",
    `title: ${yamlString(page.title)}`,
    `slug: ${yamlString(page.slug)}`,
    `type: ${yamlString(page.type)}`,
    `source: ${yamlString("66origin.com")}`,
    `source_url: ${yamlString(page.canonicalUrl)}`,
    `source_hash: ${yamlString(page.sourceHash)}`,
  ];

  if (page.description) {
    frontmatter.push(`description: ${yamlString(page.description)}`);
  }

  frontmatter.push("---");
  return `${frontmatter.join("\n")}\n\n${page.markdown}\n`;
}

async function readManifest(manifestPath: string): Promise<RagManifest | null> {
  try {
    return JSON.parse(await fs.readFile(manifestPath, "utf8")) as RagManifest;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await fs.writeFile(
    temporaryPath,
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
  await fs.rename(temporaryPath, filePath);
}

async function writeTextIfChanged(
  filePath: string,
  content: string,
): Promise<"created" | "updated" | "unchanged"> {
  let previous: string | null = null;
  try {
    previous = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  if (previous === content) return "unchanged";

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await fs.writeFile(temporaryPath, content, "utf8");
  await fs.rename(temporaryPath, filePath);
  return previous === null ? "created" : "updated";
}

async function wait(delayMs: number): Promise<void> {
  if (delayMs <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function fetchHtml(
  url: string,
  fetchImpl: typeof fetch,
): Promise<string> {
  const response = await fetchImpl(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "66Origin-RAG-Generator/1.0 (+https://www.66origin.com)",
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !contentType.includes("text/html")) {
    throw new Error(`Type de contenu inattendu: ${contentType}`);
  }

  return response.text();
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  callback: (value: T) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(values.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      output[index] = await callback(values[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () =>
      worker(),
    ),
  );
  return output;
}

function outputRelativePath(target: PageTarget): string {
  return path.posix.join(TYPE_DIRECTORIES[target.type], `${target.slug}.md`);
}

export async function generateSiteDocuments(
  options: GeneratorOptions = {},
): Promise<{ manifest: RagManifest; report: GenerationReport }> {
  const baseUrl = new URL(options.baseUrl ?? DEFAULT_BASE_URL).origin;
  const outputDir = options.outputDir ?? DEFAULT_OUTPUT_DIR;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const requestDelayMs = options.requestDelayMs ?? 100;
  const concurrency = Math.max(1, options.concurrency ?? 4);
  const logger = options.logger ?? console;
  const startedAt = now().toISOString();
  const manifestPath = path.join(
    /* turbopackIgnore: true */
    outputDir,
    "manifest.json",
  );
  const previousManifest = await readManifest(manifestPath);
  const previousByUrl = new Map(
    (previousManifest?.documents ?? []).map((document) => [
      document.sourceUrl,
      document,
    ]),
  );

  const targets: PageTarget[] = [];

  for (const [type, indexPath] of Object.entries(INDEX_PATHS) as Array<
    [Exclude<PageType, "page">, string]
  >) {
    const indexUrl = new URL(indexPath, baseUrl).href;
    logger.log(`Découverte ${type}: ${indexUrl}`);
    const html = await fetchHtml(indexUrl, fetchImpl);
    const discovered = discoverTargetsFromHtml(html, type, baseUrl);
    if (discovered.length === 0) {
      throw new Error(`Aucune page ${type} découverte depuis ${indexUrl}`);
    }
    targets.push(...discovered);
    await wait(requestDelayMs);
  }

  for (const staticPath of STATIC_PATHS) {
    const url = new URL(staticPath, baseUrl);
    targets.push({
      type: "page",
      url: url.href,
      slug: pageSlug(url, "page"),
    });
  }

  const uniqueTargets = [
    ...new Map(targets.map((target) => [target.url, target])).values(),
  ].sort((a, b) => a.url.localeCompare(b.url));
  const seenUrls = new Set(uniqueTargets.map((target) => target.url));
  const failures: Array<{ url: string; error: string }> = [];
  const activeDocuments: ManifestDocument[] = [];
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  const results = await mapWithConcurrency(
    uniqueTargets,
    concurrency,
    async (target) => {
      try {
        await wait(requestDelayMs);
        const html = await fetchHtml(target.url, fetchImpl);
        const page = extractPage(html, target, baseUrl);
        const relativePath = outputRelativePath(target);
        const outcome = await writeTextIfChanged(
          path.join(
            /* turbopackIgnore: true */
            outputDir,
            relativePath,
          ),
          renderMarkdown(page),
        );

        const previous = previousByUrl.get(target.url);
        const timestamp = now().toISOString();
        return {
          outcome,
          document: {
            type: target.type,
            slug: target.slug,
            sourceUrl: target.url,
            canonicalUrl: page.canonicalUrl,
            outputFile: relativePath,
            sourceHash: page.sourceHash,
            version:
              previous && previous.sourceHash === page.sourceHash
                ? previous.version
                : (previous?.version ?? 0) + 1,
            status: "active" as const,
            firstSeenAt: previous?.firstSeenAt ?? timestamp,
            lastSeenAt: timestamp,
            lastGeneratedAt:
              outcome === "unchanged"
                ? (previous?.lastGeneratedAt ?? timestamp)
                : timestamp,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ url: target.url, error: message });
        const previous = previousByUrl.get(target.url);
        if (!previous) return null;
        return {
          outcome: "failed" as const,
          document: { ...previous, status: "failed" as const, error: message },
        };
      }
    },
  );

  for (const result of results) {
    if (!result) continue;
    activeDocuments.push(result.document);
    if (result.outcome === "created") created++;
    else if (result.outcome === "updated") updated++;
    else if (result.outcome === "unchanged") unchanged++;
  }

  const missingDocuments = [...previousByUrl.values()]
    .filter((document) => !seenUrls.has(document.sourceUrl))
    .map((document) => ({
      ...document,
      status: "missing" as const,
      error: "La page n’a pas été retrouvée pendant la découverte",
    }));

  const completedAt = now().toISOString();
  const manifest: RagManifest = {
    schemaVersion: 1,
    source: baseUrl,
    generatedAt: completedAt,
    documents: [...activeDocuments, ...missingDocuments].sort((a, b) =>
      a.sourceUrl.localeCompare(b.sourceUrl),
    ),
  };
  const report: GenerationReport = {
    startedAt,
    completedAt,
    source: baseUrl,
    discovered: uniqueTargets.length,
    created,
    updated,
    unchanged,
    missing: missingDocuments.length,
    failed: failures.length,
    failures,
  };

  await writeJson(manifestPath, manifest);
  await writeJson(
    path.join(
      /* turbopackIgnore: true */
      outputDir,
      "last-run.json",
    ),
    report,
  );

  return { manifest, report };
}
