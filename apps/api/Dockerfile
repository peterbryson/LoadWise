# syntax=docker/dockerfile:1
# LoadWise API image (#34). Built from the repository root so the API can use the workspace
# packages it depends on: docker build -f apps/api/Dockerfile .
# The same image runs locally (docker compose --profile api) and, later, on Azure staging.

FROM node:22-slim AS base
# Prisma's query and migration engines need OpenSSL, which the slim image leaves out.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo

FROM base AS build
# Manifests and the Prisma schema first, so the dependency layer is reused until they change.
# The install's postinstall step runs prisma generate, which needs the schema.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/
COPY packages/analytics/package.json packages/analytics/
# Only the API and the workspace packages it depends on; the mobile app's dependencies are skipped.
RUN pnpm install --frozen-lockfile --filter "@loadwise/api..."
COPY . .
RUN pnpm --filter "@loadwise/api..." run build

FROM base AS runtime
ENV NODE_ENV=production
# Dev dependencies stay in the image because prisma migrate deploy needs the Prisma CLI at start-up.
# A smaller image would move prisma to dependencies; not worth a lockfile change yet.
COPY --from=build --chown=node:node /repo /repo
USER node
WORKDIR /repo/apps/api
EXPOSE 3000
# Apply any committed migrations, then start the API. Configuration comes from environment
# variables (DATABASE_URL, FIREBASE_PROJECT_ID, CORS_ORIGINS, PORT); no .env file is copied in.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main.js"]
