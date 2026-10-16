import manifest from "../../../rag/generated/manifest.json";
import projectAliases from "../../../data/project-aliases.json";

export type ProjectLink = { label: string; url: string };
type AliasMap = Record<string, string[]>;

export function isProjectUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "www.66origin.com" &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      /^\/works\/[a-z0-9-]+\/?$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

// The committed manifest is bundled with the API; no CMS/network request is needed.
export function buildProjectCatalog(
  value: unknown,
  aliases: AliasMap = projectAliases,
): ProjectLink[] {
  if (
    !value ||
    typeof value !== "object" ||
    !("documents" in value) ||
    !Array.isArray(value.documents)
  )
    return [];

  const candidates = new Map<string, ProjectLink | null>();
  for (const document of value.documents) {
    if (
      !document ||
      document.type !== "work" ||
      document.status !== "active" ||
      typeof document.slug !== "string" ||
      !isProjectUrl(document.canonicalUrl)
    )
      continue;

    const title =
      typeof document.title === "string" ? document.title.trim() : "";
    // Explicit aliases handle short project names and abbreviations. A new
    // project's complete title and comma-separated name work without an override.
    const labels = [
      title,
      title.split(",")[0],
      ...(aliases[document.slug] ?? []),
    ];
    for (const raw of labels) {
      const label = raw.trim();
      if (!label) continue;
      const key = label.toLocaleLowerCase("fr");
      const link = { label, url: document.canonicalUrl };
      if (!candidates.has(key)) candidates.set(key, link);
      else if (candidates.get(key)?.url !== link.url) candidates.set(key, null);
    }
  }
  return [...candidates.values()].filter(
    (link): link is ProjectLink => link !== null,
  );
}

const catalog = buildProjectCatalog(manifest);

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function selectProjectLinks(
  text: string,
  projects: ProjectLink[] = catalog,
): ProjectLink[] {
  const sorted = projects
    .filter((project) => project.label.trim() && isProjectUrl(project.url))
    .toSorted((a, b) => b.label.length - a.label.length);
  if (!sorted.length) return [];

  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}_])(${sorted.map((p) => escapeRegExp(p.label)).join("|")})(?![\\p{L}\\p{N}_])`,
    "giu",
  );
  const lookup = new Map(
    sorted.map((p) => [p.label.toLocaleLowerCase("fr"), p]),
  );
  const selected = new Map<string, ProjectLink>();
  for (const match of text.matchAll(pattern)) {
    const project = lookup.get(match[0].toLocaleLowerCase("fr"));
    if (project) selected.set(project.label.toLocaleLowerCase("fr"), project);
  }
  return [...selected.values()];
}
