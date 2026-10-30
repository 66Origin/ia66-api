import assert from "node:assert/strict";
import test from "node:test";
import { requireAdmin } from "../src/lib/admin";

// The two former RAG secrets are listed only to prove they are ignored.
const AUTH_ENV_KEYS = [
  "ADMIN_TOKEN",
  "RAG_ADMIN_TOKEN",
  "RAG_EXPORT_PASSWORD",
] as const;

type AuthEnvironment = Partial<
  Record<(typeof AUTH_ENV_KEYS)[number], string>
>;

function useAuthEnvironment(values: AuthEnvironment): () => void {
  const previousValues = new Map(
    AUTH_ENV_KEYS.map((key) => [key, process.env[key]]),
  );

  for (const key of AUTH_ENV_KEYS) {
    const value = values[key];

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return () => {
    for (const [key, value] of previousValues) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

function requestWithToken(token?: string): Request {
  return new Request("http://localhost/api/v1/rag/export", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

test("refuse tout lorsque ADMIN_TOKEN n’est pas configuré", () => {
  const restore = useAuthEnvironment({
    RAG_ADMIN_TOKEN: "rag-admin-token",
    RAG_EXPORT_PASSWORD: "interface-password",
  });

  try {
    for (const token of [undefined, "rag-admin-token", "interface-password"]) {
      assert.deepEqual(requireAdmin(requestWithToken(token)), {
        ok: false,
        status: 503,
        error: "Admin token is not configured",
      });
    }
  } finally {
    restore();
  }
});

test("accepte ADMIN_TOKEN", () => {
  const restore = useAuthEnvironment({ ADMIN_TOKEN: "admin-token" });

  try {
    assert.deepEqual(requireAdmin(requestWithToken("admin-token")), {
      ok: true,
    });
  } finally {
    restore();
  }
});

test("n’accepte plus les anciens secrets RAG", () => {
  const restore = useAuthEnvironment({
    ADMIN_TOKEN: "admin-token",
    RAG_ADMIN_TOKEN: "rag-admin-token",
    RAG_EXPORT_PASSWORD: "interface-password",
  });

  try {
    for (const token of [
      undefined,
      "rag-admin-token",
      "interface-password",
      "incorrect-token",
    ]) {
      assert.deepEqual(requireAdmin(requestWithToken(token)), {
        ok: false,
        status: 401,
        error: "Unauthorized",
      });
    }
  } finally {
    restore();
  }
});
