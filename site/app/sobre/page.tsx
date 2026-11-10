import type { Metadata } from "next";
import { STORES } from "@/lib/data";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Sobre, afiliados e privacidade" };

export default function AboutPage() {
  return (
    <div className="wrap section narrow prose">
      <h1>Sobre o {SITE.name}</h1>
      <p>O {SITE.name} é um canal de promoções de hardware e periféricos para quem monta e faz upgrade de PC. Um bot consulta as lojas a cada 5 minutos, filtra produtos ruins e descontos inflados e publica só o que está realmente abaixo do preço normal.</p>

      <h2>Divulgação de afiliados</h2>
      <p>Os links para {Object.values(STORES).join(", ")} são links de afiliado. Quando você compra por eles, a loja paga uma comissão ao {SITE.name}. O preço para você não muda. As ofertas não são patrocinadas: nenhuma loja paga para aparecer, e a seleção é feita pelos filtros de qualidade e preço.</p>

      <h2>Preços e estoque</h2>
      <p>Os preços são os informados pelas lojas no momento em que o bot encontrou a oferta. Eles podem mudar ou esgotar a qualquer momento; o preço válido é sempre o da loja na hora da compra.</p>

      <h2>Privacidade</h2>
      <p>O site não tem cadastro e não coleta dados pessoais. Os alertas de preço ficam no bot do Telegram e guardam apenas o seu ID do Telegram e o texto do alerta, que você pode apagar com <code>/remover_alerta</code>.</p>
    </div>
  );
}
