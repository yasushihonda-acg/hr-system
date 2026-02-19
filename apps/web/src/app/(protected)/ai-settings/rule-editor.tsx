"use client";

import { ChevronDown, ChevronUp, Save } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClassificationRule } from "@/lib/types";
import { updateRuleAction } from "./actions";

const CATEGORY_COLORS: Record<string, string> = {
  salary: "bg-green-100 text-green-800",
  retirement: "bg-red-100 text-red-800",
  hiring: "bg-blue-100 text-blue-800",
  contract: "bg-yellow-100 text-yellow-800",
  transfer: "bg-purple-100 text-purple-800",
  foreigner: "bg-orange-100 text-orange-800",
  training: "bg-indigo-100 text-indigo-800",
  health_check: "bg-pink-100 text-pink-800",
  attendance: "bg-teal-100 text-teal-800",
  other: "bg-gray-100 text-gray-600",
};

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

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  function add() {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput("");
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>
          追加
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="cursor-pointer gap-1 hover:bg-destructive/20"
              onClick={() => onChange(value.filter((t) => t !== tag))}
            >
              {tag} ×
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function RuleEditor({ rule }: { rule: ClassificationRule }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keywords, setKeywords] = useState(rule.keywords);
  const [excludeKeywords, setExcludeKeywords] = useState(rule.excludeKeywords);
  const [patterns, setPatterns] = useState(rule.patterns);
  const [description, setDescription] = useState(rule.description);
  const [isActive, setIsActive] = useState(rule.isActive);

  const colorClass = CATEGORY_COLORS[rule.category] ?? "bg-gray-100 text-gray-600";
  const label = CATEGORY_LABELS[rule.category] ?? rule.category;

  async function handleSave() {
    setSaving(true);
    try {
      await updateRuleAction(rule.category, {
        keywords,
        excludeKeywords,
        patterns,
        description,
        isActive,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className={!isActive ? "opacity-60" : undefined}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${colorClass}`}>
              {label}
            </span>
            <span className="text-sm text-muted-foreground">
              優先度: {rule.priority} · キーワード {keywords.length}件 · パターン {patterns.length}
              件
            </span>
            {!isActive && (
              <Badge variant="outline" className="text-xs">
                無効
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsActive(!isActive)}
              className="text-xs"
            >
              {isActive ? "無効化" : "有効化"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setOpen(!open)}
            >
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {!open && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{description}</p>}
      </CardHeader>

      {open && (
        <CardContent className="space-y-4 pt-0">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">説明</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="このカテゴリの説明"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              キーワード（Enterまたは追加ボタン）
            </Label>
            <TagInput value={keywords} onChange={setKeywords} placeholder="キーワードを入力..." />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">除外キーワード</Label>
            <TagInput
              value={excludeKeywords}
              onChange={setExcludeKeywords}
              placeholder="除外するキーワード..."
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              正規表現パターン（例: 給与.*改定）
            </Label>
            <TagInput value={patterns} onChange={setPatterns} placeholder="正規表現を入力..." />
          </div>

          {rule.sampleMessages.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                サンプルメッセージ
              </Label>
              <div className="space-y-1">
                {rule.sampleMessages.map((msg) => (
                  <div
                    key={msg}
                    className="rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground"
                  >
                    {msg}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving} size="sm">
              <Save className="mr-2 h-4 w-4" />
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
