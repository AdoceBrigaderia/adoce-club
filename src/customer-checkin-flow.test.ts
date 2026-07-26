import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CLIENT_RPC_ALLOWLIST,
  OPERATION_RPC_ALLOWLIST,
} from "../netlify/functions/_shared/bff-rpc-policy";

const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const customerPage = readFileSync(
  new URL("./CustomerCheckInPage.tsx", import.meta.url),
  "utf8",
);
const operationQueue = readFileSync(
  new URL("./OperationCustomerCheckIns.tsx", import.meta.url),
  "utf8",
);
const operationHub = readFileSync(
  new URL("./OperationBusinessHub.tsx", import.meta.url),
  "utf8",
);
const customerBff = readFileSync(
  new URL("../netlify/functions/auth-bff-client-rpc.ts", import.meta.url),
  "utf8",
);
const customerStyles = readFileSync(
  new URL("./customer-checkin-page.css", import.meta.url),
  "utf8",
);
const operationStyles = readFileSync(
  new URL("./operation-customer-checkins.css", import.meta.url),
  "utf8",
);

describe("fluxo NFC invertido e QR", () => {
  it("possui rota pública própria antes do gateway de login do cliente", () => {
    expect(app).toContain('location.hash.startsWith("#check-in")');
    expect(app).toContain("<PasskeyClientGateway />");
    expect(app.indexOf("<CustomerCheckInPage />")).toBeLessThan(
      app.indexOf("<PasskeyClientGateway />"),
    );
  });

  it("usa sessão cliente em cookie e BFF com CSRF", () => {
    expect(CLIENT_RPC_ALLOWLIST).toContain("customer_create_store_checkin");
    expect(customerBff).toContain('cookies.get(SURFACE_COOKIE) !== "client"');
    expect(customerBff).toContain("validCsrf(request)");
    expect(customerPage).toContain("clientBffRpc<CheckInResult>");
    expect(customerPage).not.toContain("requireSupabase");
    expect(customerPage).not.toContain("Authorization");
  });

  it("retoma o check-in depois do login e não pede cartão físico", () => {
    expect(customerPage).toContain("rememberCustomerCheckInReturn");
    expect(customerPage).toContain("Depois do login, você volta automaticamente");
    expect(customerPage).toContain("O NFC e o QR não guardam seus dados");
  });

  it("mostra o cliente na operação e aplica carimbos com um toque", () => {
    expect(OPERATION_RPC_ALLOWLIST).toContain("staff_list_active_customer_checkins");
    expect(OPERATION_RPC_ALLOWLIST).toContain("staff_apply_customer_checkin_stamps");
    expect(operationHub).toContain("<OperationCustomerCheckIns />");
    expect(operationQueue).toContain("[1, 2, 3].map");
    expect(operationQueue).toContain("checkin-loyalty:");
  });

  it("mantém áreas de toque grandes no celular e tablet", () => {
    expect(customerStyles).toContain("min-height:60px");
    expect(operationStyles).toContain("min-height:62px");
    expect(operationStyles).toContain("min-height:68px");
  });
});
