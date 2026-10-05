# Image de production du backend Huntited (Express + registre partagé).
# Le registre est un fichier JSON : monter un volume persistant sur /app/data.

# 1. Dépendances complètes (pour compiler)
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# 2. Compilation TypeScript (sans les tests)
FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN bun run build

# 3. Dépendances de production uniquement
FROM oven/bun:1 AS prod-deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# 4. Image finale : Node, utilisateur non-root, aucun secret embarqué
FROM node:24-alpine
ENV NODE_ENV=production \
    PORT=3001 \
    REGISTRY_FILE=/app/data/registry.json
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
EXPOSE 3001
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- "http://127.0.0.1:${PORT}/health" || exit 1
CMD ["node", "dist/index.js"]
