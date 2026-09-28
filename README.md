# Bot de Ofertas de Hardware para Telegram

Bot em Node.js + TypeScript que coleta ofertas públicas da Amazon e do Mercado Livre, escolhe a melhor oferta ainda não publicada, injeta os parâmetros de afiliado e publica no Telegram. Foi desenhado para trabalhar com baixo consumo de memória.

## Configuração local

Requisitos: Node.js 20 ou superior.

```bash
npm install
cp .env.example .env
npm run dev
```

Preencha no `.env`:

- `TELEGRAM_BOT_TOKEN`: token criado pelo BotFather.
- `CHANNEL_ID`: `@nome_do_canal` ou o ID numérico do canal. O bot precisa ser administrador com permissão para publicar.
- `TELEGRAM_ADMIN_USER_ID`: ID numérico do único usuário autorizado a usar os comandos administrativos.
- `AMAZON_TAG`: ID do programa de associados da Amazon.
- `ML_TAG`: parâmetros de rastreio do Mercado Livre em formato de query string, como `matt_tool=123&matt_word=hardware`.

As URLs das páginas monitoradas (por padrão, ofertas de informática/hardware), o caminho do histórico e a execução imediata ao iniciar também podem ser alterados pelas variáveis opcionais documentadas em `.env.example`. A Amazon fica desativada por padrão; só use `AMAZON_ENABLED=true` depois de confirmar que a coleta e a divulgação cumprem as regras da sua conta de Associado.

## Comandos

No chat privado com o bot, o administrador pode usar `/oferta`, `/status`, `/pausar` e `/retomar`.

```bash
npm run dev       # desenvolvimento
npm run build     # compila TypeScript
npm test          # testes
npm start         # executa o build
```

## Deploy no Render

1. Envie o repositório para um provedor Git.
2. No Render, crie um **Background Worker** com runtime Docker e plano Free, caso ele esteja disponível na sua conta/região. Para um Web Service, configure `PORT=10000` e use `/health` como health check.
3. Cadastre as quatro variáveis obrigatórias no painel do Render. Nunca envie o arquivo `.env` ao repositório.
4. Crie um banco Redis gratuito no Upstash e copie `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` para as variáveis do Render.
5. Use o `Dockerfile` da raiz. O comando de inicialização já está definido na imagem.

O limite de heap do Node foi fixado em 384 MB, deixando margem dentro dos 512 MB para o runtime e bibliotecas. A coleta é sequencial e cada resposta HTML é limitada a 6 MB.

Um Web Service gratuito pode hibernar sem tráfego recebido; nesse estado, o agendamento interno de 45 minutos não é garantido. Para execução contínua, prefira um Background Worker disponível no seu plano ou um serviço pago. O endpoint `/health` existe para compatibilidade e monitoramento, não para substituir um worker contínuo.

### Persistência

Quando as credenciais do Upstash são fornecidas, cada ID e URL publicados são gravados no Redis com expiração automática de sete dias. As consultas de um lote inteiro usam um único `MGET`, reduzindo tráfego e latência.

Sem Upstash, o histórico fica em `./data/posted-deals.json`. O filesystem comum do Render é efêmero: reinícios e novos deploys podem apagar esse histórico.

### Evitar hibernação no plano gratuito

Depois do deploy como Web Service, crie um monitor HTTP no UptimeRobot apontando para `https://SEU-SERVICO.onrender.com/health`, com intervalo de 10 minutos. Isso reduz a chance de hibernação por inatividade, mas não impede reinícios ou suspensões iniciados pelo próprio Render.

## Observações sobre scraping

Os sites podem alterar HTML, seletores ou regras de acesso sem aviso. Os providers foram isolados justamente para permitir ajustes independentes. Respeite os termos de uso, o `robots.txt` e as regras dos programas de afiliados. O bot não tenta contornar CAPTCHA ou bloqueios.
