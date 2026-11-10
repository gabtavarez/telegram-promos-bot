import Link from "next/link";
import type { Offer } from "@/lib/data";
import { brl } from "@/lib/format";
import { TimeAgo } from "./TimeAgo";

export function OfferCard({ offer, priority = false }: { offer: Offer; priority?: boolean }) {
  const href = `/oferta/${offer.slug}`;
  return (
    <article className={`card${offer.active ? "" : " card--off"}`}>
      <Link href={href} className="card__media" aria-label={offer.shortTitle} tabIndex={-1}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={offer.image} alt="" loading={priority ? "eager" : "lazy"} referrerPolicy="no-referrer" />
        {offer.discount ? <span className="badge badge--off">-{offer.discount}%</span> : null}
        {!offer.active ? <span className="card__ended">Encerrada</span> : null}
      </Link>
      <div className="card__body">
        <div className="card__meta">
          <span className={`store store--${offer.store}`}>{offer.storeLabel}</span>
          <span className="dot" aria-hidden>·</span>
          <TimeAgo iso={offer.publishedAt} />
        </div>
        <h3 className="card__title"><Link href={href}>{offer.shortTitle}</Link></h3>
        <div className="card__price">
          {offer.previousPrice ? <s>{brl.format(offer.previousPrice)}</s> : null}
          <strong>{brl.format(offer.price)}</strong>
          {offer.installment ? <small>{offer.installment}</small> : null}
        </div>
        {offer.coupon ? (
          <div className="coupon"><span>Cupom</span><code>{offer.coupon}</code></div>
        ) : null}
        <a className="btn btn--store" href={offer.url} target="_blank" rel="sponsored nofollow noopener noreferrer">
          {offer.active ? "Ver na loja" : "Ver mesmo assim"}
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </a>
      </div>
    </article>
  );
}
