import { beforeEach, describe, expect, it, vi } from "vitest";

const axiosMocks = vi.hoisted(() => ({
  create: vi.fn(),
  post: vi.fn(),
}));

vi.mock("axios", () => ({
  default: { create: axiosMocks.create },
  create: axiosMocks.create,
}));

import { MercadoLivreOAuth } from "../src/services/MercadoLivreOAuth.js";

describe("MercadoLivreOAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    axiosMocks.create.mockReturnValue({ post: axiosMocks.post });
  });

  it("usa state e PKCE ao trocar o codigo e conserva o token em memoria", async () => {
    axiosMocks.post.mockResolvedValue({
      data: {
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 21_600,
        user_id: 123,
      },
    });
    const oauth = new MercadoLivreOAuth({
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "https://example.com/oauth/mercadolivre/callback",
    });

    const authorizationUrl = new URL(await oauth.createAuthorizationUrl());
    expect(authorizationUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorizationUrl.searchParams.get("code_challenge")).toBeTruthy();
    expect(authorizationUrl.searchParams.get("state")).toBeTruthy();

    await oauth.exchangeAuthorizationCode("authorization-code", authorizationUrl.searchParams.get("state")!);
    expect(await oauth.getAccessToken()).toBe("access-token");

    const submitted = new URLSearchParams(axiosMocks.post.mock.calls[0]?.[1] as string);
    expect(submitted.get("grant_type")).toBe("authorization_code");
    expect(submitted.get("code_verifier")).toBeTruthy();
    expect(submitted.get("client_secret")).toBe("client-secret");
    expect(axiosMocks.post).toHaveBeenCalledOnce();
  });

  it("recusa callback com state diferente", async () => {
    const oauth = new MercadoLivreOAuth({
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "https://example.com/oauth/mercadolivre/callback",
    });
    await oauth.createAuthorizationUrl();

    await expect(oauth.exchangeAuthorizationCode("code", "state-invalido"))
      .rejects.toThrow("state invalido");
    expect(axiosMocks.post).not.toHaveBeenCalled();
  });

  it("renova e substitui automaticamente o refresh token perto da expiracao", async () => {
    axiosMocks.post
      .mockResolvedValueOnce({
        data: { access_token: "access-1", refresh_token: "refresh-1", expires_in: 60 },
      })
      .mockResolvedValueOnce({
        data: { access_token: "access-2", refresh_token: "refresh-2", expires_in: 21_600 },
      });
    const oauth = new MercadoLivreOAuth({
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "https://example.com/oauth/mercadolivre/callback",
    });
    const authorizationUrl = new URL(await oauth.createAuthorizationUrl());
    await oauth.exchangeAuthorizationCode("code", authorizationUrl.searchParams.get("state")!);

    expect(await oauth.getAccessToken()).toBe("access-2");
    const refreshRequest = new URLSearchParams(axiosMocks.post.mock.calls[1]?.[1] as string);
    expect(refreshRequest.get("grant_type")).toBe("refresh_token");
    expect(refreshRequest.get("refresh_token")).toBe("refresh-1");
  });
});
