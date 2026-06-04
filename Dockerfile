# syntax=docker/dockerfile:1.7

# ---------- builder ----------
FROM oven/bun:1.1.38-alpine AS builder
WORKDIR /app

# Instala deps a partir do package.json (lockfile gerenciado no monorepo)
COPY package.json ./
RUN bun install --no-save

# Copia código e tipa-checa (TS sem emit, garante build saudável)
COPY tsconfig.json ./
COPY src ./src
RUN bunx tsc --noEmit

# ---------- runtime ----------
FROM oven/bun:1.1.38-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Usuário não-root já vem na imagem (uid 1000 "bun")
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/src ./src

USER bun
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Roda direto via Bun (sem watch). main.ts é o entrypoint.
CMD ["bun", "run", "src/main.ts"]
