import type { AllowanceType, EmploymentType } from "@hr-system/shared";
import { ALLOWANCE_TYPES, EMPLOYMENT_TYPES } from "@hr-system/shared";
import { describe, expect, it } from "vitest";
import { ALLOWANCE_MASTER_DATA } from "../allowance-master.js";
import { TEST_EMPLOYEES } from "../employees.js";
import { PITCH_TABLE_DATA } from "../pitch-table.js";

describe("PitchTable seed data", () => {
  it("should have exactly 50 rows (grade 1-5 x step 1-10)", () => {
    expect(PITCH_TABLE_DATA).toHaveLength(50);
  });

  it("should cover all grade-step combinations", () => {
    const combinations = new Set(PITCH_TABLE_DATA.map((p) => `${p.grade}-${p.step}`));
    expect(combinations.size).toBe(50);

    for (let grade = 1; grade <= 5; grade++) {
      for (let step = 1; step <= 10; step++) {
        expect(combinations.has(`${grade}-${step}`)).toBe(true);
      }
    }
  });

  it("should calculate amount correctly: grade * 50000 + step * 5000", () => {
    for (const row of PITCH_TABLE_DATA) {
      expect(row.amount).toBe(row.grade * 50000 + row.step * 5000);
    }
  });

  it("should have no negative amounts", () => {
    for (const row of PITCH_TABLE_DATA) {
      expect(row.amount).toBeGreaterThanOrEqual(0);
    }
  });

  it("should have isActive set to true for all rows", () => {
    for (const row of PITCH_TABLE_DATA) {
      expect(row.isActive).toBe(true);
    }
  });
});

describe("AllowanceMaster seed data", () => {
  it("should have valid allowanceType for all entries", () => {
    const validTypes: readonly AllowanceType[] = ALLOWANCE_TYPES;
    for (const entry of ALLOWANCE_MASTER_DATA) {
      expect(validTypes).toContain(entry.allowanceType);
    }
  });

  it("should have no negative amounts", () => {
    for (const entry of ALLOWANCE_MASTER_DATA) {
      expect(entry.amount).toBeGreaterThanOrEqual(0);
    }
  });

  it("should have unique codes", () => {
    const codes = ALLOWANCE_MASTER_DATA.map((e) => e.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("should have position, region, and qualification types", () => {
    const types = new Set(ALLOWANCE_MASTER_DATA.map((e) => e.allowanceType));
    expect(types.has("position")).toBe(true);
    expect(types.has("region")).toBe(true);
    expect(types.has("qualification")).toBe(true);
  });

  it("should have isActive set to true for all entries", () => {
    for (const entry of ALLOWANCE_MASTER_DATA) {
      expect(entry.isActive).toBe(true);
    }
  });
});

describe("Employee seed data", () => {
  it("should have at least 15 employees (ACG real staff)", () => {
    expect(TEST_EMPLOYEES.length).toBeGreaterThanOrEqual(15);
  });

  it("should have valid employmentType for all employees", () => {
    const validTypes: readonly EmploymentType[] = EMPLOYMENT_TYPES;
    for (const emp of TEST_EMPLOYEES) {
      expect(validTypes).toContain(emp.employmentType);
    }
  });

  it("should have unique employee numbers", () => {
    const numbers = TEST_EMPLOYEES.map((e) => e.employeeNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("should have isActive set to true for all employees", () => {
    for (const emp of TEST_EMPLOYEES) {
      expect(emp.isActive).toBe(true);
    }
  });
});
