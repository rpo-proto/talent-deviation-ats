import { getDb, id } from "./db";
import { normalizeStage, stageOrder } from "./stages";
import type { NormalizedImport } from "./types";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function nowIso() {
  return new Date().toISOString();
}

function ensureRole(title: string) {
  const db = getDb();
  const slug = slugify(title);
  const existing = db.prepare("SELECT id, slug, title FROM roles WHERE slug = ?").get(slug) as
    | { id: string; slug: string; title: string }
    | undefined;
  if (existing) return existing;

  const role = { id: id("role"), slug, title: title.trim() };
  db.prepare("INSERT INTO roles (id, slug, title, department) VALUES (?, ?, ?, 'Product')").run(
    role.id,
    role.slug,
    role.title
  );
  return role;
}

type CandidateRef = {
  externalId?: string;
  name?: string;
  role?: string;
};

function findCandidate(ref: CandidateRef) {
  const db = getDb();
  if (!ref.role || !ref.name) return undefined;
  const role = ensureRole(ref.role);
  if (ref.externalId) {
    const byExternal = db
      .prepare("SELECT id FROM candidates WHERE external_id = ? AND role_id = ?")
      .get(ref.externalId, role.id) as { id: string } | undefined;
    if (byExternal) return byExternal.id;
  }
  const byName = db
    .prepare("SELECT id FROM candidates WHERE lower(name) = lower(?) AND role_id = ?")
    .get(ref.name, role.id) as { id: string } | undefined;
  return byName?.id;
}

function upsertCandidate(candidate: NonNullable<NormalizedImport["candidates"]>[number]) {
  const db = getDb();
  const role = ensureRole(candidate.role);
  const normalizedStage = normalizeStage(candidate.stage);
  const order = stageOrder(normalizedStage);
  const retained = candidate.retained === true || order >= 4 ? 1 : 0;
  const current = findCandidate({
    externalId: candidate.externalId,
    name: candidate.name,
    role: candidate.role
  });

  if (!current) {
    const candidateId = id("cand");
    db.prepare(`
      INSERT INTO candidates (
        id, external_id, role_id, name, email, linkedin_url, source, stage, stage_order,
        status, drive_url, profile_url, resume_url, retained, last_activity_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      candidateId,
      candidate.externalId ?? null,
      role.id,
      candidate.name,
      candidate.email ?? null,
      candidate.linkedinUrl ?? null,
      candidate.source ?? null,
      normalizedStage,
      order,
      candidate.status ?? "active",
      candidate.driveUrl ?? null,
      candidate.profileUrl ?? null,
      candidate.resumeUrl ?? null,
      retained,
      candidate.lastActivityAt ?? null,
      nowIso()
    );
    return candidateId;
  }

  db.prepare(`
    UPDATE candidates
    SET
      external_id = COALESCE(?, external_id),
      email = COALESCE(?, email),
      linkedin_url = COALESCE(?, linkedin_url),
      source = COALESCE(?, source),
      stage = ?,
      stage_order = ?,
      status = COALESCE(?, status),
      drive_url = COALESCE(?, drive_url),
      profile_url = COALESCE(?, profile_url),
      resume_url = COALESCE(?, resume_url),
      retained = MAX(retained, ?),
      last_activity_at = COALESCE(?, last_activity_at),
      updated_at = ?
    WHERE id = ?
  `).run(
    candidate.externalId ?? null,
    candidate.email ?? null,
    candidate.linkedinUrl ?? null,
    candidate.source ?? null,
    normalizedStage,
    order,
    candidate.status ?? null,
    candidate.driveUrl ?? null,
    candidate.profileUrl ?? null,
    candidate.resumeUrl ?? null,
    retained,
    candidate.lastActivityAt ?? null,
    nowIso(),
    current
  );
  return current;
}

export function importNormalized(payload: NormalizedImport) {
  const db = getDb();
  const importId = payload.sourceBatch?.id ?? id("batch");
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT OR IGNORE INTO import_batches (id, label, source_type, imported_by)
      VALUES (?, ?, ?, ?)
    `).run(
      importId,
      payload.sourceBatch?.label ?? null,
      payload.sourceBatch?.sourceType ?? null,
      payload.sourceBatch?.importedBy ?? null
    );

    let candidateCount = 0;
    let eventCount = 0;
    let scorecardCount = 0;
    let nudgeCount = 0;

    for (const candidate of payload.candidates ?? []) {
      upsertCandidate(candidate);
      candidateCount += 1;
    }

    for (const event of payload.events ?? []) {
      const role = event.role ? ensureRole(event.role) : undefined;
      const candidateId = findCandidate({
        externalId: event.candidateExternalId,
        name: event.candidateName,
        role: event.role
      });
      db.prepare(`
        INSERT INTO evidence_events (
          id, candidate_id, role_id, occurred_at, source_type, source_label, source_url,
          title, body, author, evidence_weight, visibility
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id("evt"),
        candidateId ?? null,
        role?.id ?? null,
        event.occurredAt ?? nowIso(),
        event.sourceType ?? payload.sourceBatch?.sourceType ?? "other",
        event.sourceLabel ?? payload.sourceBatch?.label ?? null,
        event.sourceUrl ?? null,
        event.title,
        event.body,
        event.author ?? null,
        event.evidenceWeight ?? 0.5,
        event.visibility ?? "private"
      );
      eventCount += 1;
    }

    for (const scorecard of payload.scorecards ?? []) {
      const candidateId = findCandidate({
        externalId: scorecard.candidateExternalId,
        name: scorecard.candidateName,
        role: scorecard.role
      });
      if (!candidateId) continue;
      db.prepare(`
        INSERT INTO scorecards (
          id, candidate_id, reviewer, reviewer_type, rubric, scores_json, summary, recommendation
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id("score"),
        candidateId,
        scorecard.reviewer,
        scorecard.reviewerType,
        scorecard.rubric,
        JSON.stringify(scorecard.scores ?? {}),
        scorecard.summary,
        scorecard.recommendation ?? null
      );
      scorecardCount += 1;
    }

    for (const nudge of payload.nudges ?? []) {
      const candidateId = findCandidate({
        externalId: nudge.candidateExternalId,
        name: nudge.candidateName,
        role: nudge.role
      });
      db.prepare(`
        INSERT INTO nudges (id, candidate_id, owner, reason, due_at, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id("nudge"), candidateId ?? null, nudge.owner, nudge.reason, nudge.dueAt ?? null, nudge.status ?? "open");
      nudgeCount += 1;
    }

    return { importId, candidateCount, eventCount, scorecardCount, nudgeCount };
  });

  return tx();
}
