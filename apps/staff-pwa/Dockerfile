FROM node:22-alpine AS builder
ENV DOCKER_BUILD=true
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN corepack enable
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @esse-beauty/staff-pwa... build

FROM node:22-alpine AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3003
WORKDIR /app
COPY --from=builder /workspace/apps/staff-pwa/.next/standalone ./
COPY --from=builder /workspace/apps/staff-pwa/.next/static ./apps/staff-pwa/.next/static
COPY --from=builder /workspace/apps/staff-pwa/public ./apps/staff-pwa/public
EXPOSE 3003
CMD ["node", "apps/staff-pwa/server.js"]
