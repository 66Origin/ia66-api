import { NextResponse } from "next/server";
import { requireRagAdmin } from "@/lib/admin";
import { ragExportService } from "@/lib/rag/export-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Base64 adds roughly 33%; keep the JSON response below Vercel's 4.5 MB limit.
const MAX_INLINE_ARCHIVE_BYTES = 3 * 1024 * 1024;

export async function POST(req: Request) {
  const admin = requireRagAdmin(req);
  if (!admin.ok) {
    return NextResponse.json(
      { error: admin.error },
      { status: admin.status },
    );
  }

  try {
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
  }
}
