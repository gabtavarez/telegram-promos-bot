"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const ACCENTS = [
  { hex: "#0560ff", name: "Azul órbita" },
  { hex: "#00b8ff", name: "Ciano" },
  { hex: "#7c5cff", name: "Violeta" },
  { hex: "#19c37d", name: "Verde" },
  { hex: "#ff7a1a", name: "Laranja" },
  { hex: "#ff3d71", name: "Rosa" },
];

export const WIDGETS = [
  { id: "timeline", label: "Ofertas ao longo do tempo" },
  { id: "stores", label: "Ofertas por loja" },
  { id: "categories", label: "Ofertas por categoria" },
  { id: "discounts", label: "Faixas de desconto" },
  { id: "health", label: "Saúde das lojas" },
  { id: "latest", label: "Últimas ofertas" },
] as const;

export type WidgetId = (typeof WIDGETS)[number]["id"];
export type Density = "confortavel" | "compacto";

export interface Prefs {
  accent: string;
  density: Density;
  widgets: Array<{ id: WidgetId; visible: boolean }>;
}

const DEFAULTS: Prefs = {
  accent: ACCENTS[0]!.hex,
  density: "confortavel",
  widgets: WIDGETS.map((widget) => ({ id: widget.id, visible: true })),
};

const KEY = "tp.prefs";

interface Ctx {
  prefs: Prefs;
  update: (patch: Partial<Prefs>) => void;
  reset: () => void;
}

const PrefsContext = createContext<Ctx | null>(null);

function normalize(raw: Partial<Prefs> | null): Prefs {
  const known = new Set(WIDGETS.map((widget) => widget.id));
  const saved = (raw?.widgets ?? []).filter((item) => known.has(item.id));
  const missing = WIDGETS.filter((widget) => !saved.some((item) => item.id === widget.id))
    .map((widget) => ({ id: widget.id, visible: true }));
  return {
    accent: raw?.accent && /^#[0-9a-f]{6}$/i.test(raw.accent) ? raw.accent : DEFAULTS.accent,
    density: raw?.density === "compacto" ? "compacto" : "confortavel",
    widgets: [...saved, ...missing],
  };
}

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored) setPrefs(normalize(JSON.parse(stored) as Partial<Prefs>));
    } catch {
      /* sem armazenamento: segue com o padrao */
    }
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", prefs.accent);
    document.documentElement.dataset.density = prefs.density;
  }, [prefs]);

  const persist = useCallback((next: Prefs) => {
    setPrefs(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignora */
    }
  }, []);

  const value = useMemo<Ctx>(() => ({
    prefs,
    update: (patch) => persist({ ...prefs, ...patch }),
    reset: () => persist(DEFAULTS),
  }), [prefs, persist]);

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Ctx {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs fora do PrefsProvider");
  return ctx;
}
