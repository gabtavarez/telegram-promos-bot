"use client";

import { useEffect, useState } from "react";
import { useConfig } from "./ConfigProvider";
import { Field, Segmented, Switch } from "./Controls";
import { previewCaption, SAMPLE_OFFER } from "@/lib/preview";
import type { AdOptions } from "@/lib/botConfig";
import type { MetricsPayload, OfferLite } from "@/lib/types";

const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME || "seu_bot";

export function AdsEditor() {
  const { draft, edit, status } = useConfig();
  const ad = draft.ad;
  const [sample, setSample] = useState<OfferLite>(SAMPLE_OFFER);
  const [real, setReal] = useState(false);

  useEffect(() => {
    fetch("/api/metrics")
      .then((response) => response.json())
      .then((data: MetricsPayload) => {
        const candidate = data.offers?.find((offer) => offer.discount && offer.status === "active");
        if (candidate && data.mode === "live") { setSample(candidate); setReal(true); }
      })
      .catch(() => undefined);
  }, []);

  const set = <K extends keyof AdOptions>(key: K, value: AdOptions[K]) =>
    edit((current) => ({ ...current, ad: { ...current.ad, [key]: value } }));

  const { lines, buttons } = previewCaption(sample, ad, BOT_USERNAME);
  const compact = ad.template === "compacto";

  return (
    <div className="config-page with-preview">
      <div>
        <section className="section">
          <h2>Formato da mensagem</h2>
          <p className="lede">Define o quanto cada anúncio mostra. O compacto deixa só preço, título, link e cupom.</p>
          <Field label="Modelo">
            <Segmented value={ad.template} onChange={(value) => set("template", value)} options={[{ id: "completo", label: "Completo" }, { id: "compacto", label: "Compacto" }]} />
          </Field>
        </section>

        <section className="section">
          <h2>O que aparece no anúncio</h2>
          <Field label="Destaque do desconto" hint="Faixa no topo: oferta boa, super oferta ou desconto imperdível.">
            <Switch label="Destaque do desconto" checked={ad.showHeader && !compact} onChange={(value) => set("showHeader", value)} />
          </Field>
          <Field label="Preço antigo riscado" hint="Só aparece quando o desconto é verificado.">
            <Switch label="Preço antigo riscado" checked={ad.showOldPrice && !compact} onChange={(value) => set("showOldPrice", value)} />
          </Field>
          <Field label="Validade do cupom">
            <Switch label="Validade do cupom" checked={ad.showCouponExpiry && !compact} onChange={(value) => set("showCouponExpiry", value)} />
          </Field>
          <Field label="Hashtags de loja e categoria">
            <Switch label="Hashtags de loja e categoria" checked={ad.showHashtags} onChange={(value) => set("showHashtags", value)} />
          </Field>
          <Field label="Marcar como anúncio" hint="Acrescenta #Anúncio às hashtags, útil para divulgação de afiliado.">
            <Segmented value={ad.disclosure} onChange={(value) => set("disclosure", value)} options={[{ id: "none", label: "Não" }, { id: "anuncio", label: "Sim" }]} />
          </Field>
        </section>

        <section className="section">
          <h2>Botões e rodapé</h2>
          <Field label="Botões embaixo da mensagem">
            <Switch label="Botões embaixo da mensagem" checked={ad.showButtons} onChange={(value) => set("showButtons", value)} />
          </Field>
          <Field label="Texto do botão de compra" stack>
            <input className="input" aria-label="Texto do botão de compra" maxLength={30} value={ad.ctaLabel} onChange={(event) => set("ctaLabel", event.target.value)} />
          </Field>
          <Field label="Convite para os alertas de preço" hint="Link do bot no rodapé e botão “Criar alerta de preço”.">
            <Switch label="Convite para os alertas de preço" checked={ad.showAlertFooter} onChange={(value) => set("showAlertFooter", value)} />
          </Field>
          <Field label="Linha extra no rodapé" hint="Ex.: link do grupo de bate-papo ou do canal no WhatsApp. Até 120 caracteres." stack>
            <input className="input" aria-label="Linha extra no rodapé" maxLength={120} value={ad.customFooter} onChange={(event) => set("customFooter", event.target.value)} placeholder="Entre no grupo: t.me/..." />
          </Field>
        </section>
        {status === "loading" ? <p className="note">Carregando configuração…</p> : null}
      </div>

      <aside className="preview" aria-label="Pré-visualização">
        <h2>Pré-visualização</h2>
        <p className="note">{real ? "Com uma oferta real publicada pelo bot." : "Com uma oferta de exemplo."}</p>
        <div className="tg-wall">
          <div className="tg-bubble">
            <div className="tg-img">
              {sample.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sample.imageUrl} alt="" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="ph" src="/logo.png" alt="" />
              )}
            </div>
            <div className="tg-text">
              {lines.map((line, index) => (
                <div key={index} style={{ minHeight: line.length ? undefined : "0.9em" }}>
                  {line.map((span, i) => {
                    if (span.code) return <code key={i}>{span.t}</code>;
                    if (span.s) return <s key={i}>{span.t}</s>;
                    if (span.link) return <span className="tg-link" key={i}>{span.t}</span>;
                    return span.b ? <b key={i}>{span.t}</b> : <span key={i}>{span.t}</span>;
                  })}
                </div>
              ))}
            </div>
            <div className="tg-time">18:42</div>
          </div>
          {buttons.length ? (
            <div className="tg-btns">{buttons.map((label) => <div className="tg-btn" key={label}>{label}</div>)}</div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
