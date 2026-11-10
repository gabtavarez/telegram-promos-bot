import type { Metadata } from "next";
import { botUrl, SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Alertas de preço",
  description: "Receba um aviso no Telegram quando o produto que você quer chegar no seu preço.",
};

const EXAMPLES = ["/alerta RTX 4060 abaixo de 1900", "/alerta SSD NVMe 1TB | 350", "/alerta Ryzen 7 5700X | 850"];

export default function AlertsPage() {
  const bot = botUrl();
  return (
    <div className="wrap section narrow">
      <h1>Alertas de preço</h1>
      <p className="hero__lede">Diga o produto e quanto quer pagar. Quando o bot achar uma oferta que bate, ele te chama no privado. Sem cadastro, sem e-mail.</p>

      <ol className="steps">
        <li>
          <h3>Abra o bot no Telegram</h3>
          <p>{bot ? <>Toque em <a href={bot} target="_blank" rel="noopener">@{SITE.botUsername}</a> e depois em <b>Iniciar</b>.</> : "Abra o bot do canal no Telegram e toque em Iniciar."}</p>
        </li>
        <li>
          <h3>Mande o comando /alerta</h3>
          <p>Escreva o produto e, se quiser, o preço máximo:</p>
          <ul className="cmds">{EXAMPLES.map((example) => <li key={example}><code className="cmd">{example}</code></li>)}</ul>
        </li>
        <li>
          <h3>Pronto</h3>
          <p>Use <code>/meus_alertas</code> para ver os seus e <code>/remover_alerta</code> para apagar.</p>
        </li>
      </ol>

      {bot ? <a className="btn btn--tg btn--lg" href={bot} target="_blank" rel="noopener">Abrir o bot de alertas</a> : null}
    </div>
  );
}
