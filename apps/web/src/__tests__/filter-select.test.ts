import { describe, expect, it } from "vitest";
import { buildFilterUrl } from "../app/(protected)/task-board/filter-utils";

describe("buildFilterUrl", () => {
  it("フィルターなしでallを選択するとクエリなしURLを返す", () => {
    expect(buildFilterUrl({}, "priority", "all")).toBe("/task-board");
  });

  it("priorityをhighに変更するとクエリに反映される", () => {
    expect(buildFilterUrl({}, "priority", "high")).toBe("/task-board?priority=high");
  });

  it("既存のsearchParamsが保持される", () => {
    const url = buildFilterUrl({ source: "gchat", id: "msg-1" }, "priority", "high");
    expect(url).toContain("source=gchat");
    expect(url).toContain("priority=high");
    expect(url).toContain("id=msg-1");
  });

  it("allに変更すると該当パラメータが除外される", () => {
    const url = buildFilterUrl({ priority: "high", source: "gchat" }, "priority", "all");
    expect(url).not.toContain("priority");
    expect(url).toContain("source=gchat");
  });

  it("pageは常に1にリセットされクエリに含まれない", () => {
    const url = buildFilterUrl({ page: "3" }, "status", "unresponded");
    expect(url).not.toContain("page");
    expect(url).toContain("status=unresponded");
  });
});
