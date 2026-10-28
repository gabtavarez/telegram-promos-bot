"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (response.ok) {
      window.location.href = "/";
      return;
    }
    setError(((await response.json().catch(() => ({}))) as { error?: string }).error ?? "Não foi possível entrar.");
    setBusy(false);
  }

  return (
    <main className="login">
      <form onSubmit={submit}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Tavarez Promos" />
        <h1>Painel do Tavarez Promos</h1>
        <input className="input" type="password" autoComplete="current-password" placeholder="Senha" aria-label="Senha" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus />
        <p className="err" role="alert">{error}</p>
        <button className="btn primary" disabled={busy || !password}>{busy ? "Entrando…" : "Entrar"}</button>
      </form>
    </main>
  );
}
