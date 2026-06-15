FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @esse-beauty/api... build
RUN pnpm --filter @esse-beauty/api deploy --prod /deploy

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /deploy ./
COPY --from=builder /workspace/apps/api/dist ./dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
