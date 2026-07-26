ARG NODE_IMAGE=node:24.17.0-alpine3.23

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --legacy-peer-deps

FROM deps AS builder
WORKDIR /app
ARG APP_ORIGIN
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID
ENV APP_ORIGIN=$APP_ORIGIN
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID
COPY . .
RUN npm run prisma:generate \
  && npm run build \
  && npm run runtime:build

FROM deps AS production-deps
WORKDIR /app
RUN npm prune --omit=dev --legacy-peer-deps

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache ca-certificates \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/live').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"
CMD ["node", "server.js"]

FROM ${NODE_IMAGE} AS migrate-deps
WORKDIR /app
COPY docker/migrate/package.json docker/migrate/package-lock.json ./
RUN npm ci

FROM ${NODE_IMAGE} AS migrate
WORKDIR /app
COPY --from=migrate-deps /app/node_modules ./node_modules
COPY prisma ./prisma
RUN ./node_modules/.bin/prisma --version \
  && apk add --no-cache ca-certificates \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 migrate \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
USER migrate
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

FROM ${NODE_IMAGE} AS worker
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache ca-certificates \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 worker \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=production-deps --chown=worker:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=worker:nodejs /app/build/runtime/worker.mjs ./worker.mjs
COPY --from=builder --chown=worker:nodejs /app/build/runtime/bootstrap-admin.mjs ./bootstrap-admin.mjs
COPY --from=builder --chown=worker:nodejs /app/build/runtime/repair-chat-read-markers.mjs ./repair-chat-read-markers.mjs
USER worker
CMD ["node", "worker.mjs"]

FROM ${NODE_IMAGE} AS chat-gateway
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache ca-certificates \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 chatgateway \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=production-deps --chown=chatgateway:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=chatgateway:nodejs /app/build/runtime/chat-gateway.mjs ./chat-gateway.mjs
USER chatgateway
EXPOSE 3001
CMD ["node", "chat-gateway.mjs"]
