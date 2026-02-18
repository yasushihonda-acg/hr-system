# ADR-002: LLM選定 — Vertex AI (Gemini)

| 項目 | 内容 |
|------|------|
| 日付 | 2026-02-18 |
| ステータス | 承認済み |
| 決定者 | アーキテクチャチーム |

---

## コンテキスト (Context)

HR-AI Agent は Google Chat 上の自然言語テキストから「何をしたいのか（Intent）」と「誰に、何を、いつ行うか（Parameters）」を正確に抽出する必要がある。

### 抽出対象の例

- 入力: 「田中さんの給与を来月から2ピッチ上げて」
- 抽出 Intent: `salary_change`
- 抽出 Parameters: `{ "target": "田中", "change_type": "pitch_up", "amount": 2, "effective_month": "next_month" }`

処理件数の規模感（既存の人事処理カテゴリ）:

| カテゴリ | 件数 |
|---------|------|
| 給与・社会保険関連 | 66件 |
| 退職関連 | 45件 |
| 入社関連 | 38件 |
| 異動・昇格関連 | 35件 |
| その他 | 複数カテゴリ |

LLM の選定にあたり、以下の要件を考慮した。

- GCP 基盤（`hr-system-487809`、`asia-northeast1`）との統合コスト最小化
- PII（個人情報）を含むプロンプトを処理するため、データが外部ネットワークに流出しないこと
- 就業規則、Pitch テーブル、地域手当規定などの長文コンテキストを処理できること
- JSON Structured Output で確実にパラメータを抽出できること
- **LLM はパラメータ抽出に徹し、金銭計算は確定的プログラムコードで行うこと**（詳細は ADR-007 参照）

---

## 決定 (Decision)

**Vertex AI 上の Gemini モデル**を LLM として採用する。

具体的には以下の方針とする。

- 通常の Intent 分類・パラメータ抽出: `gemini-2.0-flash`（コスト効率重視）
- 複雑な指示・曖昧な文脈の解釈: `gemini-2.0-pro`（精度重視）
- モデルバージョンは Vertex AI の Stable チャンネルを使用し、定期的に見直す

---

## 理由 (Rationale)

### GCP ネイティブ統合

- Vertex AI は GCP の Service Account で認証でき、追加の API キー管理が不要
- VPC Service Controls を使用してプライベートエンドポイント経由でアクセス可能
- PII を含むプロンプトが Google ネットワーク外に出ないことを保証できる

### 長文コンテキスト対応

- Gemini モデルは大きなコンテキストウィンドウを持ち、就業規則全文や Pitch テーブル全体をコンテキストに含めた RAG が可能
- 複数の参照テーブル（地域手当、資格手当、役職手当）を同時に注入して推論できる

### JSON Structured Output

- Vertex AI の Gemini は `response_mime_type: "application/json"` と JSON Schema 指定による確実なパラメータ抽出が可能
- スキーマ違反の出力が発生した場合の再試行ロジックを実装しやすい

### コスト効率

- GCP 統一により、クロスクラウドの通信コストやデータ転送コストが発生しない
- `gemini-2.0-flash` は高速かつ低コストで、件数の多い機械的な Intent 分類に適している

---

## プロンプトエンジニアリング戦略

### 役割定義（System Prompt）

```
あなたは株式会社ACGの人事アシスタントAIです。
社長や人事担当者からの指示を正確に理解し、
処理に必要なパラメータをJSON形式で抽出することが唯一の役割です。
金銭の計算は行いません。
```

### コンテキスト注入（RAG）

以下のマスターデータを必要に応じてプロンプトに注入する。

| データ | 用途 |
|-------|------|
| Pitch テーブル | 「Xピッチ上げる」の数値変換に使用 |
| 地域手当規定 | 地域コードと手当金額のマッピング |
| 資格手当一覧 | 資格名と対応手当金額のマッピング |
| 社員マスタ（要約） | 「田中さん」のような曖昧な指名の解決 |

### Chain of Thought（ステップバイステップ推論）

```
Step 1: 指示の主な動作（動詞）を特定する
Step 2: 対象者を特定する（複数人の場合はリスト化）
Step 3: 変更内容・数値を抽出する
Step 4: 有効日・時期を特定する（「来月」→ 具体的な年月）
Step 5: 不明な情報がある場合は確認が必要なフィールドを明示する
Step 6: 上記を JSON 形式で出力する
```

### Intent 分類（10カテゴリ）

```json
{
  "intent_categories": [
    "salary_change",
    "allowance_change",
    "position_change",
    "hire",
    "resignation",
    "transfer",
    "leave_of_absence",
    "social_insurance_update",
    "contract_renewal",
    "other_inquiry"
  ]
}
```

### 曖昧な指示への対応

- 「30万くらいで」→ 確認プロンプトを返す（「具体的な金額を教えてください」）
- 複数候補の社員名 → 候補リストを提示して確認を求める
- 有効日が不明 → 「来月1日からでよいですか？」と確認

### 出力 JSON スキーマ例

```json
{
  "intent": "salary_change",
  "confidence": 0.95,
  "parameters": {
    "target_employee_ids": ["EMP-001"],
    "change_type": "pitch_up",
    "pitch_delta": 2,
    "effective_date": "2026-03-01",
    "notes": ""
  },
  "clarification_needed": false,
  "clarification_message": null
}
```

---

## 代替案 (Alternatives Considered)

### OpenAI GPT-4 / GPT-4o

- 高品質な日本語対応と Structured Output に対応
- ただし、GCP 外部のエンドポイントに PII が送信されるためセキュリティリスクがある
- API キーの別途管理が必要
- **不採用理由**: PII の外部送信リスクと GCP 統合コスト

### Claude (Anthropic)

- 長文コンテキストと日本語対応に優れる
- AWS Bedrock または Anthropic API 経由となり、GCP との統合が複雑になる
- **不採用理由**: GCP ネイティブでないため統合コストが高い

### Google AI Studio 直接利用

- 開発時の検証には有用
- 本番運用では VPC 統合や IAM 制御が Vertex AI に比べて制限される
- エンタープライズ SLA や利用規約が Vertex AI と異なる
- **不採用理由**: 本番運用に必要なセキュリティ・SLA 要件を満たさない

### Fine-tuning 専用モデル

- 人事処理に特化した小型モデルの Fine-tuning も検討
- 学習データの準備と維持コストが高い
- Gemini の汎用モデルが RAG + プロンプトエンジニアリングで十分な精度を出せる見込み
- **不採用理由**: 初期段階では ROI が見合わない。将来的な検討事項として保留

---

## 影響 (Consequences)

### ポジティブ

- GCP の Service Account で統一管理され、追加の認証管理が不要
- PII が GCP ネットワーク内に留まり、セキュリティ要件を満たす
- Vertex AI のモデルバージョン管理により、モデル更新を制御しながら適用できる
- 長文コンテキストにより、マスターデータを都度 DB 参照せずにプロンプトに含めることができる（シンプルな実装）

### ネガティブ / リスク

- LLM の出力は確率的であり、稀に Intent 誤分類・パラメータ抽出ミスが発生する
  - 対策: Human-in-the-loop（ADR-006）で必ず人間が確認する設計とする
- Vertex AI の Gemini モデルはバージョンアップデートで挙動が変わる可能性がある
  - 対策: Stable チャンネルを使用し、プロンプトの回帰テストを CI に組み込む
- `confidence` スコアが低い場合の処理フローを定義する必要がある
  - 対策: `confidence < 0.7` の場合は自動的に `clarification_needed: true` とし、チャットで確認を求める

### 評価指標

| 指標 | 目標値 |
|------|--------|
| Intent 分類精度 | 95%以上 |
| パラメータ抽出精度 | 98%以上 |
| 平均レスポンス時間 | 3秒以内 |
| 確認プロンプト発生率 | 10%以下 |

---

## 関連 ADR

- [ADR-001: 全体アーキテクチャ — GCPベース構成](./ADR-001-gcp-architecture.md)
- [ADR-004: チャット連携方式 — Google Chat API + Pub/Sub](./ADR-004-chat-integration.md)
- [ADR-006: Human-in-the-loop 設計パターン](./ADR-006-human-in-the-loop.md)
- [ADR-007: AI役割分離 — LLMはパラメータ抽出、計算は確定コード](./ADR-007-ai-role-separation.md)
