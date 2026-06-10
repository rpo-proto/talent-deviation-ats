import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

import { getDashboardData } from "@/app/lib/data";

function exportDir() {
  const configured = process.env.TALENT_ATS_EXPORT_DIR ?? ".local/exports";
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

export async function POST() {
  const data = getDashboardData();
  const dir = exportDir();
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const filePath = path.join(dir, `${stamp}-talent-deviation-ats-snapshot.md`);
  const openNudges = data.nudges.filter((nudge) => nudge.status === "open");

  const lines = [
    "# Talent Deviation ATS Snapshot",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Pipeline",
    "",
    "| Candidate | Role | Stage | Source | Last Activity |",
    "|---|---|---|---|---|",
    ...data.candidates.map((candidate) =>
      `| ${candidate.name} | ${candidate.roleTitle} | ${candidate.stage} | ${candidate.source ?? ""} | ${candidate.lastActivityAt ?? ""} |`
    ),
    "",
    "## Open Nudges",
    "",
    ...openNudges.map((nudge) => `- **${nudge.owner}**: ${nudge.reason}${nudge.dueAt ? ` (${nudge.dueAt})` : ""}`),
    "",
    "## Recent Signal",
    "",
    ...data.recentSignal.slice(0, 25).map((event) => `- **${event.title}** — ${event.author ?? event.sourceLabel ?? event.sourceType}: ${event.body}`)
  ];

  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
  return NextResponse.json({ ok: true, filePath });
}
