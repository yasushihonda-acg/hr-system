"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LlmClassificationRule } from "@/lib/types";
import { createLlmRuleAction, deleteLlmRuleAction, updateLlmRuleAction } from "./llm-rules-actions";

const TYPE_LABELS: Record<string, string> = {
  system_prompt: "システムプロンプト",
  few_shot_example: "Few-shot例",
  category_definition: "カテゴリ定義",
};

export function LlmRulesEditor({ initialRules }: { initialRules: LlmClassificationRule[] }) {
  const router = useRouter();
  const systemPromptRules = initialRules.filter((r) => r.type === "system_prompt");
  const fewShotRules = initialRules.filter((r) => r.type === "few_shot_example");

  return (
    <div className="space-y-6">
      {/* システムプロンプト */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">システムプロンプト</h2>
          {systemPromptRules.length === 0 && (
            <AddSystemPromptButton onAdded={() => router.refresh()} />
          )}
        </div>
        {systemPromptRules.map((rule) => (
          <SystemPromptCard key={rule.id} rule={rule} onSaved={() => router.refresh()} />
        ))}
      </div>

      {/* Few-shot examples */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Few-shot 例</h2>
          <AddFewShotButton onAdded={() => router.refresh()} />
        </div>
        {fewShotRules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Few-shot 例がありません。追加ボタンで新規作成してください。
          </p>
        ) : (
          fewShotRules.map((rule) => (
            <FewShotCard key={rule.id} rule={rule} onSaved={() => router.refresh()} />
          ))
        )}
      </div>
    </div>
  );
}

function SystemPromptCard({ rule, onSaved }: { rule: LlmClassificationRule; onSaved: () => void }) {
  const [content, setContent] = useState(rule.content ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateLlmRuleAction(rule.id, { content });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{TYPE_LABELS[rule.type]}</Badge>
          <span className="text-xs text-muted-foreground">
            優先度: {rule.priority}
            {!rule.isActive && " (無効)"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">プロンプト内容</Label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="sm">
            <Save className="mr-2 h-4 w-4" />
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FewShotCard({ rule, onSaved }: { rule: LlmClassificationRule; onSaved: () => void }) {
  const [inputText, setInputText] = useState(rule.inputText ?? "");
  const [expectedCategory, setExpectedCategory] = useState(rule.expectedCategory ?? "");
  const [explanation, setExplanation] = useState(rule.explanation ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateLlmRuleAction(rule.id, { inputText, expectedCategory, explanation });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteLlmRuleAction(rule.id);
      onSaved();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs font-medium text-muted-foreground">入力テキスト</Label>
            <Input value={inputText} onChange={(e) => setInputText(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">期待カテゴリ</Label>
            <Input
              value={expectedCategory}
              onChange={(e) => setExpectedCategory(e.target.value)}
              placeholder="salary, retirement..."
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">説明</Label>
          <Input value={explanation} onChange={(e) => setExplanation(e.target.value)} />
        </div>
        <div className="flex justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-1 h-4 w-4" />
            {deleting ? "削除中..." : "削除"}
          </Button>
          <Button onClick={handleSave} disabled={saving} size="sm">
            <Save className="mr-2 h-4 w-4" />
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AddSystemPromptButton({ onAdded }: { onAdded: () => void }) {
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    setLoading(true);
    try {
      await createLlmRuleAction({
        type: "system_prompt",
        content: "",
        category: null,
        description: "分類用システムプロンプト",
        keywords: null,
        inputText: null,
        expectedCategory: null,
        explanation: null,
        priority: 1,
        isActive: true,
      });
      onAdded();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleAdd} disabled={loading}>
      <Plus className="mr-1 h-4 w-4" />
      {loading ? "追加中..." : "追加"}
    </Button>
  );
}

function AddFewShotButton({ onAdded }: { onAdded: () => void }) {
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    setLoading(true);
    try {
      await createLlmRuleAction({
        type: "few_shot_example",
        content: null,
        category: null,
        description: null,
        keywords: null,
        inputText: "",
        expectedCategory: null,
        explanation: "",
        priority: 100,
        isActive: true,
      });
      onAdded();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleAdd} disabled={loading}>
      <Plus className="mr-1 h-4 w-4" />
      {loading ? "追加中..." : "Few-shot例を追加"}
    </Button>
  );
}
