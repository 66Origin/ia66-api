import assert from "node:assert/strict";
import test from "node:test";
import { requireRagExport } from "../src/lib/admin";

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
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });
}

test("refuse l’export lorsqu’aucune authentification n’est configurée", () => {
  const restoreEnvironment = useAuthEnvironment({});

  try {
    assert.deepEqual(requireRagExport(requestWithToken()), {
      ok: false,
      status: 503,
      error: "RAG export authentication is not configured",
    });
  } finally {
    restoreEnvironment();
  }
});

test("accepte le mot de passe de l’interface", () => {
  const restoreEnvironment = useAuthEnvironment({
    RAG_EXPORT_PASSWORD: "interface-password",
  });

  try {
    assert.deepEqual(
      requireRagExport(requestWithToken("interface-password")),
      { ok: true },
    );
  } finally {
    restoreEnvironment();
  }
});

test("accepte toujours le token administrateur RAG", () => {
  const restoreEnvironment = useAuthEnvironment({
    RAG_ADMIN_TOKEN: "rag-admin-token",
    RAG_EXPORT_PASSWORD: "interface-password",
  });

  try {
    assert.deepEqual(
      requireRagExport(requestWithToken("rag-admin-token")),
      { ok: true },
    );
  } finally {
    restoreEnvironment();
  }
});

test("refuse un token incorrect", () => {
  const restoreEnvironment = useAuthEnvironment({
    RAG_ADMIN_TOKEN: "rag-admin-token",
    RAG_EXPORT_PASSWORD: "interface-password",
  });

  try {
    assert.deepEqual(requireRagExport(requestWithToken("incorrect-token")), {
      ok: false,
      status: 401,
      error: "Unauthorized",
    });
  } finally {
    restoreEnvironment();
  }
});