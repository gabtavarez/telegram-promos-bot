"use client";

import { useState } from "react";

export function Field({ label, hint, children, stack }: { label: string; hint?: string; children: React.ReactNode; stack?: boolean }) {
  return (
    <div className={stack ? "field stack" : "field"}>
      <div className="txt">
        <div className="lab">{label}</div>
        {hint ? <div className="hint">{hint}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />;
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Array<{ id: T; label: string }>; onChange: (value: T) => void }) {
  return (
    <div className="seg" role="group">
      {options.map((option) => (
        <button key={option.id} type="button" aria-pressed={value === option.id} onClick={() => onChange(option.id)}>{option.label}</button>
      ))}
    </div>
  );
}

export function Slider({ value, min, max, step = 1, format, onChange, label }: {
  value: number; min: number; max: number; step?: number; format?: (value: number) => string; onChange: (value: number) => void; label: string;
}) {
  return (
    <div className="range-wrap">
      <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <output>{format ? format(value) : value}</output>
    </div>
  );
}

export function NumberInput({ value, onChange, min = 0, max, label, suffix }: {
  value: number; onChange: (value: number) => void; min?: number; max?: number; label: string; suffix?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
      <input
        className="input num"
        type="number"
        inputMode="decimal"
        aria-label={label}
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(Math.min(max ?? Infinity, Math.max(min, next)));
        }}
      />
      {suffix ? <span className="note">{suffix}</span> : null}
    </div>
  );
}

export function TagInput({ values, onChange, placeholder, label }: { values: string[]; onChange: (values: string[]) => void; placeholder: string; label: string }) {
  const [text, setText] = useState("");
  const add = () => {
    const next = text.trim().replace(/,$/, "").slice(0, 40);
    if (next && !values.some((item) => item.toLowerCase() === next.toLowerCase()) && values.length < 40) onChange([...values, next]);
    setText("");
  };
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <input
        className="input"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") { event.preventDefault(); add(); }
          if (event.key === "Backspace" && !text && values.length) onChange(values.slice(0, -1));
        }}
        onBlur={add}
      />
      {values.length ? (
        <div className="chips">
          {values.map((value) => (
            <span className="chip" key={value}>
              {value}
              <button type="button" aria-label={`Remover ${value}`} onClick={() => onChange(values.filter((item) => item !== value))}>×</button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
