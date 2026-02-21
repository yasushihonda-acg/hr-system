export { getGenerativeModel } from "./gemini-client.js";
export {
  type ClassificationConfig,
  classifyIntent,
  type IntentClassificationResult,
  type RegexRule,
  type ThreadContext,
} from "./intent-classifier.js";
export {
  extractSalaryParams,
  type SalaryChangeParams,
} from "./param-extractor.js";
export {
  INTENT_CLASSIFICATION_PROMPT,
  SALARY_PARAM_EXTRACTION_PROMPT,
} from "./prompts.js";
