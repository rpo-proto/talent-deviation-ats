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

export async function GET(request: NextRequest) {
  const requestedPath = request.nextUrl.searchParams.get("path");
  if (!requestedPath) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const absolutePath = path.isAbsolute(requestedPath)
    ? requestedPath
    : path.join(process.cwd(), requestedPath);

  // realpathSync normalizes the path and resolves symlinks, so the prefix check
  // against each realpath'd root below cannot be bypassed with ".." or symlinks.
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

  // The file is served inside the loop so every fs call is dominated by this root's
  // startsWith check: CodeQL only accepts that shape as a js/path-injection barrier,
  // so keep it inline rather than hoisting it into a helper or an array predicate.
  for (const root of allowedRoots) {
    if (!filePath.startsWith(root + path.sep)) {
      continue;
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

  return NextResponse.json({ error: "File is outside allowed roots" }, { status: 403 });
}
