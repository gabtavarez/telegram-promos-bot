import type { Metadata, Viewport } from "next";
import "@fontsource-variable/sora";
import "./globals.css";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: "Tavarez Promos — promoções de hardware e periféricos", template: "%s · Tavarez Promos" },
  description: "Ofertas de placa de vídeo, processador, SSD, monitor, teclado e mouse garimpadas o dia todo em KaBuM!, Mercado Livre, AliExpress, Shopee e Amazon, com desconto checado contra o histórico de preço.",
  icons: { icon: "/favicon.png", apple: "/apple-touch-icon.png" },
  openGraph: { siteName: SITE.name, locale: "pt_BR", type: "website", images: ["/logo.png"] },
};

export const viewport: Viewport = { themeColor: "#05060a", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
