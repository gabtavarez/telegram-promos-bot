import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import axios, { type AxiosInstance } from "axios";

interface TokenPayload {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId?: number;
}

interface PendingAuthorization {
  state: string;
  verifier: string;
  expiresAt: number;
}

interface MercadoLivreOAuthOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  redisUrl?: string;
  redisToken?: string;
}

interface RedisResponse<T> {
  result?: T;
  error?: string;
}

export class MercadoLivreOAuth {
  private readonly client = axios.create({ timeout: 15_000 });
  private readonly redis?: AxiosInstance;
  private readonly encryptionKey: Buffer;
  private memoryToken?: TokenPayload;
  private pending?: PendingAuthorization;

  constructor(private readonly options: MercadoLivreOAuthOptions) {
    this.encryptionKey = createHash("sha256").update(options.clientSecret).digest();
    if (options.redisUrl && options.redisToken) {
      this.redis = axios.create({
        baseURL: options.redisUrl.replace(/\/$/, ""),
        timeout: 10_000,
        headers: { Authorization: `Bearer ${options.redisToken}`, "Content-Type": "application/json" },
      });
    }
  }

  async createAuthorizationUrl(): Promise<string> {
    const state = randomBytes(24).toString("base64url");
    const verifier = randomBytes(48).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const pending = { state, verifier, expiresAt: Date.now() + 10 * 60_000 };
    await this.savePending(pending);

    const url = new URL("https://auth.mercadolivre.com.br/authorization");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.options.clientId);
    url.searchParams.set("redirect_uri", this.options.redirectUri);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeAuthorizationCode(code: string, state: string): Promise<void> {
    const pending = await this.loadPending();
    if (!pending || pending.expiresAt < Date.now() || !safeEqual(pending.state, state)) {
      throw new Error("Autorizacao expirada ou state invalido. Inicie o fluxo novamente.");
    }

    const form = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this.options.clientId,
      client_secret: this.options.clientSecret,
      code,
      redirect_uri: this.options.redirectUri,
      code_verifier: pending.verifier,
    });
    const token = await this.requestToken(form);
    await this.saveToken(token);
    await this.clearPending();
  }

  async getAccessToken(): Promise<string> {
    const token = await this.loadToken();
    if (!token) throw new Error("Mercado Livre ainda nao foi autorizado. Use /autorizar_meli no chat privado do bot.");
    if (token.expiresAt > Date.now() + 5 * 60_000) return token.accessToken;

    const form = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this.options.clientId,
      client_secret: this.options.clientSecret,
      refresh_token: token.refreshToken,
    });
    const refreshed = await this.requestToken(form);
    await this.saveToken(refreshed);
    return refreshed.accessToken;
  }

  async clearToken(): Promise<void> {
    this.memoryToken = undefined;
    if (this.redis) await this.redisCommand(["DEL", tokenKey()]);
  }

  private async requestToken(form: URLSearchParams): Promise<TokenPayload> {
    const { data } = await this.client.post<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
      user_id?: number;
    }>("https://api.mercadolibre.com/oauth/token", form.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    });
    if (!data.access_token || !data.refresh_token) throw new Error("Mercado Livre nao retornou os tokens esperados.");
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + Math.max(60, data.expires_in) * 1_000,
      userId: data.user_id,
    };
  }

  private async saveToken(token: TokenPayload): Promise<void> {
    this.memoryToken = token;
    if (this.redis) await this.redisCommand(["SET", tokenKey(), encrypt(JSON.stringify(token), this.encryptionKey)]);
  }

  private async loadToken(): Promise<TokenPayload | undefined> {
    if (this.memoryToken) return this.memoryToken;
    if (!this.redis) return undefined;
    const encrypted = await this.redisCommand<string | null>(["GET", tokenKey()]);
    if (!encrypted) return undefined;
    this.memoryToken = JSON.parse(decrypt(encrypted, this.encryptionKey)) as TokenPayload;
    return this.memoryToken;
  }

  private async savePending(pending: PendingAuthorization): Promise<void> {
    this.pending = pending;
    if (this.redis) {
      await this.redisCommand(["SET", pendingKey(), encrypt(JSON.stringify(pending), this.encryptionKey), "EX", 600]);
    }
  }

  private async loadPending(): Promise<PendingAuthorization | undefined> {
    if (this.pending) return this.pending;
    if (!this.redis) return undefined;
    const encrypted = await this.redisCommand<string | null>(["GET", pendingKey()]);
    return encrypted ? JSON.parse(decrypt(encrypted, this.encryptionKey)) as PendingAuthorization : undefined;
  }

  private async clearPending(): Promise<void> {
    this.pending = undefined;
    if (this.redis) await this.redisCommand(["DEL", pendingKey()]);
  }

  private async redisCommand<T = unknown>(command: Array<string | number>): Promise<T> {
    if (!this.redis) throw new Error("Redis nao configurado.");
    const { data } = await this.redis.post<RedisResponse<T>>("/", command);
    if (data.error) throw new Error(`Upstash Redis: ${data.error}`);
    return data.result as T;
  }
}

function encrypt(value: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

function decrypt(value: string, key: Buffer): string {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Token do Mercado Livre armazenado em formato invalido.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function safeEqual(left: string, right: string): boolean {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return leftHash.equals(rightHash);
}

function tokenKey(): string {
  return "telegram-promos:mercadolivre:oauth-token";
}

function pendingKey(): string {
  return "telegram-promos:mercadolivre:oauth-pending";
}
