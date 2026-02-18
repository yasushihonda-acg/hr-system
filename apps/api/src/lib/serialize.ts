import type { Timestamp } from "firebase-admin/firestore";

export function toISO(ts: Timestamp): string {
  return ts.toDate().toISOString();
}

export function toISOOrNull(ts: Timestamp | null | undefined): string | null {
  return ts ? ts.toDate().toISOString() : null;
}
