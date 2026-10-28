"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Visão geral", icon: <path d="M4 19V9m6 10V5m6 14v-7m4 7H2" /> },
  { href: "/anuncios", label: "Anúncios", icon: <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h5" /></> },
  { href: "/bot", label: "Bot", icon: <><path d="M4 7h16M4 12h16M4 17h16" /><circle cx="9" cy="7" r="2" fill="#000" /><circle cx="15" cy="12" r="2" fill="#000" /><circle cx="8" cy="17" r="2" fill="#000" /></> },
];

export function Shell({ children, protectedByPassword }: { children: React.ReactNode; protectedByPassword: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = async () => {
    await fetch("/api/login", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  };
  return (
    <div className="shell">
      <aside className="rail">
        <Link href="/" className="rail-logo" aria-label="Tavarez Promos">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={44} height={44} />
        </Link>
        <nav className="nav" aria-label="Principal">
          {ITEMS.map((item) => (
            <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
              <svg viewBox="0 0 24 24" aria-hidden="true">{item.icon}</svg>
              {item.label}
            </Link>
          ))}
        </nav>
        {protectedByPassword ? (
          <div className="rail-foot"><button className="linklike" onClick={logout}>Sair</button></div>
        ) : null}
      </aside>
      <main className="page">{children}</main>
    </div>
  );
}
