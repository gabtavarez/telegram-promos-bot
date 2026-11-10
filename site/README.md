# Tavarez Promos — site público

Site de ofertas (Next.js) que lê as publicações do bot no Upstash: home, `/ofertas` com filtros,
`/oferta/[id]` com histórico de preço, `/alertas` e `/sobre`.

Variáveis (Vercel, projeto `tavarez-promos`, root `site/`): `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CHANNEL_URL`, `NEXT_PUBLIC_BOT_USERNAME`. Sem Upstash, roda com ofertas de exemplo.
