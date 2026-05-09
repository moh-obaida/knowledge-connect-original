import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  applyBoardExcelImport,
  buildBoardExportWorkbook,
  mergeBoardFromExcelMatrix,
  mergeBoardFromWorkbook,
  parseBoardExcelMatrix,
} from "./excelQuestions";
import { generateBoard, getBoardLetterKey, getQuestionsForCell, type QuestionBankByLetter } from "./store";

const BOARD_HEADER_ROW = [
  "معرف_الخلية",
  "الحرف",
  "الترتيب",
  "السؤال",
  "الإجابة",
  "التصنيف",
  "الصعوبة",
  "النقاط",
  "تلميح",
  "شرح",
  "نوع_السؤال",
  "اختيار_أ",
  "اختيار_ب",
  "اختيار_ج",
  "اختيار_د",
  "اختيار_هـ",
  "اختيار_و",
  "معرف_السؤال",
];

function rowForQuestion(
  cellId: string,
  letterKey: string,
  order: string,
  question: string,
  answer: string,
  questionId = "",
  typeHint = "نصي",
): string[] {
  return [cellId, letterKey, order, question, answer, "قصص", "متوسط", "1", "", "", typeHint, "", "", "", "", "", "", questionId];
}

describe("دمج لوحة Excel", () => {
  it("يستورد صفاً لحرف ي مع إجابة صح/خطأ دون مطابقة أول حرف الإجابة مع الحرف", () => {
    const matrix = [
      BOARD_HEADER_ROW,
      rowForQuestion("", "ي", "24", "يوسف من أبناء يعقوب؟", "صحيح", "", "صح أو خطأ"),
    ];
    const board = generateBoard(5, "arabic", { arabicLetterSet: "extended" });
    const merged = mergeBoardFromExcelMatrix(matrix, board, {}, "merge");
    expect(merged).not.toBeNull();
    const yCell = merged!.board.find((c) => getBoardLetterKey(c) === "ي");
    expect(yCell).toBeDefined();
    expect(yCell!.question).toContain("يوسف");
    expect(yCell!.answer).toBe("صح");
  });

  it("يربط السؤال بالحرف من العمود وليس بترتيب الصف أو مؤشر اللوحة", () => {
    const board = generateBoard(5, "arabic", { arabicLetterSet: "extended" });
    const هCell = board.find((c) => getBoardLetterKey(c) === "ه")!;
    const وCell = board.find((c) => getBoardLetterKey(c) === "و")!;
    const matrix = [
      BOARD_HEADER_ROW,
      rowForQuestion(هCell.id, "و", "1", "سؤال للواو", "جواب واو"),
    ];
    const merged = mergeBoardFromExcelMatrix(matrix, board, {}, "merge");
    expect(merged).not.toBeNull();
    const هAfter = merged!.board.find((c) => c.id === هCell.id)!;
    const وAfter = merged!.board.find((c) => c.id === وCell.id)!;
    const هQs = getQuestionsForCell(هAfter, merged!.questionBankByLetter);
    const وQs = getQuestionsForCell(وAfter, merged!.questionBankByLetter);
    expect(هQs.some((q) => q.question.includes("واو"))).toBe(false);
    expect(وQs.some((q) => q.question.includes("واو"))).toBe(true);
  });

  it("يحفظ أسئلة حرف غير على اللوحة في questionBankByLetter", () => {
    const board = generateBoard(5, "arabic");
    expect(board.some((c) => getBoardLetterKey(c) === "ي")).toBe(false);
    const matrix = [BOARD_HEADER_ROW, rowForQuestion("", "ي", "0", "سؤال ياء", "جواب")];
    const merged = mergeBoardFromExcelMatrix(matrix, board, {}, "merge");
    expect(merged!.questionBankByLetter["ي"]?.length).toBeGreaterThan(0);
    expect(merged!.questionBankByLetter["ي"]![0]!.letterKey).toBe("ي");
  });

  it("تصدير ثم استيراد يحافظ على letterKey لـ ه و و و ي", () => {
    const board = generateBoard(5, "arabic", { arabicLetterSet: "extended" });
    const ه = board.find((c) => getBoardLetterKey(c) === "ه")!;
    const و = board.find((c) => getBoardLetterKey(c) === "و")!;
    const ي = board.find((c) => getBoardLetterKey(c) === "ي")!;
    const withBanks = board.map((c) => {
      if (c.id === ه.id)
        return {
          ...c,
          questionBank: [
            {
              id: "q_test_ه",
              letterKey: "ه",
              letter: "ه",
              question: "س ه",
              answer: "ج ه",
              category: "غير مصنف",
              difficulty: "medium" as const,
              points: 10,
              hint: "",
              explanation: "",
              type: "fill" as const,
            },
          ],
        };
      if (c.id === و.id)
        return {
          ...c,
          questionBank: [
            {
              id: "q_test_و",
              letterKey: "و",
              letter: "و",
              question: "س و",
              answer: "ج و",
              category: "غير مصنف",
              difficulty: "medium" as const,
              points: 10,
              hint: "",
              explanation: "",
              type: "fill" as const,
            },
          ],
        };
      if (c.id === ي.id)
        return {
          ...c,
          questionBank: [
            {
              id: "q_test_ي",
              letterKey: "ي",
              letter: "ي",
              question: "س ي",
              answer: "ج ي",
              category: "غير مصنف",
              difficulty: "medium" as const,
              points: 10,
              hint: "",
              explanation: "",
              type: "fill" as const,
            },
          ],
        };
      return { ...c, questionBank: [] };
    });

    const wb = buildBoardExportWorkbook(withBanks, {}, "board_only");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
    const round = XLSX.read(buf, { type: "buffer" });

    const emptyBoard = board.map((c) => ({ ...c, question: "", answer: "", questionBank: [] as unknown[] }));
    const remerged = mergeBoardFromWorkbook(round, emptyBoard, {}, "replace-all");
    expect(remerged).not.toBeNull();

    const ه2 = remerged!.board.find((c) => c.id === ه.id)!;
    const و2 = remerged!.board.find((c) => c.id === و.id)!;
    const ي2 = remerged!.board.find((c) => c.id === ي.id)!;
    expect(getQuestionsForCell(ه2, remerged!.questionBankByLetter)[0]?.letterKey).toBe("ه");
    expect(getQuestionsForCell(و2, remerged!.questionBankByLetter)[0]?.letterKey).toBe("و");
    expect(getQuestionsForCell(ي2, remerged!.questionBankByLetter)[0]?.letterKey).toBe("ي");
    expect(parseBoardExcelMatrix(XLSX.utils.sheet_to_json(round.Sheets["Board"]!, { header: 1, defval: "" }) as string[][]).rows[0]?.letterKey).toBe("ه");
  });

  it("وضع update-existing يحدّث السؤال عند تطابق معرف_السؤال", () => {
    const board = generateBoard(5, "arabic", { arabicLetterSet: "extended" });
    const يCell = board.find((c) => getBoardLetterKey(c) === "ي")!;
    const starter: QuestionBankByLetter = {};
    const seeded = applyBoardExcelImport({
      roomBoard: board,
      questionBankByLetter: starter,
      rows: parseBoardExcelMatrix([
        BOARD_HEADER_ROW,
        rowForQuestion(يCell.id, "ي", "1", "قديم", "أول", "q_stable_1"),
      ]).rows,
      mode: "merge",
    });
    const updated = applyBoardExcelImport({
      roomBoard: seeded.board,
      questionBankByLetter: seeded.questionBankByLetter,
      rows: parseBoardExcelMatrix([
        BOARD_HEADER_ROW,
        rowForQuestion(يCell.id, "ي", "1", "جديد", "ثان", "q_stable_1"),
      ]).rows,
      mode: "update-existing",
    });
    const يAfter = updated.board.find((c) => c.id === يCell.id)!;
    const qs = getQuestionsForCell(يAfter, updated.questionBankByLetter);
    expect(qs.find((q) => q.id === "q_stable_1")?.question).toBe("جديد");
    expect(qs.find((q) => q.id === "q_stable_1")?.answer).toBe("ثان");
  });
});
