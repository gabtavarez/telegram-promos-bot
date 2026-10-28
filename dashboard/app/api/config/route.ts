import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, isAuthed, passwordConfigured } from "@/lib/auth";
import { botConfigSchema, parseBotConfig } from "@/lib/botConfig";
import { KEYS, hasUpstash, parseJson, redis } from "@/lib/upstash";

export const dynamic = "force-dynamic";

async function editPermission(): Promise<{ canEdit: boolean; reason?: string }> {
  if (!hasUpstash) return { canEdit: false, reason: "Modo demonstração: conecte o Upstash para salvar." };
  if (!passwordConfigured) return { canEdit: false, reason: "Defina DASHBOARD_PASSWORD na Vercel para liberar a edição." };
  const jar = await cookies();
  if (!(await isAuthed(jar.get(SESSION_COOKIE)?.value))) return { canEdit: false, reason: "Entre com a senha para editar." };
  return { canEdit: true };
}

export async function GET() {
  const permission = await editPermission();
  let config = parseBotConfig({});
  if (hasUpstash) {
    try {
      config = parseBotConfig(parseJson<unknown>(await redis<string | null>(["GET", KEYS.config]), {}));
    } catch {
      /* usa o padrao se o Redis estiver indisponivel */
    }
  }
  return NextResponse.json({ config, mode: hasUpstash ? "live" : "demo", ...permission });
}

export async function PUT(request: Request) {
  const permission = await editPermission();
  if (!permission.canEdit) return NextResponse.json({ error: permission.reason }, { status: 403 });
  const parsed = botConfigSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Configuração inválida." }, { status: 400 });
  await redis<string>(["SET", KEYS.config, JSON.stringify(parsed.data)]);
  return NextResponse.json({ ok: true, config: parsed.data });
}
