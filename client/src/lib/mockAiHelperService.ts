import type { AiRequest } from "./sessionTypes";

export function generateMockQuestions(req: AiRequest) {
  return Array.from({ length: req.count }).map((_, i) => ({
    question: `(${i+1}) سؤال تجريبي عن ${req.topic} - ${req.subject}`,
    answer: req.questionType === "tf" ? "صحيح" : "إجابة نموذجية",
    type: req.questionType,
    note: "نسخة تجريبية: سيتم تفعيل المساعد الذكي لاحقًا",
  }));
}
