import { execFileSync } from "node:child_process";
import { prepareApology } from "../netlify/functions/_shared/duplicate-stamps-apology.ts";

execFileSync(process.execPath, ["scripts/verify-primary-workspace.mjs"], { stdio: "inherit" });
// CLI autenticada consulta Management API. Nao le variaveis nem credenciais Netlify.
const command = "npx --no-install supabase db query --linked --file scripts/duplicate-stamps-apology-preview.sql --output json";
const output = execFileSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", command], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
const snapshot = JSON.parse(output).rows[0];
const { recipients: _privateRecipients, ...preview } = prepareApology(snapshot.recipients, new Set(snapshot.blocked_ids));
if (snapshot.reversals !== 144 || snapshot.stamps !== 233 || snapshot.customers !== 100
  || preview.total !== 100 || preview.normal !== 92 || preview.reversed !== 8) throw new Error("incident_scope_mismatch");
console.log(JSON.stringify({ mode: "preview", reversals: snapshot.reversals, stamps: snapshot.stamps,
  ...preview, sent: snapshot.sent, failed: snapshot.failed, messages_sent_this_run: 0 }, null, 2));
