import fs from "node:fs";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

const DEFAULT_ALLOWED_ROOT = path.join(process.cwd(), ".local", "artifacts");

const CONTENT_TYPES: Record<string, string> = {
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".html": "text/html; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8"
};

function configuredRoots() {
  const roots = (process.env.TALENT_ATS_ALLOWED_FILE_ROOTS ?? DEFAULT_ALLOWED_ROOT)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return roots.map((root) => (path.isAbsolute(root) ? root : path.join(process.cwd(), root)));
}

function isInsideRoot(filePath: string, root: string) {
  const relative = path.relative(root, filePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export async function GET(request: NextRequest) {
  const requestedPath = request.nextUrl.searchParams.get("path");
  if (!requestedPath) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const absolutePath = path.isAbsolute(requestedPath)
    ? requestedPath
    : path.join(process.cwd(), requestedPath);

  let filePath: string;
  try {
    filePath = fs.realpathSync(absolutePath);
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const allowedRoots = configuredRoots()
    .map((root) => {
      try {
        return fs.realpathSync(root);
      } catch {
        return null;
      }
    })
    .filter((root): root is string => Boolean(root));

  if (!allowedRoots.some((root) => isInsideRoot(filePath, root))) {
    return NextResponse.json({ error: "File is outside allowed roots" }, { status: 403 });
  }

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    return NextResponse.json({ error: "Path is not a file" }, { status: 404 });
  }

  const body = fs.readFileSync(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const headers = new Headers({
    "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
    "Content-Disposition": `inline; filename="${path.basename(filePath).replaceAll("\"", "")}"`
  });

  return new NextResponse(body, { headers });
}
