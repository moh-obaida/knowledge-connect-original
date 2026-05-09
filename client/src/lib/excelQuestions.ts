import * as XLSX from "xlsx";
import type { BoardCell } from "./store";
import {
  normalizeBoardLetter,
  type QuestionBankByLetter,
  type StoredQuestionItem,
  type QuestionTypeValue,
  newQuestionId,
  ensureStoredQuestion,
  questionDedupeSignature,
  getBoardLetterKey,
  syncBoardCellLetters,
} from "./store";
import { normalizeTfCanonical } from "./questionTypes";

function formatQuestionTypeForExport(t?: QuestionTypeValue): string {
  if (t === "mcq") return "اختيار من متعدد";
  if (t === "tf") return "صح أو خطأ";
  return "إكمال";
}

/** Answer-checking helper only — do not use for board / import letter identity */
const ARABIC_LETTER_ANSWER_NORMALIZE: Record<string, string> = { أ: "ا", إ: "ا", آ: "ا", ٱ: "ا", ى: "ي" };

export function normalizeArabicLetter(value?: string): string {
  const ch = (value || "").trim().replace(/[ً-ٰٟۖ-ۭ]/g, "").charAt(0);
  return ARABIC_LETTER_ANSWER_NORMALIZE[ch] || ch;
}

const BOARD_HEADERS = [
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
] as const;

const TEMPLATE_HEADERS = ["اسم_القالب", "رقم_السؤال", "الحرف", "السؤال", "الإجابة_الصحيحة", "التصنيف", "المستوى"] as const;

const META_SHEET = "Meta";
const BOARD_SHEET = "Board";
const QUESTIONS_SHEET = "Questions";

export type BoardImportMode =
  | "merge"
  | "add-new-only"
  | "update-existing"
  | "replace-all"
  | "replace-letters-in-file-only";

export const BOARD_IMPORT_MODE_LABELS: Record<BoardImportMode, string> = {
  merge: "دمج مع بنك الأسئلة الحالي",
  "add-new-only": "إضافة الأسئلة الجديدة فقط",
  "update-existing": "تحديث الأسئلة الموجودة",
  "replace-all": "استبدال بنك الأسئلة بالكامل",
  "replace-letters-in-file-only": "استبدال أسئلة الحروف الموجودة في الملف فقط",
};

function parseDifficultyCell(s: string): BoardCell["difficulty"] {
  const t = String(s || "").trim();
  if (t === "easy" || t === "سهل") return "easy";
  if (t === "hard" || t === "صعب") return "hard";
  return "medium";
}

function formatDifficulty(d: string | undefined): string {
  if (d === "easy") return "سهل";
  if (d === "hard") return "صعب";
  return "متوسط";
}

function matrixFromSheet(wb: XLSX.WorkBook, preferredNames: string[]): string[][] {
  for (const name of preferredNames) {
    if (wb.SheetNames.includes(name)) {
      const sh = wb.Sheets[name];
      if (!sh) continue;
      const rows = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(sh, { header: 1, defval: "" });
      return rows.map((r) => (Array.isArray(r) ? r : []).map((c) => String(c ?? "").trim()));
    }
  }
  const first = wb.SheetNames[0];
  if (!first) return [];
  const sh = wb.Sheets[first];
  if (!sh) return [];
  const rows = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(sh, { header: 1, defval: "" });
  return rows.map((r) => (Array.isArray(r) ? r : []).map((c) => String(c ?? "").trim()));
}

export async function readExcelWorkbookFromFile(file: File): Promise<XLSX.WorkBook> {
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { type: "array" });
}

export type ParsedBoardRow = {
  cellId: string;
  letterRaw: string;
  letterKey: string;
  excelRowIndex: number;
  question: string;
  answer: string;
  category: string;
  difficulty: BoardCell["difficulty"];
  points: number;
  hint: string;
  explanation: string;
  qType: QuestionTypeValue;
  choices: string[];
  /** From معرف_السؤال column when present — enables update-existing + Excel round-trip */
  importQuestionId?: string;
};

export type ParseBoardMatrixResult = {
  rows: ParsedBoardRow[];
  skippedEmptyLetter: number;
  skippedMissingQa: number;
};

function inferRowQuestionType(
  typeHint: string,
  answer: string,
  choices: string[],
): QuestionTypeValue {
  const h = typeHint.toLowerCase();
  if (h.includes("متعدد") || h.includes("mcq") || h.includes("اختيار")) return "mcq";
  if (h.includes("صح_خطأ") || h.includes("tf") || h === "صح/خطأ" || (h.includes("صح") && h.includes("خطأ")))
    return "tf";
  if (choices.length >= 2) return "mcq";
  return "fill";
}

/** Parse Board sheet: letterKey from الحرف via normalizeBoardLetter only — each row processed independently */
export function parseBoardExcelMatrix(matrix: string[][]): ParseBoardMatrixResult {
  const rows: ParsedBoardRow[] = [];
  let skippedEmptyLetter = 0;
  let skippedMissingQa = 0;
  if (!matrix.length) return { rows, skippedEmptyLetter, skippedMissingQa };
  let start = 0;
  const head = matrix[0].join(" ");
  if (head.includes("معرف") || head.includes("الترتيب") || head.includes("السؤال")) start = 1;

  for (let i = start; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row.some((c) => String(c).trim())) continue;
    const cellId = String(row[0] || "").trim();
    const letterRaw = String(row[1] || "").trim();
    const question = String(row[3] || "").trim();
    let answer = String(row[4] || "").trim();
    const letterKey = normalizeBoardLetter(letterRaw);
    if (!letterKey) {
      skippedEmptyLetter++;
      continue;
    }
    if (!question) {
      skippedMissingQa++;
      continue;
    }
    const typeHint = String(row[10] || "").trim();
    const choices = [11, 12, 13, 14, 15, 16].map((j) => String(row[j] || "").trim()).filter(Boolean);
    const importQuestionId = String(row[17] || "").trim() || undefined;
    const qType = inferRowQuestionType(typeHint, answer, choices);

    if (qType === "mcq") {
      if (choices.length < 2) {
        skippedMissingQa++;
        continue;
      }
      if (!answer) answer = choices[0];
      if (!choices.includes(answer)) {
        const hit = choices.find((c) => c.trim() === answer.trim());
        if (hit) answer = hit;
        else {
          skippedMissingQa++;
          continue;
        }
      }
    } else if (qType === "tf") {
      const canon = normalizeTfCanonical(answer);
      if (!canon) {
        skippedMissingQa++;
        continue;
      }
      answer = canon;
    } else if (!answer) {
      skippedMissingQa++;
      continue;
    }

    rows.push({
      cellId,
      letterRaw,
      letterKey,
      excelRowIndex: i + 1,
      question,
      answer,
      category: String(row[5] || "").trim() || "غير مصنف",
      difficulty: parseDifficultyCell(String(row[6] || "")),
      points: Number(row[7]) || 10,
      hint: String(row[8] || "").trim(),
      explanation: String(row[9] || "").trim(),
      qType,
      choices: qType === "mcq" ? choices : [],
      importQuestionId,
    });
  }
  return { rows, skippedEmptyLetter, skippedMissingQa };
}

function rowToStoredItem(row: ParsedBoardRow): StoredQuestionItem {
  const type = row.qType;
  const choices = type === "mcq" ? row.choices : undefined;
  let answer = row.answer;
  if (type === "tf") {
    answer = normalizeTfCanonical(answer) || "صح";
  }
  return {
    id: row.importQuestionId && row.importQuestionId.length ? row.importQuestionId : newQuestionId(),
    letter: row.letterRaw,
    letterKey: row.letterKey,
    question: row.question,
    answer,
    type,
    choices,
    category: row.category,
    difficulty: row.difficulty,
    points: row.points,
    hint: row.hint,
    explanation: row.explanation,
    originalRowNumber: row.excelRowIndex,
    isActive: true,
  };
}

function cloneBankByLetter(src: QuestionBankByLetter): QuestionBankByLetter {
  const out: QuestionBankByLetter = {};
  for (const [k, arr] of Object.entries(src)) {
    out[k] = arr.map((q) => ({ ...q }));
  }
  return out;
}

function cloneCellBank(cell: BoardCell): StoredQuestionItem[] {
  const bank = (cell as BoardCell & { questionBank?: unknown[] }).questionBank;
  if (!Array.isArray(bank)) return [];
  const key = getBoardLetterKey(cell);
  const out: StoredQuestionItem[] = [];
  for (const q of bank) {
    const item = ensureStoredQuestion(q as Record<string, unknown>, key);
    if (item) out.push(item);
  }
  return out;
}

function setCellBank(cell: BoardCell, items: StoredQuestionItem[]): BoardCell {
  const first = items[0];
  return syncBoardCellLetters({
    ...cell,
    question: first?.question || "",
    answer: first?.answer || "",
    category: first?.category || "",
    difficulty: first?.difficulty || "easy",
    points: first?.points ?? 1,
    hint: first?.hint || "",
    explanation: first?.explanation || "",
    ...( { questionBank: items } as Record<string, unknown>),
  } as BoardCell);
}

function collectSignaturesForLetter(
  letterKey: string,
  board: BoardCell[],
  globalBank: QuestionBankByLetter,
): Set<string> {
  const sigs = new Set<string>();
  for (const cell of board) {
    if (getBoardLetterKey(cell) !== letterKey) continue;
    for (const q of cloneCellBank(cell)) sigs.add(questionDedupeSignature(q));
  }
  for (const q of globalBank[letterKey] || []) sigs.add(questionDedupeSignature(q));
  return sigs;
}

/**
 * Apply parsed Excel rows: never map by board index.
 * - If معرف_الخلية matches a cell and letterKey matches that cell → attach there.
 * - Else attach to first cell with same letterKey, else questionBankByLetter[letterKey].
 */
export function applyBoardExcelImport(args: {
  roomBoard: BoardCell[];
  questionBankByLetter: QuestionBankByLetter;
  rows: ParsedBoardRow[];
  mode: BoardImportMode;
}): {
  board: BoardCell[];
  questionBankByLetter: QuestionBankByLetter;
  summary: {
    importedCount: number;
    skippedRows: number;
    letterCounts: Record<string, number>;
    warnings: string[];
  };
} {
  const warnings: string[] = [];
  let board = args.roomBoard.map((c) => syncBoardCellLetters({ ...c }));
  let globalBank = cloneBankByLetter(args.questionBankByLetter || {});
  const fileLetterKeys = new Set(args.rows.map((r) => r.letterKey));

  if (args.mode === "replace-all") {
    board = board.map((cell) => setCellBank(cell, []));
    globalBank = {};
  } else if (args.mode === "replace-letters-in-file-only") {
    for (const lk of Array.from(fileLetterKeys)) {
      board = board.map((cell) => (getBoardLetterKey(cell) !== lk ? cell : setCellBank(cell, [])));
      delete globalBank[lk];
    }
  }

  const letterCounts: Record<string, number> = {};
  let importedCount = 0;
  let skippedRows = 0;

  const cellById = new Map(board.map((c) => [c.id, c] as const));
  const firstCellByLetter = new Map<string, BoardCell>();
  for (const cell of board) {
    const k = getBoardLetterKey(cell);
    if (!firstCellByLetter.has(k)) firstCellByLetter.set(k, cell);
  }

  for (const row of args.rows) {
    const item = rowToStoredItem(row);
    let destCell: BoardCell | undefined;

    if (row.cellId && cellById.has(row.cellId)) {
      const c = cellById.get(row.cellId)!;
      if (getBoardLetterKey(c) === row.letterKey) destCell = c;
      else {
        warnings.push(
          `صف ${row.excelRowIndex}: معرف الخلية ${row.cellId} لا يطابق حرف العمود «${row.letterRaw}» — تم استخدام الحرف من العمود.`,
        );
      }
    }
    if (!destCell) destCell = firstCellByLetter.get(row.letterKey);
    const isGlobal = !destCell;

    const readExisting = (): StoredQuestionItem[] => {
      if (isGlobal) return [...(globalBank[row.letterKey] || [])];
      return cloneCellBank(destCell!);
    };

    const writeExisting = (items: StoredQuestionItem[]) => {
      if (isGlobal) {
        globalBank[row.letterKey] = items;
      } else {
        const idx = board.findIndex((c) => c.id === destCell!.id);
        if (idx >= 0) board[idx] = setCellBank(board[idx], items);
      }
    };

    if (args.mode === "add-new-only") {
      const sigs = collectSignaturesForLetter(row.letterKey, board, globalBank);
      if (sigs.has(questionDedupeSignature(item))) {
        skippedRows++;
        continue;
      }
    }

    let existing = readExisting();

    if (args.mode === "update-existing") {
      const ix = existing.findIndex((q) => q.id === item.id);
      if (ix >= 0) {
        existing = [...existing];
        existing[ix] = { ...item, id: existing[ix].id };
        writeExisting(existing);
        importedCount++;
        letterCounts[row.letterKey] = (letterCounts[row.letterKey] || 0) + 1;
        continue;
      }
    }

    existing = [...existing, item];
    writeExisting(existing);
    importedCount++;
    letterCounts[row.letterKey] = (letterCounts[row.letterKey] || 0) + 1;
  }

  return {
    board,
    questionBankByLetter: globalBank,
    summary: {
      importedCount,
      skippedRows,
      letterCounts,
      warnings,
    },
  };
}

export function mergeBoardFromExcelMatrix(
  matrix: string[][],
  roomBoard: BoardCell[],
  questionBankByLetter: QuestionBankByLetter = {},
  mode: BoardImportMode = "merge",
): { board: BoardCell[]; questionBankByLetter: QuestionBankByLetter; summary: ReturnType<typeof applyBoardExcelImport>["summary"] } | null {
  const parsed = parseBoardExcelMatrix(matrix);
  if (!parsed.rows.length) return null;
  return applyBoardExcelImport({
    roomBoard,
    questionBankByLetter,
    rows: parsed.rows,
    mode,
  });
}

export function mergeBoardFromWorkbook(
  wb: XLSX.WorkBook,
  roomBoard: BoardCell[],
  questionBankByLetter: QuestionBankByLetter = {},
  mode: BoardImportMode = "merge",
): { board: BoardCell[]; questionBankByLetter: QuestionBankByLetter; summary: ReturnType<typeof applyBoardExcelImport>["summary"] } | null {
  const matrix = matrixFromSheet(wb, [BOARD_SHEET, wb.SheetNames[0] || ""]);
  return mergeBoardFromExcelMatrix(matrix, roomBoard, questionBankByLetter, mode);
}

/** معاينة قبل الاستيراد: أعداد لكل حرف وتحذيرات للحروف غير الموجودة على اللوحة */
export function previewBoardWorkbook(wb: XLSX.WorkBook, roomBoard: BoardCell[]): {
  parsed: ParseBoardMatrixResult;
  counts: Record<string, number>;
  warnings: string[];
} {
  const matrix = matrixFromSheet(wb, [BOARD_SHEET, wb.SheetNames[0] || ""]);
  const parsed = parseBoardExcelMatrix(matrix);
  const counts: Record<string, number> = {};
  for (const r of parsed.rows) counts[r.letterKey] = (counts[r.letterKey] || 0) + 1;
  const boardKeys = new Set(roomBoard.map((c) => getBoardLetterKey(c)));
  const warnings: string[] = [];
  for (const lk of Object.keys(counts)) {
    if (!boardKeys.has(lk)) {
      warnings.push(
        `تم العثور على ${counts[lk]} سؤالاً للحرف «${lk}» لكن هذا الحرف غير موجود حالياً في لوحة اللعب — سيتم حفظها في بنك الاحتياطي حتى تُفعّل الخانة لاحقاً.`,
      );
    }
  }
  return { parsed, counts, warnings };
}

export type BoardExportMode = "full_bank" | "board_only";

/** للاختبارات ومسار التصدير → استيراد دون ملف */
export function buildBoardExportWorkbook(
  board: BoardCell[],
  questionBankByLetter: QuestionBankByLetter = {},
  exportMode: BoardExportMode = "full_bank",
): XLSX.WorkBook {
  const rows: string[][] = [Array.from(BOARD_HEADERS)];
  const appendQuestions = (cellId: string, letterKey: string, position: number, bank: StoredQuestionItem[]) => {
    for (const q of bank) {
      const ch = [...(q.choices || []), "", "", "", "", "", ""].slice(0, 6);
      rows.push([
        cellId,
        letterKey,
        String(position),
        String(q.question || ""),
        String(q.answer || ""),
        String(q.category || ""),
        formatDifficulty(q.difficulty),
        String(Number(q.points) || 10),
        String(q.hint || ""),
        String(q.explanation || ""),
        formatQuestionTypeForExport(q.type),
        ch[0] || "",
        ch[1] || "",
        ch[2] || "",
        ch[3] || "",
        ch[4] || "",
        ch[5] || "",
        String(q.id || ""),
      ]);
    }
  };

  for (const cell of board) {
    const lk = getBoardLetterKey(cell);
    const bankRaw = (cell as BoardCell & { questionBank?: unknown[] }).questionBank;
    const bank: StoredQuestionItem[] = Array.isArray(bankRaw)
      ? bankRaw.map((q) => ensureStoredQuestion(q as Record<string, unknown>, lk)).filter(Boolean) as StoredQuestionItem[]
      : cell.question.trim()
        ? [
            ensureStoredQuestion(
              {
                question: cell.question,
                answer: cell.answer,
                category: cell.category,
                difficulty: cell.difficulty,
                points: cell.points,
                hint: cell.hint,
                explanation: cell.explanation,
              } as Record<string, unknown>,
              lk,
            )!,
          ].filter(Boolean)
        : [];
    if (bank.length) appendQuestions(cell.id, lk, cell.position, bank);
  }

  if (exportMode === "full_bank") {
    for (const [letterKey, list] of Object.entries(questionBankByLetter)) {
      if (!list?.length) continue;
      appendQuestions("", letterKey, -1, list);
    }
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, BOARD_SHEET);
  return wb;
}

/** تصدير اللوحة؛ عمود الحرف = letterKey. full_bank يتضمن questionBankByLetter للحروف غير على اللوحة */
export function exportBoardToXlsx(
  board: BoardCell[],
  downloadName: string,
  questionBankByLetter: QuestionBankByLetter = {},
  exportMode: BoardExportMode = "full_bank",
) {
  const wb = buildBoardExportWorkbook(board, questionBankByLetter, exportMode);
  const safe = downloadName.endsWith(".xlsx") ? downloadName : `${downloadName}.xlsx`;
  XLSX.writeFile(wb, safe);
}

export type StarterTemplateExcel = {
  id: string;
  name: string;
  categories: string[];
  level: "سهل" | "متوسط" | "صعب";
  questions: string[];
  boardBanks: Array<{ cellId: string; label: string; questionBank: any[] }>;
  createdAt: string;
  userCreated: true;
  letterCounts?: Record<string, number>;
};

function parseMetaMatrix(meta: string[][]): { name?: string; categories?: string[]; level?: "سهل" | "متوسط" | "صعب" } {
  const out: { name?: string; categories?: string[]; level?: "سهل" | "متوسط" | "صعب" } = {};
  let start = 0;
  if (meta[0]?.[0]?.includes("مفتاح") || meta[0]?.[0]?.toLowerCase() === "key") start = 1;
  for (let i = start; i < meta.length; i++) {
    const k = String(meta[i][0] || "").trim().toLowerCase();
    const v = String(meta[i][1] || "").trim();
    if (!k || !v) continue;
    if (k === "name" || k === "اسم" || k === "اسم_القالب") out.name = v;
    else if (k === "categories" || k === "التصنيفات")
      out.categories = v
        .split(/[,،]/)
        .map((s) => s.trim())
        .filter(Boolean);
    else if (k === "level" || k === "المستوى") {
      if (v === "سهل" || v === "متوسط" || v === "صعب") out.level = v;
    }
  }
  return out;
}

export function parseTemplateWorkbookToStarter(wb: XLSX.WorkBook): StarterTemplateExcel | null {
  const metaSheet = matrixFromSheet(wb, [META_SHEET]);
  const meta = metaSheet.length ? parseMetaMatrix(metaSheet) : {};

  const matrix = matrixFromSheet(wb, [QUESTIONS_SHEET, wb.SheetNames[0] || ""]);
  if (!matrix.length) return null;

  let start = 0;
  const h = matrix[0].join(" ");
  if (h.includes("اسم") || h.includes("الحرف") || h.includes("السؤال")) start = 1;

  const banks = new Map<string, any[]>();
  let templateName = meta.name || "";

  for (let i = start; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row.some((c) => String(c).trim())) continue;
    const nameCol = String(row[0] || "").trim();
    const letter = String(row[2] || "").trim();
    const question = String(row[3] || "").trim();
    const answer = String(row[4] || "").trim();
    const letterKey = normalizeBoardLetter(letter);
    if (!letterKey || !question || !answer) continue;

    if (!templateName && nameCol) templateName = nameCol;

    if (!banks.has(letterKey)) banks.set(letterKey, []);
    const lk = letterKey;
    banks.get(lk)!.push({
      id: newQuestionId(),
      letter,
      letterKey: lk,
      question,
      answer,
      category: String(row[5] || "").trim() || "غير مصنف",
      difficulty: parseDifficultyCell(String(row[6] || "")),
      points: 1,
      hint: "",
      explanation: "",
      isActive: true,
    });
  }

  if (!banks.size || !templateName) return null;

  const boardBanks = Array.from(banks.entries()).map(([label, questionBank]) => ({
    cellId: "",
    label,
    questionBank,
  }));

  const categories =
    meta.categories && meta.categories.length
      ? meta.categories
      : Array.from(new Set(Array.from(banks.values()).flatMap((qs) => qs.map((q: any) => q.category || "غير مصنف"))));

  const level: "سهل" | "متوسط" | "صعب" = meta.level || "متوسط";

  const letterCounts: Record<string, number> = {};
  for (const b of boardBanks) {
    letterCounts[b.label] = b.questionBank.length;
  }

  return {
    id: `u_${Date.now()}`,
    name: templateName,
    categories,
    level,
    questions: boardBanks.flatMap((b) => b.questionBank.map((q: any) => q.question)),
    boardBanks,
    createdAt: new Date().toISOString(),
    userCreated: true,
    letterCounts,
  };
}

export function exportTemplateToXlsx(tpl: {
  name: string;
  categories: string[];
  level: string;
  boardBanks?: Array<{ label: string; questionBank: any[] }>;
}) {
  const rows: string[][] = [Array.from(TEMPLATE_HEADERS)];
  const banks = tpl.boardBanks || [];
  let n = 0;
  for (const b of banks) {
    const lk = normalizeBoardLetter(b.label);
    for (const q of b.questionBank || []) {
      n += 1;
      rows.push([
        tpl.name,
        String(n),
        (q as StoredQuestionItem).letterKey || lk,
        String(q.question || ""),
        String(q.answer || ""),
        String(q.category || "غير مصنف"),
        formatDifficulty(q.difficulty),
      ]);
    }
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, QUESTIONS_SHEET);

  const metaRows = [
    ["مفتاح", "قيمة"],
    ["name", tpl.name],
    ["categories", tpl.categories.join("، ")],
    ["level", tpl.level],
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(metaRows);
  XLSX.utils.book_append_sheet(wb, wsMeta, META_SHEET);

  const ALLOWED_SHEET = "القيم المسموحة";
  const EXAMPLES_SHEET = "أمثلة جاهزة";
  const allowedRows = [
    ["نوع", "قيمة"],
    [
      "الحروف المعتمدة في عمود «الحرف»",
      "ا، ب، ت، ث، ج، ح، خ، د، ذ، ر، ز، س، ش، ص، ض، ط، ظ، ع، غ، ف، ق، ك، ل، م، ن، ه، و، ي",
    ],
    ["ملاحظة", "لا تخلط بين حرف واو وبين كلمة «و» في الجملة."],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(allowedRows), ALLOWED_SHEET);

  const exampleRows: string[][] = [
    Array.from(TEMPLATE_HEADERS),
    [
      "مثال_القالب",
      "1",
      "ه",
      "ما اسم النبي الذي أُرسل إلى عاد؟",
      "هود",
      "تربية إسلامية",
      "متوسط",
    ],
    [
      "مثال_القالب",
      "2",
      "و",
      "ما الكلمة التي تدل على الوحي؟",
      "وحي",
      "لغة عربية",
      "متوسط",
    ],
    [
      "مثال_القالب",
      "3",
      "ي",
      "يوسف عليه السلام من أبناء يعقوب عليه السلام.",
      "صحيح",
      "قصص الأنبياء",
      "سهل",
    ],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(exampleRows), EXAMPLES_SHEET);

  const safe = `template-${tpl.name.replace(/[/\\?*[\]]/g, "-")}.xlsx`;
  XLSX.writeFile(wb, safe);
}
