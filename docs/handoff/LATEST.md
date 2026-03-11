# HR-AI Agent — Session Handoff

**最終更新**: 2026-03-11（セッション終了時点・最終更新）
**ブランチ**: `main`（最新コミット: `62d9cbe` — feat: 全メッセージ種別で担当者・期限をインライン編集可能にする (#251) (#252)）

---

## 現在のフェーズ

**Phase 9 — タスク管理拡張**

タスク詳細に期限(deadline)フィールド追加（PR #249）、期限の設定・編集 UI 追加（PR #250）、全メッセージ種別（Google Chat / LINE / 手動タスク）で担当者・期限インライン編集対応（PR #252）。

**未コミット変更**: `apps/web/src/app/(protected)/ai-settings/` 配下に 5 ファイル未追跡。これらは PR #134 で `admin/ai-settings/` に移動済みの旧ファイルが残留したもの。削除推奨（詳細は要対応項目を参照）。

**CI**: Deploy to Cloud Run (#252) — success（確認済み）

---

## MVP 実装状況

| タスク | 内容 | コミット/PR | 状態 |
|--------|------|------------|------|
| Task B〜H | マスターデータ・給与計算・承認SM・Gemini分類・OAuth/RBAC | main (#5〜#9) | 完了 |
| Task I/J | REST API（salary-drafts / employees / audit-logs） | main (#10) | 完了 |
| Task K | Next.js 承認ダッシュボード（Auth.js + shadcn/ui） | main (#11) | 完了 |
| Task L | Chat Webhook Worker（Pub/Sub + OIDC） | main (#12) | 完了 |
| Task M | チャットデータ収集・ハイブリッド分類基盤 | main (#13) | 完了 |
| Task N | GCP インフラ（Cloud Run Worker + Pub/Sub + Artifact Registry） | main (#20) | 完了 |
| Wave 1〜5 | チャット分析ダッシュボード（統計・ルール管理・対応状況） | main (#35) | 完了 |
| CI/CD | GitHub Actions（CI + Deploy to Cloud Run）WIF認証済み | main (#46〜#53) | 完了 |
| #17 | 分類フィードバック学習ループ（精度可視化・手動修正分析・CSVエクスポート） | main (#54) | 完了 |
| #19 | ダッシュボード強化（要確認フィルタ・カテゴリ分布グラフ） | main (#55) | 完了 |
| #56/#57/#58 | チャットメンション表示修正（`<users/ID>` 形式対応） | main (#59) | 完了 |
| **#60/#61** | **チャットパイプラインのメタデータ欠損バグ修正** | **main (#62)** | **完了** |
| **#64** | **チャット分析ページ カードフィードUI刷新** | **main (#65)** | **完了** |
| **#66/#67（部分）** | **メンション表示バグ修正 & 空senderName対応** | **main (#68)** | **完了** |
| **#63** | **backfill-chat.ts に --repair フラグ追加 — 欠損 senderName 補完** | **main (#69)** | **完了** |
| **#71** | **Worker: メンション displayName が空の場合 spaces.members.get で補完** | **main (#72)** | **完了** |
| **#75** | **DB: repairChatMessages で mentionedUsers の displayName を spaces.members.get で補完** | **main (#76)** | **完了** |
| **#70** | **fix(web): メンションの数字IDを非表示 — 名前不明時は「不明ユーザー」を表示** | **main (#77)** | **完了** |
| **#73** | **feat(web): チャットカードに添付ファイルを展開表示** | **main (#78)** | **完了** |
| **#74** | **feat(web): チャットカードに Google Chat メッセージへの遷移リンクを追加** | **main (#79)** | **完了** |
| **#67** | **style(web): カードUI品質改善 — shadow・アバター・フォント・レイアウト調整** | **main (#80)** | **完了** |
| **—** | **fix(web): MessageCard を Client Component に分離 — Server Component で onClick 不可問題修正** | **main (#81)** | **完了** |
| **—** | **fix(web): formatDateTime に timeZone: Asia/Tokyo を追加し Hydration mismatch を修正** | **main (#82)** | **完了** |
| **—** | **fix(web): 添付ファイルのリンク先を Google Chat メッセージに変更** | **main (#83)** | **完了** |
| **—** | **fix(web): 添付ファイルのリンクを Google Chat ファイル名検索 URL に変更** | **main (#84)** | **完了** |
| **—** | **fix(web): 添付ファイルリンクのクリック伝播を停止 & テスト追加** | **main (#85)** | **完了** |
| **—** | **fix(web): `<Link>` を `<button>+useRouter` に変更し添付ファイルリンクを修正** | **main (#86)** | **完了** |
| **—** | **fix(web): 添付ファイルリンクを新しいウィンドウで開くよう変更** | **main (#87)** | **完了** |
| **—** | **fix(web): Google Chat リンクを新しいウィンドウで開き Chrome タブインターセプトを回避** | **main (#88)** | **完了** |
| **—** | **fix(web): Google Chat リンクを #search/ URL に変更しメッセージへ直接遷移** | **main (#89)** | **完了** |
| **—** | **fix(worker): senderName/@メンション表示名が空になる問題を修正** | **main (#90)** | **完了** |
| **—** | **fix(web): audit-logs ページの 403 エラーでクラッシュする問題を修正** | **main (#91)** | **完了** |
| **—** | **fix(web): パイチャートのラベル重なりを Legend 表示に変更** | **main (#92)** | **完了** |
| **—** | **fix(web): パイチャートのツールチップにカテゴリ名と割合を表示** | **main (#93)** | **完了** |
| **—** | **feat(web): カテゴリ別分布をドーナツ＋横棒グラフ切替タブに変更** | **main (#94)** | **完了** |
| **—** | **fix(api): Chat同期 403エラーを修正（ADC 開発者 OAuth クレデンシャル利用）** | **main (#95)** | **完了** |
| **—** | **feat(web): カテゴリ別分布を2カラムレイアウトに刷新（空間効率改善）** | **main (#98)** | **完了** |
| **—** | **fix(web): モバイルナビ overflow 修正＋カテゴリチャートクリック連動** | **main (#99)** | **完了** |
| **—** | **fix(web): チャート外クリック解除・グレーアウト緩和** | **main (#100)** | **完了** |
| **—** | **feat(chat-sync): 定期同期 + 設定変更 UI を追加（Cloud Scheduler + 歯車アイコンパネル）** | **main (#101)** | **完了** |
| **—** | **fix(db): backfill-chat repair に Firestore transient エラーリトライを追加** | **main** | **完了** |
| **—** | **feat(web): 「作成案」ワークフロー管理テーブルビューを追加（インライン編集・手順クリックサイクル）** | **main (#102)** | **完了** |
| **—** | **fix(web): intent=null のメッセージもテーブルビューで編集可能にする** | **main (#103)** | **完了** |
| **—** | **perf(web): ビュー切替をクライアント側 useState に変更 — ページ遷移なしで即時切替** | **main (#104)** | **完了** |
| **—** | **feat(web): チャット分析・ダッシュボードに60秒自動リフレッシュを追加（バックグラウンドタブはスキップ）** | **main (#105)** | **完了** |
| **—** | **feat: チャットスペース管理機能を追加（スペース追加・削除・一覧、管理タブ）** | **main (#106)** | **完了** |
| **—** | **fix(web): /admin/spaces に「詳しく見る」展開セクションを追加** | **main (49cab10)** | **完了** |
| **—** | **fix(dashboard): スペース別メッセージ数に表示名を反映** | **main (1d0a8a6)** | **完了** |
| **—** | **fix(web): AutoRefresh をマウント直後に即時リフレッシュするよう修正** | **main (37248f5)** | **完了** |
| **#108〜#112** | **feat: LINE グループチャット収集・表示機能（Webhook・Firestore・API・Web タブ切替）** | **main (d259470, PR #113)** | **完了** |
| **—** | **fix(api): line-messages/stats ルーティング修正 — 重複マウントを削除** | **main (53a79a2)** | **完了** |
| **—** | **fix(web): toLocaleString による hydration mismatch を修正 (#115)** | **main (7acf646)** | **完了** |
| **—** | **fix(web): LINE メッセージカードの line-clamp-3 を除去して全文表示 (#118)** | **main (dc3e594)** | **完了** |
| **—** | **feat: LINE 画像メッセージの取得・Cloud Storage 保存・表示対応 (#119)** | **main (0b36c27)** | **完了** |
| **—** | **fix(worker): GCS Uniform Bucket-Level Access との互換性修正 + バックフィルスクリプト追加 (#120)** | **main (d68bbfb)** | **完了** |
| **—** | **feat(web): レイアウト刷新 — 縦サイドバー + ヘッダーリデザイン (#122)** | **main (e2fe103)** | **完了** |
| **—** | **feat: Inbox（受信箱）+ ワークフロー管理 — Phase 2 (#124)** | **main (4b3425d)** | **完了** |
| **—** | **test: Phase 2 Inbox テスト追加 — responseStatus フィルタ + inbox-counts + isNavActive (#125)** | **main (7fd75c0)** | **完了** |
| **—** | **feat(web): Phase 3 — ダッシュボード刷新 + 引き継ぎメモ + AI提案パネル (#126)** | **main (1582776)** | **完了** |
| **—** | **test(web): AiPanel ロジックテスト追加 — getConfidenceLabel 境界値 + CATEGORY_ACTIONS 網羅 (#127)** | **main (6235c62)** | **完了** |
| **—** | **feat(web): Phase 4 — Admin 設定ページのデザインリフレッシュ (#128)** | **main (2723571)** | **完了** |
| **—** | **feat(web): Phase 5 — チャット分析ページのデザイントークン統一 + 類似メッセージ表示 (#129)** | **main (9f23cda)** | **完了** |
| **—** | **fix(web): FE-BE 型アライメント — nullable 修正 + DraftItem 構造統一 + 契約テスト強化 (#130)** | **main (894312e)** | **完了** |
| **—** | **feat(web): UI再設計 — 3ペイン Inbox + タスクサイドパネル + Admin 統合 (#134)** | **main (e1cc36e)** | **完了** |
| **#142** | **feat: タスク優先度の型定義・DB・API・クライアント追加** | **main (#145)** | **完了** |
| **#143** | **feat: 受信箱に優先度セレクター追加（極高/高/中/低）** | **main (#146)** | **完了** |
| **#144** | **feat: タスクビューページ追加 — 優先度付きメッセージの一覧・フィルタ** | **main (#147)** | **完了** |
| **—** | **docs: CLAUDE.md を現状に合わせて更新** | **main (b63350d)** | **完了** |
| **#148** | **fix: Google Chat メッセージで Intent なしでもタスク優先度を設定可能にする** | **main (#149)** | **完了** |
| **#150/#151** | **fix(web): 受信箱の詳細ページ遷移リンク削除 + 添付ファイル表示追加** | **main (#152)** | **完了** |
| **#153〜#158** | **fix: セキュリティ強化・テスト品質・パフォーマンス改善（Server Actions 認証・PII除去・count()集計・境界値テスト追加）** | **main (#159)** | **完了** |
| **—** | **fix: CI二重テスト解消 + coverageゲート閾値設定 + Playwright BASE_URL対応** | **main (#165)** | **完了** |
| **—** | **fix: api/worker の vitest.config.ts にも coverage 閾値を追加** | **main (86a5d86)** | **完了** |
| **#172** | **fix: viewer ユーザーの業務 API アクセス拒否ガード** | **main (#172)** | **完了** |
| **#167/#168** | **fix: chat-sync 分類漏れ修正 + salary-drafts PATCH から金額フィールド除去** | **main (#173)** | **完了** |
| **—** | **test: chat-sync 分類パイプラインのテストカバレッジ追加** | **main (#174)** | **完了** |
| **—** | **feat: 黄金比ベースのタイポグラフィ・フォントサイズ調整** | **main (#176)** | **完了** |
| **—** | **fix(web): text-[11px] を text-xs(12px) に統一** | **main (#177)** | **完了** |
| **—** | **ui(web): サイドバーナビ再設計 — 可読性・アクティブ状態の改善** | **main (#178)** | **完了** |
| **#179** | **feat: 操作マニュアル /help ページ追加** | **main (#179)** | **完了** |
| **#181** | **feat(web): /help ページをエディトリアルUIにリデザイン** | **main (#181)** | **完了** |
| **#182** | **fix(worker): 同姓同名の従業員がいる場合にドラフト作成を保留する** | **main (#182)** | **完了** |
| **#183** | **test(worker): findEmployee のテストカバレッジ強化** | **main (#183)** | **完了** |
| **—** | **fix: chat-sync の fire-and-forget を同期実行に変更し二重起動を防止 (#184)** | **main (#184)** | **完了** |
| **—** | **fix: Intent フィルタ使用時のページネーションをフィルタ後に適用 (#185)** | **main (#185)** | **完了** |
| **—** | **test(web): ヘルプページのコンポーネントテスト追加 (#180) (#186)** | **main (#186)** | **完了** |
| **—** | **test: 認証・認可の統合テスト追加 (#163) (#187)** | **main (#187)** | **完了** |
| **—** | **test: Worker 統合テスト追加 — Firestore Emulator で重複排除・書き込みを検証 (#188)** | **main (#188)** | **完了** |
| **#191** | **fix(web): 承認ページのタイトルを「タスク一覧」から「承認一覧」に修正** | **main (#191)** | **完了** |
| **—** | **feat(web): ヘルプページ大規模アップデート — デスクトップスクリーンショット・コンテンツ拡充** | **main (#192)** | **完了** |
| **—** | **feat(web): ヘルプページにモバイル用フローティング目次ボタンを追加** | **main (#193)** | **完了** |
| **—** | **refactor(help): ハードコードされた10カテゴリ配列を CATEGORY_LABELS 定数に置換** | **main (#194)** | **完了** |
| **—** | **fix(web): ヘルプページのデスクトップサイドバーTOCがスクロールに追随するよう修正** | **main (#195)** | **完了** |
| **#202** | **fix(worker): 現行給与の重複データ(effectiveTo=null)を検出して処理を停止** | **main (#207)** | **完了** |
| **#198** | **fix(api): Chat 同期メタデータをスペース別に分離** | **main (#208)** | **完了** |
| **#196/#197** | **fix(api): 認証境界強化 + 給与ドラフト状態遷移のトランザクション保護** | **main (#203/#204)** | **完了** |
| **#201** | **fix(worker): replyCount を count() クエリで正確に取得** | **main (#205)** | **完了** |
| **#199** | **fix: Intent フィルタ時の 2000 件上限を逆引きクエリで解消** | **main (#206)** | **完了** |
| **#132** | **feat: アプリ設定 API の実装 (GET/PATCH /api/admin/config)** | **main (#209)** | **完了** |
| **#133** | **feat: 資料管理 API の実装 (GET/POST/DELETE /api/admin/docs)** | **main (#210)** | **完了** |
| **—** | **test(api): admin-config/admin-docs の境界値・エッジケーステスト追加** | **main (#211)** | **完了** |
| **—** | **feat(web): タスクボードに詳細パネルを追加（ページ遷移なし）** | **main (#213)** | **完了** |
| **#215/#216/#217** | **fix(web): タスクボード本番エラー修正 + UI改善** | **main (#219)** | **完了** |
| **—** | **ci: Build ステップを CI に追加（本番ビルドエラーの早期検出）** | **main (fd7a267)** | **完了** |
| **—** | **fix(worker): vitest exclude に dist/ を追加（CI build 後のテスト失敗修正）** | **main (2114c61)** | **完了** |
| **—** | **fix(web): サイドメニューに sticky を追加しスクロール追随を修正 (#220)** | **main (1a0a16f)** | **完了** |
| **#214** | **perf(web): タスクボード選択状態を useState に移行 — サーバー再フェッチを回避（TaskBoardContent 分離）** | **main (#227 + 121415d, d653609, 93e02ff)** | **完了** |
| **—** | **perf(web): タスクボードにページネーション追加 (30件/ページ)** | **main (#232)** | **完了** |
| **—** | **perf(web): タスクボード・受信箱に loading.tsx スケルトン追加** | **main (#231)** | **完了** |
| **—** | **feat: 手動タスク入力機能を追加（CRUD API + UI）** | **main (#233)** | **完了** |
| **—** | **feat: ダッシュボード統計に LINE メッセージを統合 (#230)** | **main (#234)** | **完了** |
| **—** | **test: manual-tasks CRUD API の統合テスト追加** | **main (#235)** | **完了** |
| **—** | **perf(web): 受信箱フィルター切替のパフォーマンス改善** | **main (#237)** | **完了** |
| **—** | **ci: firestore.indexes.json 変更時に自動デプロイするステップを追加** | **main (#238)** | **完了** |
| **—** | **perf: 未対応フィルター5000件超の高速化 — Firestore ページネーション** | **main (#240)** | **完了** |
| **—** | **perf: ダッシュボード stats API にキャッシュ追加** | **main (#242)** | **完了** |
| **—** | **fix(web): ページ遷移時のサイドバー位置ずれを修正 (#244)** | **main (6fcdc0b)** | **完了** |
| **—** | **fix(web): サイドバー位置ずれを修正 — h-screen + overflow-hidden** | **main (092d14a)** | **完了** |
| **—** | **fix(web): ヘルプページのスクロール不可デグレを修正** | **main (2174c67)** | **完了** |
| **—** | **feat(web): Google Chat 受信箱にスペース名を表示（LINE 同様）(#247)** | **main (911683d)** | **完了** |
| **—** | **feat: タスク詳細に期限(deadline)フィールドを追加 (#249)** | **main (c56bf3a)** | **完了** |
| **—** | **fix: 期限(deadline)の設定・編集UIを追加 (#250)** | **main (41e4bf0)** | **完了** |
| **—** | **feat: 全メッセージ種別で担当者・期限をインライン編集可能にする (#252)** | **main (62d9cbe)** | **完了** |

---

## 直近の変更（最新5件）

### feat: 全メッセージ種別で担当者・期限をインライン編集可能にする (#252) (62d9cbe)
- Google Chat / LINE / 手動タスク の全メッセージ種別で担当者・期限をインライン編集可能にした

### fix: 期限(deadline)の設定・編集UIを追加 (#250) (41e4bf0)
- 期限フィールドの設定・編集 UI コンポーネントを追加

### feat: タスク詳細に期限(deadline)フィールドを追加 (#249) (c56bf3a)
- shared/db/api/web の全レイヤーに deadline フィールドを追加

### feat(web): Google Chat 受信箱にスペース名を表示（LINE 同様）(#247) (911683d)
- Google Chat 受信箱のメッセージカードに LINE 同様のスペース名ラベルを追加表示

### fix(web): ヘルプページのスクロール不可デグレを修正 (2174c67)
- ヘルプページでスクロールができなくなるデグレを修正

### fix(web): サイドバー位置ずれを修正 — h-screen + overflow-hidden (092d14a)
- サイドバーの位置ずれを `h-screen` + `overflow-hidden` の組み合わせで修正

### fix(web): ページ遷移時のサイドバー位置ずれを修正 (#244) (6fcdc0b)
- ページ遷移時にサイドバーが位置ずれする問題を修正

### perf: ダッシュボード stats API にキャッシュ追加 (194f296, PR #242)
- ダッシュボードの統計 API レスポンスにキャッシュを追加してパフォーマンス改善

### perf: 未対応フィルター5000件超の高速化 — Firestore ページネーション (385ae88, PR #240)
- 未対応フィルター適用時に5000件超のドキュメントを一括取得していた問題を Firestore ページネーションで解決

### ci: firestore.indexes.json 変更時に自動デプロイするステップを追加 (0d2944f, PR #238)
- `firestore.indexes.json` 変更時に `firebase deploy --only firestore:indexes` を自動実行する CI ステップを追加

### perf(web): 受信箱フィルター切替のパフォーマンス改善 (5b8c589, PR #237)
- 受信箱フィルター切替時のパフォーマンスを改善

### test: manual-tasks CRUD API の統合テスト追加 (f2799f9, PR #235)
- 手動タスク CRUD API の統合テストを Firestore Emulator ベースで追加

### feat: ダッシュボード統計に LINE メッセージを統合 (#230) (e507963, PR #234)
- ダッシュボードの統計カード・グラフに LINE メッセージ件数を組み込み

### fix(worker): vitest exclude に dist/ を追加（CI build 後のテスト失敗修正）(2114c61)
- CI の `pnpm build` 実行後に `dist/` 以下のコンパイル済みファイルが vitest に拾われてテスト失敗する問題を修正
- `apps/worker/vitest.config.ts` の `exclude` に `**/dist/**` を追加
- **CI 全ステップ成功**（最新ラン確認済み）

### ci: Build ステップを CI に追加（本番ビルドエラーの早期検出）(fd7a267)
- CI に `pnpm build` を追加し、Next.js サーバー/クライアント境界エラーを PR 段階で検出可能に

### fix(web): タスクボード本番エラー修正 + UI改善 (76c4c4d, PR #219)
- `taskCompositeId` をクライアント専用ファイルから `task-composite-id.ts` に分離（サーバー/クライアント境界エラー修正）
- ページタイトル変更、空エリア削除、ヘルプページ更新、インタラクションテスト5件追加（Closes #215/#216/#217）

### feat(web): タスクボードに詳細パネルを追加（ページ遷移なし）(8bbcb67, PR #213)
- タスククリック時に右側パネルで詳細表示（デスクトップ）、モバイルは全幅表示
- `useUrlSelection` フック新設、`?id=` URL パラメータで選択状態管理、task-board.test.tsx 27件追加

### test(api): admin-config/admin-docs の境界値・エッジケーステスト追加 (85298ed, PR #211)
- アプリ設定 API・資料管理 API の境界値テスト・エッジケーステストを追加

### feat: 資料管理 API の実装 (69e120f, PR #210)
- `GET/POST/DELETE /api/admin/docs` エンドポイントを実装（Closes #133）
- Firestore `appDocs` コレクションへの CRUD

### feat: アプリ設定 API の実装 (8aacc9c, PR #209)
- `GET/PATCH /api/admin/config` エンドポイントを実装（Closes #132）
- Firestore `appConfig` ドキュメントへの読み書き

### fix(api): Chat 同期メタデータをスペース別に分離 (3c70bc2, PR #208)
- Chat 同期メタデータを全スペース共有から スペース別（`chatSyncMeta/{spaceId}`）に変更（Closes #198）

### fix(worker): 現行給与の重複データ検出で処理を停止 (3f5190b, PR #207)
- `effectiveTo=null` の現行給与が複数存在する場合に `DUPLICATE_CURRENT_SALARY` エラーを返し、誤ったドラフト生成を防止（Closes #202）

### test(worker): findEmployee のテストカバレッジ強化 (c78fda7, PR #183)
- findEmployee 関数に対する単体テストを追加・強化
- 同姓同名ケースを含む境界値テストを整備

### fix(worker): 同姓同名の従業員がいる場合にドラフト作成を保留する (9128b7a, PR #182)
- findEmployee で同姓同名が複数ヒットした場合に `AMBIGUOUS_EMPLOYEE` エラーを返し、ドラフト作成を保留する安全機構を実装

### feat(web): /help ページをエディトリアルUIにリデザイン (3541d39, PR #181)
- /help ページのUIをエディトリアルスタイルに刷新して可読性を向上

### feat: 操作マニュアル /help ページ追加 (f936879, PR #179)
- ユーザー向け操作マニュアルを /help ルートに新設

### ui(web): サイドバーナビ再設計 — 可読性・アクティブ状態の改善 (a12c96e, PR #178)
- サイドバーナビゲーションのアクティブ状態スタイルと可読性を改善

### fix: viewer ユーザーの業務 API アクセス拒否ガード (fab37d0, PR #172)
- viewer ロールが業務系 API エンドポイントにアクセスできた問題を修正

### fix: CI二重テスト解消 + coverageゲート閾値設定 + Playwright BASE_URL対応 (7621073, PR #165)
- CI ワークフローでテストが二重実行されていた問題を修正
- vitest coverage 閾値ゲートを設定（api/worker/web 全サービス対応）
- Playwright の BASE_URL 設定を追加

### fix: セキュリティ強化・テスト品質・パフォーマンス改善 (32e6182, PR #159)
- **セキュリティ**: Server Actions 全7ファイルに `requireAccess()` / `requireAdmin()` 追加（defense-in-depth）
- **セキュリティ**: `process-line-message.ts` のログから PII（senderName）を除去
- **セキュリティ**: 開発用トークンバイパスに `ALLOW_DEV_TOKEN` フラグの二重ガードを追加
- **パフォーマンス**: `inbox-counts` を全件スキャン → `count()` 4並列クエリに変更（chat + LINE 両方）
- **テスト**: Pitch 境界値テスト追加、event-parser テストを分割、smoke.test.ts を意味あるテストに置換
- Closes #153, #154, #155, #156, #157, #158

### fix: 受信箱の詳細ページ遷移リンク削除 + 添付ファイル表示追加 (c51c9fa, PR #152)
- 受信箱詳細ペインから不要なページ遷移リンクを削除
- 添付ファイルの表示を追加
- inbox-3pane.test.tsx に対応テスト追加（#150/#151）

### fix: Google Chat メッセージで Intent なしでもタスク優先度を設定可能にする (e42e1b9, PR #149)
- intent が null のメッセージでも taskPriority を PATCH できるよう修正
- (#148 の不具合対応)

### docs: CLAUDE.md を現状に合わせて更新 (b63350d)
- Project Structure: worker/salary/ai パッケージ追加
- Data Model: LineMessage 追加
- Architecture: LINE Webhook 追記

### feat: タスクビューページ追加 (18ef843, PR #147)
- `/task-board` ルートにタスクビューページを新設
- Google Chat / LINE 両ソースの優先度付きメッセージを統合表示
- 優先度・ソース・対応状況でフィルタリング、極高は赤背景で強調
- サイドバーナビを4→5項目に拡張（タスク→/task-board、承認→/tasks）

### feat: 受信箱に優先度セレクター追加 (520c947, PR #146)
- TaskPrioritySelector: 4段階トグルボタン（極高/高/中/低、再クリックで解除）
- TaskPriorityDot: 一覧ペイン用インジケータ（極高は赤パルスバッジ）
- Google Chat / LINE 両方の受信箱詳細ペインに統合

### feat: タスク優先度の型定義・DB・API・クライアント追加 (50b6ab7, PR #145)
- shared: `TaskPriority` 型 + `TASK_PRIORITIES` 定数
- db: IntentRecord / LineMessage に `taskPriority` フィールド追加
- api: PATCH workflow / PATCH line-messages task-priority エンドポイント
- web: 型定義 + API クライアント関数追加

### feat(web): UI再設計 — 3ペイン Inbox + タスクサイドパネル + Admin 統合 (e1cc36e, PR #134)
- Inbox: 左(320px一覧)+中央(詳細)+右(300px AI判定)の3ペイン構成
- Tasks: ドラフト詳細サイドパネル、Admin: 5タブ統合
- ナビ 8項目→4項目、定数集約

---

## 次のアクション候補

1. **残留ファイル削除**: `apps/web/src/app/(protected)/ai-settings/` の 5 ファイル（PR #134 の移動済みファイルが残留）を `git rm` で削除してコミット
2. **SmartHR / Google Sheets / Gmail 連携実装**（Phase 2 後半）
3. **E2E テスト自動化**（Playwright による本番フロー検証）

### 完了済みバックログ（参考）

| Issue | 内容 | 結果 |
|-------|------|------|
| **#96** | senderName・メンション表示名が空になる問題の根本解決 | 調査完了。459件のうち199件は `users/unknown`（修復不可）、260件は退職済みアカウント（People API 404 — 技術的に修復不可）。Issue に調査結果コメント記録済み |
| **#97** | 不要 IAM バインディング（hr-api → hr-worker serviceAccountTokenCreator）削除 | 削除済みを `gcloud iam` コマンドで確認済み |
| **#196** | verifyIdToken に audience 指定がなく認証境界が曖昧 | PR #203/#204 で修正済み |
| **#197** | 給与ドラフト状態遷移をトランザクションで保護する | PR #203 で Firestore トランザクション実装済み |
| **#199** | Intent フィルタ時の 2000 件上限によるデータ欠落リスク | PR #206 で逆引きクエリに変更済み |
| **#201** | replyCount が常に 0 or 1 になる問題 | PR #205 で count() クエリ対応済み |

---

## デプロイ環境

| サービス | 状態 | URL/識別子 |
|---------|------|-----------|
| Cloud Run (Worker) | デプロイ済み | `hr-worker` (asia-northeast1) |
| Cloud Run (API) | デプロイ済み | `hr-api` (asia-northeast1) |
| Cloud Run (Web) | デプロイ済み | `hr-web` (asia-northeast1) |
| Artifact Registry | 作成済み | `asia-northeast1-docker.pkg.dev/hr-system-487809/hr-system` |
| Firestore | 本番稼働中 | Native モード (asia-northeast1) |
| Pub/Sub | 稼働中 | `hr-chat-events` + `hr-chat-events-dlq` |
| GitHub Actions | CI完了・Deploy完了 | `.github/workflows/deploy.yml` |

---

## テスト状況

| パッケージ/アプリ | テストファイル | テスト数 |
|-----------------|--------------|---------|
| packages/salary | calculator.test.ts | 境界値テスト含む |
| packages/shared | approval.test.ts + status-transitions.test.ts | |
| apps/api | auth.test.ts + health.test.ts + salary-drafts.test.ts + intent-stats.test.ts | 22+ |
| apps/api (integration) | firestore-queries.integration.test.ts | 17 |
| apps/api (integration) | auth-authz.integration.test.ts | 追加済み |
| apps/worker | event-parser.test.ts + dedup.test.ts + process-message.test.ts + salary-handler.test.ts + enrich-event.test.ts + worker.integration.test.ts | 41+ |
| apps/web | smoke.test.ts + api-contract.test.ts + inbox-3pane.test.tsx + sidebar-nav.test.tsx + help.test.tsx 等 | 92+ |
| **合計** | | **297+（統合テスト追加後）** |

---

## オープン GitHub Issues

現在オープンな Issue なし（#200 を含む全 Issue がクローズ済み）。

（#96/#97/#132/#133/#196/#197/#198/#199/#200/#201/#202/#214/#218 は対応完了・クローズ済み）

---

## アーキテクチャ概要

```
apps/
  api/          Hono (TypeScript) — Cloud Run API サーバー (port 3001)
  worker/       Hono (TypeScript) — Chat Webhook Worker (port 3002)
  web/          Next.js 15 App Router — 承認ダッシュボード (port 3000)
packages/
  db/           Firestore 型定義・コレクション・クライアント
  shared/       DraftStatus, ApprovalAction, validateTransition 等
  salary/       確定的給与計算エンジン（LLM不使用）
  ai/           Gemini intent分類（正規表現プレ分類レイヤー付き）
infra/
  cloud-run/    Terraform（SA + IAM + Workload Identity）
  oauth/        Terraform（Google OAuth クライアント）
.github/
  workflows/    CI（PR時）+ Deploy to Cloud Run（main push時）
```

---

## ステータス遷移（ADR-006 準拠）

```
draft → reviewed → approved → processing → completed
          ↓           ↓
       rejected    rejected
裁量的変更: reviewed → pending_ceo_approval → approved
```

行き止まりなし（rejected は再ドラフト可能な設計）

---

## 再開手順

```bash
cd /Users/yyyhhh/ACG/hr-system

# 開発サーバー起動（API: 3001, Web: 3000, Worker: 3002）
pnpm dev

# Firebase Emulator（別ターミナル）
pnpm emulator

# テスト実行
pnpm test

# 統合テスト（Firestore Emulator が起動している状態で）
pnpm --filter @hr-system/api test:integration
```
