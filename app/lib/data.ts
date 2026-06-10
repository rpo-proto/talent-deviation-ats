import "server-only";

import { getDb } from "./db";
import { STAGES } from "./stages";
import type { Candidate, DashboardData, EvidenceEvent, Nudge, Role, Scorecard } from "./types";

type CandidateRow = {
  id: string;
  role_id: string;
  role_title: string;
  name: string;
  email: string | null;
  linkedin_url: string | null;
  source: string | null;
  stage: string;
  stage_order: number;
  status: string;
  drive_url: string | null;
  profile_url: string | null;
  resume_url: string | null;
  retained: number;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
};

type EventRow = {
  id: string;
  candidate_id: string | null;
  role_id: string | null;
  occurred_at: string;
  source_type: EvidenceEvent["sourceType"];
  source_label: string | null;
  source_url: string | null;
  title: string;
  body: string;
  author: string | null;
  evidence_weight: number;
  visibility: string;
  created_at: string;
};

type ScorecardRow = {
  id: string;
  candidate_id: string;
  reviewer: string;
  reviewer_type: "human" | "llm";
  rubric: string;
  scores_json: string;
  summary: string;
  recommendation: string | null;
  created_at: string;
};

type NudgeRow = {
  id: string;
  candidate_id: string | null;
  owner: string;
  reason: string;
  due_at: string | null;
  status: "open" | "done" | "dismissed";
  created_at: string;
};

function candidateFromRow(row: CandidateRow): Candidate {
  return {
    id: row.id,
    roleId: row.role_id,
    roleTitle: row.role_title,
    name: row.name,
    email: row.email,
    linkedinUrl: row.linkedin_url,
    source: row.source,
    stage: row.stage,
    stageOrder: row.stage_order,
    status: row.status,
    driveUrl: row.drive_url,
    profileUrl: row.profile_url,
    resumeUrl: row.resume_url,
    retained: row.retained,
    lastActivityAt: row.last_activity_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function eventFromRow(row: EventRow): EvidenceEvent {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    roleId: row.role_id,
    occurredAt: row.occurred_at,
    sourceType: row.source_type,
    sourceLabel: row.source_label,
    sourceUrl: row.source_url,
    title: row.title,
    body: row.body,
    author: row.author,
    evidenceWeight: row.evidence_weight,
    visibility: row.visibility,
    createdAt: row.created_at
  };
}

export function getDashboardData(): DashboardData {
  const db = getDb();

  const roles = db.prepare("SELECT id, slug, title, department, active FROM roles ORDER BY title").all() as Role[];
  const candidates = (
    db
      .prepare(
        `
          SELECT c.*, r.title AS role_title
          FROM candidates c
          JOIN roles r ON r.id = c.role_id
          ORDER BY c.stage_order, c.updated_at DESC, c.name
        `
      )
      .all() as CandidateRow[]
  ).map(candidateFromRow);

  const events = (
    db
      .prepare(
        `
          SELECT *
          FROM evidence_events
          ORDER BY occurred_at DESC, created_at DESC
          LIMIT 300
        `
      )
      .all() as EventRow[]
  ).map(eventFromRow);

  const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recentSignal = (
    db
      .prepare(
        `
          SELECT *
          FROM evidence_events
          WHERE occurred_at >= ?
          ORDER BY occurred_at DESC, created_at DESC
          LIMIT 50
        `
      )
      .all(recentCutoff) as EventRow[]
  ).map(eventFromRow);

  const scorecards = (
    db
      .prepare("SELECT * FROM scorecards ORDER BY created_at DESC")
      .all() as ScorecardRow[]
  ).map(
    (row): Scorecard => ({
      id: row.id,
      candidateId: row.candidate_id,
      reviewer: row.reviewer,
      reviewerType: row.reviewer_type,
      rubric: row.rubric,
      scores: JSON.parse(row.scores_json || "{}"),
      summary: row.summary,
      recommendation: row.recommendation,
      createdAt: row.created_at
    })
  );

  const nudges = (db.prepare("SELECT * FROM nudges ORDER BY status, due_at").all() as NudgeRow[]).map(
    (row): Nudge => ({
      id: row.id,
      candidateId: row.candidate_id,
      owner: row.owner,
      reason: row.reason,
      dueAt: row.due_at,
      status: row.status,
      createdAt: row.created_at
    })
  );

  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    counts.set(`${candidate.roleTitle}::${candidate.stage}`, (counts.get(`${candidate.roleTitle}::${candidate.stage}`) ?? 0) + 1);
  }

  const stageCounts = roles.flatMap((role) =>
    STAGES.map((stage) => ({
      roleTitle: role.title,
      stage: stage.name,
      count: counts.get(`${role.title}::${stage.name}`) ?? 0
    }))
  );

  return {
    roles,
    candidates,
    events,
    scorecards,
    nudges,
    recentSignal,
    stageCounts,
    driveRootUrl: process.env.TALENT_ATS_DRIVE_ROOT_URL
  };
}
