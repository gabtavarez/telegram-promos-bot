const encoder = new TextEncoder();

export const SESSION_COOKIE = "tp_session";
export const passwordConfigured = Boolean(process.env.DASHBOARD_PASSWORD);

async function sign(secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode("tavarez-promos-session"));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function sessionToken(): Promise<string | undefined> {
  const password = process.env.DASHBOARD_PASSWORD;
  return password ? sign(password) : undefined;
}

export async function passwordMatches(candidate: string): Promise<boolean> {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return false;
  return safeEqual(await sign(candidate), await sign(password));
}

/** Sem senha configurada o painel fica aberto para leitura; com senha exige a sessao valida. */
export async function isAuthed(cookieValue: string | undefined): Promise<boolean> {
  const expected = await sessionToken();
  if (!expected) return false;
  return Boolean(cookieValue) && safeEqual(cookieValue!, expected);
}
