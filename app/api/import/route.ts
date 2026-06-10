import { NextResponse } from "next/server";

import { importNormalized } from "@/app/lib/importer";
import type { NormalizedImport } from "@/app/lib/types";

export async function POST(request: Request) {
  const payload = (await request.json()) as NormalizedImport;
  const result = importNormalized(payload);
  return NextResponse.json({ ok: true, result });
}
