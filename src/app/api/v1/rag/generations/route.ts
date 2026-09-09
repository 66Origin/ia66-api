import { NextResponse } from "next/server";
import { requireRagAdmin } from "@/lib/admin";
import {
  ragGenerationService,
  type RagGenerationJob,
} from "@/lib/rag/generation-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicJob(job: RagGenerationJob) {
  const { archiveFile: _archiveFile, ...safeJob } = job;
  return { ...safeJob, archiveAvailable: Boolean(_archiveFile) };
}

export async function GET(req: Request) {
  const admin = requireRagAdmin(req);
  if (!admin.ok) {
    return NextResponse.json(
      { error: admin.error },
      { status: admin.status },
    );
  }

  const limit = Number.parseInt(new URL(req.url).searchParams.get("limit") ?? "10", 10);
  const jobs = await ragGenerationService.list(Number.isFinite(limit) ? limit : 10);
  return NextResponse.json({ generations: jobs.map(publicJob) });
}

export async function POST(req: Request) {
  const admin = requireRagAdmin(req);
  if (!admin.ok) {
    return NextResponse.json(
      { error: admin.error },
      { status: admin.status },
    );
  }

  const result = await ragGenerationService.start();
  if (!result.started) {
    return NextResponse.json(
      {
        error: "A generation is already running",
        generation: publicJob(result.job),
      },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { generation: publicJob(result.job) },
    { status: 202 },
  );
}
