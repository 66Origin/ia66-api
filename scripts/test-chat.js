// scripts/test-chat.js
import fs from "node:fs";
import assert from "node:assert";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ORIGIN = process.env.ORIGIN || "https://66origin.webflow.io";
const FIXTURES_PATH = process.env.FIXTURES || "tests/chat.fixtures.json";

async function callApi(payload) {
  const res = await fetch(`${BASE_URL}/api/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}\n${body}`);
  }

  const json = await res.json().catch(() => ({}));
  return typeof json.text === "string" ? json.text : "";
}

function countQuestions(text) {
  return (text.match(/\?/g) || []).length;
}

function mustContain(text, terms) {
  for (const t of terms) {
    assert(text.includes(t), `Missing "${t}"`);
  }
}

function mustNotContain(text, terms) {
  for (const t of terms) {
    assert(!text.includes(t), `Forbidden "${t}"`);
  }
}

function mustMatch(text, patterns) {
  for (const p of patterns) {
    const re = new RegExp(p, "i");
    assert(re.test(text), `Missing pattern /${p}/i`);
  }
}

function mustMatchAny(text, patterns) {
  const ok = patterns.some((p) => new RegExp(p, "i").test(text));
  if (!ok) throw new Error(`Missing any regex of: ${patterns.join(" | ")}`);
}

function mustNotMatchAny(text, patterns) {
  for (const p of patterns) {
    const re = new RegExp(p, "i");
    if (re.test(text)) {
      throw new Error(`Forbidden regex /${p}/i`);
    }
  }
}

function countQuestionsBeforeQuestionBlock(text) {
  const idx = text.search(/\nQUESTION:\s*/i);
  const head = idx >= 0 ? text.slice(0, idx) : text;
  return (head.match(/\?/g) || []).length;
}

function countAcquisBullets(text) {
  const m = text.match(
    /ACQUIS:\s*([\s\S]*?)(?:\nORIENTATION:|\nSUITE:|\nQUESTION:|$)/i,
  );
  if (!m) return 0;
  const block = m[1];
  return (block.match(/^\s*[-*]\s+/gm) || []).length;
}

function countQuestionsOutsideQuestionBlock(text) {
  const idx = text.search(/\nQUESTION:\s*/i);
  const head = idx >= 0 ? text.slice(0, idx) : text;
  const tail = idx >= 0 ? text.slice(idx) : "";
  const headQ = (head.match(/\?/g) || []).length;
  const tailQ = (tail.match(/\?/g) || []).length;
  // si QUESTION: existe, on autorise au plus 1 "?" dans tail
  return { headQ, tailQ };
}

function mustMentionDocLimit(text) {
  const ok =
    /je ne le vois pas|je ne vois pas|je ne trouve pas|documents actuels.*ne contiennent pas|pas d'informations|n'est pas disponible dans les documents actuels|pas disponible dans les documents actuels|sans accès au texte/i.test(
      text,
    );
  if (!ok) throw new Error("Missing doc-limit statement for non-covered case");
}

function applyAsserts(text, rule = {}) {
  if (rule.mustContain) mustContain(text, rule.mustContain);
  if (rule.mustNotContain) mustNotContain(text, rule.mustNotContain);
  if (rule.mustMatch) mustMatch(text, rule.mustMatch);
  if (rule.mustMatchAny) mustMatchAny(text, rule.mustMatchAny);
  if (rule.mustNotMatchAny) mustNotMatchAny(text, rule.mustNotMatchAny);
  if (rule.mustMentionDocLimit) mustMentionDocLimit(text);

  if (typeof rule.maxQuestions === "number") {
    const q = countQuestions(text);
    assert(
      q <= rule.maxQuestions,
      `Too many questions: ${q} > ${rule.maxQuestions}`,
    );
  }

  if (typeof rule.maxQuestionsBeforeQuestionBlock === "number") {
    const q = countQuestionsBeforeQuestionBlock(text);
    if (q > rule.maxQuestionsBeforeQuestionBlock) {
      throw new Error(
        `Too many questions before QUESTION: ${q} > ${rule.maxQuestionsBeforeQuestionBlock}`,
      );
    }
  }

  if (typeof rule.maxAcquisBullets === "number") {
    const n = countAcquisBullets(text);
    if (n > rule.maxAcquisBullets) {
      throw new Error(
        `Too many ACQUIS bullets: ${n} > ${rule.maxAcquisBullets}`,
      );
    }
  }

  if (rule.noQuestionMarkOutsideQuestionBlock) {
    const { headQ } = countQuestionsOutsideQuestionBlock(text);
    if (headQ > 0)
      throw new Error(`Forbidden "?" outside QUESTION block: ${headQ}`);
  }
}

async function main() {
  const raw = fs.readFileSync(FIXTURES_PATH, "utf-8");
  const fixtures = JSON.parse(raw);

  console.log("Fixtures loaded:", fixtures.length);

  let passed = 0;

  for (const fx of fixtures) {
    const name = fx.name || "unnamed";
    process.stdout.write(`- ${name} ... `);

    const text = await callApi(fx.payload);

    try {
      applyAsserts(text, fx.assert);
      passed += 1;
      console.log("OK");
    } catch (e) {
      console.log("FAILED");
      console.log("\n--- PAYLOAD USED ---\n");
      console.log(JSON.stringify(fx.payload, null, 2));
      console.log("\n--- OUTPUT ---\n");
      console.log(text);
      console.log("\n--- END ---\n");
      throw e;
    }

    console.log(text);
    console.log("\n---\n");
  }

  console.log(`Passed: ${passed}/${fixtures.length}`);
}

main().catch((e) => {
  console.error("\nFAILED");
  console.error(e.message || e);
  process.exit(1);
});
