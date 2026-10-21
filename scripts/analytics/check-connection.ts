import { config } from "dotenv";
import {
  closeAnalyticsPool,
  getAnalyticsPool,
} from "../../src/lib/analytics/db";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

async function main() {
  try {
    const result = await getAnalyticsPool().query<{ ok: number }>(
      "SELECT 1 AS ok",
    );

    if (result.rows[0]?.ok !== 1) {
      throw new Error("Unexpected database response.");
    }

    console.log("Analytics database connection: OK");
  } finally {
    await closeAnalyticsPool();
  }
}

main().catch((error: unknown) => {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "CHECK_FAILED";

  console.error(`Analytics database connection: FAILED (${code})`);
  process.exitCode = 1;
});
