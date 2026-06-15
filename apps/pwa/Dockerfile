FROM node:22-alpine AS builder
ENV DOCKER_BUILD=true
RUN corepack enable
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @esse-beauty/pwa... build

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /workspace/apps/pwa/.next/standalone ./
COPY --from=builder /workspace/apps/pwa/.next/static ./apps/pwa/.next/static
COPY --from=builder /workspace/apps/pwa/public ./apps/pwa/public
EXPOSE 3002
CMD ["node", "apps/pwa/server.js"]
