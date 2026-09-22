import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("acesso da operação com senha", () => {
  it("usa celular e senha como acesso principal da equipe", () => {
    const app = source("./AccessApp.tsx");
    expect(app).toContain(
      "await signInWithStaffPhonePassword(phone, password, rememberLogin)",
    );
    expect(app).toContain('surface === "operation" ? "Entrar com senha"');
    expect(app).toContain("Use seu celular com DDD e a senha da operação.");
    expect(app).toContain('placeholder="(85) 99999-9999"');
  });

  it("permite mostrar e ocultar a senha digitada", () => {
    const app = source("./AccessApp.tsx");
    expect(app).toContain("const [showPassword, setShowPassword] = useState(false)");
    expect(app).toContain('type={showPassword ? "text" : "password"}');
    expect(app).toContain('aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}');
  });

  it("recupera a senha da equipe somente pelo WhatsApp", () => {
    const app = source("./AccessApp.tsx");
    const passwordForm = app.slice(
      app.indexOf('!registering && loginMode === "password"'),
      app.indexOf('!registering && loginMode === "forgot"'),
    );
    expect(passwordForm).toContain('setLoginMode("forgot")');
    expect(passwordForm).toContain("Esqueci a senha");
    expect(app).toContain("await requestPasswordReset({ phone })");
    expect(app).toContain("Enviar código pelo WhatsApp");
    expect(app).not.toContain("Entrar com código enviado por e-mail");
  });

  it("oferece uma saída explícita nas configurações da operação", () => {
    const app = source("./AccessApp.tsx");
    expect(app).toContain('id="operation-session-title"');
    expect(app).toContain("Sessão neste aparelho");
    expect(app).toContain("Sair da operação");
    expect(app).toContain("o aplicativo deixa de ouvir e imprimir novos pedidos");
  });

  it("autentica pelo endpoint protegido sem expor o e-mail interno", () => {
    const auth = source("./services/auth.ts");
    const endpoint = source("../netlify/functions/staff-phone-login.ts");
    expect(auth).toContain('fetch("/api/staff-phone-login"');
    expect(endpoint).toContain('.eq("phone_e164", phone)');
    expect(endpoint).toContain('.from("staff_members")');
    expect(endpoint).toContain('const configured = env("SITE_URL")');
    expect(endpoint).toContain('"Celular ou senha incorretos."');
  });

  it("obriga a troca da senha temporária no primeiro acesso", () => {
    const app = source("./AccessApp.tsx");
    const migration = source(
      "../supabase/migrations/20260723101500_forced_password_change.sql",
    );
    expect(app).toContain("if (mustChangePassword || passwordRecoveryRequested)");
    expect(app).toContain('"complete_forced_password_change"');
    expect(migration).toContain("must_change_password boolean");
  });

  it("obriga a criação de nova senha após recuperação pelo WhatsApp", () => {
    const app = source("./AccessApp.tsx");

    expect(app).toContain(
      'sessionStorage.getItem(passwordRecoveryStorageKey) === "true"',
    );
    expect(app).toContain("if (mustChangePassword || passwordRecoveryRequested)");
    expect(app).toContain("setPasswordRecoveryRequested(false)");
    expect(app).toContain(
      "sessionStorage.removeItem(passwordRecoveryStorageKey)",
    );
    expect(app).toContain("O código recebido pelo WhatsApp confirmou sua identidade.");
  });

  it("permite concluir a troca somente com uma sessão autenticada", () => {
    const migration = source(
      "../supabase/migrations/20260803095005_restore_forced_password_completion_grant.sql",
    );

    expect(migration).toContain(
      "grant execute on function public.complete_forced_password_change()",
    );
    expect(migration).toContain("to authenticated");
    expect(migration).toContain("from public, anon");
  });

  it("mantém as rotinas do Clube disponíveis apenas após o login", () => {
    const migration = source(
      "../supabase/migrations/20260803095152_restore_customer_club_rpc_grants.sql",
    );

    expect(migration).toContain("public.customer_referral_overview()");
    expect(migration).toContain("public.customer_group_overview()");
    expect(migration).toContain("public.create_group_invite(text)");
    expect(migration).toContain("to authenticated");
    expect(migration).toContain("from public, anon");
  });
});
