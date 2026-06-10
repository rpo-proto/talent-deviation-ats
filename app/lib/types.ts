export type SourceType =
  | "slack"
  | "gmail"
  | "granola"
  | "local_file"
  | "case_study"
  | "human_note"
  | "llm_review"
  | "drive"
  | "other";

export type Role = {
  id: string;
  slug: string;
  title: string;
  department: string;
  active: number;
};

export type Candidate = {
  id: string;
  roleId: string;
  roleTitle: string;
  name: string;
  email?: string | null;
  linkedinUrl?: string | null;
  source?: string | null;
  stage: string;
  stageOrder: number;
  status: string;
  driveUrl?: string | null;
  profileUrl?: string | null;
  resumeUrl?: string | null;
  retained: number;
  lastActivityAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EvidenceEvent = {
  id: string;
  candidateId?: string | null;
  roleId?: string | null;
  occurredAt: string;
  sourceType: SourceType;
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  title: string;
  body: string;
  author?: string | null;
  evidenceWeight: number;
  visibility: string;
  createdAt: string;
};

export type Scorecard = {
  id: string;
  candidateId: string;
  reviewer: string;
  reviewerType: "human" | "llm";
  rubric: string;
  scores: Record<string, number>;
  summary: string;
  recommendation?: string | null;
  createdAt: string;
};

export type Nudge = {
  id: string;
  candidateId?: string | null;
  owner: string;
  reason: string;
  dueAt?: string | null;
  status: "open" | "done" | "dismissed";
  createdAt: string;
};

export type DashboardData = {
  roles: Role[];
  candidates: Candidate[];
  events: EvidenceEvent[];
  scorecards: Scorecard[];
  nudges: Nudge[];
  recentSignal: EvidenceEvent[];
  stageCounts: Array<{
    roleTitle: string;
    stage: string;
    count: number;
  }>;
  driveRootUrl?: string;
};

export type NormalizedImport = {
  sourceBatch?: {
    id?: string;
    label?: string;
    importedBy?: string;
    sourceType?: SourceType;
  };
  candidates?: Array<{
    externalId?: string;
    name: string;
    role: string;
    email?: string;
    linkedinUrl?: string;
    source?: string;
    stage?: string;
    status?: string;
    driveUrl?: string;
    profileUrl?: string;
    resumeUrl?: string;
    retained?: boolean;
    lastActivityAt?: string;
  }>;
  events?: Array<{
    candidateExternalId?: string;
    candidateName?: string;
    role?: string;
    occurredAt?: string;
    sourceType?: SourceType;
    sourceLabel?: string;
    sourceUrl?: string;
    title: string;
    body: string;
    author?: string;
    evidenceWeight?: number;
    visibility?: string;
  }>;
  scorecards?: Array<{
    candidateExternalId?: string;
    candidateName?: string;
    role?: string;
    reviewer: string;
    reviewerType: "human" | "llm";
    rubric: string;
    scores?: Record<string, number>;
    summary: string;
    recommendation?: string;
  }>;
  nudges?: Array<{
    candidateExternalId?: string;
    candidateName?: string;
    role?: string;
    owner: string;
    reason: string;
    dueAt?: string;
    status?: "open" | "done" | "dismissed";
  }>;
};
