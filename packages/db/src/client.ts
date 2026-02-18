import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp({
    projectId: process.env.GCP_PROJECT_ID || "hr-system-487809",
  });
}

export const db = getFirestore();
