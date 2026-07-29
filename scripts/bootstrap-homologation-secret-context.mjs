const expectedBranch = "homologacao-adoce";
const expectedEnvironment = "homologation";
const endpoint = "https://vazozolhbehnriytzcdc.supabase.co/functions/v1/netlify-homologation-secret-bridge";

if (process.env.BRANCH !== expectedBranch) {
  throw new Error(`Bootstrap rejeitado fora da branch ${expectedBranch}.`);
}
if (process.env.ADOCE_DEPLOY_ENV !== expectedEnvironment) {
  throw new Error("Bootstrap rejeitado fora da homologação.");
}

const token = String(process.env.HOMOLOGATION_SECRET_BRIDGE_TOKEN || "").trim();
if (!token) throw new Error("Token temporário da ponte ausente.");

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-once-token": token,
  },
});
const payload = await response.json().catch(() => null);
if (!response.ok || payload?.ok !== true) {
  throw new Error(`Ponte de segredos falhou com HTTP ${response.status}.`);
}
const statuses = Array.isArray(payload.results)
  ? payload.results.map(({ key, status, ok }) => ({ key, status, ok }))
  : [];
console.log("Contexto privado da homologação atualizado:", JSON.stringify(statuses));
