"use client";

import { useConfig } from "./ConfigProvider";

export function SaveBar() {
  const { dirty, status, canEdit, reason, message, save, discard } = useConfig();
  if (!dirty && !message) return null;
  const text = message?.text ?? (canEdit ? "Você tem alterações não salvas." : reason ?? "Edição indisponível.");
  const kind = message?.kind ?? (!canEdit ? "err" : undefined);
  return (
    <div className="savebar" role="region" aria-label="Salvar configuração">
      <div className="savebar-inner">
        <p className={`msg ${kind ?? ""}`} role="status">{text}</p>
        {dirty ? <button className="btn" onClick={discard} disabled={status === "saving"}>Descartar</button> : null}
        {dirty ? <button className="btn primary" onClick={save} disabled={!canEdit || status === "saving"}>{status === "saving" ? "Salvando…" : "Salvar alterações"}</button> : null}
      </div>
    </div>
  );
}
