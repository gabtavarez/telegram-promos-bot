"use client";

import { useEffect } from "react";
import { ACCENTS, WIDGETS, usePrefs } from "./Prefs";

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { prefs, update, reset } = usePrefs();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const move = (index: number, direction: -1 | 1) => {
    const next = [...prefs.widgets];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    update({ widgets: next });
  };
  const toggle = (index: number) => {
    update({ widgets: prefs.widgets.map((widget, i) => (i === index ? { ...widget, visible: !widget.visible } : widget)) });
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Personalizar painel">
        <h2>Personalizar painel</h2>
        <p className="sub">As escolhas ficam salvas neste navegador.</p>

        <h3>Cor de destaque</h3>
        <div className="swatches">
          {ACCENTS.map((accent) => (
            <button
              key={accent.hex}
              className="swatch"
              style={{ ["--c" as string]: accent.hex }}
              aria-label={accent.name}
              aria-pressed={prefs.accent === accent.hex}
              onClick={() => update({ accent: accent.hex })}
            />
          ))}
        </div>

        <h3>Espaçamento</h3>
        <div className="seg" role="group">
          <button aria-pressed={prefs.density === "confortavel"} onClick={() => update({ density: "confortavel" })}>Confortável</button>
          <button aria-pressed={prefs.density === "compacto"} onClick={() => update({ density: "compacto" })}>Compacto</button>
        </div>

        <h3>Blocos da visão geral</h3>
        {prefs.widgets.map((widget, index) => {
          const meta = WIDGETS.find((item) => item.id === widget.id)!;
          return (
            <div className="order-row" key={widget.id}>
              <input type="checkbox" checked={widget.visible} onChange={() => toggle(index)} aria-label={`Mostrar ${meta.label}`} />
              <span className="label">{meta.label}</span>
              <button className="icon-btn" aria-label={`Subir ${meta.label}`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
              <button className="icon-btn" aria-label={`Descer ${meta.label}`} disabled={index === prefs.widgets.length - 1} onClick={() => move(index, 1)}>↓</button>
            </div>
          );
        })}

        <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
          <button className="btn" onClick={reset}>Restaurar padrão</button>
          <button className="btn primary" onClick={onClose}>Concluir</button>
        </div>
      </div>
    </>
  );
}
