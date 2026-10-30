import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

// The scripts must start whether they are loaded before the DOM is ready
// (defer) or after it (late or dynamic loading).
const SCRIPTS = ["menu", "videos", "ia"] as const;

function run(name: (typeof SCRIPTS)[number], readyState: string) {
  const listeners: Array<() => void> = [];
  const queried: string[] = [];

  const document = {
    readyState,
    addEventListener(type: string, listener: () => void) {
      if (type === "DOMContentLoaded") listeners.push(listener);
    },
    querySelector(selector: string) {
      queried.push(selector);
      return null;
    },
    querySelectorAll(selector: string) {
      queried.push(selector);
      return [];
    },
    getElementById(id: string) {
      queried.push(`#${id}`);
      return null;
    },
  };

  const context = vm.createContext({
    document,
    window: { matchMedia: () => ({ matches: false }) },
  });

  vm.runInContext(
    readFileSync(`public/webflow/js/${name}.js`, "utf8"),
    context,
  );

  return { listeners, queried };
}

for (const name of SCRIPTS) {
  test(`${name}.js starts immediately when the DOM is already ready`, () => {
    const { listeners, queried } = run(name, "complete");

    assert.equal(listeners.length, 0);
    assert.ok(queried.length > 0, "the script did not look for its elements");
  });

  test(`${name}.js waits for DOMContentLoaded while the page loads`, () => {
    const { listeners, queried } = run(name, "loading");

    assert.equal(listeners.length, 1);
    assert.equal(queried.length, 0);

    listeners[0]();
    assert.ok(queried.length > 0, "the script did not start after the event");
  });
}
