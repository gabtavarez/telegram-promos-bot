"use client";

import { useEffect, useState } from "react";
import { relativeTime } from "@/lib/format";

/** Tempo relativo calculado no navegador (a página fica em cache, o relógio não). */
export function TimeAgo({ iso }: { iso: string }) {
  const [label, setLabel] = useState(() => relativeTime(iso));
  useEffect(() => {
    setLabel(relativeTime(iso));
    const timer = setInterval(() => setLabel(relativeTime(iso)), 60_000);
    return () => clearInterval(timer);
  }, [iso]);
  return <time dateTime={iso} suppressHydrationWarning>{label}</time>;
}
