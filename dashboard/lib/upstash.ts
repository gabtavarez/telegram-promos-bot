const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export const hasUpstash = Boolean(url && token);

export async function redis<T>(command: Array<string | number>): Promise<T> {
  if (!url || !token) throw new Error("Upstash nao configurado");
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Upstash respondeu ${response.status}`);
  const data = (await response.json()) as { result?: T; error?: string };
  if (data.error) throw new Error(`Upstash: ${data.error}`);
  return data.result as T;
}

export const KEYS = {
  published: "telegram-promos:published",
  health: "telegram-promos:provider-health",
  alerts: "telegram-promos:alerts",
  coupons: "telegram-promos:active-coupons",
  config: "telegram-promos:config",
} as const;

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
