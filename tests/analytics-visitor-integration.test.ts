import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const sources = [
  "public/webflow/js/analytics-visitor-storage.js",
  "public/webflow/js/analytics-visitor.js",
].map((path) => readFileSync(path, "utf8"));

type Visitor = {
  visitorToken: string;
  expiresAt: number;
};

function loadPage(hostname: string, storage: Map<string, string>) {
  const expiresAt = Date.now() + 86_400_000;
  const issued: Visitor = {
    visitorToken:
      `v1.11111111-1111-4111-8111-111111111111.${expiresAt}.` + "a".repeat(43),
    expiresAt,
  };

  const requests: Array<{ visitorToken?: string }> = [];

  const browserWindow = {
    location: {
      hostname,
      origin: `https://${hostname}`,
    },
    navigator: {
      locks: {
        async request(
          _name: string,
          _options: unknown,
          callback: () => Promise<unknown>,
        ) {
          return callback();
        },
      },
    },
    localStorage: {
      getItem(key: string) {
        return storage.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        storage.set(key, value);
      },
      removeItem(key: string) {
        storage.delete(key);
      },
    },
    OAnalyticsVisitor: undefined as
      | { prepare(apiBase?: string): Promise<Visitor | null> }
      | undefined,
  };

  const context = vm.createContext({
    window: browserWindow,
    AbortController,
    setTimeout,
    clearTimeout,
    async fetch(_url: string, options: { body: string }) {
      const body = JSON.parse(options.body) as {
        visitorToken?: string;
      };
      requests.push(body);

      return {
        ok: true,
        async json() {
          if (body.visitorToken) {
            return {
              visitorToken: body.visitorToken,
              expiresAt: Number(body.visitorToken.split(".")[2]),
            };
          }
          return issued;
        },
      };
    },
  });

  for (const source of sources) {
    vm.runInContext(source, context);
  }

  assert.ok(browserWindow.OAnalyticsVisitor);

  return {
    client: browserWindow.OAnalyticsVisitor,
    requests,
  };
}

for (const hostname of [
  "66origin-test.webflow.io",
  "ia66-api-analytics-test.vercel.app",
  "ia66-api-analytics-test-git-feat-254a10-christellebqns-projects.vercel.app",
]) {
  test(`${hostname}: real storage preserves the token after reload`, async () => {
    const storage = new Map<string, string>();
    const firstPage = loadPage(hostname, storage);
    const first = await firstPage.client.prepare();

    assert.ok(first);
    assert.equal(storage.size, 1);

    const secondPage = loadPage(hostname, storage);
    const second = await secondPage.client.prepare();

    assert.ok(second);
    assert.equal(second.visitorToken, first.visitorToken);
    assert.equal(second.expiresAt, first.expiresAt);
    assert.equal(secondPage.requests[0].visitorToken, first.visitorToken);
  });
}

for (const hostname of ["www.66origin.com", "66origin.com"]) {
  test(`${hostname}: no recognition or storage write`, async () => {
    const storage = new Map<string, string>();
    const page = loadPage(hostname, storage);

    assert.equal(await page.client.prepare(), null);
    assert.equal(page.requests.length, 0);
    assert.equal(storage.size, 0);
  });
}
