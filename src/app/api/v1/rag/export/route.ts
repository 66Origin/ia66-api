import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireRagExport } from "@/lib/admin";
import { ragExportService } from "@/lib/rag/export-service";
import { redis } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Base64 adds roughly 33%; keep the JSON response below Vercel's 4.5 MB limit.
const MAX_INLINE_ARCHIVE_BYTES = 3 * 1024 * 1024;

const EXPORT_LOCK_KEY = "rag:export:lock";
const EXPORT_LOCK_DURATION_SECONDS = 75;

export async function POST(req: Request) {
  const authorization = requireRagExport(req);

  if (!authorization.ok) {
    return NextResponse.json(
      { error: authorization.error },
      { status: authorization.status },
    );
  }

  const lockId = randomUUID();
  let lockAcquired = false;

  try {
    const lockResult = await redis.set(EXPORT_LOCK_KEY, lockId, {
      nx: true,
      ex: EXPORT_LOCK_DURATION_SECONDS,
    });

    if (lockResult !== "OK") {
      return NextResponse.json(
        {
          error: "RAG export already in progress",
        },
        { status: 409 },
      );
    }

    lockAcquired = true;

    const result = await ragExportService.run();
    const format = new URL(req.url).searchParams.get("format");

    if (format === "raw") {
      return new Response(new Uint8Array(result.archive), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${result.filename}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    if (result.archive.byteLength > MAX_INLINE_ARCHIVE_BYTES) {
      return NextResponse.json(
        {
          error: "Archive exceeds the Vercel inline response safety limit",
          sizeBytes: result.archive.byteLength,
          report: result.report,
        },
        { status: 413 },
      );
    }

    return NextResponse.json({
      export: {
        id: result.id,
        status:
          result.report.failed > 0 ? "completed_with_errors" : "completed",
        archiveSizeBytes: result.archive.byteLength,
        report: result.report,
      },
      openaiFileResponse: [
        {
          name: result.filename,
          mime_type: "application/zip",
          content: result.archive.toString("base64"),
        },
      ],
    });
  } catch (error) {
    console.error("RAG export failed", error);
    return NextResponse.json(
      {
        error: "RAG export failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  } finally {
    if (lockAcquired) {
      try {
        const currentLock = await redis.get<string>(EXPORT_LOCK_KEY);

        if (currentLock === lockId) {
          await redis.del(EXPORT_LOCK_KEY);
        }
      } catch (error) {
        console.error("Unable to release RAG export lock", error);
      }
    }
  }
}
