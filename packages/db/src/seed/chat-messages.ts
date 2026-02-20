import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ChatCategory, ResponseStatus } from "@hr-system/shared";
import { Timestamp } from "firebase-admin/firestore";
import { collections } from "../collections.js";

// ============================================================
// CSV 解析（RFC 4180 準拠 — 改行入りの引用フィールドに対応）
// ============================================================

function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
      } else if (char !== "\r") {
        field += char;
      }
    }
  }
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

// ============================================================
// メッセージ送信者のパース
// 形式: "1443.徳永 誠, 47 分" or "MA共通アカウント, 8 分"
// ============================================================

function parseSender(content: string): { userId: string; name: string } {
  const firstLine = content.trim().split("\n")[0] ?? "";
  const m = firstLine.match(/^(\d+)\.(.+?)[,　\s]/);
  if (m?.[1] && m?.[2]) {
    return { userId: `users/${m[1]}`, name: m[2].trim() };
  }
  const named = firstLine.match(/^(.+?),\s/);
  if (named?.[1]) {
    return { userId: "users/system", name: named[1].trim() };
  }
  return { userId: "users/unknown", name: "不明" };
}

// ============================================================
// @メンションのパース: @159.有川智浩 or @全員
// ============================================================

function parseMentions(content: string): Array<{ userId: string; displayName: string }> {
  const result: Array<{ userId: string; displayName: string }> = [];
  const re = /@(\d+)\.([^\s\n@,]+)/g;
  for (const m of content.matchAll(re)) {
    if (m[1] && m[2]) {
      result.push({ userId: `users/${m[1]}`, displayName: m[2] });
    }
  }
  return result;
}

// ============================================================
// カテゴリ分類（キーワードマッチ）
// ============================================================

const CATEGORY_KEYWORDS: Record<ChatCategory, string[]> = {
  salary: [
    "給与",
    "時給",
    "月給",
    "賃金",
    "最低賃金",
    "手当",
    "社会保険",
    "住民税",
    "給与明細",
    "昇給",
    "減給",
    "資格手当",
    "地域手当",
    "役職手当",
    "ピッチ",
    "給与規程",
  ],
  retirement: [
    "退職",
    "退社",
    "離職",
    "休職",
    "復職",
    "離職票",
    "退職金",
    "育休",
    "育児休業",
    "産休",
    "産前産後",
  ],
  hiring: [
    "入社",
    "採用",
    "面接",
    "求人",
    "応募",
    "内定",
    "オリエンテーション",
    "試用期間",
    "新入社員",
    "新卒",
    "中途",
  ],
  contract: [
    "労働条件",
    "雇用契約",
    "契約更新",
    "職種変更",
    "条件通知書",
    "雇用形態",
    "パートタイム",
  ],
  transfer: ["異動", "拠点", "移転", "寮", "社用車", "施設", "転勤"],
  foreigner: ["外国人", "特定技能", "ビザ", "入管", "在留", "実習生", "技能実習", "外国籍"],
  training: ["研修", "監査", "証明書", "身体拘束", "就労証明", "資格", "免許", "講習"],
  health_check: ["健康診断", "面談", "産業医", "定期健診", "人間ドック", "健診"],
  attendance: ["勤怠", "休暇", "シフト", "有給", "残業", "欠勤", "遅刻", "早退"],
  other: [],
};

function classifyMessage(content: string): {
  category: ChatCategory;
  matchedKeyword: string | null;
} {
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS) as [ChatCategory, string[]][]) {
    if (cat === "other") continue;
    const found = keywords.find((kw) => content.includes(kw));
    if (found) return { category: cat, matchedKeyword: found };
  }
  return { category: "other", matchedKeyword: null };
}

// ============================================================
// 対応状況マッピング（CSVの「未対応／対応済み」列）
// ============================================================

function mapResponseStatus(raw: string): ResponseStatus {
  const s = raw.trim();
  if (s.includes("対応済み") || s.includes("済")) return "responded";
  if (s.includes("対応不要") || s.includes("不要")) return "not_required";
  if (s.includes("対応中") || s.includes("調整中")) return "in_progress";
  if (s.includes("未対応") || s.includes("未")) return "unresponded";
  return "unresponded";
}

// ============================================================
// 日付のパース（"10/20" → 2025年10月20日）
// ============================================================

function parseDate(raw: string): Date {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m?.[1] && m?.[2]) {
    const month = Number.parseInt(m[1], 10);
    const day = Number.parseInt(m[2], 10);
    // タスクシートは2025年10月〜2026年2月頃の記録
    const year = month >= 10 ? 2025 : 2026;
    return new Date(year, month - 1, day, 9, 0, 0);
  }
  return new Date("2025-10-01T09:00:00");
}

// ============================================================
// Firestore へのバッチ書き込み（500件上限対応）
// ============================================================

const SPACE_ID = "AAAA-qf5jX0";
const BATCH_SIZE = 400;

export async function seedChatMessages(): Promise<void> {
  const csvPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../docs/raw/task-management-sheet.csv",
  );
  const content = readFileSync(csvPath, "utf-8");
  const rows = parseCSV(content);

  // 1行目はヘッダー or 空行なのでスキップし、No列に数値があるもののみ対象
  const messageRows = rows.filter((row) => {
    const no = row[0]?.trim() ?? "";
    return /^\d+$/.test(no);
  });

  console.log(`  → ${messageRows.length} messages from CSV`);

  let chatMsgCount = 0;
  let intentCount = 0;

  for (let offset = 0; offset < messageRows.length; offset += BATCH_SIZE) {
    const chunk = messageRows.slice(offset, offset + BATCH_SIZE);
    const msgBatch = collections.chatMessages.firestore.batch();
    const intentBatch = collections.intentRecords.firestore.batch();

    for (const row of chunk) {
      const no = row[0]?.trim() ?? "";
      const dateRaw = row[1]?.trim() ?? "";
      const content = row[2]?.trim() ?? "";
      const responseStatusRaw = row[6]?.trim() ?? "";

      const docId = `seed-msg-${no.padStart(4, "0")}`;
      const sender = parseSender(content);
      const mentions = parseMentions(content);
      const { category, matchedKeyword } = classifyMessage(content);
      const date = parseDate(dateRaw);
      const ts = Timestamp.fromDate(date);

      // --- ChatMessage ---
      const msgRef = collections.chatMessages.doc(docId);
      msgBatch.set(msgRef, {
        spaceId: SPACE_ID,
        googleMessageId: docId,
        senderUserId: sender.userId,
        senderEmail: "",
        senderName: sender.name,
        senderType: "HUMAN",
        content,
        formattedContent: null,
        messageType: "MESSAGE",
        threadName: null,
        parentMessageId: null,
        mentionedUsers: mentions,
        annotations: mentions.map((u) => ({
          type: "USER_MENTION" as const,
          userMention: {
            user: { name: u.userId, displayName: u.displayName, type: "HUMAN" },
          },
        })),
        attachments: [],
        isEdited: false,
        isDeleted: false,
        rawPayload: null,
        processedAt: ts,
        createdAt: ts,
      });

      // --- IntentRecord ---
      const intentDocId = `intent-${docId}`;
      const intentRef = collections.intentRecords.doc(intentDocId);
      intentBatch.set(intentRef, {
        chatMessageId: docId,
        category,
        confidenceScore: matchedKeyword ? 0.9 : 0.5,
        extractedParams: null,
        classificationMethod: "regex",
        regexPattern: matchedKeyword ?? null,
        llmInput: null,
        llmOutput: null,
        isManualOverride: false,
        originalCategory: null,
        overriddenBy: null,
        overriddenAt: null,
        responseStatus: mapResponseStatus(responseStatusRaw),
        responseStatusUpdatedBy: null,
        responseStatusUpdatedAt: null,
        createdAt: ts,
      });
    }

    await msgBatch.commit();
    await intentBatch.commit();
    chatMsgCount += chunk.length;
    intentCount += chunk.length;
  }

  console.log(`  Seeded ${chatMsgCount} chat messages + ${intentCount} intent records`);
}
