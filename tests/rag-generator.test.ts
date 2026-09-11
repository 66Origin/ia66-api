import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  discoverTargetsFromHtml,
  extractPage,
  generateSiteDocuments,
  renderMarkdown,
} from "../src/lib/rag/site-generator";

const BASE_URL = "https://www.66origin.com";

function pageHtml({
  title,
  pathname,
  body,
}: {
  title: string;
  pathname: string;
  body: string;
}) {
  return `<!doctype html>
    <html lang="fr">
      <head>
        <title>${title} | 66 Origin</title>
        <meta name="description" content="Description de ${title}">
        <link rel="canonical" href="${BASE_URL}${pathname}">
      </head>
      <body>
        <nav>Menu à exclure</nav>
        <main><a href="/works">Retour</a>${body}</main>
        <footer>Footer à exclure</footer>
      </body>
    </html>`;
}

test("découvre uniquement les pages de la catégorie demandée", () => {
  const html = `
    <a href="/works/projet-b">B</a>
    <a href="${BASE_URL}/works/projet-a?utm_source=test#top">A</a>
    <a href="/works/projet-b">B bis</a>
    <a href="/insights/article">Insight</a>
    <a href="https://example.com/works/externe">Externe</a>`;

  assert.deepEqual(discoverTargetsFromHtml(html, "work", BASE_URL), [
    { type: "work", url: `${BASE_URL}/works/projet-a`, slug: "projet-a" },
    { type: "work", url: `${BASE_URL}/works/projet-b`, slug: "projet-b" },
  ]);
});

test("extrait le main et génère un Markdown stable", () => {
  const target = {
    type: "work" as const,
    url: `${BASE_URL}/works/taiji`,
    slug: "taiji",
  };
  const html = pageHtml({
    title: "Taiji",
    pathname: "/works/taiji",
    body: `
      <h1>Taiji</h1>
      <p>Un vélo <strong>connecté</strong>.</p>
      <img src="taiji.jpg" alt="Visuel Taiji">
      <script>console.log("secret")</script>`,
  });

  const page = extractPage(html, target, BASE_URL);
  const markdown = renderMarkdown(page);

  assert.match(markdown, /# Taiji/);
  assert.match(markdown, /Un vélo \*\*connecté\*\*\./);
  assert.doesNotMatch(markdown, /Menu à exclure|Footer à exclure|Retour/);
  assert.doesNotMatch(markdown, /secret|taiji\.jpg/);
  assert.match(markdown, /source_hash: "sha256:[a-f0-9]{64}"/);
  assert.equal(page.sourceHash, extractPage(html, target, BASE_URL).sourceHash);
});

test("accepte le conteneur .main des fiches équipe", () => {
  const target = {
    type: "team" as const,
    url: `${BASE_URL}/team/philippe-mihelic`,
    slug: "philippe-mihelic",
  };
  const html = `<!doctype html><html><head><title>Philippe Mihelic</title></head>
    <body><header>Menu</header><div class="main"><style>.x{color:red}</style>
    <div class="w-dyn-empty">No items found.</div><a href="/team">Retour</a>
    <h1>Philippe Mihelic</h1><p>Cofondateur et CEO.</p></div>
    <footer>Pied de page</footer></body></html>`;

  const page = extractPage(html, target, BASE_URL);

  assert.match(page.markdown, /# Philippe Mihelic/);
  assert.match(page.markdown, /Cofondateur et CEO\./);
  assert.doesNotMatch(
    page.markdown,
    /Menu|Pied de page|Retour|color:red|No items found/,
  );
});

test("génère, versionne et conserve une page devenue manquante", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "rag-generator-"));
  let workLinks = '<a href="/works/projet-a">Projet A</a>';
  let workBody = "Version initiale";
  let tick = 0;

  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(input.toString());
    let html: string;

    if (url.pathname === "/works") html = workLinks;
    else if (url.pathname === "/insights") {
      html = '<a href="/insights/article-a">Article A</a>';
    } else if (url.pathname === "/team") {
      html = '<a href="/team/personne-a">Personne A</a>';
    } else {
      html = pageHtml({
        title: url.pathname.split("/").filter(Boolean).at(-1) ?? "Accueil",
        pathname: url.pathname,
        body: `<h1>Page</h1><p>${url.pathname === "/works/projet-a" ? workBody : "Contenu"}</p>`,
      });
    }

    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  };
  const now = () => new Date(Date.UTC(2026, 8, 8, 10, 0, tick++));

  const first = await generateSiteDocuments({
    outputDir,
    fetchImpl,
    now,
    requestDelayMs: 0,
    concurrency: 1,
    logger: { log() {}, warn() {} },
  });
  const firstWork = first.manifest.documents.find(
    (document) => document.sourceUrl === `${BASE_URL}/works/projet-a`,
  );
  assert.equal(firstWork?.version, 1);
  assert.equal(firstWork?.status, "active");

  workBody = "Version modifiée";
  const second = await generateSiteDocuments({
    outputDir,
    fetchImpl,
    now,
    requestDelayMs: 0,
    concurrency: 1,
    logger: { log() {}, warn() {} },
  });
  const secondWork = second.manifest.documents.find(
    (document) => document.sourceUrl === `${BASE_URL}/works/projet-a`,
  );
  assert.equal(secondWork?.version, 2);
  assert.equal(second.report.updated, 1);

  workLinks = '<a href="/works/projet-b">Projet B</a>';
  const third = await generateSiteDocuments({
    outputDir,
    fetchImpl,
    now,
    requestDelayMs: 0,
    concurrency: 1,
    logger: { log() {}, warn() {} },
  });
  const missingWork = third.manifest.documents.find(
    (document) => document.sourceUrl === `${BASE_URL}/works/projet-a`,
  );
  assert.equal(missingWork?.status, "missing");
  assert.equal(third.report.missing, 1);

  const preserved = await readFile(
    path.join(outputDir, "works", "projet-a.md"),
    "utf8",
  );
  assert.match(preserved, /Version modifiée/);
});
