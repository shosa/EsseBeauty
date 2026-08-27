FROM node:22-alpine AS builder
ENV DOCKER_BUILD=true
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN corepack enable
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @esse-beauty/platform... build

FROM node:22-alpine AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3004
WORKDIR /app
COPY --from=builder /workspace/apps/platform/.next/standalone ./
COPY --from=builder /workspace/apps/platform/.next/static ./apps/platform/.next/static
EXPOSE 3004
CMD ["node", "apps/platform/server.js"]
