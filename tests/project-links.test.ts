import assert from "node:assert/strict";
import { test } from "node:test";
import { buildProjectCatalog, selectProjectLinks } from "../src/lib/rag/project-links";

const bewizUrl = "https://www.66origin.com/works/bewiz-rebranding-cabinet-comptable-identite-digitale";

test("Bewiz gets its canonical link without grounding sources or a browser catalog", () => {
  assert.deepEqual(selectProjectLinks("Pour Bewiz, notre travail…"), [
    { label: "BEWIZ", url: bewizUrl },
  ]);
});

test("multiple names, case variants, abbreviations and accents are supported", () => {
  const links = selectProjectLinks("Bewiz et BEWIZ, ILB, Le Vélo et The Brand Show.");
  assert.equal(links.length, 4);
  assert.ok(links.some((link) => link.label === "ILB"));
  assert.ok(links.some((link) => link.label === "Le Vélo"));
  assert.ok(links.some((link) => link.label === "The Brand Show"));
});

test("longer names take precedence and substrings inside words are ignored", () => {
  assert.deepEqual(selectProjectLinks("SuperBewiz, Bewizzz et éBewiz."), []);
  const links = selectProjectLinks("The Brand Show by Kantar et Bewiz.");
  assert.equal(links.length, 2);
  assert.equal(links[0].label, "The Brand Show by Kantar");
});

test("ordinary text and unknown projects do not create links", () => {
  assert.deepEqual(selectProjectLinks("Nous créons des produits numériques."), []);
  assert.deepEqual(selectProjectLinks("Un projet inconnu."), []);
});

test("an unavailable or malformed catalog leaves the answer without links", () => {
  for (const value of [null, {}, { documents: "invalid" }]) {
    assert.deepEqual(buildProjectCatalog(value), []);
  }
  assert.deepEqual(selectProjectLinks("Bewiz", []), []);
});

test("only active Works with safe canonical URLs enter the catalog", () => {
  const document = { type: "work", status: "active", slug: "test", title: "Test", canonicalUrl: bewizUrl };
  const documents = [
    document,
    { ...document, status: "missing", title: "Missing" },
    { ...document, type: "team", title: "Team" },
    ...["javascript:alert(1)", "https://evil.test/works/test", "https://www.66origin.com/works/test?x=1",
      "https://www.66origin.com/works/test#fragment", "https://evil.test@www.66origin.com/works/test",
      "https://www.66origin.com/insights/test"].map((canonicalUrl) => ({ ...document, title: "Unsafe", canonicalUrl })),
  ];
  assert.deepEqual(buildProjectCatalog({ documents }, {}), [{ label: "Test", url: bewizUrl }]);
});

test("a new project can use its title without a custom alias", () => {
  const links = buildProjectCatalog({ documents: [{
    type: "work", status: "active", slug: "new", title: "Nouveau, un projet",
    canonicalUrl: "https://www.66origin.com/works/new",
  }] }, {});
  assert.equal(selectProjectLinks("Le projet Nouveau.", links)[0]?.label, "Nouveau");
});

test("ambiguous aliases are excluded rather than linked arbitrarily", () => {
  const links = buildProjectCatalog({ documents: [
    { type: "work", status: "active", slug: "one", title: "One", canonicalUrl: "https://www.66origin.com/works/one" },
    { type: "work", status: "active", slug: "two", title: "Two", canonicalUrl: "https://www.66origin.com/works/two" },
  ] }, { one: ["Shared"], two: ["Shared"] });
  assert.deepEqual(selectProjectLinks("Shared", links), []);
});
