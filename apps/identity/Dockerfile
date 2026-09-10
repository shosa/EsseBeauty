FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @esse-beauty/identity... build
RUN pnpm --filter @esse-beauty/identity deploy --prod --legacy /deploy

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /deploy ./
COPY --from=builder /workspace/apps/identity/dist ./dist
EXPOSE 3009
CMD ["node", "dist/index.js"]
