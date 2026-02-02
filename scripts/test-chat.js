// scripts/test-chat.js
import fs from "node:fs";
import path from "node:path";

const API_URL = process.env.API_URL || "http://localhost:3000/api/v1/chat";

function countQuestions(text) {
  const matches = text.match(/\?/g);
  return matches ? matches.length : 0;
}

function countQuestionsBeforeQuestionBlock(text) {
  const idx = text.search(/^\s*QUESTION:\s*$/im);
  const before = idx >= 0 ? text.slice(0, idx) : text;
  const matches = before.match(/\?/g);
  return matches ? matches.length : 0;
}

function hasQuestionMarkOutsideQuestionBlock(text) {
  const idx = text.search(/^\s*QUESTION:\s*$/im);
  if (idx < 0) return /\?/.test(text);
  const before = text.slice(0, idx);
  return /\?/.test(before);
}

function countAcquisBullets(text) {
  const m = text.match(/(^|\n)ACQUIS:\s*\n([\s\S]*?)(\nORIENTATION:)/i);
  if (!m) return 0;
  const body = m[2];
  const lines = body.split("\n");
  return lines.filter((l) => /^\s*[-*]\s+/.test(l)).length;
}

function mustMentionDocLimit(text) {
  const ok =
    /je ne le vois pas|je ne vois pas|je ne trouve pas|pas d'informations|n'est pas disponible dans les documents actuels|pas disponible dans les documents actuels|documents actuels.*ne contiennent pas|sans accès au texte/i.test(
      text,
    );
  if (!ok) throw new Error("Missing doc-limit statement for non-covered case");
}

function assertRegexList(text, patterns, { any = false } = {}) {
  if (!patterns?.length) return;
  const regexes = patterns.map((p) => new RegExp(p, "i"));
  if (any) {
    if (!regexes.some((r) => r.test(text))) {
      throw new Error(`Missing any regex of: ${patterns.join(" | ")}`);
    }
  } else {
    for (const r of regexes) {
      if (!r.test(text)) throw new Error(`Missing regex: ${r}`);
    }
  }
}

function assertNotContain(text, needles) {
  if (!needles?.length) return;
  for (const n of needles) {
    if (text.toLowerCase().includes(String(n).toLowerCase())) {
      throw new Error(`Forbidden substring: ${n}`);
    }
  }
}

function assertNotMatchAny(text, patterns) {
  if (!patterns?.length) return;
  for (const p of patterns) {
    const r = new RegExp(p, "i");
    if (r.test(text)) throw new Error(`Forbidden regex ${r}`);
  }
}

async function postJson(url, payload) {
  const res = await fetch(url, {
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

async function run() {
  const fixturesPath = path.resolve("tests/chat.fixtures.json");
  const fixtures = JSON.parse(fs.readFileSync(fixturesPath, "utf8"));
  console.log(`Fixtures loaded: ${fixtures.length}`);

  let passed = 0;

  for (const fx of fixtures) {
    const name = fx.name;
    const payload = fx.payload;
    const assert = fx.assert || {};

    process.stdout.write(`- ${name} ... `);

    let out;
    try {
      out = await postJson(API_URL, payload);
      const text = out?.text || "";
      const isFinal = Boolean(out?.isFinal);

      console.log("OK");
      console.log(text);
      console.log("\n---\n");

      assertRegexList(text, assert.mustMatch, { any: false });
      assertRegexList(text, assert.mustMatchAny, { any: true });
      assertNotContain(text, assert.mustNotContain);
      assertNotMatchAny(text, assert.mustNotMatchAny);

      const q = countQuestions(text);
      const maxQ = assert.maxQuestions ?? 999;
      if (q > maxQ) throw new Error(`Too many questions: ${q} > ${maxQ}`);

      const qBefore = countQuestionsBeforeQuestionBlock(text);
      const maxQBefore = assert.maxQuestionsBeforeQuestionBlock ?? 999;
      if (qBefore > maxQBefore) {
        throw new Error(
          `Too many questions before QUESTION block: ${qBefore} > ${maxQBefore}`,
        );
      }

      if (assert.noQuestionMarkOutsideQuestionBlock) {
        if (hasQuestionMarkOutsideQuestionBlock(text)) {
          throw new Error(`Forbidden "?" outside QUESTION block`);
        }
      }

      const b = countAcquisBullets(text);
      const maxB = assert.maxAcquisBullets ?? 999;
      if (b > maxB) throw new Error(`Too many ACQUIS bullets: ${b} > ${maxB}`);

      if (assert.mustMentionDocLimit) {
        mustMentionDocLimit(text);
      }

      if (typeof assert.isFinal === "boolean") {
        if (isFinal !== assert.isFinal) {
          throw new Error(
            `isFinal mismatch: got ${isFinal} expected ${assert.isFinal}`,
          );
        }
      }

      passed++;
    } catch (e) {
      console.log("FAILED\n");
      console.log("--- PAYLOAD USED ---\n");
      console.log(JSON.stringify(payload, null, 2));
      console.log("\n--- OUTPUT ---\n");
      if (out?.text) console.log(out.text);
      console.log("\n--- END ---\n");
      console.log(String(e));
      console.log("\n");
    }
  }

  console.log(`Passed: ${passed}/${fixtures.length}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
