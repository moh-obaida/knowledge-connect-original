import { describe, expect, it } from "vitest";
import { checkWinner, findWinningPath, generateBoard, getHexNeighbors } from "./store";

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
