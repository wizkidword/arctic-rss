import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("production Docker images", () => {
  it("keeps build tools out of the compiled worker and gateway images", async () => {
    const dockerfile = await readFile("Dockerfile", "utf8");

    expect(dockerfile).toContain("ARG NODE_IMAGE=node:24.17.0-alpine3.23");
    expect(dockerfile).toContain("ARG NGINX_IMAGE=nginx:1.30.4-alpine3.24");
    expect(dockerfile).toContain("FROM deps AS production-deps");
    expect(dockerfile).toContain("RUN npm prune --omit=dev");
    expect(dockerfile).toContain("npm run runtime:build");
    expect(dockerfile).toContain("FROM ${NODE_IMAGE} AS migrate-deps");
    expect(dockerfile).toContain(
      "COPY docker/migrate/package.json docker/migrate/package-lock.json ./",
    );
    expect(dockerfile).toContain("FROM ${NODE_IMAGE} AS migrate");
    expect(dockerfile).toContain("COPY --from=migrate-deps /app/node_modules ./node_modules");
    expect(dockerfile).toContain("COPY --from=builder /app/build/runtime/check-migration-risk.mjs ./check-migration-risk.mjs");
    expect(dockerfile).not.toContain("FROM deps AS migrate");
    expect(dockerfile).toContain(
      "rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx",
    );
    expect(dockerfile).toContain(
      'CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]',
    );
    expect(dockerfile).toContain("USER migrate");
    expect(dockerfile).toContain("FROM ${NODE_IMAGE} AS worker");
    expect(dockerfile).toContain('COPY --from=builder --chown=worker:nodejs /app/build/runtime/worker.mjs ./worker.mjs');
    expect(dockerfile).toContain('COPY --from=builder --chown=worker:nodejs /app/build/runtime/bootstrap-admin.mjs ./bootstrap-admin.mjs');
    expect(dockerfile).toContain('COPY --from=builder --chown=worker:nodejs /app/build/runtime/repair-chat-read-markers.mjs ./repair-chat-read-markers.mjs');
    expect(dockerfile).toContain('CMD ["node", "worker.mjs"]');
    expect(dockerfile).toContain("FROM ${NODE_IMAGE} AS chat-gateway");
    expect(dockerfile).toContain('COPY --from=builder --chown=chatgateway:nodejs /app/build/runtime/chat-gateway.mjs ./chat-gateway.mjs');
    expect(dockerfile).toContain('CMD ["node", "chat-gateway.mjs"]');
    expect(dockerfile).toContain("USER chatgateway");
    expect(dockerfile).toContain("FROM ${NGINX_IMAGE} AS edge-proxy");
    expect(dockerfile).toContain(
      "COPY ops/nginx/chat-proxy.conf /etc/nginx/conf.d/default.conf",
    );
    expect(dockerfile).toContain("RUN sed -i '/^user /d' /etc/nginx/nginx.conf");
    expect(dockerfile).toContain("USER nginx");

    const workerStage = dockerfile
      .split("FROM ${NODE_IMAGE} AS worker")[1]
      .split("FROM ${NODE_IMAGE} AS chat-gateway")[0];
    const gatewayStage = dockerfile.split("FROM ${NODE_IMAGE} AS chat-gateway")[1];

    expect(workerStage).not.toContain("COPY . .");
    expect(workerStage).not.toContain("tsx");
    expect(gatewayStage).not.toContain("COPY . .");
    expect(gatewayStage).not.toContain("tsx");
  });
});
