// scripts/test-chat.js
import fs from "node:fs";
import path from "node:path";

const API_URL = process.env.API_URL || "http://localhost:3000/api/v1/chat";

function countLines(s) {
  return String(s || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean).length;
}

function assertNoFirstPersonSingular(text) {
  // évite faux positifs sur "projet"
  // on cible surtout débuts de phrase
  const bad = /(^|\n)\s*Je\s+/m;
  if (bad.test(text))
    throw new Error("Contains first-person singular 'Je ...'");
}

function runAssertions(output, assert) {
  const text = String(output || "").trim();

  if (assert.mustNotContain) {
    for (const bad of assert.mustNotContain) {
      if (text.includes(bad))
        throw new Error(`Contains forbidden substring: ${bad}`);
    }
  }

  if (assert.maxLines != null) {
    const n = countLines(text);
    if (n > assert.maxLines)
      throw new Error(`Too many lines: ${n} > ${assert.maxLines}`);
  }

  if (assert.noFirstPersonSingular) {
    assertNoFirstPersonSingular(text);
  }

  if (assert.mustMentionNoContent) {
    const phrase =
      "Cette information n’est pas disponible dans les contenus actuels.";
    if (!text.includes(phrase))
      throw new Error(`Missing standard no-content phrase: ${phrase}`);
  }

  return true;
}

async function callApi(payload) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://66origin.webflow.io",
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status} ${res.statusText} ${JSON.stringify(json)}`,
    );
  }
  return json;
}

async function main() {
  const fixturesPath = path.join(process.cwd(), "tests/chat.fixtures.json");
  const fixtures = JSON.parse(fs.readFileSync(fixturesPath, "utf-8"));

  console.log(`Fixtures loaded: ${fixtures.length}`);

  let passed = 0;
  for (const fx of fixtures) {
    process.stdout.write(`- ${fx.name} ... `);
    try {
      const resp = await callApi(fx.payload);
      const text = resp?.text ?? "";
      runAssertions(text, fx.assert || {});
      console.log("OK");
      console.log(text);
      console.log("\n---\n");

      passed++;
    } catch (e) {
      console.log("FAILED");
      console.log("\n--- PAYLOAD USED ---\n");
      console.log(JSON.stringify(fx.payload, null, 2));
      console.log("\n--- END ---\n");
      throw e;
    }
  }

  console.log(`\nPassed: ${passed}/${fixtures.length}`);
}

main().catch((e) => {
  console.error(String(e?.message ?? e));
  process.exit(1);
});
