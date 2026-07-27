export const VISUAL_REVIEW_SESSION_KEY = "adoce:homologation-visual-review:v1";

export const visualValidationRoutes = [
  { id: "inicio", label: "Início e identidade", href: "/#inicio" },
  { id: "adoce-hoje", label: "Fatias de hoje", href: "/#adoce-hoje" },
  { id: "cadastro", label: "Cadastro simplificado", href: "/#cadastro" },
  { id: "clube", label: "Clube e cartão digital", href: "/#clube" },
  { id: "pede-junto", label: "Pede Junto", href: "/#pede-junto" },
  { id: "encomendas", label: "Encomendas", href: "/#encomendas" },
  { id: "operacao", label: "Operação", href: "/#operacao" },
  { id: "contato", label: "Fale com a Adoce", href: "/#fale-com-a-adoce" },
] as const;

export type VisualValidationRouteId = (typeof visualValidationRoutes)[number]["id"];
export type VisualReviewStatus = "pending" | "approved" | "adjust";

export type VisualReviewState = {
  statuses: Record<VisualValidationRouteId, VisualReviewStatus>;
  notes: string;
  updatedAt: string | null;
};

export type VisualReviewMetadata = {
  commit?: string;
  builtAt?: string;
  url?: string;
};

const validStatuses = new Set<VisualReviewStatus>([
  "pending",
  "approved",
  "adjust",
]);

export function createEmptyVisualReview(): VisualReviewState {
  return {
    statuses: Object.fromEntries(
      visualValidationRoutes.map(({ id }) => [id, "pending"]),
    ) as Record<VisualValidationRouteId, VisualReviewStatus>,
    notes: "",
    updatedAt: null,
  };
}

export function normalizeVisualReview(value: unknown): VisualReviewState {
  const empty = createEmptyVisualReview();
  if (!value || typeof value !== "object") return empty;

  const candidate = value as Partial<VisualReviewState>;
  const sourceStatuses =
    candidate.statuses && typeof candidate.statuses === "object"
      ? candidate.statuses
      : {};

  const statuses = Object.fromEntries(
    visualValidationRoutes.map(({ id }) => {
      const status = (sourceStatuses as Record<string, unknown>)[id];
      return [id, validStatuses.has(status as VisualReviewStatus) ? status : "pending"];
    }),
  ) as Record<VisualValidationRouteId, VisualReviewStatus>;

  return {
    statuses,
    notes: typeof candidate.notes === "string" ? candidate.notes.slice(0, 4000) : "",
    updatedAt:
      typeof candidate.updatedAt === "string" ? candidate.updatedAt.slice(0, 80) : null,
  };
}

export function visualReviewProgress(review: VisualReviewState) {
  const statuses = Object.values(review.statuses);
  const approved = statuses.filter((status) => status === "approved").length;
  const adjust = statuses.filter((status) => status === "adjust").length;
  const pending = statuses.length - approved - adjust;

  return {
    total: statuses.length,
    approved,
    adjust,
    pending,
    reviewed: approved + adjust,
  };
}

export function buildVisualReviewMarkdown(
  review: VisualReviewState,
  metadata: VisualReviewMetadata = {},
) {
  const progress = visualReviewProgress(review);
  const statusLabel: Record<VisualReviewStatus, string> = {
    pending: "Pendente",
    approved: "Aprovado",
    adjust: "Precisa ajustar",
  };
  const safe = (value: string | undefined, fallback: string) =>
    value?.trim() || fallback;

  const lines = [
    "# Validação visual — Portal Adoce",
    "",
    `- Commit: ${safe(metadata.commit, "não informado")}`,
    `- Build: ${safe(metadata.builtAt, "não informado")}`,
    `- URL: ${safe(metadata.url, "não informada")}`,
    `- Progresso: ${progress.reviewed}/${progress.total} telas revisadas`,
    `- Aprovadas: ${progress.approved}`,
    `- Precisam ajustar: ${progress.adjust}`,
    `- Pendentes: ${progress.pending}`,
    "",
    "## Telas",
    "",
    ...visualValidationRoutes.map(
      ({ id, label }) => `- [${review.statuses[id] === "approved" ? "x" : " "}] ${label}: ${statusLabel[review.statuses[id]]}`,
    ),
    "",
    "## Observações gerais",
    "",
    review.notes.trim() || "Nenhuma observação registrada.",
    "",
    "Produção não foi alterada por esta validação.",
  ];

  return `${lines.join("\n")}\n`;
}
