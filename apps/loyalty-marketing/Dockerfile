FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @esse-beauty/loyalty-marketing... build
RUN pnpm --filter @esse-beauty/loyalty-marketing deploy --prod --legacy /deploy

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /deploy ./
COPY --from=builder /workspace/apps/loyalty-marketing/dist ./dist
EXPOSE 3006
CMD ["node", "dist/index.js"]
