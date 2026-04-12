# ============================================================================
# SmartHR MCP Server — Multi-stage Docker Build
# Base: node:22-slim
# Package manager: pnpm (version from packageManager field in package.json)
#
# Stage 1 (builder): pnpm install + turbo build --filter=@hr-system/mcp-smarthr...
# Stage 2 (runner):  pnpm install --prod + dist/ のみコピー
# ============================================================================

FROM node:22-slim AS base
WORKDIR /app

# corepack 有効化（package.json の packageManager フィールドに従い pnpm を使用）
RUN corepack enable

# ===== Stage 1: builder =====
FROM base AS builder

# 依存関係のキャッシュ効率化
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY packages/mcp-smarthr/package.json ./packages/mcp-smarthr/

# 全依存関係をインストール（devDeps 含む: tsc が必要）
RUN pnpm install --frozen-lockfile

# ソースコードをコピー
COPY packages/mcp-smarthr/src ./packages/mcp-smarthr/src
COPY packages/mcp-smarthr/tsconfig.json ./packages/mcp-smarthr/
COPY packages/mcp-smarthr/tsconfig.build.json ./packages/mcp-smarthr/
COPY tsconfig.json ./

# ビルド
RUN pnpm turbo build --filter=@hr-system/mcp-smarthr

# ===== Stage 2: runner =====
FROM base AS runner

ENV NODE_ENV=production

# 本番依存のみインストール（devDeps 除外）
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/mcp-smarthr/package.json ./packages/mcp-smarthr/

RUN pnpm install --frozen-lockfile --prod

# ビルド済み JS ファイルのみコピー
COPY --from=builder /app/packages/mcp-smarthr/dist ./packages/mcp-smarthr/dist

EXPOSE 8080

# 非 root ユーザーで実行
USER node

CMD ["node", "packages/mcp-smarthr/dist/serve.js"]
