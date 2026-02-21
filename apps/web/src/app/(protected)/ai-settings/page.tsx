import { Bot } from "lucide-react";
import { getClassificationRules, getLlmRules } from "@/lib/api";
import { ClassificationTester } from "./classification-tester";
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
