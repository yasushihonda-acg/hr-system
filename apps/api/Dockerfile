# ============================================================================
# HR System API — Multi-stage Docker Build
# Base: node:22-slim
# Package manager: pnpm (version from packageManager field in package.json)
#
# Stage 1 (builder): pnpm install + turbo build --filter=@hr-system/api...
# Stage 2 (runner):  pnpm install --prod + dist/ のみコピー
# ============================================================================

FROM node:22-slim AS base
WORKDIR /app

# corepack 有効化（package.json の packageManager フィールドに従い pnpm を使用）
RUN corepack enable

# ===== Stage 1: builder =====
FROM base AS builder

# 依存関係のキャッシュ効率化:
# package.json ファイルのみを先にコピーして pnpm install を実行する
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/

# 全依存関係をインストール（devDeps 含む: tsc, turbo が必要）
RUN pnpm install --frozen-lockfile

# ソースコードをコピー
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/
COPY apps/api/tsconfig.build.json ./apps/api/
COPY packages/db/src ./packages/db/src
COPY packages/db/tsconfig.json ./packages/db/
COPY packages/db/tsconfig.build.json ./packages/db/
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/tsconfig.build.json ./packages/shared/
COPY tsconfig.json ./

# API とその依存パッケージをビルド（shared → db → api の順）
RUN pnpm turbo build --filter=@hr-system/api...

# ===== Stage 2: runner =====
FROM base AS runner

ENV NODE_ENV=production

# 本番依存のみインストール（devDeps 除外）
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile --prod

# ビルド済み JS ファイルのみコピー（src は不要）
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

EXPOSE 8080

# 非 root ユーザーで実行
USER node

CMD ["node", "apps/api/dist/index.js"]
