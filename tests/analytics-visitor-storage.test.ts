import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

type StoredVisitor = {
  visitorToken: string;
  expiresAt: number;
};

type VisitorStorage = {
  read(): StoredVisitor | null;
  save(value: unknown): boolean;
  clear(): void;
};

const source = readFileSync(
  "public/webflow/js/analytics-visitor-storage.js",
  "utf8",
);

const storageKey = "o.analytics.visitor.dev.v1";

function validVisitor(): StoredVisitor {
  const expiresAt = Date.now() + 60_000;

  return {
    visitorToken:
      `v1.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.${expiresAt}.` + "A".repeat(43),
    expiresAt,
  };
}

function setup(hostname = "localhost") {
  const entries = new Map<string, string>();

  const localStorage = {
    getItem(key: string) {
      return entries.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      entries.set(key, value);
    },
    removeItem(key: string) {
      entries.delete(key);
    },
  };

  const browserWindow = {
    location: { hostname },
    localStorage,
    OAnalyticsVisitorStorage: undefined as VisitorStorage | undefined,
  };

  vm.runInNewContext(source, {
    window: browserWindow,
    Date,
  });

  assert.ok(browserWindow.OAnalyticsVisitorStorage);

  return {
    entries,
    localStorage,
    storage: browserWindow.OAnalyticsVisitorStorage,
  };
}

test("missing storage returns no recognized visitor", () => {
  const { storage } = setup();

  assert.equal(storage.read(), null);
});

test("a visitor is saved and read with its original expiration", () => {
  const { storage, entries } = setup();
  const visitor = validVisitor();

  assert.equal(storage.save(visitor), true);
  assert.deepEqual(JSON.parse(JSON.stringify(storage.read())), visitor);
  assert.deepEqual(JSON.parse(entries.get(storageKey)!), visitor);

  assert.equal(storage.save(visitor), true);
  assert.deepEqual(JSON.parse(entries.get(storageKey)!), visitor);
});

test("expired entries are removed and cannot be saved", () => {
  const { storage, entries } = setup();
  const expiresAt = Date.now() - 1;
  const visitor = {
    visitorToken:
      `v1.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.${expiresAt}.` + "A".repeat(43),
    expiresAt,
  };

  entries.set(storageKey, JSON.stringify(visitor));

  assert.equal(storage.read(), null);
  assert.equal(entries.has(storageKey), false);
  assert.equal(storage.save(visitor), false);
});

test("malformed entries are removed without throwing", () => {
  const { storage, entries } = setup();
  const visitor = validVisitor();

  for (const raw of [
    "{invalid-json",
    "null",
    "{}",
    JSON.stringify({ ...visitor, visitorToken: "invalid" }),
    JSON.stringify({
      ...visitor,
      expiresAt: visitor.expiresAt + 1,
    }),
  ]) {
    entries.set(storageKey, raw);

    assert.equal(storage.read(), null);
    assert.equal(entries.has(storageKey), false);
  }
});

test("storage errors do not escape to the chat", () => {
  const { storage, localStorage } = setup();

  localStorage.getItem = () => {
    throw new Error("Storage unavailable");
  };
  localStorage.setItem = () => {
    throw new Error("Storage quota exceeded");
  };
  localStorage.removeItem = () => {
    throw new Error("Storage unavailable");
  };

  assert.equal(storage.read(), null);
  assert.equal(storage.save(validVisitor()), false);
  assert.doesNotThrow(() => storage.clear());
});

test("the production hostname never accesses storage", () => {
  let accesses = 0;

  const browserWindow = {
    location: { hostname: "www.66origin.com" },
    get localStorage(): never {
      accesses++;
      throw new Error("Unexpected storage access");
    },
    OAnalyticsVisitorStorage: undefined as VisitorStorage | undefined,
  };

  vm.runInNewContext(source, {
    window: browserWindow,
    Date,
  });

  const storage = browserWindow.OAnalyticsVisitorStorage;
  assert.ok(storage);

  assert.equal(storage.read(), null);
  assert.equal(storage.save(validVisitor()), false);
  storage.clear();

  assert.equal(accesses, 0);
});

test("127.0.0.1 supports storage and explicit removal", () => {
  const { storage, entries } = setup("127.0.0.1");

  assert.equal(storage.save(validVisitor()), true);

  storage.clear();

  assert.equal(entries.has(storageKey), false);
  assert.equal(storage.read(), null);
});
