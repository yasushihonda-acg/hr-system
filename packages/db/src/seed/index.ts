import { Timestamp } from "firebase-admin/firestore";
import { collections } from "../collections.js";
import { ALLOWANCE_MASTER_DATA } from "./allowance-master.js";
import { TEST_EMPLOYEES } from "./employees.js";
import { PITCH_TABLE_DATA } from "./pitch-table.js";

async function seedPitchTable(): Promise<void> {
  const col = collections.pitchTables;
  const batch = col.firestore.batch();

  for (const row of PITCH_TABLE_DATA) {
    const docId = `grade${row.grade}_step${row.step}`;
    batch.set(col.doc(docId), {
      ...row,
      createdAt: Timestamp.now(),
    });
  }

  await batch.commit();
  console.log(`Seeded ${PITCH_TABLE_DATA.length} pitch table rows`);
}

async function seedAllowanceMaster(): Promise<void> {
  const col = collections.allowanceMasters;
  const batch = col.firestore.batch();

  for (const entry of ALLOWANCE_MASTER_DATA) {
    const docId = `${entry.allowanceType}_${entry.code}`;
    batch.set(col.doc(docId), {
      ...entry,
      createdAt: Timestamp.now(),
    });
  }

  await batch.commit();
  console.log(`Seeded ${ALLOWANCE_MASTER_DATA.length} allowance master rows`);
}

async function seedEmployees(): Promise<void> {
  const col = collections.employees;
  const batch = col.firestore.batch();
  const now = Timestamp.now();

  for (const emp of TEST_EMPLOYEES) {
    batch.set(col.doc(emp.employeeNumber), {
      ...emp,
      hireDate: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  await batch.commit();
  console.log(`Seeded ${TEST_EMPLOYEES.length} test employees`);
}

async function main(): Promise<void> {
  console.log("Starting seed...");
  await seedPitchTable();
  await seedAllowanceMaster();
  await seedEmployees();
  console.log("Seed completed successfully");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
