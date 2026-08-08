import { describe, expect, it } from "vitest";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  sessionTokens,
} from "../netlify/functions/_shared/session-security";

describe("sessão das passkeys no BFF", () => {
  it("recusa sessão quando falta o refresh token", () => {
    const request = new Request("https://homologacao.test/api/auth-bff-passkeys", {
      headers: { cookie: `${ACCESS_COOKIE}=access-token` },
    });

    expect(sessionTokens(request)).toBeNull();
  });

  it("lê access e refresh token juntos dos cookies HttpOnly", () => {
    const request = new Request("https://homologacao.test/api/auth-bff-passkeys", {
      headers: {
        cookie: `${ACCESS_COOKIE}=access-token; ${REFRESH_COOKIE}=refresh-token`,
      },
    });

    expect(sessionTokens(request)).toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
  });
});
