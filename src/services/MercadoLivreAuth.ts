import { createHash, randomBytes } from "node:crypto";
import axios, { type AxiosInstance } from "axios";

const API = "https://api.mercadolibre.com";
const AUTH = "https://auth.mercadolivre.com.br/authorization";
const TOKEN_KEY = "telegram-promos:ml-oauth";

interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  userId?: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  user_id?: number;
}

/** Armazenamento minimo chave/valor (Upstash REST) para o token sobreviver a reinicios. */
class TokenStore {
  private memory?: string;
  private readonly client?: AxiosInstance;

  constructor(url?: string, token?: string) {
    if (url && token) {
      this.client = axios.create({ baseURL: url.replace(/\/$/, ""), timeout: 10_000, headers: { Authorization: `Bearer ${token}` } });
    }
  }

  async get(): Promise<StoredToken | undefined> {
    const raw = this.client
      ? (await this.client.post<{ result: string | null }>("/", ["GET", TOKEN_KEY])).data.result
      : this.memory;
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as StoredToken;
    } catch {
      return undefined;
    }
  }

  async set(value: StoredToken): Promise<void> {
    const raw = JSON.stringify(value);
    if (this.client) await this.client.post("/", ["SET", TOKEN_KEY, raw]);
    else this.memory = raw;
  }
}

/** OAuth do app do Mercado Livre (authorization code + PKCE, com refresh automatico). */
export class MercadoLivreAuth {
  private readonly store: TokenStore;
  private readonly pending = new Map<string, { verifier?: string; createdAt: number }>();
  private cached?: StoredToken;
  private refreshing?: Promise<StoredToken | undefined>;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly redirectUri: string,
    upstashUrl?: string,
    upstashToken?: string,
  ) {
    this.store = new TokenStore(upstashUrl, upstashToken);
  }

  authorizationUrl(usePkce = true): string {
    const state = randomBytes(16).toString("hex");
    const verifier = usePkce ? randomBytes(32).toString("base64url") : undefined;
    for (const [key, value] of this.pending) if (Date.now() - value.createdAt > 15 * 60_000) this.pending.delete(key);
    this.pending.set(state, { verifier, createdAt: Date.now() });
    const url = new URL(AUTH);
    const params = new URLSearchParams({ response_type: "code", client_id: this.clientId, redirect_uri: this.redirectUri, state });
    if (verifier) {
      params.set("code_challenge", createHash("sha256").update(verifier).digest("base64url"));
      params.set("code_challenge_method", "S256");
    }
    url.search = params.toString();
    return url.toString();
  }

  async handleCallback(code: string, state: string): Promise<StoredToken> {
    const pending = this.pending.get(state);
    if (!pending) throw new Error("Login expirado ou invalido. Abra o link de login de novo.");
    this.pending.delete(state);
    return this.requestToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.redirectUri,
      ...(pending.verifier ? { code_verifier: pending.verifier } : {}),
    });
  }

  async isConnected(): Promise<boolean> {
    return Boolean(await this.getAccessToken().catch(() => undefined));
  }

  async getAccessToken(): Promise<string | undefined> {
    this.cached ??= await this.store.get();
    if (!this.cached) return undefined;
    if (this.cached.expiresAt - Date.now() > 5 * 60_000) return this.cached.accessToken;
    if (!this.cached.refreshToken) return undefined;
    this.refreshing ??= this.requestToken({ grant_type: "refresh_token", refresh_token: this.cached.refreshToken })
      .catch((error) => {
        console.error("Mercado Livre: falha ao renovar o token; faca login de novo.", describe(error));
        return undefined;
      })
      .finally(() => { this.refreshing = undefined; });
    return (await this.refreshing)?.accessToken;
  }

  private async requestToken(params: Record<string, string>): Promise<StoredToken> {
    const body = new URLSearchParams({ client_id: this.clientId, client_secret: this.clientSecret, ...params });
    const { data } = await axios.post<TokenResponse>(`${API}/oauth/token`, body.toString(), {
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      timeout: 15_000,
    });
    const token: StoredToken = {
      accessToken: data.access_token,
      // O refresh token do ML e de uso unico: guarda sempre o novo.
      refreshToken: data.refresh_token ?? this.cached?.refreshToken,
      expiresAt: Date.now() + data.expires_in * 1_000,
      userId: data.user_id ?? this.cached?.userId,
    };
    this.cached = token;
    await this.store.set(token);
    return token;
  }

  /** Testa quais endpoints de busca a API libera para este app. */
  async diagnose(query = "ssd nvme"): Promise<Record<string, unknown>> {
    const token = await this.getAccessToken();
    if (!token) return { connected: false, error: "Sem login. Abra /ml/login primeiro." };
    const headers = { Authorization: `Bearer ${token}` };
    const probe = async (path: string, summarize: (data: any) => unknown) => {
      try {
        const { status, data } = await axios.get(`${API}${path}`, { headers, timeout: 15_000 });
        return { status, ...((summarize(data) as object) ?? {}) };
      } catch (error) {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        const message = axios.isAxiosError(error) ? JSON.stringify(error.response?.data ?? error.message).slice(0, 300) : String(error);
        return { status, error: message };
      }
    };
    const q = encodeURIComponent(query);
    const search = await probe(`/sites/MLB/search?q=${q}&limit=5`, (d) => ({
      total: d?.paging?.total,
      sample: d?.results?.slice(0, 3).map((r: any) => ({ id: r.id, title: r.title, price: r.price, original_price: r.original_price })),
    }));
    const products = await probe(`/products/search?status=active&site_id=MLB&q=${q}&limit=5`, (d) => ({
      total: d?.paging?.total,
      sample: d?.results?.slice(0, 3).map((r: any) => ({ id: r.id, name: r.name })),
    }));
    const firstProduct = (products as any)?.sample?.[0]?.id as string | undefined;
    const productItems = firstProduct
      ? await probe(`/products/${firstProduct}/items`, (d) => ({
        sample: d?.results?.slice(0, 2).map((r: any) => ({ item_id: r.item_id, price: r.price, original_price: r.original_price })),
      }))
      : { skipped: true };
    const highlights = await probe(`/highlights/MLB/category/MLB1648`, (d) => ({ count: d?.content?.length }));
    const me = await probe(`/users/me`, (d) => ({ id: d?.id, nickname: d?.nickname }));
    return { connected: true, me, search, products, productItems, highlights };
  }
}

function describe(error: unknown): string {
  if (axios.isAxiosError(error)) return `${error.response?.status ?? error.code}: ${JSON.stringify(error.response?.data ?? error.message).slice(0, 300)}`;
  return error instanceof Error ? error.message : String(error);
}
