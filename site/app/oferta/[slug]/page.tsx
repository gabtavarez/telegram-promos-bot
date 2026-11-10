import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OfferCard } from "@/components/OfferCard";
import { PriceChart } from "@/components/PriceChart";
import { TimeAgo } from "@/components/TimeAgo";
import { getOffer, getOffers, getPriceHistory } from "@/lib/data";
import { brl, cleanTitle } from "@/lib/format";
import { botUrl, SITE } from "@/lib/site";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const offer = await getOffer((await params).slug);
  if (!offer) return { title: "Oferta não encontrada" };
  const price = brl.format(offer.price);
  return {
    title: `${offer.shortTitle} por ${price}`,
    description: `${offer.shortTitle} por ${price}${offer.discount ? ` (-${offer.discount}%)` : ""} na ${offer.storeLabel}. Veja o histórico de preço antes de comprar.`,
    alternates: { canonical: `/oferta/${offer.slug}` },
    openGraph: { images: [offer.image] },
  };
}

export default async function OfferPage({ params }: { params: Promise<{ slug: string }> }) {
  const offer = await getOffer((await params).slug);
  if (!offer) notFound();
  const [history, all] = await Promise.all([getPriceHistory(offer.dealId), getOffers()]);
  const prices = history.map((point) => point.price);
  const average = prices.length ? prices.reduce((sum, value) => sum + value, 0) / prices.length : undefined;
  const lowest = prices.length ? Math.min(...prices) : undefined;
  const belowAverage = average ? Math.round((1 - offer.price / average) * 100) : 0;
  // "De R$ X" que o histórico desmente (preço atual na média): não mostramos o desconto da loja.
  const inflated = history.length >= 5 && belowAverage < 3;
  const previousPrice = inflated ? undefined : offer.previousPrice;
  const discount = inflated ? undefined : offer.discount;
  const verdict = prices.length < 3
    ? undefined
    : offer.price <= (lowest ?? Infinity) ? { tone: "good", text: "Menor preço que o bot já viu" }
    : belowAverage >= 8 ? { tone: "good", text: `${belowAverage}% abaixo da média` }
    : belowAverage >= 2 ? { tone: "ok", text: "Um pouco abaixo da média" }
    : { tone: "meh", text: "Preço na média" };
  const similar = all.filter((item) => item.active && item.id !== offer.id && item.category.slug === offer.category.slug).slice(0, 4);
  const alertCommand = `/alerta ${cleanTitle(offer.title, 40).replace(/…$/, "")} | ${Math.floor(offer.price * 0.95)}`;

  return (
    <div className="wrap section">
      <nav className="crumbs" aria-label="Você está em">
        <Link href="/ofertas">Ofertas</Link>
        <span aria-hidden>/</span>
        <Link href={`/ofertas?categoria=${offer.category.slug}`}>{offer.category.label}</Link>
      </nav>

      <div className="detail">
        <div className="detail__media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={offer.image} alt={offer.shortTitle} referrerPolicy="no-referrer" />
          {discount ? <span className="badge badge--off badge--lg">-{discount}%</span> : null}
        </div>

        <div className="detail__info">
          <div className="card__meta">
            <span className={`store store--${offer.store}`}>{offer.storeLabel}</span>
            <span className="dot" aria-hidden>·</span>
            <span>publicada <TimeAgo iso={offer.publishedAt} /></span>
          </div>
          <h1 className="detail__title">{cleanTitle(offer.title, 160)}</h1>

          {!offer.active ? <p className="notice">Esta oferta foi encerrada: o produto esgotou ou o preço mudou. Confira o preço atual na loja.</p> : null}

          <div className="detail__price">
            {previousPrice ? <s>{brl.format(previousPrice)}</s> : null}
            <strong>{brl.format(offer.price)}</strong>
            {offer.installment ? <small>{offer.installment}</small> : null}
          </div>
          {verdict ? <p className={`verdict verdict--${verdict.tone}`}>{verdict.text}</p> : null}

          {offer.coupon ? (
            <div className="coupon coupon--lg">
              <span>Use o cupom</span>
              <code>{offer.coupon}</code>
              {offer.couponEndsAt ? <small>válido até {new Date(offer.couponEndsAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}</small> : null}
            </div>
          ) : null}

          <a className="btn btn--primary btn--lg" href={offer.url} target="_blank" rel="sponsored nofollow noopener noreferrer">
            Ir para a {offer.storeLabel}
          </a>
          <p className="fineprint">Preço e estoque podem mudar a qualquer momento. Link de afiliado: o preço para você é o mesmo.</p>

          {botUrl() ? (
            <div className="alertbox">
              <h2>Quer pagar menos?</h2>
              <p>Mande este comando para o <a href={botUrl()} target="_blank" rel="noopener">@{SITE.botUsername}</a> e receba um aviso quando o preço cair:</p>
              <code className="cmd">{alertCommand}</code>
            </div>
          ) : null}
        </div>
      </div>

      <section className="section section--tight">
        <div className="section__head">
          <h2>Histórico de preço</h2>
          {lowest && average ? <p className="muted">Menor: <b>{brl.format(lowest)}</b> · Média: <b>{brl.format(average)}</b> · {history.length} dia{history.length === 1 ? "" : "s"} acompanhado{history.length === 1 ? "" : "s"}</p> : null}
        </div>
        <PriceChart points={history} current={offer.price} />
      </section>

      {similar.length ? (
        <section className="section section--tight">
          <div className="section__head">
            <h2>Mais ofertas de {offer.category.label.toLowerCase()}</h2>
            <Link className="link-more" href={`/ofertas?categoria=${offer.category.slug}`}>Ver todas</Link>
          </div>
          <div className="grid">{similar.map((item) => <OfferCard key={item.id} offer={item} />)}</div>
        </section>
      ) : null}
    </div>
  );
}
