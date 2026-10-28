import type { Metadata, Viewport } from "next";
import "@fontsource-variable/sora";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tavarez Promos — Painel",
  description: "Métricas do canal e configuração do bot de promoções.",
  icons: { icon: "/favicon.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#000000", colorScheme: "dark" };

const earlyPrefs = `try{var p=JSON.parse(localStorage.getItem('tp.prefs')||'{}');var r=document.documentElement;if(p.accent)r.style.setProperty('--accent',p.accent);if(p.density)r.dataset.density=p.density}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: earlyPrefs }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
