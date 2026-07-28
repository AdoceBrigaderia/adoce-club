export const VISUAL_REVIEW_SESSION_KEY = "adoce:homologation-visual-review:v2";

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

export type VisualValidationRoute = (typeof visualValidationRoutes)[number];
export type VisualValidationRouteId = VisualValidationRoute["id"];
export type VisualReviewStatus = "pending" | "approved" | "adjust";

export type VisualReviewState = {
  statuses: Record<VisualValidationRouteId, VisualReviewStatus>;
  routeNotes: Record<VisualValidationRouteId, string>;
  notes: string;
  updatedAt: string | null;
};

export type VisualReviewMetadata = {
  commit?: string;
  builtAt?: string;
  url?: string;
  viewport?: string;
};

const validStatuses = new Set<VisualReviewStatus>([
  "pending",
  "approved",
  "adjust",
]);

const emptyRouteRecord = <T>(factory: () => T) =>
  Object.fromEntries(
    visualValidationRoutes.map(({ id }) => [id, factory()]),
  ) as Record<VisualValidationRouteId, T>;

export function createEmptyVisualReview(): VisualReviewState {
  return {
    statuses: emptyRouteRecord(() => "pending" as VisualReviewStatus),
    routeNotes: emptyRouteRecord(() => ""),
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
  const sourceRouteNotes =
    candidate.routeNotes && typeof candidate.routeNotes === "object"
      ? candidate.routeNotes
      : {};

  const statuses = Object.fromEntries(
    visualValidationRoutes.map(({ id }) => {
      const status = (sourceStatuses as Record<string, unknown>)[id];
      return [id, validStatuses.has(status as VisualReviewStatus) ? status : "pending"];
    }),
  ) as Record<VisualValidationRouteId, VisualReviewStatus>;

  const routeNotes = Object.fromEntries(
    visualValidationRoutes.map(({ id }) => {
      const note = (sourceRouteNotes as Record<string, unknown>)[id];
      return [id, typeof note === "string" ? note.slice(0, 800) : ""];
    }),
  ) as Record<VisualValidationRouteId, string>;

  return {
    statuses,
    routeNotes,
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

export function nextPendingVisualRoute(
  review: VisualReviewState,
): VisualValidationRoute | null {
  return (
    visualValidationRoutes.find(({ id }) => review.statuses[id] === "pending") ?? null
  );
}

export function visualReviewReadiness(review: VisualReviewState) {
  const progress = visualReviewProgress(review);
  const pendingRoutes = visualValidationRoutes.filter(
    ({ id }) => review.statuses[id] === "pending",
  );

  return {
    ready: progress.pending === 0,
    hasAdjustments: progress.adjust > 0,
    pendingRoutes,
  };
}

function compactNote(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 800);
}

export function buildVisualReviewMarkdown(
  review: VisualReviewState,
  metadata: VisualReviewMetadata = {},
) {
  const progress = visualReviewProgress(review);
  const readiness = visualReviewReadiness(review);
  const statusLabel: Record<VisualReviewStatus, string> = {
    pending: "Pendente",
    approved: "Aprovado",
    adjust: "Precisa ajustar",
  };
  const safe = (value: string | undefined, fallback: string) =>
    value?.trim() || fallback;
  const routeLines = visualValidationRoutes.flatMap(({ id, label }) => {
    const status = review.statuses[id];
    const note = compactNote(review.routeNotes[id]);
    const line = `- [${status === "approved" ? "x" : " "}] ${label}: ${statusLabel[status]}`;
    return note ? [line, `  - Observação: ${note}`] : [line];
  });
  const pendingLabels = readiness.pendingRoutes.map(({ label }) => label).join(", ");

  const lines = [
    "# Validação visual — Portal Adoce",
    "",
    `- Commit: ${safe(metadata.commit, "não informado")}`,
    `- Build: ${safe(metadata.builtAt, "não informado")}`,
    `- URL: ${safe(metadata.url, "não informada")}`,
    `- Viewport: ${safe(metadata.viewport, "não informado")}`,
    `- Última atualização: ${review.updatedAt || "não informada"}`,
    `- Progresso: ${progress.reviewed}/${progress.total} telas revisadas`,
    `- Pronta para envio: ${readiness.ready ? "sim" : "não"}`,
    `- Telas pendentes: ${pendingLabels || "nenhuma"}`,
    `- Aprovadas: ${progress.approved}`,
    `- Precisam ajustar: ${progress.adjust}`,
    `- Pendentes: ${progress.pending}`,
    "",
    "## Telas",
    "",
    ...routeLines,
    "",
    "## Observações gerais",
    "",
    review.notes.trim() || "Nenhuma observação registrada.",
    "",
    "Produção não foi alterada por esta validação.",
  ];

  return `${lines.join("\n")}\n`;
}
