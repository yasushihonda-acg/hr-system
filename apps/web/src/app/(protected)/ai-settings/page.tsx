import { Bot } from "lucide-react";
import { ConfusionMatrixTable } from "@/components/confusion-matrix-table";
import { CategoryBarChart, CategoryPieChart } from "@/components/dashboard-charts";
import { ConfidenceTimelineChart, OverrideRateChart } from "@/components/intent-stats-charts";
import { IntentStatsSummaryCards } from "@/components/intent-stats-summary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getClassificationRules,
  getConfidenceTimeline,
  getConfusionMatrix,
  getIntentStatsSummary,
  getLlmRules,
  getOverridePatterns,
  getOverrideRateTimeline,
  getStatsCategories,
} from "@/lib/api";
import { ClassificationTester } from "./classification-tester";
import { CsvExportButton } from "./csv-export-button";
import { LlmRulesEditor } from "./llm-rules-editor";
import { RuleEditor } from "./rule-editor";
import { TabNav } from "./tab-nav";

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

export default async function AiSettingsPage({ searchParams }: Props) {
  const { tab = "regex" } = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">AI分類設定</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          分類ルールを調整して識別率を向上させます。タブを切り替えて正規表現ルール・LLMルール・テストを管理できます。
        </p>
      </div>

      <TabNav activeTab={tab} />

      {tab === "regex" && <RegexTab />}
      {tab === "llm" && <LlmTab />}
      {tab === "test" && <TestTab />}
      {tab === "accuracy" && <AccuracyTab />}
    </div>
  );
}

async function RegexTab() {
  const { rules } = await getClassificationRules();
  return (
    <div className="space-y-3">
      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          分類ルールがありません。シードデータを投入してください。
        </p>
      ) : (
        rules.map((rule) => <RuleEditor key={rule.category} rule={rule} />)
      )}
    </div>
  );
}

async function LlmTab() {
  const { rules } = await getLlmRules();
  return <LlmRulesEditor initialRules={rules} />;
}

function TestTab() {
  return <ClassificationTester />;
}

async function AccuracyTab() {
  const [summary, confusionData, confidenceData, overrideRateData, patternsData, categoriesData] =
    await Promise.all([
      getIntentStatsSummary(),
      getConfusionMatrix(),
      getConfidenceTimeline({ granularity: "day" }),
      getOverrideRateTimeline({ granularity: "day" }),
      getOverridePatterns(),
      getStatsCategories(),
    ]);

  return (
    <div className="space-y-6">
      <IntentStatsSummaryCards data={summary} />

      <Card>
        <CardHeader>
          <CardTitle>カテゴリ別分布</CardTitle>
          <CardDescription>
            全メッセージのカテゴリ内訳（総数: {categoriesData.total}件）
          </CardDescription>
        </CardHeader>
        <CardContent>
          {categoriesData.categories.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              <CategoryPieChart data={categoriesData.categories} />
              <CategoryBarChart data={categoriesData.categories} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">データがありません</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Confidence 推移（直近30日）</CardTitle>
          <CardDescription>分類の確信度を平均・最小・最大で表示</CardDescription>
        </CardHeader>
        <CardContent>
          {confidenceData.timeline.length > 0 ? (
            <ConfidenceTimelineChart data={confidenceData.timeline} />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">データがありません</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Override率 推移</CardTitle>
          <CardDescription>手動修正の発生率を日別で表示</CardDescription>
        </CardHeader>
        <CardContent>
          {overrideRateData.timeline.length > 0 ? (
            <OverrideRateChart data={overrideRateData.timeline} />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">データがありません</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>混同行列</CardTitle>
          <CardDescription>
            修正前カテゴリ（行）→ 修正後カテゴリ（列）の集計。色が濃いほど修正頻度が高い。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConfusionMatrixTable
            entries={confusionData.entries}
            categories={confusionData.categories}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>修正パターン一覧</CardTitle>
              <CardDescription>
                頻出の修正パターンとサンプルメッセージ（全{patternsData.totalOverrides}件）
              </CardDescription>
            </div>
            <CsvExportButton patterns={patternsData.patterns} />
          </div>
        </CardHeader>
        <CardContent>
          {patternsData.patterns.length > 0 ? (
            <div className="space-y-4">
              {patternsData.patterns.map((pattern) => (
                <div
                  key={`${pattern.fromCategory}-${pattern.toCategory}`}
                  className="rounded-lg border p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span className="rounded bg-muted px-2 py-0.5">{pattern.fromCategory}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="rounded bg-primary/10 text-primary px-2 py-0.5">
                        {pattern.toCategory}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {pattern.count}件 ({pattern.percentage}%)
                    </span>
                  </div>
                  {pattern.sampleMessages.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {pattern.sampleMessages.map((msg) => (
                        <p
                          key={msg.id}
                          className="text-xs text-muted-foreground truncate pl-2 border-l-2 border-muted"
                        >
                          {msg.content}
                        </p>
                      ))}
                    </div>
                  )}
                  {pattern.suggestedKeywords.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {pattern.suggestedKeywords.map((kw) => (
                        <span
                          key={kw}
                          className="text-xs rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              手動修正データがありません
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
