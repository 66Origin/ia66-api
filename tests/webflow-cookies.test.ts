import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

type Listener = (event?: unknown) => void;

function element(attributes: Record<string, string> = {}) {
  const listeners: Record<string, Listener[]> = {};
  const classes = new Set<string>();

  return {
    textContent: "",
    href: attributes.href ?? "",
    getAttribute: (name: string) => attributes[name] ?? null,
    addEventListener(type: string, listener: Listener) {
      (listeners[type] ??= []).push(listener);
    },
    click() {
      for (const listener of listeners.click ?? []) listener();
    },
    classList: {
      add: (...names: string[]) => names.forEach((n) => classes.add(n)),
      remove: (...names: string[]) => names.forEach((n) => classes.delete(n)),
      contains: (name: string) => classes.has(name),
    },
  };
}

function run({
  cookies = {} as Record<string, string>,
  infoHref = "",
  hostname = "www.66origin.com",
} = {}) {
  const jar = new Map(Object.entries(cookies));
  const writes: string[] = [];
  const documentListeners: Record<string, Listener[]> = {};
  const dataLayer: unknown[] = [];

  const elements: Record<string, ReturnType<typeof element>> = {
    "consent-text": element(),
    "btn-accept": element(),
    "btn-refuse": element(),
    "analytics-info-link": element({ href: infoHref }),
    "consent-banner": element(),
    "consent-banner-close": element(),
  };

  const document = {
    readyState: "complete",
    get cookie() {
      return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
    },
    set cookie(value: string) {
      writes.push(value);
      const [pair] = value.split(";");
      const [name, content] = pair.split("=");

      if (value.includes("expires=Thu, 01 Jan 1970")) jar.delete(name);
      else jar.set(name, content);
    },
    getElementById: (id: string) => elements[id],
    addEventListener(type: string, listener: Listener) {
      (documentListeners[type] ??= []).push(listener);
    },
  };

  const context = vm.createContext({
    document,
    window: { location: { pathname: "/", hostname }, dataLayer },
    requestAnimationFrame: (callback: () => void) => callback(),
    setTimeout: () => 0,
  });

  vm.runInContext(
    readFileSync("public/webflow/js/cookies.js", "utf8"),
    context,
  );

  const clickOn = (matches: boolean) => {
    let prevented = false;
    const event = {
      target: { closest: () => (matches ? {} : null) },
      preventDefault: () => {
        prevented = true;
      },
    };

    for (const listener of documentListeners.click ?? []) listener(event);
    return prevented;
  };

  return { jar, writes, elements, dataLayer, clickOn };
}

test("the Webflow link to the privacy policy is kept", () => {
  const { elements } = run({ infoHref: "/politique-de-confidentialite#cookies" });

  assert.equal(
    elements["analytics-info-link"].href,
    "/politique-de-confidentialite#cookies",
  );
});

test("Google's page is used while the Webflow link is empty", () => {
  const { elements } = run({ infoHref: "#" });

  assert.match(elements["analytics-info-link"].href, /support\.google\.com/);
});

test("a manage-cookies link reopens the banner after a choice", () => {
  const { elements, clickOn } = run({ cookies: { cookie_consent: "granted" } });
  const banner = elements["consent-banner"];

  assert.equal(banner.classList.contains("is-visible"), false);
  assert.equal(clickOn(false), false);
  assert.equal(banner.classList.contains("is-visible"), false);

  assert.equal(clickOn(true), true);
  assert.equal(banner.classList.contains("is-visible"), true);
});

test("refusing deletes the Google Analytics cookies on every domain", () => {
  const { jar, writes, elements, dataLayer } = run({
    cookies: {
      cookie_consent: "granted",
      _ga: "GA1.1.1",
      _ga_ABC123: "GS1.1.1",
      other: "kept",
    },
  });

  elements["btn-refuse"].click();

  assert.equal(jar.get("cookie_consent"), "denied");
  assert.equal(jar.has("_ga"), false);
  assert.equal(jar.has("_ga_ABC123"), false);
  assert.equal(jar.get("other"), "kept");
  assert.ok(
    writes.some((w) => w.startsWith("_ga=;") && w.endsWith("domain=.66origin.com")),
  );
  assert.deepEqual(JSON.parse(JSON.stringify(dataLayer.at(-1))), {
    event: "consent_update",
    analytics_storage: "denied",
  });
});

test("accepting keeps the Google Analytics cookies", () => {
  const { jar, elements } = run({ cookies: { _ga: "GA1.1.1" } });

  elements["btn-accept"].click();

  assert.equal(jar.get("cookie_consent"), "granted");
  assert.equal(jar.get("_ga"), "GA1.1.1");
});
