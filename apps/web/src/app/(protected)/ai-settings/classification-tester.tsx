"use client";

import { FlaskConical } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { TestClassificationResult } from "@/lib/types";
import { testClassifyAction } from "./test-classify-action";

const CATEGORY_LABELS: Record<string, string> = {
  salary: "給与・社保",
  retirement: "退職・休職",
  hiring: "入社・採用",
  contract: "契約変更",
  transfer: "施設・異動",
  foreigner: "外国人・ビザ",
  training: "研修・監査",
  health_check: "健康診断",
  attendance: "勤怠・休暇",
  other: "その他",
};

export function ClassificationTester() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestClassificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleTest() {
    if (!message.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await testClassifyAction(message);
      setResult(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">分類テスト</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            テストメッセージを入力して、現在のルールでどのように分類されるか確認できます。
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="テストメッセージを入力してください..."
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            maxLength={1000}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{message.length}/1000</span>
            <Button onClick={handleTest} disabled={loading || !message.trim()} size="sm">
              {loading ? "分類中..." : "テスト実行"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardContent className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">カテゴリ</p>
                <Badge className="mt-1">
                  {CATEGORY_LABELS[result.category] ?? result.category}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">確信度</p>
                <p className="mt-1 text-lg font-semibold">
                  {(result.confidence * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">分類方法</p>
                <Badge variant="outline" className="mt-1">
                  {result.classificationMethod === "regex" ? "正規表現" : "AI (Gemini)"}
                </Badge>
              </div>
              {result.regexPattern && (
                <div>
                  <p className="text-xs text-muted-foreground">マッチパターン</p>
                  <p className="mt-1 text-sm font-mono">{result.regexPattern}</p>
                </div>
              )}
            </div>
            {result.reasoning && (
              <div>
                <p className="text-xs text-muted-foreground">理由</p>
                <p className="mt-1 text-sm">{result.reasoning}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
