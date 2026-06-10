import fs from "node:fs";
import path from "node:path";

import { parse } from "csv-parse/sync";

import { importNormalized } from "../app/lib/importer";
import type { NormalizedImport } from "../app/lib/types";

const rosterPath = process.argv[2];

if (!rosterPath) {
  console.error("Usage: npm run seed:roster -- /absolute/path/to/private-roster.csv");
  process.exit(1);
}
const absolutePath = path.isAbsolute(rosterPath) ? rosterPath : path.join(process.cwd(), rosterPath);
const csv = fs.readFileSync(absolutePath, "utf8");
const rows = parse(csv, { columns: true, skip_empty_lines: true }) as Array<Record<string, string>>;

const stageMap = (stage: string) => {
  const value = stage.toLowerCase();
  if (value.includes("declined")) return "Declined";
  if (value.includes("case study received") || value.includes("eval")) return "Case Study Review";
  if (value.includes("case study sent")) return "Case Study";
  if (value.includes("approved") || value.includes("under review") || value.includes("awaiting")) return "Internal Triage";
  if (value.includes("nda")) return "Internal Triage";
  return "Intake";
};

const payload: NormalizedImport = {
  sourceBatch: {
    id: `local-roster-${new Date().toISOString().slice(0, 10)}`,
    label: "Private hiring roster CSV",
    importedBy: "seed-local-roster",
    sourceType: "local_file"
  },
  candidates: rows.map((row) => ({
    externalId: row.Candidate?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    name: row.Candidate,
    role: row.Role === "Engineer" ? "Product Engineer" : "Product Designer",
    source: row.Source,
    stage: stageMap(row.Stage ?? ""),
    status: (row.Stage ?? "").toLowerCase().includes("declined") ? "declined" : "active",
    retained: stageMap(row.Stage ?? "") === "Case Study" || stageMap(row.Stage ?? "") === "Case Study Review",
    lastActivityAt: row["Last Update"] ? `${row["Last Update"]}T12:00:00.000Z` : undefined
  })),
  events: rows
    .filter((row) => row["Notes / Decline Reason"])
    .map((row) => ({
      candidateExternalId: row.Candidate?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      candidateName: row.Candidate,
      role: row.Role === "Engineer" ? "Product Engineer" : "Product Designer",
      occurredAt: row["Last Update"] ? `${row["Last Update"]}T12:00:00.000Z` : undefined,
      sourceType: "local_file",
      sourceLabel: "_roster.csv",
      title: "Roster note",
      body: row["Notes / Decline Reason"],
      evidenceWeight: 0.45
    }))
};

const result = importNormalized(payload);
console.log(JSON.stringify(result, null, 2));
