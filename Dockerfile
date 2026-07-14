FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM deps AS builder
WORKDIR /app
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID
COPY . .
RUN npm run prisma:generate
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
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

FROM deps AS migrate
WORKDIR /app
COPY . .
RUN npm run prisma:generate \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 migrate \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
USER migrate
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

FROM deps AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY . .
RUN npm run prisma:generate \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 worker \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
USER worker
CMD ["./node_modules/.bin/tsx", "worker/index.ts"]

FROM deps AS chat-gateway
WORKDIR /app
ENV NODE_ENV=production
COPY . .
RUN npm run prisma:generate \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 chatgateway \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
USER chatgateway
EXPOSE 3001
CMD ["./node_modules/.bin/tsx", "services/chat-gateway/index.ts"]
