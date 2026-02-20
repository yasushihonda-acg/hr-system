# ============================================================================
# HR System Web — Multi-stage Docker Build (Next.js standalone)
# Base: node:22-slim
# Package manager: pnpm (version from packageManager field in package.json)
#
# Stage 1 (builder): pnpm install + turbo build --filter=@hr-system/web...
# Stage 2 (runner):  .next/standalone のみコピー（node_modules 同梱）
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
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/

# 全依存関係をインストール（devDeps 含む: next build, turbo が必要）
RUN pnpm install --frozen-lockfile

# ソースコードと設定ファイルをコピー
COPY apps/web/src ./apps/web/src
COPY apps/web/tsconfig.json ./apps/web/
COPY apps/web/next.config.ts ./apps/web/
COPY apps/web/postcss.config.mjs ./apps/web/
COPY apps/web/components.json ./apps/web/
COPY apps/web/next-env.d.ts ./apps/web/
COPY packages/db/src ./packages/db/src
COPY packages/db/tsconfig.json ./packages/db/
COPY packages/db/tsconfig.build.json ./packages/db/
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/tsconfig.build.json ./packages/shared/
COPY tsconfig.json ./

# Web とその依存パッケージをビルド（shared → db → web の順）
# NEXT_TELEMETRY_DISABLED: ビルド時の telemetry 送信を無効化
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo build --filter=@hr-system/web...

# ===== Stage 2: runner =====
FROM base AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Cloud Run から外部アクセスを受け付けるため 0.0.0.0 をバインド
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# standalone ビルドに node_modules が同梱されているため pnpm install 不要
# monorepo の standalone は apps/web/.next/standalone/ 配下にパス構造が再現される
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
# public/ は現在未使用のためスキップ
# COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

# 非 root ユーザーで実行
USER node

CMD ["node", "apps/web/server.js"]
