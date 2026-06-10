"use client";

import {
  AlertCircle,
  Archive,
  ChevronRight,
  ExternalLink,
  FileSearch,
  GitBranch,
  Inbox,
  MessageSquareText,
  RefreshCw,
  Search,
  Sparkles,
  UserRoundCheck
} from "lucide-react";
import { useMemo, useState } from "react";

import { DOSSIER_UNLOCK_ORDER, STAGES } from "@/app/lib/stages";
import type { Candidate, DashboardData, EvidenceEvent, Nudge, Scorecard } from "@/app/lib/types";

type Props = {
  data: DashboardData;
};

function formatDate(value?: string | null) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function scoreAverage(scorecard?: Scorecard) {
  if (!scorecard) return undefined;
  const values = Object.values(scorecard.scores).filter((value) => Number.isFinite(value));
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function candidateScore(candidate: Candidate, scorecards: Scorecard[]) {
  const card = scorecards.find((item) => item.candidateId === candidate.id);
  return scoreAverage(card);
}

function sourceClass(type: EvidenceEvent["sourceType"]) {
  if (type === "slack") return "source source-blue";
  if (type === "granola") return "source source-green";
  if (type === "gmail") return "source source-amber";
  if (type === "llm_review") return "source source-violet";
  return "source";
}

export function TalentDashboard({ data }: Props) {
  const [roleFilter, setRoleFilter] = useState("All");
  const defaultCandidateId =
    data.candidates.find((candidate) => candidate.stage === "Final Decision")?.id ??
    data.candidates.find((candidate) => candidate.stageOrder >= DOSSIER_UNLOCK_ORDER)?.id ??
    data.candidates[0]?.id ??
    "";
  const [selectedCandidateId, setSelectedCandidateId] = useState(defaultCandidateId);
  const [query, setQuery] = useState("");

  const filteredCandidates = useMemo(() => {
    return data.candidates.filter((candidate) => {
      const roleMatch = roleFilter === "All" || candidate.roleTitle === roleFilter;
      const text = `${candidate.name} ${candidate.roleTitle} ${candidate.stage} ${candidate.source ?? ""}`.toLowerCase();
      return roleMatch && text.includes(query.toLowerCase());
    });
  }, [data.candidates, query, roleFilter]);

  const selectedCandidate = data.candidates.find((candidate) => candidate.id === selectedCandidateId) ?? filteredCandidates[0];
  const selectedEvents = selectedCandidate
    ? data.events.filter((event) => event.candidateId === selectedCandidate.id).slice(0, 20)
    : [];
  const selectedScorecards = selectedCandidate ? data.scorecards.filter((scorecard) => scorecard.candidateId === selectedCandidate.id) : [];
  const selectedNudges = selectedCandidate ? data.nudges.filter((nudge) => nudge.candidateId === selectedCandidate.id) : [];

  const openNudges = data.nudges.filter((nudge) => nudge.status === "open");
  const caseStudyCandidates = data.candidates.filter((candidate) => candidate.stageOrder >= DOSSIER_UNLOCK_ORDER && candidate.status !== "declined");
  const standoutCandidate = caseStudyCandidates
    .map((candidate) => ({ candidate, score: candidateScore(candidate, data.scorecards) ?? 0 }))
    .sort((a, b) => b.score - a.score)[0];

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Local-first hiring cockpit</p>
          <h1>Talent Deviation ATS</h1>
        </div>
        <div className="top-actions">
          {data.driveRootUrl ? (
            <a className="icon-button" href={data.driveRootUrl} target="_blank" rel="noreferrer" title="Open private Drive source folder">
              <Archive size={18} />
              <span>Drive Vault</span>
            </a>
          ) : null}
          <button className="icon-button" type="button" title="Refresh through agent-assisted import">
            <RefreshCw size={18} />
            <span>Agent Refresh</span>
          </button>
        </div>
      </header>

      <section className="metrics-grid">
        <div className="metric">
          <span className="metric-label">Applicants</span>
          <strong>{data.candidates.length}</strong>
          <span>{data.roles.length} active roles</span>
        </div>
        <div className="metric">
          <span className="metric-label">At Case Study+</span>
          <strong>{caseStudyCandidates.length}</strong>
          <span>full dossier threshold</span>
        </div>
        <div className="metric">
          <span className="metric-label">Open Nudges</span>
          <strong>{openNudges.length}</strong>
          <span>recommended, not auto-sent</span>
        </div>
        <div className="metric">
          <span className="metric-label">Current Standout</span>
          <strong>{standoutCandidate?.candidate.name ?? "None yet"}</strong>
          <span>{standoutCandidate?.score ? `${standoutCandidate.score.toFixed(1)} avg signal` : "needs evidence"}</span>
        </div>
      </section>

      <section className="workspace">
        <aside className="left-rail">
          <div className="panel">
            <div className="panel-header">
              <MessageSquareText size={18} />
              <h2>Last 24h Signal</h2>
            </div>
            <div className="recent-list">
              {data.recentSignal.length === 0 ? (
                <p className="empty">No recent imported signal yet.</p>
              ) : (
                data.recentSignal.slice(0, 8).map((event) => (
                  <article className="recent-item" key={event.id}>
                    <span className={sourceClass(event.sourceType)}>{event.sourceType}</span>
                    <h3>{event.title}</h3>
                    <p>{event.body}</p>
                    <span className="timestamp">{formatDate(event.occurredAt)}</span>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <AlertCircle size={18} />
              <h2>Pending</h2>
            </div>
            <div className="nudge-list">
              {openNudges.length === 0 ? (
                <p className="empty">No imported nudges.</p>
              ) : (
                openNudges.slice(0, 8).map((nudge) => <NudgeRow key={nudge.id} nudge={nudge} />)
              )}
            </div>
          </div>
        </aside>

        <section className="main-area">
          <div className="toolbar">
            <div className="segmented" aria-label="Role filter">
              <button className={roleFilter === "All" ? "active" : ""} onClick={() => setRoleFilter("All")} type="button">
                All
              </button>
              {data.roles.map((role) => (
                <button
                  className={roleFilter === role.title ? "active" : ""}
                  key={role.id}
                  onClick={() => setRoleFilter(role.title)}
                  type="button"
                >
                  {role.title}
                </button>
              ))}
            </div>
            <label className="search-box">
              <Search size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search candidates" />
            </label>
          </div>

          <div className="funnel" aria-label="Candidate funnel">
            {STAGES.slice(0, 9).map((stage) => {
              const stageCandidates = filteredCandidates.filter((candidate) => candidate.stage === stage.name);
              return (
                <section className="stage-column" key={stage.name}>
                  <div className="stage-heading">
                    <span>{stage.name}</span>
                    <strong>{stageCandidates.length}</strong>
                  </div>
                  <div className="candidate-stack">
                    {stageCandidates.map((candidate) => (
                      <button
                        className={`candidate-card ${selectedCandidate?.id === candidate.id ? "selected" : ""}`}
                        key={candidate.id}
                        onClick={() => setSelectedCandidateId(candidate.id)}
                        type="button"
                      >
                        <span className="candidate-name">{candidate.name}</span>
                        <span className="candidate-meta">{candidate.source ?? candidate.roleTitle}</span>
                        <span className="candidate-footer">
                          {candidate.stageOrder >= DOSSIER_UNLOCK_ORDER ? (
                            <>
                              <Sparkles size={14} /> dossier
                            </>
                          ) : (
                            <>
                              <Inbox size={14} /> thin intake
                            </>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </section>

        <aside className="dossier">
          {selectedCandidate ? (
            <CandidateDossier
              candidate={selectedCandidate}
              events={selectedEvents}
              nudges={selectedNudges}
              scorecards={selectedScorecards}
            />
          ) : (
            <p className="empty">Select a candidate.</p>
          )}
        </aside>
      </section>
    </main>
  );
}

function NudgeRow({ nudge }: { nudge: Nudge }) {
  return (
    <article className="nudge">
      <strong>{nudge.owner}</strong>
      <p>{nudge.reason}</p>
      <span>{nudge.dueAt ? formatDate(nudge.dueAt) : "No due date"}</span>
    </article>
  );
}

function CandidateDossier({
  candidate,
  events,
  nudges,
  scorecards
}: {
  candidate: Candidate;
  events: EvidenceEvent[];
  nudges: Nudge[];
  scorecards: Scorecard[];
}) {
  const unlocked = candidate.stageOrder >= DOSSIER_UNLOCK_ORDER;
  const latestScore = scoreAverage(scorecards[0]);

  return (
    <div className="dossier-inner">
      <div className="dossier-title">
        <div>
          <p className="eyebrow">{candidate.roleTitle}</p>
          <h2>{candidate.name}</h2>
        </div>
        <span className={`status-pill ${unlocked ? "status-live" : ""}`}>{unlocked ? "Dossier" : "Thin"}</span>
      </div>

      <div className="detail-grid">
        <div>
          <span>Stage</span>
          <strong>{candidate.stage}</strong>
        </div>
        <div>
          <span>Source</span>
          <strong>{candidate.source ?? "Unknown"}</strong>
        </div>
        <div>
          <span>Signal</span>
          <strong>{latestScore ? latestScore.toFixed(1) : "Unscored"}</strong>
        </div>
      </div>

      {candidate.driveUrl ? (
        <a className="drive-link" href={candidate.driveUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={16} />
          Open private source folder
        </a>
      ) : null}

      {!unlocked ? (
        <div className="locked">
          <FileSearch size={18} />
          <p>Detailed profile unlocks once the candidate reaches case study.</p>
        </div>
      ) : (
        <>
          <section className="dossier-section">
            <h3>
              <UserRoundCheck size={17} />
              Scorecards
            </h3>
            {scorecards.length === 0 ? (
              <p className="empty">No scorecards imported yet.</p>
            ) : (
              scorecards.map((scorecard) => (
                <article className="scorecard" key={scorecard.id}>
                  <div>
                    <strong>{scorecard.reviewer}</strong>
                    <span>{scorecard.rubric} · {scorecard.reviewerType}</span>
                  </div>
                  <p>{scorecard.summary}</p>
                  <div className="score-grid">
                    {Object.entries(scorecard.scores).map(([key, value]) => (
                      <span key={key}>
                        {key.replaceAll("_", " ")} <strong>{value}</strong>
                      </span>
                    ))}
                  </div>
                </article>
              ))
            )}
          </section>

          <section className="dossier-section">
            <h3>
              <GitBranch size={17} />
              Evidence Timeline
            </h3>
            {events.length === 0 ? (
              <p className="empty">No evidence imported yet.</p>
            ) : (
              events.map((event) => (
                <article className="event" key={event.id}>
                  <span className={sourceClass(event.sourceType)}>{event.sourceType}</span>
                  <h4>{event.title}</h4>
                  <p>{event.body}</p>
                  <footer>
                    {event.author ?? event.sourceLabel ?? "Source"} · weight {event.evidenceWeight.toFixed(2)} · {formatDate(event.occurredAt)}
                  </footer>
                </article>
              ))
            )}
          </section>

          <section className="dossier-section">
            <h3>
              <ChevronRight size={17} />
              Candidate Nudges
            </h3>
            {nudges.length === 0 ? <p className="empty">No candidate-specific nudges.</p> : nudges.map((nudge) => <NudgeRow key={nudge.id} nudge={nudge} />)}
          </section>
        </>
      )}
    </div>
  );
}
