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
  category?: string;
  letter?: string;
};

export function normalizeQuestion(raw: any): QuizQuestion {
  const type: QuestionType = ["mcq","tf","fill","letter","image"].includes(raw?.type) ? raw.type : "fill";
  const prompt = String(raw?.prompt || raw?.question || "").trim();
  const correctAnswer = String(raw?.correctAnswer || raw?.answer || "").trim();
  const choices = Array.isArray(raw?.choices) ? raw.choices.map((x: any) => String(x).trim()).filter(Boolean) : undefined;
  return {
    id: String(raw?.id || ""),
    type,
    prompt,
    choices,
    correctAnswer,
    difficulty: raw?.difficulty === "hard" || raw?.difficulty === "easy" ? raw.difficulty : "medium",
    imageUrl: raw?.imageUrl ? String(raw.imageUrl) : undefined,
    explanation: raw?.explanation ? String(raw.explanation) : undefined,
    category: raw?.category ? String(raw.category) : undefined,
    letter: raw?.letter ? String(raw.letter) : undefined,
  };
}

export function validateQuestion(q: QuizQuestion) {
  const issues: string[] = [];
  if (!q.prompt) issues.push("Question text is required.");
  if (!q.correctAnswer) issues.push("Correct answer is required.");
  if (q.type === "mcq") {
    const choices = (q.choices || []).filter(Boolean);
    if (choices.length < 2) issues.push("Multiple choice needs at least two choices.");
    if (choices.length >= 2 && q.correctAnswer && !choices.includes(q.correctAnswer)) issues.push("Please select the correct answer.");
  }
  if (q.type === "tf" && !["true", "false", "صحيح", "خطأ"].includes(q.correctAnswer.toLowerCase())) issues.push("Correct answer must be true or false.");
  if (q.type === "letter" && !q.letter?.trim()) issues.push("Letter/character is required.");
  if (q.type === "image" && !q.imageUrl) issues.push("This image question has no image yet, so a placeholder will be shown.");
  return { valid: issues.length === 0, issues };
}

export function checkAnswer(q: QuizQuestion, userAnswer: unknown) {
  const ua = String(userAnswer ?? "").trim();
  const ca = q.correctAnswer.trim();
  const normalize = (v: string) => v.toLowerCase().replace(/\s+/g, " ");
  const isCorrect = normalize(ua) === normalize(ca);
  return { isCorrect, correctAnswer: q.correctAnswer, feedback: isCorrect ? "إجابة صحيحة!" : "إجابة خاطئة" };
}
