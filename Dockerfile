FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS runner
ENV NODE_ENV=production \
    NODE_OPTIONS=--max-old-space-size=384
WORKDIR /app

RUN addgroup -S bot && adduser -S bot -G bot && mkdir -p /app/data && chown -R bot:bot /app
COPY --from=builder --chown=bot:bot /app/package.json ./package.json
COPY --from=builder --chown=bot:bot /app/node_modules ./node_modules
COPY --from=builder --chown=bot:bot /app/dist ./dist

USER bot
EXPOSE 10000
CMD ["node", "dist/index.js"]
