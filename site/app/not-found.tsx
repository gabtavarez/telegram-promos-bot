import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap section narrow empty">
      <h1>Oferta não encontrada</h1>
      <p className="muted">Ela pode ter saído do ar. Veja as mais recentes:</p>
      <Link className="btn btn--primary" href="/ofertas">Ver ofertas</Link>
    </div>
  );
}
