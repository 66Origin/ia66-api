import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

// Minimal DOM for testing text-node replacement and link attributes.
class TestNode {
  childNodes: TestNode[] = [];
  parent: TestNode | null = null;
  href = "";
  target = "";
  rel = "";
  className = "";
  constructor(public nodeType: number, public tagName = "", public nodeValue = "") {}
  appendChild(node: TestNode) {
    node.parent = this;
    this.childNodes.push(node);
    return node;
  }
  set textContent(text: string) {
    this.childNodes = [];
    this.appendChild(new TestNode(3, "", text));
  }
  get textContent(): string {
    return this.nodeType === 3 ? this.nodeValue : this.childNodes.map((node) => node.textContent).join("");
  }
  replaceWith(fragment: TestNode) {
    assert.ok(this.parent);
    const parent = this.parent;
    for (const child of fragment.childNodes) child.parent = parent;
    parent.childNodes.splice(parent.childNodes.indexOf(this), 1, ...fragment.childNodes);
  }
}

const source = readFileSync("public/webflow/js/ia.js", "utf8");
const url = "https://www.66origin.com/works/bewiz-rebranding-cabinet-comptable-identite-digitale";

function render(text: string, links: unknown = [{ label: "Bewiz", url }], tag = "DIV") {
  const element = new TestNode(1, tag);
  element.textContent = text;
  const context = vm.createContext({
    URL,
    Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 },
    document: {
      createDocumentFragment: () => new TestNode(11),
      createTextNode: (text: string) => new TestNode(3, "", text),
      createElement: (tag: string) => new TestNode(1, tag.toUpperCase()),
    },
    // No window.PROJECTS, or even window, is present in this context.
  });
  for (const name of ["escapeRegExp", "linkifyProjectsInElement"]) {
    const start = source.indexOf(`  function ${name}(`);
    assert.notEqual(start, -1);
    const end = source.indexOf("\n  }\n", start) + 5;
    vm.runInContext(source.slice(start, end), context);
  }
  (context.linkifyProjectsInElement as (element: TestNode, links: unknown) => void)(element, links);
  return element;
}

test("API links render without window.PROJECTS, preserving text and safe attributes", () => {
  const element = render("Pour BEWIZ, découvrez Bewiz.");
  const anchors = element.childNodes.filter((node) => node.tagName === "A");
  assert.equal(element.textContent, "Pour BEWIZ, découvrez Bewiz.");
  assert.equal(anchors.length, 2);
  assert.equal(anchors[0].href, url);
  assert.equal(anchors[0].target, "_blank");
  assert.equal(anchors[0].rel, "noopener noreferrer");
  assert.equal(anchors[0].className, "ia66o-work-link");
});

test("an older API or missing links leaves readable text", () => {
  for (const links of [undefined, null, [], "invalid"]) {
    const element = render("Bewiz", links === undefined ? [] : links);
    assert.equal(element.textContent, "Bewiz");
    assert.equal(element.childNodes.length, 1);
  }
});

test("unsafe URLs and ambiguous labels are not rendered", () => {
  for (const badUrl of ["javascript:alert(1)", "https://evil.test/works/test", "https://www.66origin.com/works/test?x=1"]) {
    assert.equal(render("Bewiz", [{ label: "Bewiz", url: badUrl }]).childNodes[0].nodeType, 3);
  }
  assert.equal(render("Bewiz", [
    { label: "Bewiz", url },
    { label: "BEWIZ", url: "https://www.66origin.com/works/other" },
  ]).childNodes[0].nodeType, 3);
});

test("existing links and code blocks are not modified", () => {
  for (const tag of ["A", "CODE", "PRE"]) {
    const element = render("Bewiz", [{ label: "Bewiz", url }], tag);
    assert.equal(element.childNodes[0].nodeType, 3);
  }
});

test("longest labels win and partial word matches are excluded", () => {
  const element = render("éBewiz SuperBewiz Bewiz Group Bewiz", [
    { label: "Bewiz", url },
    { label: "Bewiz Group", url: "https://www.66origin.com/works/group" },
  ]);
  const anchors = element.childNodes.filter((node) => node.tagName === "A");
  assert.deepEqual(anchors.map((node) => node.textContent), ["Bewiz Group", "Bewiz"]);
});
