export type QuestionType = "mcq" | "tf" | "fill" | "letter" | "image";

export type QuizQuestion = {
  id?: string;
  type: QuestionType;
  prompt: string;
  choices?: string[];
  correctAnswer: string;
  difficulty?: "easy" | "medium" | "hard";
  imageUrl?: string;
  explanation?: string;
};

export function normalizeQuestion(raw: any): QuizQuestion {
  const type: QuestionType = raw?.type || "fill";
  return {
    id: String(raw?.id || ""),
    type,
    prompt: String(raw?.prompt || raw?.question || "").trim(),
    choices: Array.isArray(raw?.choices) ? raw.choices.map((x: any) => String(x)) : undefined,
    correctAnswer: String(raw?.correctAnswer || raw?.answer || "").trim(),
    difficulty: raw?.difficulty === "hard" || raw?.difficulty === "easy" ? raw.difficulty : "medium",
    imageUrl: raw?.imageUrl ? String(raw.imageUrl) : undefined,
    explanation: raw?.explanation ? String(raw.explanation) : undefined,
  };
}

export function validateQuestion(q: QuizQuestion) {
  const issues: string[] = [];
  if (!q.prompt) issues.push("Question text is required.");
  if (!q.correctAnswer) issues.push("Correct answer is required.");
  if (q.type === "mcq") {
    const choices = (q.choices || []).filter(Boolean);
    if (choices.length < 2) issues.push("Multiple choice needs at least 2 choices.");
  }
  if (q.type === "tf" && !["true", "false", "صحيح", "خطأ"].includes(q.correctAnswer.toLowerCase())) issues.push("True/False answer must be true or false.");
  return { valid: issues.length === 0, issues };
}

export function checkAnswer(q: QuizQuestion, userAnswer: unknown) {
  const ua = String(userAnswer ?? "").trim();
  const ca = q.correctAnswer.trim();
  const normalize = (v: string) => v.toLowerCase().replace(/\s+/g, " ");
  const isCorrect = normalize(ua) === normalize(ca);
  return { isCorrect, correctAnswer: q.correctAnswer, feedback: isCorrect ? "Correct!" : "Wrong answer" };
}
