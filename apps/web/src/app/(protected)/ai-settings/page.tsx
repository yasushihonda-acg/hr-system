import { Bot } from "lucide-react";
import { getClassificationRules } from "@/lib/api";
import { RuleEditor } from "./rule-editor";

export default async function AiSettingsPage() {
  const { rules } = await getClassificationRules();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">AI分類設定</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          各カテゴリの分類ルールを調整して、識別率を向上させます。
          カードを展開してキーワードや正規表現パターンを編集してください。
        </p>
      </div>

      <div className="space-y-3">
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            分類ルールがありません。シードデータを投入してください。
          </p>
        ) : (
          rules.map((rule) => <RuleEditor key={rule.category} rule={rule} />)
        )}
      </div>
    </div>
  );
}
