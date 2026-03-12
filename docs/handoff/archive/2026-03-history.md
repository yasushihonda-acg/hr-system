# HR-AI Agent — 詳細変更履歴（2026-03）

> LATEST.md から移動した詳細実装ログ。再開時は LATEST.md を参照のこと。

## MVP 実装状況（詳細・完了分）

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
| **#60/#61** | チャットパイプラインのメタデータ欠損バグ修正 | main (#62) | 完了 |
| **#64** | チャット分析ページ カードフィードUI刷新 | main (#65) | 完了 |
| **#66/#67（部分）** | メンション表示バグ修正 & 空senderName対応 | main (#68) | 完了 |
| **#63** | backfill-chat.ts に --repair フラグ追加 — 欠損 senderName 補完 | main (#69) | 完了 |
| **#71** | Worker: メンション displayName が空の場合 spaces.members.get で補完 | main (#72) | 完了 |
| **#75** | DB: repairChatMessages で mentionedUsers の displayName を補完 | main (#76) | 完了 |
| **#70** | fix(web): メンションの数字IDを非表示 — 名前不明時は「不明ユーザー」 | main (#77) | 完了 |
| **#73** | feat(web): チャットカードに添付ファイルを展開表示 | main (#78) | 完了 |
| **#74** | feat(web): チャットカードに Google Chat メッセージへの遷移リンクを追加 | main (#79) | 完了 |
| **#67** | style(web): カードUI品質改善 | main (#80) | 完了 |
| — | fix(web): MessageCard を Client Component に分離 | main (#81) | 完了 |
| — | fix(web): formatDateTime に timeZone: Asia/Tokyo を追加し Hydration mismatch を修正 | main (#82) | 完了 |
| — | fix(web): 添付ファイルリンク修正（#83〜#89 連続修正） | main (#83〜#89) | 完了 |
| — | fix(worker): senderName/@メンション表示名が空になる問題を修正 | main (#90) | 完了 |
| — | fix(web): audit-logs ページの 403 エラーでクラッシュする問題を修正 | main (#91) | 完了 |
| — | fix/feat(web): パイチャート改善（#92〜#94）、カテゴリ別分布刷新（#98〜#100） | main (#92〜#100) | 完了 |
| — | fix(api): Chat同期 403エラーを修正（ADC 開発者 OAuth クレデンシャル利用） | main (#95) | 完了 |
| — | feat(chat-sync): 定期同期 + 設定変更 UI（Cloud Scheduler + 歯車アイコンパネル） | main (#101) | 完了 |
| — | fix(db): backfill-chat repair に Firestore transient エラーリトライを追加 | main | 完了 |
| — | feat(web): 「作成案」ワークフロー管理テーブルビューを追加 | main (#102) | 完了 |
| — | fix/perf(web): intent=null対応・ビュー切替クライアント側化・60秒自動リフレッシュ | main (#103〜#105) | 完了 |
| — | feat: チャットスペース管理機能を追加（#106） + UI修正（#107相当） | main (#106) | 完了 |
| **#108〜#112** | feat: LINE グループチャット収集・表示機能 | main (#113) | 完了 |
| — | fix(api): line-messages/stats ルーティング修正 | main | 完了 |
| — | fix(web): toLocaleString による hydration mismatch を修正 | main (#115) | 完了 |
| — | fix/feat: LINE メッセージ全文表示・画像対応・GCS互換修正 | main (#118〜#120) | 完了 |
| — | feat(web): レイアウト刷新 — 縦サイドバー + ヘッダーリデザイン | main (#122) | 完了 |
| — | feat: Inbox（受信箱）+ ワークフロー管理 — Phase 2 | main (#124) | 完了 |
| — | test: Phase 2 Inbox テスト追加 | main (#125) | 完了 |
| — | feat(web): Phase 3 — ダッシュボード刷新 + 引き継ぎメモ + AI提案パネル | main (#126) | 完了 |
| — | test(web): AiPanel ロジックテスト追加 | main (#127) | 完了 |
| — | feat(web): Phase 4 — Admin 設定ページのデザインリフレッシュ | main (#128) | 完了 |
| — | feat(web): Phase 5 — チャット分析ページのデザイントークン統一 + 類似メッセージ表示 | main (#129) | 完了 |
| — | fix(web): FE-BE 型アライメント — nullable 修正 + DraftItem 構造統一 | main (#130) | 完了 |
| — | feat(web): UI再設計 — 3ペイン Inbox + タスクサイドパネル + Admin 統合 | main (#134) | 完了 |
| **#142** | feat: タスク優先度の型定義・DB・API・クライアント追加 | main (#145) | 完了 |
| **#143** | feat: 受信箱に優先度セレクター追加 | main (#146) | 完了 |
| **#144** | feat: タスクビューページ追加 | main (#147) | 完了 |
| — | docs: CLAUDE.md を現状に合わせて更新 | main | 完了 |
| **#148** | fix: Google Chat メッセージで Intent なしでもタスク優先度を設定可能に | main (#149) | 完了 |
| **#150/#151** | fix(web): 受信箱の詳細ページ遷移リンク削除 + 添付ファイル表示追加 | main (#152) | 完了 |
| **#153〜#158** | fix: セキュリティ強化・テスト品質・パフォーマンス改善 | main (#159) | 完了 |
| — | fix: CI二重テスト解消 + coverageゲート閾値設定 + Playwright BASE_URL対応 | main (#165) | 完了 |
| — | fix: api/worker の vitest.config.ts にも coverage 閾値を追加 | main | 完了 |
| **#172** | fix: viewer ユーザーの業務 API アクセス拒否ガード | main (#172) | 完了 |
| **#167/#168** | fix: chat-sync 分類漏れ修正 + salary-drafts PATCH から金額フィールド除去 | main (#173) | 完了 |
| — | test: chat-sync 分類パイプラインのテストカバレッジ追加 | main (#174) | 完了 |
| — | feat: 黄金比ベースのタイポグラフィ・フォントサイズ調整 | main (#176) | 完了 |
| — | fix(web): text-[11px] を text-xs(12px) に統一 | main (#177) | 完了 |
| — | ui(web): サイドバーナビ再設計 | main (#178) | 完了 |
| **#179** | feat: 操作マニュアル /help ページ追加 | main (#179) | 完了 |
| **#181** | feat(web): /help ページをエディトリアルUIにリデザイン | main (#181) | 完了 |
| **#182** | fix(worker): 同姓同名の従業員がいる場合にドラフト作成を保留する | main (#182) | 完了 |
| **#183** | test(worker): findEmployee のテストカバレッジ強化 | main (#183) | 完了 |
| — | fix: chat-sync の fire-and-forget を同期実行に変更し二重起動を防止 | main (#184) | 完了 |
| — | fix: Intent フィルタ使用時のページネーションをフィルタ後に適用 | main (#185) | 完了 |
| — | test(web): ヘルプページのコンポーネントテスト追加 | main (#186) | 完了 |
| — | test: 認証・認可の統合テスト追加 | main (#187) | 完了 |
| — | test: Worker 統合テスト追加 — Firestore Emulator で重複排除・書き込みを検証 | main (#188) | 完了 |
| **#191** | fix(web): 承認ページのタイトルを「タスク一覧」から「承認一覧」に修正 | main (#191) | 完了 |
| — | feat(web): ヘルプページ大規模アップデート + モバイル目次ボタン | main (#192〜#195) | 完了 |
| **#202** | fix(worker): 現行給与の重複データ(effectiveTo=null)を検出して処理を停止 | main (#207) | 完了 |
| **#198** | fix(api): Chat 同期メタデータをスペース別に分離 | main (#208) | 完了 |
| **#196/#197** | fix(api): 認証境界強化 + 給与ドラフト状態遷移のトランザクション保護 | main (#203/#204) | 完了 |
| **#201** | fix(worker): replyCount を count() クエリで正確に取得 | main (#205) | 完了 |
| **#199** | fix: Intent フィルタ時の 2000 件上限を逆引きクエリで解消 | main (#206) | 完了 |
| **#132** | feat: アプリ設定 API の実装 (GET/PATCH /api/admin/config) | main (#209) | 完了 |
| **#133** | feat: 資料管理 API の実装 (GET/POST/DELETE /api/admin/docs) | main (#210) | 完了 |
| — | test(api): admin-config/admin-docs の境界値・エッジケーステスト追加 | main (#211) | 完了 |
| — | feat(web): タスクボードに詳細パネルを追加（ページ遷移なし） | main (#213) | 完了 |
| **#215/#216/#217** | fix(web): タスクボード本番エラー修正 + UI改善 | main (#219) | 完了 |
| — | ci: Build ステップを CI に追加（本番ビルドエラーの早期検出） | main | 完了 |
| — | fix(worker): vitest exclude に dist/ を追加（CI build 後のテスト失敗修正） | main | 完了 |
| — | fix(web): サイドメニューに sticky を追加しスクロール追随を修正 | main (#220) | 完了 |
| **#214** | perf(web): タスクボード選択状態を useState に移行 | main (#227) | 完了 |
| — | perf(web): タスクボードにページネーション追加 (30件/ページ) | main (#232) | 完了 |
| — | perf(web): タスクボード・受信箱に loading.tsx スケルトン追加 | main (#231) | 完了 |
| — | feat: 手動タスク入力機能を追加（CRUD API + UI） | main (#233) | 完了 |
| — | feat: ダッシュボード統計に LINE メッセージを統合 | main (#234) | 完了 |
| — | test: manual-tasks CRUD API の統合テスト追加 | main (#235) | 完了 |
| — | perf(web): 受信箱フィルター切替のパフォーマンス改善 | main (#237) | 完了 |
| — | ci: firestore.indexes.json 変更時に自動デプロイするステップを追加 | main (#238) | 完了 |
| — | perf: 未対応フィルター5000件超の高速化 — Firestore ページネーション | main (#240) | 完了 |
| — | perf: ダッシュボード stats API にキャッシュ追加 | main (#242) | 完了 |
| — | fix(web): サイドバー位置ずれ修正（#244 + 追加コミット） | main | 完了 |
| — | feat(web): Google Chat 受信箱にスペース名を表示（LINE 同様） | main (#247) | 完了 |
| — | feat: タスク詳細に期限(deadline)フィールドを追加 | main (#249) | 完了 |
| — | fix: 期限(deadline)の設定・編集UIを追加 | main (#250) | 完了 |
| — | feat: 全メッセージ種別で担当者・期限をインライン編集可能にする | main (#252) | 完了 |
| — | fix: インライン編集の外側クリックキャンセル + 手動タスクUI統一 | main (#256) | 完了 |
| — | feat: 担当者フィールドをコンボ入力（リスト選択+直入力）にする | main (#257) | 完了 |
| — | feat: 担当者ドロップダウンのキーボードナビ + 期限カレンダーピッカー | main (#259) | 完了 |
| — | fix: /api/admin/users の Next.js API route を追加（担当者候補取得の404修正） | main (#260) | 完了 |
| — | fix: 担当者・期限の保存後にUIが即時反映されない問題を修正 | main (#262) | 完了 |
| — | fix: 担当者フィールドのIME候補選択で苗字のみ入力される問題を修正 | main (#264) | 完了 |
| — | feat: ユーザー管理の操作メニューに「表示名を編集」を追加 | main (#265) | 完了 |
| — | fix: DialogContent の aria-describedby 警告を修正 | main (#266) | 完了 |
| — | refactor: 受信箱/タスクボードの AI判定パネルを削除 | main (#267) | 完了 |
| — | feat: 手動タスク作成フォームをDialogモーダル化 + UI改善 | main (#268) | 完了 |

## 完了済みバックログ（参考）

| Issue | 内容 | 結果 |
|-------|------|------|
| **#96** | senderName・メンション表示名が空になる問題の根本解決 | 調査完了。459件のうち199件は `users/unknown`（修復不可）、260件は退職済みアカウント（People API 404 — 技術的に修復不可）。Issue に調査結果コメント記録済み |
| **#97** | 不要 IAM バインディング（hr-api → hr-worker serviceAccountTokenCreator）削除 | 削除済みを `gcloud iam` コマンドで確認済み |
| **#196** | verifyIdToken に audience 指定がなく認証境界が曖昧 | PR #203/#204 で修正済み |
| **#197** | 給与ドラフト状態遷移をトランザクションで保護する | PR #203 で Firestore トランザクション実装済み |
| **#199** | Intent フィルタ時の 2000 件上限によるデータ欠落リスク | PR #206 で逆引きクエリに変更済み |
| **#201** | replyCount が常に 0 or 1 になる問題 | PR #205 で count() クエリ対応済み |
