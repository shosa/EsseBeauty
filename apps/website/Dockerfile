FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @esse-beauty/website build

ENV NODE_ENV=production

EXPOSE 3005

CMD ["pnpm", "--filter", "@esse-beauty/website", "start"]