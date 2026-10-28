# Tavarez Promos — Painel

Dashboard em Next.js para acompanhar as métricas do canal e configurar o bot e os anúncios, sem novo deploy.

- **Visão geral:** ofertas por período, loja, categoria e faixa de desconto, saúde das lojas e últimas ofertas. Cor, espaçamento e blocos são personalizáveis (salvos no navegador).
- **Anúncios:** modelo da mensagem, elementos exibidos, botões, rodapé e `#Anúncio`, com pré-visualização ao vivo estilo Telegram.
- **Bot:** pausar, horário silencioso, intervalo e limite diário, lojas ligadas, filtros (desconto, preço, cupom, palavras) e janela contra repetição.

O painel lê e escreve no mesmo Upstash Redis do bot (`telegram-promos:config`). O bot recarrega a configuração a cada 30 s.

## Deploy na Vercel

1. Importe o repositório em vercel.com/new e defina **Root Directory = `dashboard`** (framework Next.js detectado sozinho).
2. Em **Settings → Environment Variables**, adicione:

| Variável | Para quê |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Mesmo banco do bot. Sem elas o painel abre em modo demonstração. |
| `DASHBOARD_PASSWORD` | Senha de acesso. Sem ela não é possível salvar configurações. |
| `NEXT_PUBLIC_BOT_USERNAME` | Opcional: username do bot (sem @) no preview. |

3. Faça o deploy.

## Desenvolvimento

```bash
npm install
cp .env.example .env.local
npm run dev
```

`lib/botConfig.ts` é uma cópia do contrato `src/config/botConfig.ts` do repositório do bot; mantenha os dois iguais.
