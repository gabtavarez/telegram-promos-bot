import Link from "next/link";
import { SITE } from "@/lib/site";

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer__grid">
        <div>
          <Link href="/" className="brand brand--footer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" width={28} height={28} />
            <span>Tavarez <b>Promos</b></span>
          </Link>
          <p className="muted">Promoções de hardware e periféricos garimpadas o dia todo, com filtro de qualidade e desconto checado contra o histórico de preço.</p>
        </div>
        <nav aria-label="Explorar">
          <h4>Explorar</h4>
          <Link href="/ofertas">Todas as ofertas</Link>
          <Link href="/ofertas?ordem=desconto">Maiores descontos</Link>
          <Link href="/ofertas?cupom=1">Com cupom</Link>
          <Link href="/alertas">Alertas de preço</Link>
        </nav>
        <nav aria-label="Comunidade">
          <h4>Comunidade</h4>
          {SITE.channelUrl ? <a href={SITE.channelUrl} target="_blank" rel="noopener">Canal no Telegram</a> : null}
          {SITE.botUsername ? <a href={`https://t.me/${SITE.botUsername}`} target="_blank" rel="noopener">Bot de alertas</a> : null}
          <Link href="/sobre">Sobre e afiliados</Link>
        </nav>
      </div>
      <div className="wrap footer__legal">
        <p>Alguns links são de afiliado: se você comprar por eles, a loja paga uma comissão ao {SITE.name}, sem custo extra para você. Preços e estoque mudam rápido; confira na loja antes de comprar.</p>
        <p>© {new Date().getFullYear()} {SITE.name}</p>
      </div>
    </footer>
  );
}
