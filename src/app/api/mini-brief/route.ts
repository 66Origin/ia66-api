import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  if (!body?.description || typeof body.description !== "string") {
    return NextResponse.json(
      { error: "Missing 'description' (string)" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    miniBrief: {
      resume: "Stub V1 — endpoint OK",
      objectifs: [],
      livrables: [],
      planning_estime: "",
    },
    similarCases: [],
    pitchAgence: "",
  });
}
