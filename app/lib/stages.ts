export const STAGES = [
  { name: "Intake", order: 1, thin: true },
  { name: "LHH Screened", order: 2, thin: true },
  { name: "Internal Triage", order: 3, thin: true },
  { name: "Case Study", order: 4, thin: false },
  { name: "Case Study Review", order: 5, thin: false },
  { name: "Hiring Lead Interview", order: 6, thin: false },
  { name: "Technical Lead Interview", order: 7, thin: false },
  { name: "Final Decision", order: 8, thin: false },
  { name: "Offer / Hired", order: 9, thin: false },
  { name: "Declined", order: 10, thin: true },
  { name: "Keep Warm", order: 11, thin: true }
] as const;

export const DEFAULT_STAGE = "Intake";
export const DOSSIER_UNLOCK_ORDER = 4;

export function normalizeStage(stage?: string | null): string {
  if (!stage) return DEFAULT_STAGE;
  const exact = STAGES.find((item) => item.name.toLowerCase() === stage.toLowerCase());
  if (exact) return exact.name;

  const lower = stage.toLowerCase();
  if (lower.includes("lhh")) return "LHH Screened";
  if (lower.includes("triage") || lower.includes("review")) return "Internal Triage";
  if (lower.includes("case") && lower.includes("review")) return "Case Study Review";
  if (lower.includes("case")) return "Case Study";
  if (lower.includes("paul") || lower.includes("hiring lead")) return "Hiring Lead Interview";
  if (lower.includes("michael") || lower.includes("navarro") || lower.includes("technical lead")) return "Technical Lead Interview";
  if (lower.includes("final")) return "Final Decision";
  if (lower.includes("offer") || lower.includes("hired")) return "Offer / Hired";
  if (lower.includes("declin") || lower.includes("reject")) return "Declined";
  if (lower.includes("warm")) return "Keep Warm";
  return DEFAULT_STAGE;
}

export function stageOrder(stage?: string | null): number {
  const normalized = normalizeStage(stage);
  return STAGES.find((item) => item.name === normalized)?.order ?? 1;
}

export function isDossierUnlocked(stage?: string | null): boolean {
  return stageOrder(stage) >= DOSSIER_UNLOCK_ORDER && normalizeStage(stage) !== "Declined";
}
