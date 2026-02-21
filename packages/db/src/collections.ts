import type {
  CollectionReference,
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { db } from "./client.js";
import type {
  AllowanceMaster,
  AllowedUser,
  ApprovalLog,
  AuditLog,
  ChatMessage,
  ClassificationRule,
  Employee,
  IntentRecord,
  LlmClassificationRule,
  PitchTable,
  Salary,
  SalaryDraft,
  SalaryDraftItem,
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
  salaryDraftItems: typedCollection<SalaryDraftItem>("salary_draft_items"),
  chatMessages: typedCollection<ChatMessage>("chat_messages"),
  intentRecords: typedCollection<IntentRecord>("intent_records"),
  approvalLogs: typedCollection<ApprovalLog>("approval_logs"),
  auditLogs: typedCollection<AuditLog>("audit_logs"),
  pitchTables: typedCollection<PitchTable>("pitch_tables"),
  allowanceMasters: typedCollection<AllowanceMaster>("allowance_masters"),
  allowedUsers: typedCollection<AllowedUser>("allowed_users"),
  classificationRules: typedCollection<ClassificationRule>("classification_rules"),
  llmClassificationRules: typedCollection<LlmClassificationRule>("llm_classification_rules"),
};
