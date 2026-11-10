import type { Metadata } from "next";
import Link from "next/link";
import { OfferCard } from "@/components/OfferCard";
import { CATEGORIES, categoryBySlug } from "@/lib/categories";
import { filterOffers, getOffers, STORES, type SortKey, type StoreKey } from "@/lib/data";

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;
const SORTS: Record<SortKey, string> = { recentes: "Mais recentes", desconto: "Maior desconto", "menor-preco": "Menor preço", "maior-preco": "Maior preço" };
const PAGE = 48;

export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }): Promise<Metadata> {
  const params = await searchParams;
  const category = categoryBySlug(one(params.categoria));
  const q = one(params.q);
  const title = q ? `Ofertas de “${q}”` : category ? `Promoções de ${category.label}` : "Todas as ofertas";
  return { title, alternates: { canonical: category ? `/ofertas?categoria=${category.slug}` : "/ofertas" } };
}

export default async function OffersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const ordem = (one(params.ordem) as SortKey) in SORTS ? (one(params.ordem) as SortKey) : "recentes";
  const loja = one(params.loja) && one(params.loja)! in STORES ? (one(params.loja) as StoreKey) : undefined;
  const categoria = categoryBySlug(one(params.categoria))?.slug;
  const q = one(params.q)?.slice(0, 80);
  const ativas = one(params.ativas) === "1";
  const cupom = one(params.cupom) === "1";
  const pagina = Math.max(1, Number(one(params.pagina)) || 1);

  const all = await getOffers();
  const results = filterOffers(all, { q, categoria, loja, ordem, ativas, cupom });
  const shown = results.slice(0, PAGE * pagina);

  const link = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { q, categoria, loja, ordem: ordem === "recentes" ? undefined : ordem, ativas: ativas ? "1" : undefined, cupom: cupom ? "1" : undefined, ...patch };
    for (const [key, value] of Object.entries(merged)) if (value) next.set(key, value);
    const query = next.toString();
    return query ? `/ofertas?${query}` : "/ofertas";
  };
  const heading = q ? `Resultados para “${q}”` : categoria ? `Promoções de ${categoryBySlug(categoria)!.label}` : "Todas as ofertas";

  return (
    <div className="wrap section">
      <div className="section__head section__head--page">
        <div>
          <h1>{heading}</h1>
          <p className="muted">{results.length} oferta{results.length === 1 ? "" : "s"} publicada{results.length === 1 ? "" : "s"} pelo bot nos últimos dias.</p>
        </div>
      </div>

      <div className="chips" role="list" aria-label="Categorias">
        <Link role="listitem" className={`chip${!categoria ? " chip--on" : ""}`} href={link({ categoria: undefined, pagina: undefined })}>Todas</Link>
        {CATEGORIES.map((category) => (
          <Link role="listitem" key={category.slug} className={`chip${categoria === category.slug ? " chip--on" : ""}`} href={link({ categoria: category.slug, pagina: undefined })}>
            {category.label}
          </Link>
        ))}
      </div>

      <form className="filters" action="/ofertas">
        {q ? <input type="hidden" name="q" value={q} /> : null}
        {categoria ? <input type="hidden" name="categoria" value={categoria} /> : null}
        <label>
          <span>Loja</span>
          <select name="loja" defaultValue={loja ?? ""}>
            <option value="">Todas</option>
            {Object.entries(STORES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>Ordenar</span>
          <select name="ordem" defaultValue={ordem}>
            {Object.entries(SORTS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label className="check"><input type="checkbox" name="ativas" value="1" defaultChecked={ativas} /> Só ativas</label>
        <label className="check"><input type="checkbox" name="cupom" value="1" defaultChecked={cupom} /> Com cupom</label>
        <button className="btn btn--ghost btn--sm" type="submit">Aplicar</button>
        {(q || categoria || loja || ativas || cupom || ordem !== "recentes") ? <Link className="link-more" href="/ofertas">Limpar filtros</Link> : null}
      </form>

      {shown.length ? (
        <>
          <div className="grid">{shown.map((offer, index) => <OfferCard key={offer.id} offer={offer} priority={index < 4} />)}</div>
          {results.length > shown.length ? (
            <div className="more"><Link className="btn btn--ghost" href={link({ pagina: String(pagina + 1) })} scroll={false}>Carregar mais</Link></div>
          ) : null}
        </>
      ) : (
        <div className="empty">
          <p>Nada por aqui com esses filtros.</p>
          <p className="muted">Quer ser avisado quando aparecer? <Link href="/alertas">Crie um alerta de preço</Link>.</p>
        </div>
      )}
    </div>
  );
}
