# ============================================================================
# HR System Worker — Multi-stage Docker Build
# Base: node:22-slim
# Package manager: pnpm (version from packageManager field in package.json)
#
# Stage 1 (builder): pnpm install + turbo build --filter=@hr-system/worker...
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
COPY apps/worker/package.json ./apps/worker/
COPY packages/ai/package.json ./packages/ai/
COPY packages/db/package.json ./packages/db/
COPY packages/salary/package.json ./packages/salary/
COPY packages/shared/package.json ./packages/shared/

# 全依存関係をインストール（devDeps 含む: tsc, turbo が必要）
RUN pnpm install --frozen-lockfile

# ソースコードをコピー
COPY apps/worker/src ./apps/worker/src
COPY apps/worker/tsconfig.json ./apps/worker/
COPY apps/worker/tsconfig.build.json ./apps/worker/
COPY packages/ai/src ./packages/ai/src
COPY packages/ai/tsconfig.json ./packages/ai/
COPY packages/ai/tsconfig.build.json ./packages/ai/
COPY packages/db/src ./packages/db/src
COPY packages/db/tsconfig.json ./packages/db/
COPY packages/db/tsconfig.build.json ./packages/db/
COPY packages/salary/src ./packages/salary/src
COPY packages/salary/tsconfig.json ./packages/salary/
COPY packages/salary/tsconfig.build.json ./packages/salary/
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/tsconfig.build.json ./packages/shared/
COPY tsconfig.json ./

# Worker とその依存パッケージをビルド（shared → ai/db/salary → worker の順）
RUN pnpm turbo build --filter=@hr-system/worker...

# ===== Stage 2: runner =====
FROM base AS runner

ENV NODE_ENV=production

# 本番依存のみインストール（devDeps 除外）
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/ai/package.json ./packages/ai/
COPY packages/db/package.json ./packages/db/
COPY packages/salary/package.json ./packages/salary/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile --prod

# ビルド済み JS ファイルのみコピー（src は不要）
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/packages/ai/dist ./packages/ai/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/salary/dist ./packages/salary/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

EXPOSE 8080

# 非 root ユーザーで実行
USER node

CMD ["node", "apps/worker/dist/index.js"]
