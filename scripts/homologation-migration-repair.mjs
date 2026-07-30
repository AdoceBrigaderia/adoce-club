import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const VERSION_PATTERN = /^\d{14}$/;
const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;
const MIGRATION_FILE_PATTERN = /^(\d{14})_([a-z0-9][a-z0-9_]*)\.sql$/;
const DEFAULT_PLAN = "docs/evidence/homologation-migration-repair-plan-20260727.json";
const DEFAULT_LINKED_REF = "supabase/.temp/project-ref";
const DEFAULT_OUTPUT_DIRECTORY = "artifacts/migration-repair";
const SUPABASE_CLI_VERSION = "2.109.1";

export async function loadMigrationRepairPlan(planPath = DEFAULT_PLAN) {
  const plan = JSON.parse(await readFile(planPath, "utf8"));
  return validateMigrationRepairPlan(plan);
}

export function validateMigrationRepairPlan(plan) {
  if (!plan || typeof plan !== "object") {
    throw new Error("Plano de repair inválido.");
  }
  if (plan.environment !== "homologation") {
    throw new Error("Somente o ambiente de homologação é permitido.");
  }
  if (!PROJECT_REF_PATTERN.test(String(plan.project_id || ""))) {
    throw new Error("Project ref de homologação inválido.");
  }
  if (plan.production_forbidden !== true) {
    throw new Error("O plano precisa bloquear produção explicitamente.");
  }
  if (plan.status !== "planned_not_applied") {
    throw new Error("O plano precisa permanecer como planned_not_applied antes da execução.");
  }
  if (!Array.isArray(plan.decisions) || plan.decisions.length === 0) {
    throw new Error("O plano não contém decisões de repair.");
  }

  const seenVersions = new Set();
  const seenNames = new Set();
  for (const decision of plan.decisions) {
    const name = String(decision.name || "");
    const keepVersion = String(decision.keep_version || "");
    const localMatch = MIGRATION_FILE_PATTERN.exec(String(decision.local_file || ""));
    const targetMatch = MIGRATION_FILE_PATTERN.exec(String(decision.target_file || ""));
    if (!name || seenNames.has(name)) {
      throw new Error(`Nome de migration duplicado ou ausente no plano: ${name || "<vazio>"}.`);
    }
    seenNames.add(name);
    if (!VERSION_PATTERN.test(keepVersion)) {
      throw new Error(`Versão preservada inválida para ${name}.`);
    }
    if (!localMatch || localMatch[2] !== name) {
      throw new Error(`Arquivo local inválido para ${name}.`);
    }
    if (!targetMatch || targetMatch[1] !== keepVersion || targetMatch[2] !== name) {
      throw new Error(`Arquivo alvo incompatível com a versão preservada de ${name}.`);
    }
    if (!Array.isArray(decision.revert_versions) || decision.revert_versions.length === 0) {
      throw new Error(`Nenhuma versão revertida foi definida para ${name}.`);
    }
    for (const rawVersion of decision.revert_versions) {
      const version = String(rawVersion || "");
      if (!VERSION_PATTERN.test(version)) {
        throw new Error(`Versão revertida inválida para ${name}.`);
      }
      if (version === keepVersion) {
        throw new Error(`A versão preservada não pode ser revertida em ${name}.`);
      }
      if (seenVersions.has(version)) {
        throw new Error(`Versão revertida repetida no plano: ${version}.`);
      }
      seenVersions.add(version);
    }
  }

  return plan;
}

export function buildMigrationRepairCommands(plan) {
  return plan.decisions.flatMap((decision) =>
    decision.revert_versions.map((version) => ({
      name: decision.name,
      version: String(version),
      command: [
        "npx",
        "--yes",
        `supabase@${SUPABASE_CLI_VERSION}`,
        "migration",
        "repair",
        String(version),
        "--status",
        "reverted",
        "--linked",
      ],
    })),
  );
}

export async function readLinkedProjectRef(linkedRefPath = DEFAULT_LINKED_REF) {
  return (await readFile(linkedRefPath, "utf8")).trim();
}

export function assertHomologationRepairContext({
  plan,
  linkedProjectRef,
  homologationProjectRef,
  productionProjectRef,
  confirmation,
}) {
  if (!homologationProjectRef || homologationProjectRef !== plan.project_id) {
    throw new Error("A variável de homologação não corresponde ao plano aprovado.");
  }
  if (!productionProjectRef) {
    throw new Error("A referência de produção é obrigatória para o bloqueio cruzado.");
  }
  if (productionProjectRef === plan.project_id) {
    throw new Error("A referência de produção coincide com a homologação.");
  }
  if (linkedProjectRef !== plan.project_id) {
    throw new Error("O Supabase CLI não está vinculado ao projeto exclusivo de homologação.");
  }
  const expectedConfirmation = `REPARAR SOMENTE HOMOLOGACAO ${plan.project_id}`;
  if (confirmation !== expectedConfirmation) {
    throw new Error("Confirmação explícita do repair de homologação inválida.");
  }
  return true;
}

function runCommand(command, { cwd = process.cwd(), env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), {
      cwd,
      env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ code, stdout, stderr });
      else reject(new Error(`Comando falhou com código ${code}: ${command.join(" ")}`));
    });
  });
}

function parseArguments(argv) {
  const options = {
    planPath: DEFAULT_PLAN,
    linkedRefPath: DEFAULT_LINKED_REF,
    outputDirectory: DEFAULT_OUTPUT_DIRECTORY,
    apply: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--apply") options.apply = true;
    else if (value === "--plan") options.planPath = argv[++index];
    else if (value === "--linked-ref-file") options.linkedRefPath = argv[++index];
    else if (value === "--output-dir") options.outputDirectory = argv[++index];
    else throw new Error(`Argumento não reconhecido: ${value}`);
  }
  if (!options.planPath || !options.linkedRefPath || !options.outputDirectory) {
    throw new Error("Plano, vínculo e diretório de saída são obrigatórios.");
  }
  return options;
}

export async function runHomologationMigrationRepairCli(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const plan = await loadMigrationRepairPlan(options.planPath);
  const repairCommands = buildMigrationRepairCommands(plan);
  const report = {
    schema_version: 1,
    environment: plan.environment,
    project_id: plan.project_id,
    production_forbidden: true,
    mode: options.apply ? "apply" : "dry-run",
    plan_status: plan.status,
    command_count: repairCommands.length,
    repairs: repairCommands.map(({ name, version, command }) => ({
      name,
      version,
      command: command.join(" "),
    })),
  };

  await mkdir(options.outputDirectory, { recursive: true });
  await writeFile(
    path.join(options.outputDirectory, "migration-repair-plan.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );

  if (!options.apply) {
    console.log(JSON.stringify(report, null, 2));
    return report;
  }

  const linkedProjectRef = await readLinkedProjectRef(options.linkedRefPath);
  assertHomologationRepairContext({
    plan,
    linkedProjectRef,
    homologationProjectRef: process.env.ADOCE_HOMOLOGATION_SUPABASE_REF,
    productionProjectRef: process.env.ADOCE_PRODUCTION_SUPABASE_REF,
    confirmation: process.env.CONFIRM_HOMOLOGATION_MIGRATION_REPAIR,
  });

  const before = await runCommand([
    "npx",
    "--yes",
    `supabase@${SUPABASE_CLI_VERSION}`,
    "migration",
    "list",
    "--linked",
  ]);
  await writeFile(
    path.join(options.outputDirectory, "migration-list-before.txt"),
    before.stdout,
    "utf8",
  );

  for (const repair of repairCommands) {
    await runCommand(repair.command);
  }

  const after = await runCommand([
    "npx",
    "--yes",
    `supabase@${SUPABASE_CLI_VERSION}`,
    "migration",
    "list",
    "--linked",
  ]);
  await writeFile(
    path.join(options.outputDirectory, "migration-list-after.txt"),
    after.stdout,
    "utf8",
  );
  await writeFile(
    path.join(options.outputDirectory, "migration-repair-result.json"),
    `${JSON.stringify({ ...report, completed: true }, null, 2)}\n`,
    "utf8",
  );

  return { ...report, completed: true };
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectExecution) {
  runHomologationMigrationRepairCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
