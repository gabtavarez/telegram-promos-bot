"use client";

import { useConfig } from "./ConfigProvider";
import { Field, NumberInput, Segmented, Slider, Switch, TagInput } from "./Controls";
import type { BotConfig, StoreKey } from "@/lib/botConfig";
import { STORE_LABEL } from "@/lib/types";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

export function BotEditor() {
  const { draft, edit } = useConfig();
  const { bot, filters } = draft;
  const setBot = (patch: Partial<BotConfig["bot"]>) => edit((current) => ({ ...current, bot: { ...current.bot, ...patch } }));
  const setFilters = (patch: Partial<BotConfig["filters"]>) => edit((current) => ({ ...current, filters: { ...current.filters, ...patch } }));
  const stores = Object.keys(filters.stores) as StoreKey[];

  return (
    <div className="config-page">
      <section className="section">
        <h2>Publicação</h2>
        <p className="lede">Liga e desliga o bot sem precisar de deploy. Pausado, ele não publica nem envia alertas.</p>
        <Field label="Bot ativo">
          <Switch label="Bot ativo" checked={!bot.paused} onChange={(value) => setBot({ paused: !value })} />
        </Field>
      </section>

      <section className="section">
        <h2>Horários e ritmo</h2>
        <p className="lede">Controla quando e com que frequência o canal recebe ofertas. Alertas privados não são afetados.</p>
        <Field label="Horário silencioso" hint="Nenhuma oferta é publicada neste intervalo (horário de Brasília).">
          <Switch label="Horário silencioso" checked={bot.quietHours.enabled} onChange={(value) => setBot({ quietHours: { ...bot.quietHours, enabled: value } })} />
        </Field>
        {bot.quietHours.enabled ? (
          <Field label="Das / até">
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <select className="select" aria-label="Início do horário silencioso" value={bot.quietHours.start} onChange={(event) => setBot({ quietHours: { ...bot.quietHours, start: Number(event.target.value) } })}>
                {HOURS.map((hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}
              </select>
              <span className="note">até</span>
              <select className="select" aria-label="Fim do horário silencioso" value={bot.quietHours.end} onChange={(event) => setBot({ quietHours: { ...bot.quietHours, end: Number(event.target.value) } })}>
                {HOURS.map((hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}
              </select>
            </div>
          </Field>
        ) : null}
        <Field label="Intervalo mínimo entre ofertas" hint="0 = publica sempre que achar uma boa oferta.">
          <NumberInput label="Intervalo mínimo em minutos" value={bot.minMinutesBetweenPosts} max={720} suffix="min" onChange={(value) => setBot({ minMinutesBetweenPosts: Math.round(value) })} />
        </Field>
        <Field label="Limite de ofertas por dia" hint="0 = sem limite.">
          <NumberInput label="Limite de ofertas por dia" value={bot.dailyLimit} max={500} suffix="por dia" onChange={(value) => setBot({ dailyLimit: Math.round(value) })} />
        </Field>
      </section>

      <section className="section">
        <h2>Lojas</h2>
        <p className="lede">Lojas desligadas deixam de ser consultadas. A Amazon, Kabum, Shopee e AliExpress só funcionam se tiverem credenciais no bot.</p>
        <div className="stores">
          {stores.map((store) => (
            <button key={store} type="button" className="store-toggle" aria-pressed={filters.stores[store]} onClick={() => setFilters({ stores: { ...filters.stores, [store]: !filters.stores[store] } })}>
              <span>{STORE_LABEL[store]}</span>
              <span>{filters.stores[store] ? "Ligada" : "Desligada"}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Filtros de oferta</h2>
        <p className="lede">Valem além do filtro de qualidade de hardware que o bot já aplica.</p>
        <Field label="Desconto mínimo" hint="0% aceita qualquer oferta aprovada pelo filtro de qualidade.">
          <Slider label="Desconto mínimo" value={filters.minDiscount} min={0} max={60} step={5} format={(value) => `${value}%`} onChange={(value) => setFilters({ minDiscount: value })} />
        </Field>
        <Field label="Preço mínimo" hint="0 = sem mínimo.">
          <NumberInput label="Preço mínimo" value={filters.minPrice} max={1_000_000} suffix="R$" onChange={(value) => setFilters({ minPrice: value })} />
        </Field>
        <Field label="Preço máximo" hint="0 = sem máximo.">
          <NumberInput label="Preço máximo" value={filters.maxPrice} max={1_000_000} suffix="R$" onChange={(value) => setFilters({ maxPrice: value })} />
        </Field>
        <Field label="Só ofertas com cupom">
          <Switch label="Só ofertas com cupom" checked={filters.onlyWithCoupon} onChange={(value) => setFilters({ onlyWithCoupon: value })} />
        </Field>
        <Field label="Palavras obrigatórias" hint="A oferta precisa ter pelo menos uma no título. Digite e aperte Enter." stack>
          <TagInput label="Palavras obrigatórias" placeholder="rtx, ssd, ryzen…" values={filters.requiredKeywords} onChange={(values) => setFilters({ requiredKeywords: values })} />
        </Field>
        <Field label="Palavras bloqueadas" hint="Ofertas com qualquer uma dessas no título são descartadas." stack>
          <TagInput label="Palavras bloqueadas" placeholder="usado, recondicionado…" values={filters.blockedKeywords} onChange={(values) => setFilters({ blockedKeywords: values })} />
        </Field>
      </section>

      <section className="section">
        <h2>Repetição</h2>
        <p className="lede">Evita o mesmo produto em anúncios diferentes dentro da janela, a menos que o preço caia.</p>
        <Field label="Janela sem repetir o produto">
          <Slider label="Janela sem repetir o produto" value={bot.repeatWindowHours} min={12} max={168} step={12} format={(value) => `${value} h`} onChange={(value) => setBot({ repeatWindowHours: value })} />
        </Field>
        <Field label="Queda de preço que libera repostar" hint="Se o preço cair pelo menos isso, o produto pode voltar ao canal.">
          <Slider label="Queda de preço que libera repostar" value={bot.repostPriceDropPercent} min={1} max={30} format={(value) => `${value}%`} onChange={(value) => setBot({ repostPriceDropPercent: value })} />
        </Field>
      </section>
    </div>
  );
}
