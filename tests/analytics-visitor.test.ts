import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

type Visitor = {
  visitorToken: string;
  expiresAt: number;
};

type VisitorClient = {
  prepare(apiBase?: string): Promise<Visitor | null>;
};

const source = readFileSync("public/webflow/js/analytics-visitor.js", "utf8");

function setup() {
  const visitor: Visitor = {
    visitorToken: "test-token",
    expiresAt: Date.now() + 60_000,
  };

  const state = {
    saved: null as Visitor | null,
    saveAllowed: true,
    saveCalls: 0,
    lockCalls: 0,
    requests: [] as Array<{
      url: string;
      body: { visitorToken?: string };
    }>,
  };

  const browserWindow = {
    location: {
      hostname: "localhost",
      origin: "http://localhost:3000",
    },
    navigator: {
      locks: {
        async request(
          _name: string,
          _options: { signal: AbortSignal },
          callback: () => Promise<unknown>,
        ) {
          state.lockCalls++;
          return callback();
        },
      } as object | undefined,
    },
    OAnalyticsVisitorStorage: {
      read() {
        return state.saved;
      },
      save(value: Visitor) {
        state.saveCalls++;

        if (!state.saveAllowed) {
          return false;
        }

        state.saved = value;
        return true;
      },
    },
    OAnalyticsVisitor: undefined as VisitorClient | undefined,
  };

  const context = vm.createContext({
    window: browserWindow,
    AbortController,
    setTimeout,
    clearTimeout,
    async fetch(url: string, options: { body: string }) {
      state.requests.push({
        url,
        body: JSON.parse(options.body),
      });

      return {
        ok: true,
        async json() {
          return visitor;
        },
      };
    },
  });

  vm.runInContext(source, context);
  assert.ok(browserWindow.OAnalyticsVisitor);

  return {
    client: browserWindow.OAnalyticsVisitor,
    context,
    browserWindow,
    state,
    visitor,
  };
}

test("a new token is requested locally and saved before use", async () => {
  const { client, state, visitor } = setup();

  assert.deepEqual(await client.prepare(), visitor);
  assert.deepEqual(state.requests, [
    {
      url: "http://localhost:3000/api/v1/analytics/visitor",
      body: {},
    },
  ]);
  assert.equal(state.saveCalls, 1);
  assert.equal(state.lockCalls, 1);
});

test("an existing token is sent for verification without local renewal", async () => {
  const { client, state, visitor } = setup();
  state.saved = visitor;

  assert.deepEqual(await client.prepare(), visitor);
  assert.deepEqual(state.requests[0].body, {
    visitorToken: visitor.visitorToken,
  });
  assert.equal(state.saved.expiresAt, visitor.expiresAt);
});

test("production performs no request and no storage write", async () => {
  const { client, browserWindow, state } = setup();
  browserWindow.location.hostname = "www.66origin.com";

  assert.equal(await client.prepare(), null);
  assert.equal(state.requests.length, 0);
  assert.equal(state.saveCalls, 0);
  assert.equal(state.lockCalls, 0);
});

test("missing browser locks disable recognition", async () => {
  const { client, browserWindow, state } = setup();
  browserWindow.navigator.locks = undefined;

  assert.equal(await client.prepare(), null);
  assert.equal(state.requests.length, 0);
});

test("a failed storage write makes recognition unavailable", async () => {
  const { client, state } = setup();
  state.saveAllowed = false;

  assert.equal(await client.prepare(), null);
  assert.equal(state.saved, null);
});

test("HTTP and network errors are contained", async () => {
  const http = setup();

  http.context.fetch = async () => ({
    ok: false,
  });

  assert.equal(await http.client.prepare(), null);
  assert.equal(http.state.saveCalls, 0);

  const network = setup();

  network.context.fetch = async () => {
    throw new Error("Network unavailable");
  };

  assert.equal(await network.client.prepare(), null);
  assert.equal(network.state.saveCalls, 0);
});

test("simultaneous preparations share one API request", async () => {
  const { client, state, visitor } = setup();

  const results = await Promise.all([client.prepare(), client.prepare()]);

  assert.deepEqual(results, [visitor, visitor]);
  assert.equal(state.requests.length, 1);
  assert.equal(state.lockCalls, 1);
});

test("the timeout aborts a pending request without saving a token", async () => {
  const { client, context, state } = setup();
  let expire = () => {};
  let timeoutMs: number | undefined;

  context.setTimeout = (callback: () => void, milliseconds: number) => {
    expire = callback;
    timeoutMs = milliseconds;
    return 1;
  };

  context.clearTimeout = () => {};

  context.fetch = (_url: string, options: { signal: AbortSignal }) =>
    new Promise((_resolve, reject) => {
      options.signal.addEventListener(
        "abort",
        () => reject(new Error("Request aborted")),
        { once: true },
      );
    });

  const preparation = client.prepare();

  assert.equal(timeoutMs, 2000);
  expire();

  assert.equal(await preparation, null);
  assert.equal(state.saveCalls, 0);
});

for (const hostname of [
  "66origin-test.webflow.io",
  "ia66-api-analytics-test.vercel.app",
  "ia66-api-analytics-test-git-feat-254a10-christellebqns-projects.vercel.app",
]) {
  test(`${hostname} uses the supplied API address`, async () => {
    const { client, browserWindow, state, visitor } = setup();

    browserWindow.location.hostname = hostname;
    browserWindow.location.origin = `https://${hostname}`;

    const apiBase = "https://ia66-api-analytics-test.vercel.app";

    assert.deepEqual(await client.prepare(apiBase), visitor);
    assert.equal(state.requests.length, 1);
    assert.equal(state.requests[0].url, `${apiBase}/api/v1/analytics/visitor`);
    assert.equal(state.saveCalls, 1);
  });
}

for (const hostname of [
  "www.66origin.com",
  "66origin.com",
  "fakewebflow.io",
  "test.webflow.io.example.com",
]) {
  test(`${hostname} cannot enable recognition through an API address`, async () => {
    const { client, browserWindow, state } = setup();

    browserWindow.location.hostname = hostname;
    browserWindow.location.origin = `https://${hostname}`;

    assert.equal(
      await client.prepare("https://ia66-api-analytics-test.vercel.app"),
      null,
    );
    assert.equal(state.requests.length, 0);
    assert.equal(state.saveCalls, 0);
    assert.equal(state.lockCalls, 0);
  });
}
