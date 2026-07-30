#!/usr/bin/env node
import { auditOperationalReportSurface } from "./operational-report-surface-audit-core.mjs";

const result = auditOperationalReportSurface(process.cwd());
if (result.violations.length) {
  for (const item of result.violations) {
    console.error(`[${item.code}] ${item.file}: ${item.detail}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Fronteira dos relatórios aprovada: ${result.breakdownCount} detalhamentos, ${result.filterCount} filtros backend, orçamento de ${result.touchBudget} toque, ${result.protectedFinancialFieldCount} campos financeiros protegidos e ${result.controlledFileCount} arquivos controlados.`,
  );
}
