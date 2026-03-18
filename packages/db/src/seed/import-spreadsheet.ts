/**
 * スプレッドシートからタスクボードへの一括インポート（ワンショットスクリプト）
 *
 * Usage:
 *   pnpm db:import-sheet              # 本実行
 *   pnpm db:import-sheet --dry-run    # パース結果のみ表示
 */
import * as readline from "node:readline/promises";
import type { ResponseStatus } from "@hr-system/shared";
import { Timestamp } from "firebase-admin/firestore";
import { GoogleAuth } from "google-auth-library";
import { collections } from "../collections.js";
import type { ManualTask } from "../types.js";

// タスク管理スプレッドシート（人事業務タスク一覧）
const SPREADSHEET_ID = "1zMD83BLCw5qhuq5fgSiVkdU6scndRU3F21gvKJ2ivig";
const SHEET_RANGE = "シート1";
const HEADER_ROW_INDEX = 2; // 0-based: 3行目がヘッダー
const BATCH_LIMIT = 500;
const DELETE_MAX_ITERATIONS = 100;

// カラムインデックス
const COL = {
  NO: 0,
  DATE: 1,
  PRIORITY: 2,
  // 3 is unused
  CONTENT: 4,
  OLD_ASSIGNEE: 5,
  NEW_ASSIGNEE: 6,
  STATUS: 7,
} as const;

// スプレッドシートから取り込む対象ステータス（not_required は意図的に除外）
const STATUS_MAP: Record<string, ResponseStatus | null> = {
  未対応: "unresponded",
  対応中: "in_progress",
  対応済み: "responded",
};

interface ParsedTask {
  no: string;
  title: string;
  content: string;
  responseStatus: ResponseStatus;
  assignees: string | null;
  createdAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Sheets API fetch
// ---------------------------------------------------------------------------

async function fetchSheetData(): Promise<string[][]> {
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_RANGE)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${typeof token === "string" ? token : token.token}`,
      "x-goog-user-project": "hr-system-487809",
    },
  });

  if (!res.ok) {
    throw new Error(`Sheets API error: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { values?: string[][] };
  return data.values ?? [];
}

// ---------------------------------------------------------------------------
// Parse helpers
// ---------------------------------------------------------------------------

function parseDate(dateStr: string, rowIndex: number): Timestamp {
  if (!dateStr) {
    console.warn(`  行${rowIndex}: 日付が空 → 現在時刻を使用`);
    return Timestamp.now();
  }

  // "2024/01/15" or "2024-01-15" format
  const normalized = dateStr.replace(/\//g, "-").trim();
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) {
    console.warn(`  行${rowIndex}: 日付パース失敗 "${dateStr}" → 現在時刻を使用`);
    return Timestamp.now();
  }
  return Timestamp.fromDate(d);
}

function parseRows(rows: string[][]): ParsedTask[] {
  const dataRows = rows.slice(HEADER_ROW_INDEX + 1);
  const tasks: ParsedTask[] = [];
  let skippedNoContent = 0;
  let skippedStatus = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i] as string[];
    const rowIndex = HEADER_ROW_INDEX + 1 + i + 1; // 1-based 表示用

    const status = (row[COL.STATUS] ?? "").trim();
    const mapped = STATUS_MAP[status] ?? null;
    if (!mapped) {
      skippedStatus++;
      continue;
    }

    const content = (row[COL.CONTENT] ?? "").trim();
    if (!content) {
      skippedNoContent++;
      continue;
    }

    const no = (row[COL.NO] ?? "").trim();
    const title = no ? `No.${no} ${content.slice(0, 80)}` : content.slice(0, 80);
    const newAssignee = (row[COL.NEW_ASSIGNEE] ?? "").trim();
    const oldAssignee = (row[COL.OLD_ASSIGNEE] ?? "").trim();

    tasks.push({
      no,
      title,
      content,
      responseStatus: mapped,
      // 新担当が未設定の場合は旧担当を引き継ぐ
      assignees: newAssignee || oldAssignee || null,
      createdAt: parseDate((row[COL.DATE] ?? "").trim(), rowIndex),
    });
  }

  console.log(
    `パース結果: ${tasks.length}件取込, ${skippedStatus}件ステータス対象外, ${skippedNoContent}件内容なしスキップ`,
  );
  return tasks;
}

// ---------------------------------------------------------------------------
// Firestore operations
// ---------------------------------------------------------------------------

async function deleteAllManualTasks(): Promise<number> {
  const col = collections.manualTasks;
  let totalDeleted = 0;

  // 500件ずつバッチ削除（無限ループ防止の上限付き）
  for (let iter = 0; iter < DELETE_MAX_ITERATIONS; iter++) {
    const snapshot = await col.limit(BATCH_LIMIT).get();
    if (snapshot.empty) break;

    const batch = col.firestore.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    totalDeleted += snapshot.size;
    console.log(`  削除: ${totalDeleted}件...`);
  }

  return totalDeleted;
}

async function createManualTasks(tasks: ParsedTask[]): Promise<number> {
  const col = collections.manualTasks;
  const now = Timestamp.now();
  let created = 0;

  // 500件ずつバッチ作成
  for (let i = 0; i < tasks.length; i += BATCH_LIMIT) {
    const chunk = tasks.slice(i, i + BATCH_LIMIT);
    const batch = col.firestore.batch();

    for (const task of chunk) {
      const doc: ManualTask = {
        title: task.title,
        content: task.content,
        taskPriority: "medium",
        responseStatus: task.responseStatus,
        categories: [],
        assignees: task.assignees,
        deadline: null,
        createdBy: "system@aozora-cg.com",
        createdByName: "スプレッドシート取込",
        createdAt: task.createdAt,
        updatedAt: now,
      };
      batch.set(col.doc(), doc);
    }

    await batch.commit();
    created += chunk.length;
    console.log(`  作成: ${created}/${tasks.length}件...`);
  }

  return created;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const isDryRun = process.argv.includes("--dry-run");
  console.log(
    `=== スプレッドシート → タスクボード インポート${isDryRun ? " (DRY RUN)" : ""} ===\n`,
  );

  console.log("1. スプレッドシート取得中...");
  const rows = await fetchSheetData();
  console.log(`  取得: ${rows.length}行\n`);

  console.log("2. データパース中...");
  const tasks = parseRows(rows);

  // ステータス別内訳
  const statusCounts = tasks.reduce(
    (acc, t) => {
      acc[t.responseStatus] = (acc[t.responseStatus] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  console.log("  ステータス別内訳:", statusCounts);
  console.log();

  if (isDryRun) {
    console.log("--- DRY RUN: 先頭5件のサンプル ---");
    for (const t of tasks.slice(0, 5)) {
      console.log(`  [${t.responseStatus}] ${t.title}`);
      console.log(`    担当: ${t.assignees ?? "(未設定)"}`);
    }
    console.log(`\n合計: ${tasks.length}件がインポート対象`);
    return;
  }

  // 既存件数を確認し、削除前に対話確認
  const existingCount = (await collections.manualTasks.count().get()).data().count;
  console.log(`3. 既存 ManualTask: ${existingCount}件 → ${tasks.length}件に置換します`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question("   続行しますか？ (yes/no): ");
  rl.close();
  if (answer.trim().toLowerCase() !== "yes") {
    console.log("中断しました");
    return;
  }

  console.log("  既存データ削除中...");
  const deleted = await deleteAllManualTasks();
  console.log(`  削除完了: ${deleted}件\n`);

  console.log("4. 新規 ManualTask 作成中...");
  const created = await createManualTasks(tasks);
  console.log(`  作成完了: ${created}件\n`);

  console.log("=== インポート完了 ===");
  console.log(`  削除: ${deleted}件`);
  console.log(`  作成: ${created}件`);
  console.log("  ステータス別:", statusCounts);
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
