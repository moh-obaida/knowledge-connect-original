export type SessionMode = "classic" | "timed" | "practice" | "challenge";

export type MockPlayer = { id: string; name: string; ready: boolean };

export type ClassroomSession = {
  code: string;
  title: string;
  templateName: string;
  mode: SessionMode;
  timerSec: number;
  allowSkips: boolean;
  showAnswer: boolean;
  status: "draft" | "waiting" | "active" | "ended";
  players: MockPlayer[];
};

export type AiRequest = {
  topic: string;
  subject: string;
  grade: string;
  count: number;
  questionType: "mcq" | "tf" | "fill" | "letter";
  language: "ar" | "en";
  difficulty: "easy" | "medium" | "hard";
};
