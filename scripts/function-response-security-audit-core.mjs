import path from "node:path";

const ENTRYPOINT_PATTERN = /^netlify\/functions\/[^/]+\.ts$/;
const APPROVED_HELPERS = ["secureJson", "secureText", "secureEmpty"];

function normalizedPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function hasApprovedHelper(source) {
  return APPROVED_HELPERS.some((helper) => {
    const imported = new RegExp(
      `\\b${helper}\\b[\\s\\S]*from\\s+["']\\./_shared/(?:session-security|response-security)["']`,
    ).test(source);
    const called = new RegExp(`\\b${helper}\\s*\\(`).test(source);
    return imported && called;
  });
}

export function auditFunctionResponseSecurity(files) {
  const violations = [];

  for (const file of files) {
    const filePath = normalizedPath(file.path);
    if (!ENTRYPOINT_PATTERN.test(filePath) || filePath.endsWith(".test.ts"))
      continue;
    const source = String(file.source || "");

    if (/\bnew\s+Response\s*\(/.test(source)) {
      violations.push({
        path: filePath,
        rule: "direct-response",
        message:
          "A Function cria Response diretamente em vez de usar a fronteira segura compartilhada.",
      });
    }

    if (/\bResponse\.json\s*\(/.test(source)) {
      violations.push({
        path: filePath,
        rule: "response-json",
        message:
          "Response.json não aplica automaticamente os headers obrigatórios do Portal Adoce.",
      });
    }

    if (
      /JSON\.stringify\s*\([\s\S]{0,240}Content-Type["']?\s*:\s*["']application\/json/i.test(
        source,
      )
    ) {
      violations.push({
        path: filePath,
        rule: "local-json-helper",
        message: "A Function mantém um helper JSON local e contorna secureJson.",
      });
    }

    if (!hasApprovedHelper(source)) {
      violations.push({
        path: filePath,
        rule: "missing-shared-boundary",
        message:
          "A Function não usa secureJson, secureText ou secureEmpty da fronteira compartilhada.",
      });
    }
  }

  return violations;
}
