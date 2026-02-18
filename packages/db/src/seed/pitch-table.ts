import type { Timestamp } from "firebase-admin/firestore";
import type { PitchTable } from "../types.js";

/** Timestamp のプレースホルダー（投入時に Firestore.Timestamp.now() で上書き） */
type PitchTableSeed = Omit<PitchTable, "createdAt"> & {
  createdAt?: Timestamp;
};

function generatePitchTableData(): PitchTableSeed[] {
  const data: PitchTableSeed[] = [];
  for (let grade = 1; grade <= 5; grade++) {
    for (let step = 1; step <= 10; step++) {
      data.push({
        grade,
        step,
        amount: grade * 50000 + step * 5000,
        isActive: true,
      });
    }
  }
  return data;
}

export const PITCH_TABLE_DATA = generatePitchTableData();
