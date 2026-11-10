import Link from "next/link";
import { OfferCard } from "@/components/OfferCard";
import { CATEGORIES } from "@/lib/categories";
import { getOffers, STORES } from "@/lib/data";
import { SITE, botUrl } from "@/lib/site";

export const revalidate = 60;

const DAY = 24 * 60 * 60 * 1000;

export default async function Home() {
  const offers = await getOffers();
  const active = offers.filter((offer) => offer.active);
  const latest = active.slice(0, 8);
  const today = active.filter((offer) => Date.now() - Date.parse(offer.publishedAt) < DAY);
  const topDiscounts = [...today].filter((offer) => offer.discount).sort((a, b) => (b.discount ?? 0) - (a.discount ?? 0)).slice(0, 4);
  const withCoupon = active.filter((offer) => offer.coupon).slice(0, 4);
  const counts = new Map<string, number>();
  for (const offer of active) counts.set(offer.category.slug, (counts.get(offer.category.slug) ?? 0) + 1);
  const groups = ["Componentes", "Periféricos", "Setup"] as const;

  return (
    <>
      <section className="hero">
        <div className="wrap hero__inner">
          <p className="eyebrow"><span className="pulse" aria-hidden /> Atualizado a cada 5 minutos</p>
          <h1>Promoção de hardware que <em>vale o clique</em>.</h1>
          <p className="hero__lede">
            O bot vasculha {Object.keys(STORES).length} lojas o dia todo, descarta marca duvidosa e desconto inflado,
            e só publica o que está realmente abaixo do preço normal.
          </p>
          <form action="/ofertas" className="search search--hero" role="search">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            <input name="q" type="search" placeholder="O que você procura? Ex.: RX 7600, Ryzen 5700X, monitor 27" aria-label="Buscar ofertas" />
            <button className="btn btn--primary" type="submit">Buscar</button>
          </form>
          <ul className="stats" aria-label="Números do canal">
            <li><strong>{today.length}</strong><span>ofertas nas últimas 24 h</span></li>
            <li><strong>{Object.keys(STORES).length}</strong><span>lojas monitoradas</span></li>
            <li><strong>60 dias</strong><span>de histórico de preço</span></li>
          </ul>
        </div>
      </section>

      <section className="wrap section">
        <div className="section__head">
          <h2>Acabou de sair</h2>
          <Link href="/ofertas" className="link-more">Ver todas</Link>
        </div>
        {latest.length ? (
          <div className="grid">{latest.map((offer, index) => <OfferCard key={offer.id} offer={offer} priority={index < 4} />)}</div>
        ) : (
          <p className="empty">Nenhuma oferta ativa agora. Volte em alguns minutos: o bot roda a cada 5.</p>
        )}
      </section>

      {topDiscounts.length ? (
        <section className="wrap section">
          <div className="section__head">
            <h2>Maiores descontos de hoje</h2>
            <Link href="/ofertas?ordem=desconto&ativas=1" className="link-more">Ver ranking</Link>
          </div>
          <div className="grid">{topDiscounts.map((offer) => <OfferCard key={offer.id} offer={offer} />)}</div>
        </section>
      ) : null}

      <section className="wrap section" id="categorias">
        <div className="section__head"><h2>Navegue por categoria</h2></div>
        <div className="cats">
          {groups.map((group) => (
            <div key={group} className="cats__group">
              <h3>{group}</h3>
              <ul>
                {CATEGORIES.filter((category) => category.group === group).map((category) => (
                  <li key={category.slug}>
                    <Link href={`/ofertas?categoria=${category.slug}`}>
                      <span>{category.label}</span>
                      <small>{counts.get(category.slug) ?? 0}</small>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {withCoupon.length ? (
        <section className="wrap section">
          <div className="section__head">
            <h2>Com cupom</h2>
            <Link href="/ofertas?cupom=1" className="link-more">Ver todas</Link>
          </div>
          <div className="grid">{withCoupon.map((offer) => <OfferCard key={offer.id} offer={offer} />)}</div>
        </section>
      ) : null}

      <section className="wrap section">
        <div className="section__head"><h2>Como a gente filtra</h2></div>
        <div className="pillars">
          <article>
            <span className="pillars__n">01</span>
            <h3>Marca que você conhece</h3>
            <p>Placa, fonte, SSD e memória só de marca com garantia e histórico no Brasil. Fonte de marca duvidosa nunca entra: ela queima o PC inteiro.</p>
          </article>
          <article>
            <span className="pillars__n">02</span>
            <h3>Desconto de verdade</h3>
            <p>O bot grava o preço de milhares de produtos todo dia. Se o “de R$ 949” é o preço de sempre, a oferta não é publicada.</p>
          </article>
          <article>
            <span className="pillars__n">03</span>
            <h3>Sem repetição</h3>
            <p>O mesmo produto só volta quando fica mais barato, e o feed alterna lojas, marcas e categorias para não virar um mar de teclados.</p>
          </article>
        </div>
      </section>

      <section className="wrap section">
        <div className="cta">
          <div>
            <h2>Receba no Telegram antes de esgotar</h2>
            <p>Promoção boa dura minutos. No canal as ofertas chegam no momento em que o bot encontra, e o bot de alertas avisa quando o produto que você quer bate o seu preço.</p>
          </div>
          <div className="cta__actions">
            {SITE.channelUrl ? <a className="btn btn--tg" href={SITE.channelUrl} target="_blank" rel="noopener">Entrar no canal</a> : null}
            {botUrl() ? <Link className="btn btn--ghost" href="/alertas">Criar alerta de preço</Link> : null}
          </div>
        </div>
      </section>

      <section className="wrap section faq">
        <div className="section__head"><h2>Perguntas frequentes</h2></div>
        <details>
          <summary>Como vocês sabem que o preço está bom?</summary>
          <p>O bot registra o menor preço de cada produto todo dia. Uma oferta só é publicada quando o preço está abaixo do que a loja costuma cobrar, ou quando há um cupom verificado. Na página de cada oferta você vê o gráfico desse histórico.</p>
        </details>
        <details>
          <summary>De quais lojas são as ofertas?</summary>
          <p>{Object.values(STORES).join(", ")}. As ofertas vêm das APIs e feeds oficiais de afiliados de cada loja.</p>
        </details>
        <details>
          <summary>Por que uma oferta aparece como encerrada?</summary>
          <p>Quando o produto esgota ou o preço sobe, o bot marca a oferta como encerrada. Ela continua aqui para consulta do histórico.</p>
        </details>
        <details>
          <summary>Vocês ganham alguma coisa?</summary>
          <p>Sim: os links são de afiliado e a loja paga uma pequena comissão quando alguém compra por eles. O preço para você é o mesmo. É isso que mantém o site e o bot no ar.</p>
        </details>
      </section>
    </>
  );
}
