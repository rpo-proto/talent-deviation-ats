import fs from "node:fs";
import path from "node:path";

import { getDb } from "../app/lib/db";

type CandidateRow = {
  id: string;
  external_id: string | null;
  name: string;
  role_title: string;
  email: string | null;
  linkedin_url: string | null;
  source: string | null;
  stage: string;
  status: string;
  retained: number;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
};

type EvidenceRow = {
  occurred_at: string;
  source_type: string;
  source_label: string | null;
  source_url: string | null;
  title: string;
  body: string;
  author: string | null;
  evidence_weight: number;
};

type ScorecardRow = {
  reviewer: string;
  reviewer_type: string;
  rubric: string;
  scores_json: string;
  summary: string;
  recommendation: string | null;
  created_at: string;
};

type NudgeRow = {
  owner: string;
  reason: string;
  due_at: string | null;
  status: string;
  created_at: string;
};

type LocalArtifact = {
  path: string;
  relativePath: string;
  basename: string;
  extension: string;
};

const DEFAULT_PACKET_DIR = path.join(process.cwd(), ".local", "candidate-profiles");

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value.replace(/^['"]|['"]$/g, "");
    }
  }
}

function resolvePath(value: string) {
  return path.isAbsolute(value) ? value : path.join(process.cwd(), value);
}

function packetRoot() {
  const configured = process.env.TALENT_ATS_CANDIDATE_PACKET_DIR;
  if (configured) return resolvePath(configured);

  const exportDir = process.env.TALENT_ATS_EXPORT_DIR;
  if (exportDir) return path.join(path.dirname(resolvePath(exportDir)), "_ats-candidate-profiles");

  return DEFAULT_PACKET_DIR;
}

function hiringRootForPackets(root: string) {
  const envRoot = process.env.TALENT_ATS_HIRING_ROOT;
  if (envRoot) return resolvePath(envRoot);
  return path.basename(root) === "_ats-candidate-profiles" ? path.dirname(root) : root;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function candidateTokens(candidate: CandidateRow) {
  return candidate.name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !["and", "the", "full", "stack"].includes(token));
}

function fileUrl(filePath: string) {
  return `/api/private-file?path=${encodeURIComponent(filePath)}`;
}

function walkFiles(root: string, skipRoot: string) {
  const files: LocalArtifact[] = [];
  if (!fs.existsSync(root)) return files;

  const visit = (dir: string) => {
    if (path.resolve(dir) === path.resolve(skipRoot)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        visit(fullPath);
        continue;
      }
      if (!entry.isFile() || entry.name === ".DS_Store") continue;
      const extension = path.extname(entry.name).toLowerCase();
      if (![".doc", ".docx", ".gdoc", ".html", ".md", ".pdf", ".txt"].includes(extension)) continue;
      files.push({
        path: fullPath,
        relativePath: path.relative(root, fullPath),
        basename: entry.name,
        extension
      });
    }
  };

  visit(root);
  return files;
}

function artifactMatchesCandidate(artifact: LocalArtifact, candidate: CandidateRow) {
  const slug = slugify(candidate.name);
  const haystack = `${artifact.relativePath} ${artifact.basename}`.toLowerCase();
  if (haystack.includes(slug)) return true;

  const tokens = candidateTokens(candidate);
  if (tokens.length === 1) return tokens[0].length >= 5 && haystack.includes(tokens[0]);
  if (tokens.length < 2) return false;
  return tokens.every((token) => haystack.includes(token));
}

function isCaseStudyArtifact(artifact: LocalArtifact) {
  const name = artifact.basename.toLowerCase();
  const normalizedName = name.replace(/[^a-z0-9]+/g, " ");
  return (
    normalizedName.includes("case study") ||
    normalizedName.includes("rationale") ||
    normalizedName.includes("prototype")
  );
}

function pickResume(artifacts: LocalArtifact[]) {
  const ranked = artifacts
    .filter((artifact) => [".doc", ".docx", ".pdf"].includes(artifact.extension))
    .filter((artifact) => !isCaseStudyArtifact(artifact))
    .map((artifact) => {
      const name = artifact.basename.toLowerCase();
      let score = 0;
      if (name.includes("resume") || name.includes("cv")) score += 4;
      if (name.includes("lhh")) score += 3;
      if (artifact.extension === ".pdf") score += 2;
      if (artifact.extension === ".docx") score += 1;
      return { artifact, score };
    })
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.artifact;
}

function markdownLink(label: string, href: string) {
  return `[${label}](${href.replaceAll(" ", "%20")})`;
}

function renderProfile({
  artifacts,
  candidate,
  events,
  nudges,
  resume,
  scorecards
}: {
  artifacts: LocalArtifact[];
  candidate: CandidateRow;
  events: EvidenceRow[];
  nudges: NudgeRow[];
  resume?: LocalArtifact;
  scorecards: ScorecardRow[];
}) {
  const lines: string[] = [
    `# ${candidate.name}`,
    "",
    `- Role: ${candidate.role_title}`,
    `- Stage: ${candidate.stage}`,
    `- Status: ${candidate.status}`,
    `- Source: ${candidate.source ?? "Unknown"}`,
    `- Last activity: ${candidate.last_activity_at ?? "Unknown"}`,
    `- Email: ${candidate.email ?? "Unknown"}`,
    `- LinkedIn: ${candidate.linkedin_url ?? "Unknown"}`,
    "",
    "## Resume",
    "",
    resume ? `- ${markdownLink(resume.basename, resume.path)}` : "- No resume file located in the operations folder yet.",
    "",
    "## Local Artifacts",
    ""
  ];

  if (artifacts.length === 0) {
    lines.push("- No local artifacts matched this candidate yet.");
  } else {
    for (const artifact of artifacts) {
      lines.push(`- ${markdownLink(artifact.relativePath, artifact.path)}`);
    }
  }

  lines.push("", "## Evidence Timeline", "");
  if (events.length === 0) {
    lines.push("- No evidence events imported yet.");
  } else {
    for (const event of events.slice(0, 30)) {
      lines.push(
        `### ${event.title}`,
        "",
        `- Date: ${event.occurred_at}`,
        `- Source: ${event.source_type}${event.source_label ? ` / ${event.source_label}` : ""}`,
        `- Author: ${event.author ?? "Unknown"}`,
        `- Evidence weight: ${event.evidence_weight}`,
        "",
        event.body,
        ""
      );
    }
  }

  lines.push("## Scorecards", "");
  if (scorecards.length === 0) {
    lines.push("- No scorecards imported yet.");
  } else {
    for (const scorecard of scorecards) {
      lines.push(
        `### ${scorecard.reviewer}`,
        "",
        `- Type: ${scorecard.reviewer_type}`,
        `- Rubric: ${scorecard.rubric}`,
        `- Recommendation: ${scorecard.recommendation ?? "None"}`,
        `- Created: ${scorecard.created_at}`,
        `- Scores: \`${scorecard.scores_json || "{}"}\``,
        "",
        scorecard.summary,
        ""
      );
    }
  }

  lines.push("## Nudges", "");
  if (nudges.length === 0) {
    lines.push("- No candidate-specific nudges.");
  } else {
    for (const nudge of nudges) {
      lines.push(`- ${nudge.owner}: ${nudge.reason} (${nudge.status}${nudge.due_at ? `, due ${nudge.due_at}` : ""})`);
    }
  }

  lines.push("", `Generated: ${new Date().toISOString()}`, "");
  return lines.join("\n");
}

loadLocalEnv();

const db = getDb();
const root = packetRoot();
const hiringRoot = hiringRootForPackets(root);
fs.mkdirSync(root, { recursive: true });

const artifacts = walkFiles(hiringRoot, root);
const candidates = db
  .prepare(
    `
      SELECT c.*, r.title AS role_title
      FROM candidates c
      JOIN roles r ON r.id = c.role_id
      ORDER BY r.title, c.name
    `
  )
  .all() as CandidateRow[];

const eventStmt = db.prepare(`
  SELECT occurred_at, source_type, source_label, source_url, title, body, author, evidence_weight
  FROM evidence_events
  WHERE candidate_id = ?
  ORDER BY occurred_at DESC, created_at DESC
`);
const scoreStmt = db.prepare(`
  SELECT reviewer, reviewer_type, rubric, scores_json, summary, recommendation, created_at
  FROM scorecards
  WHERE candidate_id = ?
  ORDER BY created_at DESC
`);
const nudgeStmt = db.prepare(`
  SELECT owner, reason, due_at, status, created_at
  FROM nudges
  WHERE candidate_id = ?
  ORDER BY status, due_at, created_at DESC
`);
const updateStmt = db.prepare("UPDATE candidates SET profile_url = ?, resume_url = ?, updated_at = ? WHERE id = ?");

const results = candidates.map((candidate) => {
  const slug = candidate.external_id ?? slugify(candidate.name);
  const candidateDir = path.join(root, slug);
  fs.mkdirSync(candidateDir, { recursive: true });

  const matchedArtifacts = artifacts.filter((artifact) => artifactMatchesCandidate(artifact, candidate));
  const resume = pickResume(matchedArtifacts);
  const events = eventStmt.all(candidate.id) as EvidenceRow[];
  const scorecards = scoreStmt.all(candidate.id) as ScorecardRow[];
  const nudges = nudgeStmt.all(candidate.id) as NudgeRow[];
  const profilePath = path.join(candidateDir, "profile.md");

  fs.writeFileSync(
    profilePath,
    renderProfile({
      artifacts: matchedArtifacts,
      candidate,
      events,
      nudges,
      resume,
      scorecards
    })
  );

  updateStmt.run(fileUrl(profilePath), resume ? fileUrl(resume.path) : null, new Date().toISOString(), candidate.id);

  return {
    candidate: candidate.name,
    artifacts: matchedArtifacts.length,
    profilePath,
    resumePath: resume?.path ?? null
  };
});

console.log(JSON.stringify({ packetRoot: root, hiringRoot, candidates: results }, null, 2));
