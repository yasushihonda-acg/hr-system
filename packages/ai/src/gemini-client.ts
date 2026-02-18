import { VertexAI } from "@google-cloud/vertexai";

const PROJECT = process.env.GCP_PROJECT_ID ?? "hr-system-487809";
const LOCATION = "asia-northeast1";
const MODEL = "gemini-2.5-flash";

export function getGenerativeModel() {
  const vertex = new VertexAI({ project: PROJECT, location: LOCATION });
  return vertex.getGenerativeModel({ model: MODEL });
}
