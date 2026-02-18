import { describe, expect, it } from "vitest";
import { DRAFT_STATUSES, TERMINAL_STATUSES, VALID_TRANSITIONS } from "../types.js";

describe("DraftStatus state machine", () => {
  it("VALID_TRANSITIONS covers all statuses in DRAFT_STATUSES", () => {
    for (const status of DRAFT_STATUSES) {
      expect(VALID_TRANSITIONS).toHaveProperty(status);
    }
  });

  it("all transition targets are valid DraftStatus values", () => {
    const validStatuses = new Set<string>(DRAFT_STATUSES);
    for (const [, targets] of Object.entries(VALID_TRANSITIONS)) {
      for (const target of targets) {
        expect(validStatuses.has(target)).toBe(true);
      }
    }
  });

  it("terminal states have no outgoing transitions", () => {
    for (const status of TERMINAL_STATUSES) {
      expect(VALID_TRANSITIONS[status]).toHaveLength(0);
    }
  });

  it("non-terminal states have at least one outgoing transition (no dead ends)", () => {
    for (const status of DRAFT_STATUSES) {
      if (TERMINAL_STATUSES.includes(status)) continue;
      expect(VALID_TRANSITIONS[status].length).toBeGreaterThan(0);
    }
  });

  it("rejected status can transition back (no dead end)", () => {
    expect(VALID_TRANSITIONS.rejected.length).toBeGreaterThan(0);
  });

  it("failed status can transition to retry or manual intervention", () => {
    expect(VALID_TRANSITIONS.failed.length).toBeGreaterThan(0);
  });

  it("includes 'failed' status for processing failures", () => {
    expect(DRAFT_STATUSES).toContain("failed");
  });

  it("mechanical change path: draft → reviewed → approved → processing → completed", () => {
    expect(VALID_TRANSITIONS.draft).toContain("reviewed");
    expect(VALID_TRANSITIONS.reviewed).toContain("approved");
    expect(VALID_TRANSITIONS.approved).toContain("processing");
    expect(VALID_TRANSITIONS.processing).toContain("completed");
  });

  it("discretionary change path: draft → reviewed → pending_ceo_approval → approved", () => {
    expect(VALID_TRANSITIONS.draft).toContain("reviewed");
    expect(VALID_TRANSITIONS.reviewed).toContain("pending_ceo_approval");
    expect(VALID_TRANSITIONS.pending_ceo_approval).toContain("approved");
  });

  it("rejection paths return to draft for rework", () => {
    expect(VALID_TRANSITIONS.rejected).toContain("draft");
    expect(VALID_TRANSITIONS.pending_ceo_approval).toContain("draft");
  });
});
