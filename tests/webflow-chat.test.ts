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

const source = readFileSync("public/webflow/js/ia.js", "utf8");

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
    [
      "buildAnalyticsMetadata",
      "sendMessage",
      "handleSend",
    ],
    {
      API_BASE: "https://example.test",
      MAX_HISTORY: 20,
      history: [],
      isWaiting: false,
      iaStarted: false,
      ia: null,
      isGlobalIA: false,
      analyticsConversationId: null,
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

test("project links returned by the API are passed to the renderer", async () => {
  const links = [
    { label: "Bewiz", url: "https://www.66origin.com/works/bewiz" },
  ];
  let received: unknown;
  const { context } = chat({
    async fetch() {
      return {
        ok: true,
        async json() {
          return { text: "Bewiz", projectLinks: links };
        },
      };
    },
    async transformLoader(
      _loader: unknown,
      _text: string,
      _email: unknown,
      _sources: unknown,
      projectLinks: unknown,
    ) {
      received = projectLinks;
    },
  });
  await context.handleSend({ value: "Parle-moi de Bewiz" });
  assert.deepEqual(received, links);
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

test("a response renders immediately without a CMS project list", async (t) => {
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

    linkifyProjectsInElement() {},
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

  installFunctions(context, ["transformLoader"]);

  const pending = context.handleSend({ value: "Question" });

  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(textElement.innerHTML, "Réponse");
  await pending;

  assert.equal(context.isWaiting, false);
  assert.equal(context.history.at(-1)?.text, "Réponse");
});

test("analytics use a distinct request ID and a stable conversation ID", async () => {
  let nextId = 0;

  const { context, captured } = chat({
    ia: {
      getAttribute(name: string) {
        return name === "data-o-analytics" ? "true" : null;
      },
      classList: {
        contains() {
          return false;
        },
      },
    },
    window: {
      innerHeight: 800,
      crypto: {
        randomUUID() {
          nextId++;
          return `00000000-0000-4000-8000-${String(nextId).padStart(12, "0")}`;
        },
      },
    },
  });

  await context.handleSend({ value: "Question 1" });
  await context.handleSend({ value: "Question 2" });

  const requests = captured.requests as Array<{
    analytics?: {
      requestId: string;
      conversationId: string;
      placement: string;
    };
  }>;

  const first = requests[0].analytics;
  const second = requests[1].analytics;

  assert.ok(first);
  assert.ok(second);
  assert.notEqual(first.requestId, second.requestId);
  assert.equal(first.conversationId, second.conversationId);
  assert.equal(first.placement, "home");
  assert.equal(second.placement, "home");
  assert.deepEqual(Object.keys(first).sort(), [
    "conversationId",
    "placement",
    "requestId",
  ]);
});

test("UUID generation failure does not prevent sending a message", async () => {
  const { context, captured } = chat({
    ia: {
      getAttribute() {
        return "true";
      },
      classList: {
        contains() {
          return false;
        },
      },
    },
    window: {
      innerHeight: 800,
      crypto: {
        randomUUID() {
          throw new Error("UUID unavailable");
        },
      },
    },
  });

  await context.handleSend({ value: "Question" });

  assert.equal(captured.requests.length, 1);
  assert.equal("analytics" in captured.requests[0], false);
  assert.deepEqual(captured.rendered, ["Réponse"]);
  assert.equal(context.isWaiting, false);
});

test("the chat script stores nothing on the visitor's device", () => {
  for (const api of ["localStorage", "sessionStorage", "indexedDB", "document.cookie"]) {
    assert.equal(source.includes(api), false, `${api} must not be used`);
  }
});

test("form submission is handled without reaching Webflow's form handler", async () => {
  type Listener = (event: unknown) => Promise<void> | void;

  function element() {
    const listeners = new Map<string, Listener>();

    return {
      listeners,
      addEventListener(type: string, listener: Listener) {
        listeners.set(type, listener);
      },
    };
  }

  const sent: unknown[] = [];

  const context = loadFunctions<
    vm.Context & {
      bindInput: (textarea: unknown, button: unknown, form: unknown) => void;
    }
  >(["bindInput"], {
    introTextarea: null,
    async handleSend(textarea: unknown) {
      sent.push(textarea);
    },
    autoResizeTextarea() {},
    updateCaretState() {},
    updateTypewriterState() {},
  });

  const textarea = element();
  const button = element();
  const form = element();

  context.bindInput(textarea, button, form);

  const calls: string[] = [];

  await form.listeners.get("submit")?.({
    preventDefault() {
      calls.push("preventDefault");
    },
    stopPropagation() {
      calls.push("stopPropagation");
    },
  });

  assert.deepEqual(calls, ["preventDefault", "stopPropagation"]);
  assert.deepEqual(sent, [textarea]);
});
