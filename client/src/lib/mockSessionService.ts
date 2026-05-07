import type { ClassroomSession } from "./sessionTypes";

const MOCK_NAMES = ["أحمد", "سارة", "ليان", "خالد", "نور", "مريم"];

export function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function createMockSession(partial?: Partial<ClassroomSession>): ClassroomSession {
  return {
    code: generateCode(),
    title: "حصة تفاعلية",
    templateName: "Arabic Letters Adventure",
    mode: "classic",
    timerSec: 30,
    allowSkips: true,
    showAnswer: false,
    status: "waiting",
    players: MOCK_NAMES.slice(0, 4).map((name, idx) => ({ id: `p${idx+1}`, name, ready: idx % 2 === 0 })),
    ...partial,
  };
}
