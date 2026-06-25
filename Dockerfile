# Dockerfile — Multi-stage build
# Stage development : hot reload avec tsx
# Stage production  : build compilé, image minimale

FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# ─── Development ─────────────────────────────────────────────────────────────
FROM base AS development
ENV NODE_ENV=development
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ─── Builder ─────────────────────────────────────────────────────────────────
FROM base AS builder
ENV NODE_ENV=production
RUN npm ci --only=production
COPY . .
RUN npm run build

# ─── Production ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

RUN addgroup -g 1001 -S forge && \
    adduser -S forge -u 1001 && \
    chown -R forge:forge /app

USER forge
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
