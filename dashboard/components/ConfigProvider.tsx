"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_BOT_CONFIG, type BotConfig } from "@/lib/botConfig";

type Status = "loading" | "ready" | "saving";

interface Ctx {
  draft: BotConfig;
  dirty: boolean;
  status: Status;
  mode: "live" | "demo";
  canEdit: boolean;
  reason?: string;
  message?: { kind: "ok" | "err"; text: string };
  edit: (change: (current: BotConfig) => BotConfig) => void;
  save: () => Promise<void>;
  discard: () => void;
}

const ConfigContext = createContext<Ctx | null>(null);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [saved, setSaved] = useState<BotConfig>(DEFAULT_BOT_CONFIG);
  const [draft, setDraft] = useState<BotConfig>(DEFAULT_BOT_CONFIG);
  const [status, setStatus] = useState<Status>("loading");
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [canEdit, setCanEdit] = useState(false);
  const [reason, setReason] = useState<string>();
  const [message, setMessage] = useState<Ctx["message"]>();

  useEffect(() => {
    let active = true;
    fetch("/api/config")
      .then((response) => response.json())
      .then((data: { config: BotConfig; mode: "live" | "demo"; canEdit: boolean; reason?: string }) => {
        if (!active) return;
        setSaved(data.config);
        setDraft(data.config);
        setMode(data.mode);
        setCanEdit(data.canEdit);
        setReason(data.reason);
        setStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setMessage({ kind: "err", text: "Não foi possível carregar a configuração. Recarregue a página." });
        setStatus("ready");
      });
    return () => { active = false; };
  }, []);

  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);

  const edit = useCallback((change: (current: BotConfig) => BotConfig) => {
    setMessage(undefined);
    setDraft((current) => change(current));
  }, []);

  const save = useCallback(async () => {
    setStatus("saving");
    setMessage(undefined);
    try {
      const response = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = (await response.json()) as { config?: BotConfig; error?: string };
      if (!response.ok || !data.config) throw new Error(data.error ?? "Falha ao salvar.");
      setSaved(data.config);
      setDraft(data.config);
      setMessage({ kind: "ok", text: "Salvo. O bot aplica as mudanças em até 30 segundos." });
    } catch (error) {
      setMessage({ kind: "err", text: error instanceof Error ? error.message : "Falha ao salvar." });
    }
    setStatus("ready");
  }, [draft]);

  const discard = useCallback(() => {
    setDraft(saved);
    setMessage(undefined);
  }, [saved]);

  const value = useMemo<Ctx>(
    () => ({ draft, dirty, status, mode, canEdit, reason, message, edit, save, discard }),
    [draft, dirty, status, mode, canEdit, reason, message, edit, save, discard],
  );
  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig(): Ctx {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useConfig fora do ConfigProvider");
  return ctx;
}
