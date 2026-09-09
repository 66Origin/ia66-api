import { NextResponse } from "next/server";
import { requireRagAdmin } from "@/lib/admin";
import {
  InvalidRagGenerationIdError,
  ragGenerationService,
  type RagGenerationJob,
} from "@/lib/rag/generation-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicJob(job: RagGenerationJob) {
  const { archiveFile: _archiveFile, ...safeJob } = job;
  return { ...safeJob, archiveAvailable: Boolean(_archiveFile) };
}

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

    return NextResponse.json({ generation: publicJob(job) });
  } catch (error) {
    if (error instanceof InvalidRagGenerationIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
