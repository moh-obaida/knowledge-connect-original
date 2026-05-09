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
  if (!q.prompt) issues.push("نص السؤال مطلوب.");
  if (!q.correctAnswer) issues.push("الإجابة الصحيحة مطلوبة.");
  if (q.type === "mcq") {
    const choices = (q.choices || []).filter(Boolean);
    if (choices.length < 2) issues.push("الاختيار من متعدد يحتاج خيارين على الأقل.");
    if (choices.length >= 2 && q.correctAnswer && !choices.includes(q.correctAnswer)) issues.push("اختر الإجابة الصحيحة من الخيارات.");
  }
  if (q.type === "tf" && !["true", "false", "صحيح", "خطأ"].includes(q.correctAnswer.toLowerCase())) issues.push("الإجابة يجب أن تكون: صحيح أو خطأ.");
  if (q.type === "letter" && !q.letter?.trim()) issues.push("الحرف مطلوب.");
  if (q.type === "image" && !q.imageUrl) issues.push("لا توجد صورة لهذا السؤال بعد، سيتم عرض عنصر بديل.");
  return { valid: issues.length === 0, issues };
}


const ARABIC_DIACRITICS_RE = /[ً-ٰٟۖ-ۭ]/g;
const ARABIC_PUNCTUATION_RE = /[،؛؟]/g;
const ARABIC_LETTER_EQUIVALENTS: Record<string, string> = { "أ":"ا", "إ":"ا", "آ":"ا", "ٱ":"ا" };

function normalizeArabicText(value: string) {
  return value
    .trim()
    .replace(ARABIC_DIACRITICS_RE, "")
    .replace(ARABIC_PUNCTUATION_RE, " ")
    .replace(/[\.,!?؛،:()\[\]{}"'`]/g, " ")
    .replace(/\s+/g, " ")
    .split("")
    .map((ch) => ARABIC_LETTER_EQUIVALENTS[ch] || ch)
    .join("")
    .toLowerCase();
}

function normalizeArabicLetter(value?: string) {
  const ch = normalizeArabicText(value || "").charAt(0);
  return ch;
}

export function checkAnswer(q: QuizQuestion, userAnswer: unknown) {
  const ua = String(userAnswer ?? "");
  const ca = q.correctAnswer;
  const normalizedUser = normalizeArabicText(ua);
  const normalizedCorrect = normalizeArabicText(ca);

  const isExactMatch = normalizedUser === normalizedCorrect;
  const targetLetter = normalizeArabicLetter(q.letter);
  const startsWithTargetLetter = Boolean(targetLetter) && normalizedUser.startsWith(targetLetter);
  const promptAsksForLetter = /(^|\s)(كلمة|مثال|مفردة).*(تبدأ|يبدأ|بحرف|حرف)/.test(normalizedArabicPrompt(q.prompt));
  const isLetterAnswer = q.type === "letter" || promptAsksForLetter;
  const isCorrect = isExactMatch || (isLetterAnswer && startsWithTargetLetter);
  return { isCorrect, correctAnswer: q.correctAnswer, feedback: isCorrect ? "إجابة صحيحة!" : "إجابة خاطئة" };
}

function normalizedArabicPrompt(value: string) {
  return normalizeArabicText(value);
}
