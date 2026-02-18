import type {
  CollectionReference,
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { db } from "./client.js";
import type {
  AllowanceMaster,
  ApprovalLog,
  ChatMessage,
  Employee,
  PitchTable,
  Salary,
  SalaryDraft,
} from "./types.js";

function typedCollection<T extends DocumentData>(name: string): CollectionReference<T> {
  const converter: FirestoreDataConverter<T> = {
    toFirestore(data: T): DocumentData {
      return data;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): T {
      return snapshot.data() as T;
    },
  };
  return db.collection(name).withConverter(converter);
}

export const collections = {
  employees: typedCollection<Employee>("employees"),
  salaries: typedCollection<Salary>("salaries"),
  salaryDrafts: typedCollection<SalaryDraft>("salary_drafts"),
  chatMessages: typedCollection<ChatMessage>("chat_messages"),
  approvalLogs: typedCollection<ApprovalLog>("approval_logs"),
  pitchTables: typedCollection<PitchTable>("pitch_tables"),
  allowanceMasters: typedCollection<AllowanceMaster>("allowance_masters"),
};
