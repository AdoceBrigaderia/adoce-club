export const PRODUCTION_APPROVAL_PHRASE: string;

export type ProductionApprovalEnvironment = Record<
  string,
  string | undefined
>;

export type ProductionApprovalResult = {
  approved: boolean;
  failures: string[];
  approvedBy: string;
  approvedCommit: string;
  approvedAt: string;
};

export function validateProductionApproval(
  environment: ProductionApprovalEnvironment,
  currentCommit: string,
  now?: Date,
): ProductionApprovalResult;

export const PRODUCTION_CONFIRMATION_VARIABLES: string[];
