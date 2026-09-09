import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireRagAdmin } from "@/lib/admin";
import {
  InvalidRagGenerationIdError,
  ragGenerationService,
} from "@/lib/rag/generation-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_GPT_ACTION_FILE_BYTES = 10 * 1024 * 1024;

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = requireRagAdmin(req);
  if (!admin.ok) {
    return NextResponse.json(
      { error: admin.error },
      { status: admin.status },
    );
  }

  try {
    const { id } = await context.params;
    const job = await ragGenerationService.get(id);
    if (!job) {
      return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    }
    if (!job.archiveFile) {
      return NextResponse.json(
        { error: "Archive is not available", status: job.status },
        { status: 409 },
      );
    }

    const archivePath = await ragGenerationService.getArchivePath(id);
    if (!archivePath) {
      return NextResponse.json({ error: "Archive not found" }, { status: 404 });
    }

    const archive = await fs.readFile(archivePath);
    const filename = path.basename(job.archiveFile);
    const format = new URL(req.url).searchParams.get("format");

    if (format === "raw") {
      return new Response(new Uint8Array(archive), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    if (archive.byteLength > MAX_GPT_ACTION_FILE_BYTES) {
      return NextResponse.json(
        {
          error: "Archive exceeds the GPT Action inline file limit",
          sizeBytes: archive.byteLength,
        },
        { status: 413 },
      );
    }

    return NextResponse.json({
      generationId: id,
      openaiFileResponse: [
        {
          name: filename,
          mime_type: "application/zip",
          content: archive.toString("base64"),
        },
      ],
    });
  } catch (error) {
    if (error instanceof InvalidRagGenerationIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
