"use client";

import { useEffect, useMemo, useState } from "react";
import { Columns, HBars, TimelineChart } from "./Charts";
import { usePrefs, type WidgetId } from "./Prefs";
import { SettingsSheet } from "./SettingsSheet";
import { PERIODS, brl, brl0, categoryOf, countBy, discountBins, inPeriod, summarize, timeAgo, timeline, type Period } from "@/lib/metrics";
import { REJECT_LABEL, STORE_LABEL, type CycleLite, type HealthLite, type MetricsPayload, type OfferLite } from "@/lib/types";

const SPAN: Record<WidgetId, string> = {
  timeline: "", funnel: "span-6", rejections: "span-6", stores: "span-6", categories: "span-6", discounts: "span-5", health: "span-7", latest: "",
};

export function Overview() {
  const { prefs } = usePrefs();
  const [data, setData] = useState<MetricsPayload>();
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<Period>("7d");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetch("/api/metrics")
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok) throw new Error((body as { error?: string }).error ?? "Falha ao carregar métricas.");
          if (active) { setData(body as MetricsPayload); setError(""); }
        })
        .catch((reason: Error) => active && setError(reason.message));
    void load();
    const timer = setInterval(load, 60_000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  const offers = useMemo(() => (data ? inPeriod(data.offers, period) : []), [data, period]);
  const summary = useMemo(() => summarize(offers), [offers]);
  const periodLabel = PERIODS.find((item) => item.id === period)!.label;

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Tavarez Promos</h1>
        <div className="head-actions">
          <div className="pills" role="group" aria-label="Período">
            {PERIODS.map((item) => (
              <button key={item.id} className="pill" aria-pressed={period === item.id} onClick={() => setPeriod(item.id)}>{item.label}</button>
            ))}
          </div>
          <button className="btn" onClick={() => setOpen(true)}>Personalizar</button>
        </div>
      </div>

      {data?.mode === "demo" ? (
        <p className="demo-note">Modo demonstração: estes são dados de exemplo. Para ver o seu canal, configure UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN na Vercel.</p>
      ) : null}
      {error ? <p className="demo-note" style={{ borderColor: "var(--bad)" }} role="alert">{error}</p> : null}

      {!data && !error ? <p className="empty">Carregando métricas…</p> : null}

      {data ? (
        <>
          <p className="headline">
            {summary.total === 0 ? (
              <>Nenhuma oferta publicada em {periodLabel}.</>
            ) : (
              <>
                Em {periodLabel}, o bot publicou <strong className="accent">{summary.total} {summary.total === 1 ? "oferta" : "ofertas"}</strong>
                {summary.avgDiscount ? <> com desconto médio de <strong>{summary.avgDiscount}%</strong></> : null}
                {summary.withCoupon ? <>. <strong>{summary.withCoupon}</strong> {summary.withCoupon === 1 ? "tinha" : "tinham"} cupom</> : null}
                {summary.soldout ? <> e <strong>{summary.soldout}</strong> já {summary.soldout === 1 ? "esgotou" : "esgotaram"}</> : null}.
                {" "}Ticket médio de <strong>{brl0.format(summary.avgPrice)}</strong>
                {data.alerts ? <>, com <strong>{data.alerts}</strong> {data.alerts === 1 ? "alerta ativo" : "alertas ativos"} de usuários</> : null}.
              </>
            )}
          </p>

          <div className="grid">
            {prefs.widgets.filter((widget) => widget.visible).map((widget) => (
              <section key={widget.id} className={`widget ${SPAN[widget.id]}`} aria-labelledby={`w-${widget.id}`}>
                <WidgetBody id={widget.id} offers={offers} period={period} data={data} />
              </section>
            ))}
          </div>
          <p className="note" style={{ marginTop: 40 }}>
            O bot guarda as últimas 100 ofertas publicadas; períodos longos podem mostrar menos do que foi realmente postado. Atualizado {timeAgo(data.generatedAt)}.
          </p>
        </>
      ) : null}

      {open ? <SettingsSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function Head({ id, title, note }: { id: string; title: string; note?: string }) {
  return (
    <div className="widget-head">
      <h2 id={`w-${id}`}>{title}</h2>
      {note ? <span className="note">{note}</span> : null}
    </div>
  );
}

function WidgetBody({ id, offers, period, data }: { id: WidgetId; offers: OfferLite[]; period: Period; data: MetricsPayload }) {
  const empty = <p className="empty">Sem ofertas neste período. Quando o bot publicar no canal, os números aparecem aqui.</p>;
  switch (id) {
    case "timeline":
      return (
        <>
          <Head id={id} title="Ofertas ao longo do tempo" note={period === "24h" ? "por hora" : "por dia"} />
          {offers.length ? <TimelineChart buckets={timeline(offers, period)} /> : empty}
        </>
      );
    case "funnel":
      return (
        <>
          <Head id={id} title="Funil do último ciclo" note={data.cycles[0] ? timeAgo(data.cycles[0].at) : undefined} />
          <Funnel cycle={data.cycles[0]} />
        </>
      );
    case "rejections":
      return (
        <>
          <Head id={id} title="Por que ofertas foram barradas" note="último ciclo" />
          <Rejections cycle={data.cycles[0]} />
        </>
      );
    case "stores":
      return (
        <>
          <Head id={id} title="Ofertas por loja" />
          {offers.length ? <HBars rows={countBy(offers, (offer) => STORE_LABEL[offer.provider] ?? offer.provider)} /> : empty}
        </>
      );
    case "categories":
      return (
        <>
          <Head id={id} title="Ofertas por categoria" />
          {offers.length ? <HBars rows={countBy(offers, (offer) => categoryOf(offer.title))} /> : empty}
        </>
      );
    case "discounts":
      return (
        <>
          <Head id={id} title="Faixas de desconto" note="só descontos verificados" />
          {offers.some((offer) => offer.discount !== undefined) ? <Columns buckets={discountBins(offers)} /> : empty}
        </>
      );
    case "health":
      return (
        <>
          <Head id={id} title="Saúde das lojas" note="último ciclo do bot" />
          <Health rows={data.health} />
        </>
      );
    case "latest":
      return (
        <>
          <Head id={id} title="Últimas ofertas" />
          <div className="offers">
            {data.offers.slice(0, 8).map((offer) => <Offer key={`${offer.id}-${offer.publishedAt}`} offer={offer} />)}
            {data.offers.length === 0 ? empty : null}
          </div>
        </>
      );
  }
}

const NO_CYCLE = <p className="empty">O funil aparece depois que o bot atualizado completar o primeiro ciclo.</p>;

function Funnel({ cycle }: { cycle?: CycleLite }) {
  if (!cycle) return NO_CYCLE;
  const { stages } = cycle;
  const rows = [
    { label: "Recebidas das lojas", value: cycle.received },
    { label: "Aprovadas na qualidade", value: stages.quality },
    { label: "Com desconto relevante", value: stages.promotable },
    { label: "Novas (sem repetir 12 h)", value: stages.fresh },
    { label: "Sem produto repetido", value: stages.noRepeat },
    { label: "Dentro dos seus filtros", value: stages.allowed },
    { label: "Após limites de diversidade", value: stages.diverse },
  ];
  return (
    <>
      <HBars rows={rows} limit={rows.length} />
      <p className="note" style={{ marginTop: 12 }}>
        {cycle.published
          ? <>Publicada neste ciclo: <strong>{cycle.published.title}</strong> ({cycle.published.provider}, {cycle.published.category}).</>
          : "Nenhuma oferta publicada neste ciclo."}
      </p>
    </>
  );
}

function Rejections({ cycle }: { cycle?: CycleLite }) {
  if (!cycle) return NO_CYCLE;
  const rows = Object.entries(cycle.rejected)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({ label: REJECT_LABEL[key] ?? key, value }))
    .sort((a, b) => b.value - a.value);
  if (rows.length === 0) return <p className="empty">Nada foi barrado neste ciclo.</p>;
  return (
    <>
      <HBars rows={rows} limit={8} />
      <p className="note" style={{ marginTop: 12 }}>
        Ajuste os filtros em <strong>Bot</strong> (qualidade, marcas, limites por categoria) se estiver barrando demais — ou de menos.
      </p>
    </>
  );
}

function Health({ rows }: { rows: HealthLite[] }) {
  if (rows.length === 0) return <p className="empty">O diagnóstico aparece depois do primeiro ciclo de busca do bot.</p>;
  const now = Date.now();
  return (
    <div className="health">
      {rows.map((row) => {
        const stale = now - Date.parse(row.lastAttemptAt) > 20 * 60_000;
        const level = row.error ? "bad" : stale || row.received === 0 ? "warn" : "";
        return (
          <div className="health-row" key={row.name}>
            <span className={`dot ${level}`} aria-label={level === "bad" ? "Com erro" : level === "warn" ? "Atenção" : "Normal"} />
            <div>
              <div className="name">{row.name}</div>
              <div className="detail">{row.received} recebidas · {row.qualityApproved} aprovadas · {row.promotable} em promoção · {row.newDeals} novas</div>
              {row.error ? <div className="err">{friendlyError(row.error)}</div> : null}
            </div>
            <span className="when">{timeAgo(row.lastAttemptAt)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Offer({ offer }: { offer: OfferLite }) {
  return (
    <div className="offer">
      {offer.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={offer.imageUrl} alt="" loading="lazy" width={56} height={56} />
      ) : (
        <span className="ph" aria-hidden="true">sem foto</span>
      )}
      <div>
        <a className="title" href={offer.url} target="_blank" rel="noreferrer">{offer.title}</a>
        <div className="meta">
          <span>{STORE_LABEL[offer.provider] ?? offer.provider}</span>
          <span>{timeAgo(offer.publishedAt)}</span>
          {offer.discount ? <span>-{offer.discount}%</span> : null}
          {offer.couponCode ? <span className="tag cup">cupom {offer.couponCode}</span> : null}
          {offer.status === "soldout" ? <span className="tag sold">esgotada</span> : null}
          {offer.status === "price-changed" ? <span className="tag chg">preço mudou</span> : null}
        </div>
      </div>
      <div className="price">
        {offer.previousPrice && offer.discount ? <s>{brl.format(offer.previousPrice)}</s> : null}
        {brl.format(offer.price)}
      </div>
    </div>
  );
}

function friendlyError(error: string): string {
  if (/captcha|trafego suspeito|bloqueado/i.test(error)) {
    return "Bloqueado pelo antibot da loja (CAPTCHA) para o IP do servidor. O bot espera 30 min entre tentativas; os cupons continuam funcionando.";
  }
  return error;
}
