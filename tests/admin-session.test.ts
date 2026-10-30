import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createAdminSessionToken,
  isAdminAccessConfigured,
  safeAdminRedirect,
  verifyAdminPassword,
  verifyAdminSessionToken,
} from "../src/lib/admin-session";

const SECRET = "s".repeat(32);

function withAdminEnvironment(
  values: { password?: string; secret?: string },
  operation: () => void,
) {
  const previous = {
    password: process.env.ADMIN_PASSWORD,
    secret: process.env.ADMIN_SESSION_SECRET,
  };

  const set = (name: string, value: string | undefined) => {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  };

  set("ADMIN_PASSWORD", values.password);
  set("ADMIN_SESSION_SECRET", values.secret);

  try {
    operation();
  } finally {
    set("ADMIN_PASSWORD", previous.password);
    set("ADMIN_SESSION_SECRET", previous.secret);
  }
}

test("access is refused when the configuration is incomplete", () => {
  for (const values of [
    {},
    { password: "mot-de-passe" },
    { secret: SECRET },
    { password: "mot-de-passe", secret: "trop-court" },
  ]) {
    withAdminEnvironment(values, () => {
      assert.equal(isAdminAccessConfigured(), false);
      assert.equal(verifyAdminPassword("mot-de-passe"), false);
      assert.equal(verifyAdminSessionToken("v1.9999999999999.signature"), false);
    });
  }
});

test("only the configured password is accepted", () => {
  withAdminEnvironment({ password: "mot-de-passe", secret: SECRET }, () => {
    assert.equal(isAdminAccessConfigured(), true);
    assert.equal(verifyAdminPassword("mot-de-passe"), true);

    for (const candidate of ["", "mot-de-pass", "MOT-DE-PASSE", null, 42, "x".repeat(600)]) {
      assert.equal(verifyAdminPassword(candidate), false);
    }
  });
});

test("a session token is valid until it expires", () => {
  withAdminEnvironment({ password: "mot-de-passe", secret: SECRET }, () => {
    const now = Date.UTC(2026, 9, 30, 12);
    const token = createAdminSessionToken(now);

    assert.equal(verifyAdminSessionToken(token, now), true);
    assert.equal(verifyAdminSessionToken(token, now + 8 * 3600 * 1000 - 1), true);
    assert.equal(verifyAdminSessionToken(token, now + 8 * 3600 * 1000), false);
  });
});

test("a tampered or foreign token is rejected", () => {
  let token = "";

  withAdminEnvironment({ password: "mot-de-passe", secret: SECRET }, () => {
    token = createAdminSessionToken();
    const [version, expiresAt, signature] = token.split(".");
    const later = String(Number(expiresAt) + 3600 * 1000);
    const lastCharacter = signature.at(-1) === "A" ? "E" : "A";

    for (const candidate of [
      `${version}.${later}.${signature}`,
      `${version}.${expiresAt}.${signature.slice(0, -1)}${lastCharacter}`,
      `v2.${expiresAt}.${signature}`,
      "",
      undefined,
    ]) {
      assert.equal(verifyAdminSessionToken(candidate), false);
    }
  });

  // A token signed with another secret is not accepted.
  withAdminEnvironment({ password: "mot-de-passe", secret: "t".repeat(32) }, () => {
    assert.equal(verifyAdminSessionToken(token), false);
  });
});

test("redirects stay inside the administration section", () => {
  for (const [target, expected] of [
    ["/admin/analytics", "/admin/analytics"],
    ["/admin/analytics?period=3m", "/admin/analytics?period=3m"],
    ["/admin/analytics/questions?reason=unclassifiable", "/admin/analytics/questions?reason=unclassifiable"],
    ["/admin/login", "/admin"],
    ["https://example.com/admin", "/admin"],
    ["//example.com", "/admin"],
    ["/admin/../api/v1/chat", "/admin"],
    ["/administrator", "/admin"],
    [null, "/admin"],
  ] as const) {
    assert.equal(safeAdminRedirect(target), expected);
  }
});
