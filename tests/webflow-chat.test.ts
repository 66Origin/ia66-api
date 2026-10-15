import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

type HistoryItem = {
  role: "user" | "assistant";
  text: string;
};

type ChatInput = {
  value: string;
  blur?: () => void;
};

type ChatRequest = {
  message: string;
  conversation: {
    history: HistoryItem[];
  };
};

type ChatContext = vm.Context & {
  isWaiting: boolean;
  history: HistoryItem[];
  handleSend: (input: ChatInput) => Promise<void>;
};

type ProjectsContext = vm.Context & {
  waitForProjects: () => Promise<void>;
};

type Project = {
  name: string;
  slug: string;
};

const source = readFileSync("public/webflow/js/ia.js", "utf8");

// Teste les fonctions réelles du module avec des dépendances simulées.
function installFunctions(context: vm.Context, names: string[]): void {
  for (const name of names) {
    const match = new RegExp(`^  (?:async )?function ${name}\\(`, "m").exec(
      source,
    );

    assert.ok(match, `Missing function ${name}`);

    const closingBrace = source.indexOf("\n  }\n", match.index);
    assert.notEqual(closingBrace, -1, `Missing closing brace for ${name}`);

    vm.runInContext(source.slice(match.index, closingBrace + 5), context);
  }
}

function loadFunctions<T extends object>(
  names: string[],
  globals: Record<string, unknown>,
): vm.Context & T {
  const context = vm.createContext({
    Error,
    TypeError,
    ...globals,
  });

  installFunctions(context, names);

  return context as vm.Context & T;
}

function chat(overrides: Record<string, unknown> = {}) {
  const captured = {
    requests: [] as ChatRequest[],
    fallback: [] as string[],
    rendered: [] as string[],
    removed: 0,
  };

  const context: ChatContext = loadFunctions<ChatContext>(
    ["sendMessage", "handleSend"],
    {
      API_BASE: "https://example.test",
      MAX_HISTORY: 20,
      history: [],
      isWaiting: false,
      iaStarted: false,
      ia: null,
      chatShell: { style: {}, scrollHeight: 100 },
      window: { innerHeight: 800 },
      setTimeout,

      setWaiting(value: boolean) {
        context.isWaiting = value;
      },
      startChatMode() {},
      addUserMessage() {
        return {};
      },
      isMobile() {
        return false;
      },
      storeMessage(role: HistoryItem["role"], text: string) {
        context.history.push({ role, text });
      },
      resetTextarea(input: ChatInput) {
        input.value = "";
      },
      updateTypewriterState() {},
      updateCaretState() {},
      async scrollToMessage() {},

      addBotLoader() {
        return {
          remove() {
            captured.removed++;
          },
        };
      },

      async fetch(_url: string, options: { body: string }) {
        captured.requests.push(JSON.parse(options.body) as ChatRequest);

        return {
          ok: true,
          async json() {
            return { text: "Réponse" };
          },
        };
      },

      async transformLoader(_loader: unknown, text: string) {
        captured.rendered.push(text);
        context.history.push({ role: "assistant", text });
      },

      async addBotMessage(text: string) {
        captured.fallback.push(text);
      },

      ...overrides,
    },
  );

  return { context, captured };
}

test("each request contains the current question once and only prior history", async () => {
  const { context, captured } = chat();

  await context.handleSend({ value: "Question 1" });
  await context.handleSend({ value: "Question 2" });

  assert.deepEqual(captured.requests, [
    {
      message: "Question 1",
      conversation: { history: [] },
    },
    {
      message: "Question 2",
      conversation: {
        history: [
          { role: "user", text: "Question 1" },
          { role: "assistant", text: "Réponse" },
        ],
      },
    },
  ]);

  assert.equal(context.isWaiting, false);
});

test("a pending request or rendering prevents a second submission", async () => {
  let finish: (() => void) | undefined;

  const { context, captured } = chat({
    transformLoader() {
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    },
  });

  const first = context.handleSend({ value: "Question" });

  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(context.isWaiting, true);

  await context.handleSend({ value: "Double clic" });

  assert.equal(captured.requests.length, 1);
  assert.ok(finish);

  finish();
  await first;

  assert.equal(context.isWaiting, false);
});

test("mobile submission blurs the keyboard and sends only previous history", async () => {
  let blurred = false;
  let resized = false;

  const { context, captured } = chat({
    isMobile() {
      return true;
    },
    fillRemainingSpaceAfterScroll() {
      resized = true;
    },
  });

  await context.handleSend({
    value: "Question mobile",
    blur() {
      blurred = true;
    },
  });

  assert.equal(blurred, true);
  assert.equal(resized, true);
  assert.deepEqual(captured.requests[0].conversation.history, []);
  assert.equal(context.isWaiting, false);
});

const httpCases: Array<[number, RegExp]> = [
  [429, /limite de demandes/],
  [400, /invalide/],
  [500, /souci technique/],
];

for (const [status, expected] of httpCases) {
  test(`HTTP ${status} is handled even without a JSON body`, async () => {
    const { context, captured } = chat({
      async fetch() {
        return {
          ok: false,
          status,
          json() {
            throw new Error("Not JSON");
          },
        };
      },
    });

    await context.handleSend({ value: "Question" });

    assert.match(captured.fallback[0], expected);
    assert.equal(captured.removed, 1);
    assert.equal(context.isWaiting, false);
  });
}

const failureCases: Array<[string, Record<string, unknown>, RegExp]> = [
  [
    "network failure",
    {
      async fetch() {
        throw new TypeError("Failed to fetch");
      },
    },
    /connexion au service/,
  ],
  [
    "empty response",
    {
      async fetch() {
        return {
          ok: true,
          async json() {
            return { text: " " };
          },
        };
      },
    },
    /contexte/,
  ],
  [
    "invalid response",
    {
      async fetch() {
        return {
          ok: true,
          async json() {
            return { text: 42 };
          },
        };
      },
    },
    /contexte/,
  ],
  [
    "rendering failure",
    {
      async transformLoader() {
        throw new TypeError("DOM failure");
      },
    },
    /souci technique/,
  ],
];

for (const [name, overrides, expected] of failureCases) {
  test(`${name} shows the appropriate message and unlocks inputs`, async () => {
    const { context, captured } = chat(overrides);

    await context.handleSend({ value: "Question" });

    assert.match(captured.fallback[0], expected);
    assert.equal(context.isWaiting, false);
  });
}

test("inputs unlock even if fallback rendering fails", async () => {
  const { context } = chat({
    async fetch() {
      throw new Error("offline");
    },
    async addBotMessage() {
      throw new Error("render failed");
    },
  });

  await assert.rejects(
    context.handleSend({ value: "Question" }),
    /render failed/,
  );

  assert.equal(context.isWaiting, false);
});

const projectCases: Array<[string, Project[] | undefined]> = [
  ["absent", undefined],
  ["empty", []],
];

for (const [name, projects] of projectCases) {
  test(`project wait ends when the CMS list is ${name}`, async (t) => {
    t.mock.timers.enable({
      apis: ["setTimeout", "setInterval"],
    });

    const context = loadFunctions<ProjectsContext>(["waitForProjects"], {
      window: { PROJECTS: projects },
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,
    });

    let finished = false;

    const pending = context.waitForProjects().then(() => {
      finished = true;
    });

    t.mock.timers.tick(999);
    await Promise.resolve();

    assert.equal(finished, false);

    t.mock.timers.tick(1);
    await pending;

    assert.equal(finished, true);
  });
}

test("project wait resolves as soon as a delayed CMS list is available", async (t) => {
  t.mock.timers.enable({
    apis: ["setTimeout", "setInterval"],
  });

  const window: { PROJECTS?: Project[] } = {};

  const context = loadFunctions<ProjectsContext>(["waitForProjects"], {
    window,
    setTimeout,
    setInterval,
    clearTimeout,
    clearInterval,
  });

  const pending = context.waitForProjects();

  window.PROJECTS = [{ name: "Bewiz", slug: "bewiz" }];

  t.mock.timers.tick(50);
  await pending;
});

test("a response renders without projects and the chat unlocks after the bounded wait", async (t) => {
  t.mock.timers.enable({
    apis: ["setTimeout", "setInterval"],
  });

  const textElement = { innerHTML: "" };

  const { context } = chat({
    window: {},
    setTimeout,
    setInterval,
    clearTimeout,
    clearInterval,

    addBotLoader() {
      return {
        querySelector(selector: string) {
          return selector === ".ia66o-chat-message"
            ? { classList: { remove() {} } }
            : textElement;
        },
        remove() {},
      };
    },

    formatMessage(text: string) {
      return text;
    },
    renderSources() {
      return "";
    },
    requestAnimationFrame(callback: () => void) {
      callback();
    },
    resetChatHeightWithBars() {},
    isUserNearBottom: false,
    enableInputCaret() {},
  });

  installFunctions(context, [
    "waitForProjects",
    "linkifyProjectsInElement",
    "transformLoader",
  ]);

  const pending = context.handleSend({ value: "Question" });

  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(textElement.innerHTML, "Réponse");
  assert.equal(context.isWaiting, true);

  t.mock.timers.tick(1000);
  await pending;

  assert.equal(context.isWaiting, false);
  assert.equal(context.history.at(-1)?.text, "Réponse");
});
