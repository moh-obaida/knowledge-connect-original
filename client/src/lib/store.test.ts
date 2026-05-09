import { describe, expect, it } from "vitest";
import { checkAnswer, normalizeQuestion } from "./questionTypes";
import {
  CURRENT_BOARD_VERSION,
  CURRENT_SCHEMA_VERSION,
  canSafelyUpgradeRoom,
  checkWinner,
  defaultRoomState,
  findWinningPath,
  generateBoard,
  getHexNeighbors,
  isLegacyRoom,
  normalizeBoardForDisplay,
  normalizeRoomState,
  upgradeRoomBoardVersion,
} from "./store";

function claimedBoard(size: 4 | 5 | 6, team: 1 | 2, positions: number[]) {
  return generateBoard(size, "arabic").map((cell, index) => ({
    ...cell,
    claimedBy: positions.includes(index) ? team : 0,
  }));
}

describe("مسار الفوز في لوحة الحروف", () => {
  it("ينشئ لوحة ٥×٥ بخمسة وعشرين حرفاً عربياً دون خلايا فارغة", () => {
    const board = generateBoard(5, "arabic");

    expect(board).toHaveLength(25);
    expect(board[0].label).toBe("ا");
    const rows = Array.from({ length: 5 }, (_, row) => board.slice(row * 5, row * 5 + 5));
    expect(rows).toHaveLength(5);
    expect(rows.every((row) => row.length === 5 && row.every((cell) => cell.label))).toBe(true);
    expect(board.map((cell) => cell.label)).toEqual([
      "ا", "ب", "ت", "ث", "ج",
      "ح", "خ", "د", "ذ", "ر",
      "ز", "س", "ش", "ص", "ض",
      "ط", "ظ", "ع", "غ", "ف",
      "ق", "ك", "ل", "م", "ن",
    ]);
  });

  it("يحسب الجيران حسب إزاحة الصفوف الفردية", () => {
    expect(getHexNeighbors(6, 4).sort((a, b) => a - b)).toEqual([2, 3, 5, 7, 10, 11]);
  });

  it("يكتشف مساراً متعرجاً من اليسار إلى اليمين للفريق الأول", () => {
    const board = claimedBoard(4, 1, [0, 4, 5, 9, 10, 14, 15]);

    expect(checkWinner(board, 4)).toBe(1);
    expect(findWinningPath(board, 4, 1)).toEqual(["cell-4", "cell-5", "cell-10", "cell-14", "cell-15"]);
  });

  it("يحافظ على اتجاه فوز الأزرق من اليسار إلى اليمين", () => {
    const board = claimedBoard(5, 1, [0, 1, 2, 3, 4]);

    expect(checkWinner(board, 5)).toBe(1);
    expect(findWinningPath(board, 5, 1)).toEqual(["cell-0", "cell-1", "cell-2", "cell-3", "cell-4"]);
  });

  it("يحافظ على اتجاه فوز الأحمر من الأعلى إلى الأسفل", () => {
    const board = claimedBoard(5, 2, [0, 5, 10, 15, 20]);

    expect(checkWinner(board, 5)).toBe(2);
    expect(findWinningPath(board, 5, 2)).toEqual(["cell-0", "cell-5", "cell-10", "cell-15", "cell-20"]);
  });

  it("يكتشف مساراً متعرجاً من الأعلى إلى الأسفل للفريق الثاني", () => {
    const board = claimedBoard(4, 2, [1, 5, 9, 12]);

    expect(checkWinner(board, 4)).toBe(2);
    expect(findWinningPath(board, 4, 2)).toEqual(["cell-1", "cell-5", "cell-9", "cell-12"]);
  });

  it("لا يعلن فائزاً عندما لا يكتمل المسار", () => {
    const board = claimedBoard(4, 1, [0, 4, 5, 9, 10]);

    expect(checkWinner(board, 4)).toBe(0);
  });
});

describe("تطبيع بيانات الغرف القديمة", () => {
  it("يعرض الحرف القديم أ بصيغة ا دون تغيير اللوحة الأصلية", () => {
    const board = generateBoard(5, "arabic");
    const legacyBoard = board.map((cell, index) => index === 0 ? { ...cell, label: "أ" } : cell);

    const normalized = normalizeBoardForDisplay(legacyBoard, 5);

    expect(normalized[0].label).toBe("ا");
    expect(legacyBoard[0].label).toBe("أ");
  });

  it("يرصد الغرفة القديمة ويجهز ترقية آمنة قبل بدء اللعب", () => {
    const room = defaultRoomState("123456");
    const legacyRoom = {
      ...room,
      schemaVersion: 1,
      boardVersion: "legacy",
      board: room.board.map((cell, index) => index === 0 ? { ...cell, label: "أ" } : cell),
    };

    const normalized = normalizeRoomState(legacyRoom)!;
    const upgrade = upgradeRoomBoardVersion(normalized);

    expect(isLegacyRoom(normalized)).toBe(true);
    expect(canSafelyUpgradeRoom(normalized)).toBe(true);
    expect(normalized.board[0].label).toBe("ا");
    expect(upgrade.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(upgrade.boardVersion).toBe(CURRENT_BOARD_VERSION);
  });

  it("الغرفة الجديدة تستخدم إصدار اللوحة الحالي وبداية ا", () => {
    const room = defaultRoomState("654321");

    expect(room.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(room.boardVersion).toBe(CURRENT_BOARD_VERSION);
    expect(room.board).toHaveLength(25);
    expect(room.board[0].label).toBe("ا");
  });
});

describe("التحقق من الإجابات العربية", () => {
  it("يقبل الإجابات التي تبدأ بألف مهموزة عند سؤال حرف ا", () => {
    const question = normalizeQuestion({
      type: "fill",
      question: "اذكر كلمة تبدأ بحرف ا.",
      answer: "أسد",
      letter: "ا",
    });

    expect(checkAnswer(question, "أمل").isCorrect).toBe(true);
  });
});
