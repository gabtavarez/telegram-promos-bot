import Link from "next/link";
import { SITE } from "@/lib/site";

export function Header() {
  return (
    <header className="topbar">
      <div className="wrap topbar__inner">
        <Link href="/" className="brand" aria-label={`${SITE.name}, página inicial`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={34} height={34} />
          <span>Tavarez <b>Promos</b></span>
        </Link>
        <form action="/ofertas" className="search search--top" role="search">
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          <input name="q" type="search" placeholder="Buscar: RTX 4060, SSD 1TB, AK820…" aria-label="Buscar ofertas" />
        </form>
        <nav className="nav" aria-label="Principal">
          <Link href="/ofertas">Ofertas</Link>
          <Link href="/#categorias" className="nav__hide-sm">Categorias</Link>
          <Link href="/alertas">Alertas</Link>
          {SITE.channelUrl ? <a className="btn btn--tg btn--sm" href={SITE.channelUrl} target="_blank" rel="noopener">Canal</a> : null}
        </nav>
      </div>
    </header>
  );
}
