# HR-AI Agent

社長の自然言語チャット指示を AI が解釈してドラフトを生成し、人間が承認する **Human-in-the-loop** 型の人事・給与変更自動化システム。

## Core Concept

```
Google Chat 指示（非構造化） → AI 解釈・ドラフト作成（構造化） → 人間承認 → 全連携先へ自動反映
```

## Tech Stack

| レイヤー | 技術 |
|---------|------|
| Cloud | GCP (hr-system-487809 / asia-northeast1) |
| Backend | Cloud Run (Python/Node.js) |
| Frontend | Next.js (React) on Cloud Run |
| Database | Firestore + BigQuery |
| AI/LLM | Vertex AI (Gemini) |
| Messaging | Google Chat API + Pub/Sub |
| External | SmartHR API, Google Sheets API, Gmail API |

## Architecture

```
社長/人事 → Google Chat → Pub/Sub → Cloud Run (API)
                                         ├→ Vertex AI (Intent分類・パラメータ抽出)
                                         ├→ 給与計算ロジック (確定的コード)
                                         └→ Firestore

人事担当 → Next.js Dashboard → Cloud Run (API)
                                    ├→ SmartHR API
                                    ├→ Google Sheets
                                    └→ Gmail API (通知)
```

## Phased Delivery

### Phase 1 (MVP)
- Google Chat からの指示を AI で解釈し給与変更ドラフトを自動作成
- Web ダッシュボードでの確認・修正・承認ワークフロー
- Google Sheets への書き出し
- 全チャットメッセージの10カテゴリ分類・記録

### Phase 2
- 入社フローの自動化
- SmartHR API 連携
- PDF 辞令自動生成
- 他カテゴリの段階的自動化

## Documents

| ドキュメント | パス |
|-------------|------|
| PRD | [docs/prd/PRD-001-hr-ai-agent.md](docs/prd/PRD-001-hr-ai-agent.md) |
| システム要件書 | [docs/requirements/system-requirements.md](docs/requirements/system-requirements.md) |
| ADR-001 全体アーキテクチャ | [docs/adr/ADR-001-gcp-architecture.md](docs/adr/ADR-001-gcp-architecture.md) |
| ADR-002 LLM選定 | [docs/adr/ADR-002-llm-selection.md](docs/adr/ADR-002-llm-selection.md) |
| ADR-003 DB選定 | [docs/adr/ADR-003-database-selection.md](docs/adr/ADR-003-database-selection.md) |
| ADR-004 チャット連携 | [docs/adr/ADR-004-chat-integration.md](docs/adr/ADR-004-chat-integration.md) |
| ADR-005 フロントエンド | [docs/adr/ADR-005-frontend-technology.md](docs/adr/ADR-005-frontend-technology.md) |
| ADR-006 Human-in-the-loop | [docs/adr/ADR-006-human-in-the-loop.md](docs/adr/ADR-006-human-in-the-loop.md) |
| ADR-007 AI役割分離 | [docs/adr/ADR-007-ai-role-separation.md](docs/adr/ADR-007-ai-role-separation.md) |

## Key Design Decisions

- **LLM はパラメータ抽出に徹し、金銭計算は確定的プログラムコードで実行** (ADR-007)
- **全 AI ドラフトに人間の確認・承認を必須化** (ADR-006)
- **ステータス遷移に行き止まりなし**: draft → reviewed → approved → processing → completed
- **機械的変更と裁量的変更で承認フローを分岐**

## Development

### Prerequisites

- direnv (`.envrc` で GCP/Git/GitHub CLI を自動切替)
- gcloud CLI
- Node.js 20+
- Docker

### Setup

```bash
cd /path/to/hr-system
direnv allow  # GCP: hr-system-487809, Git: yasushihonda-acg
```

## Accounts

| サービス | アカウント |
|---------|-----------|
| GCP | yasushi.honda@aozora-cg.com |
| GCP Project | hr-system-487809 |
| GitHub | yasushihonda-acg |
| Google Chat Space | AAAA-qf5jX0 |
