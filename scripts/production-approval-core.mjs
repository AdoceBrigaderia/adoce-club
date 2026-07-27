export const PRODUCTION_APPROVAL_PHRASE =
  "PRODUCAO_APROVADA_EXPRESSAMENTE";

const requiredConfirmations = [
  "ADOCE_PRODUCTION_BACKUP_CONFIRMED",
  "ADOCE_PRODUCTION_ROLLBACK_CONFIRMED",
  "ADOCE_PRODUCTION_SMOKE_PLAN_CONFIRMED",
];

const confirmed = (value) =>
  ["1", "true", "sim", "yes"].includes(String(value || "").trim().toLowerCase());

export function validateProductionApproval(
  environment,
  currentCommit,
  now = new Date(),
) {
  const failures = [];
  const approval = String(
    environment.ADOCE_PRODUCTION_APPROVAL || "",
  ).trim();
  const approvedBy = String(
    environment.ADOCE_PRODUCTION_APPROVED_BY || "",
  ).trim();
  const approvedCommit = String(
    environment.ADOCE_PRODUCTION_COMMIT || "",
  ).trim();
  const approvedAtRaw = String(
    environment.ADOCE_PRODUCTION_APPROVAL_AT || "",
  ).trim();

  if (approval !== PRODUCTION_APPROVAL_PHRASE) {
    failures.push("aprovação expressa ausente ou inválida");
  }
  if (approvedBy.length < 3) {
    failures.push("responsável pela aprovação não informado");
  }
  if (!currentCommit || approvedCommit !== currentCommit) {
    failures.push("commit aprovado não corresponde ao commit atual");
  }

  const approvedAt = new Date(approvedAtRaw);
  const ageMs = now.getTime() - approvedAt.getTime();
  if (
    !approvedAtRaw ||
    Number.isNaN(approvedAt.getTime()) ||
    ageMs < 0 ||
    ageMs > 24 * 60 * 60 * 1000
  ) {
    failures.push("aprovação deve ser válida e emitida nas últimas 24 horas");
  }

  for (const name of requiredConfirmations) {
    if (!confirmed(environment[name])) {
      failures.push(`${name} não confirmado`);
    }
  }

  return {
    approved: failures.length === 0,
    failures,
    approvedBy,
    approvedCommit,
    approvedAt: approvedAtRaw,
  };
}

export const PRODUCTION_CONFIRMATION_VARIABLES = [
  ...requiredConfirmations,
];
