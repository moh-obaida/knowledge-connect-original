import * as XLSX from "xlsx";
import type { BoardCell } from "./store";

const ARABIC_LETTER_NORMALIZE: Record<string, string> = { أ: "ا", إ: "ا", آ: "ا", ٱ: "ا", ى: "ي" };

export function normalizeArabicLetter(value?: string): string {
  const ch = (value || "").trim().replace(/[ً-ٰٟۖ-ۭ]/g, "").charAt(0);
  return ARABIC_LETTER_NORMALIZE[ch] || ch;
}

const BOARD_HEADERS = ["معرف_الخلية", "الحرف", "الترتيب", "السؤال", "الإجابة", "التصنيف", "الصعوبة", "النقاط", "تلميح", "شرح"] as const;

const TEMPLATE_HEADERS = ["اسم_القالب", "رقم_السؤال", "الحرف", "السؤال", "الإجابة_الصحيحة", "التصنيف", "المستوى"] as const;

const META_SHEET = "Meta";
const BOARD_SHEET = "Board";
const QUESTIONS_SHEET = "Questions";

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

export function exportBoardToXlsx(board: BoardCell[], downloadName: string) {
  const rows: string[][] = [Array.from(BOARD_HEADERS)];
  for (const cell of board) {
    const bank: any[] =
      Array.isArray((cell as any).questionBank) && (cell as any).questionBank.length
        ? (cell as any).questionBank
        : cell.question.trim()
          ? [
              {
                question: cell.question,
                answer: cell.answer,
                category: cell.category,
                difficulty: cell.difficulty,
                points: cell.points,
                hint: cell.hint,
                explanation: cell.explanation,
              },
            ]
          : [];
    for (const q of bank) {
      rows.push([
        cell.id,
        cell.label,
        String(cell.position),
        String(q.question || ""),
        String(q.answer || ""),
        String(q.category || ""),
        formatDifficulty(q.difficulty),
        String(Number(q.points) || 1),
        String(q.hint || ""),
        String(q.explanation || ""),
      ]);
    }
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, BOARD_SHEET);
  const safe = downloadName.endsWith(".xlsx") ? downloadName : `${downloadName}.xlsx`;
  XLSX.writeFile(wb, safe);
}

export function mergeBoardFromExcelMatrix(matrix: string[][], roomBoard: BoardCell[]): BoardCell[] | null {
  if (!matrix.length) return null;
  let start = 0;
  const head = matrix[0].join(" ");
  if (head.includes("معرف") || head.includes("الترتيب") || head.includes("السؤال")) start = 1;

  const byId = new Map<string, any[]>();
  const byLabel = new Map<string, any[]>();

  for (let i = start; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row.some((c) => String(c).trim())) continue;
    const cellId = String(row[0] || "").trim();
    const label = String(row[1] || "").trim();
    const question = String(row[3] || "").trim();
    const answer = String(row[4] || "").trim();
    if (!question || !answer) continue;

    const normLetter = normalizeArabicLetter(label);
    const normAns = normalizeArabicLetter(answer);
    if (normLetter !== normAns) continue;

    const q = {
      letter: label,
      question,
      answer,
      category: String(row[5] || "").trim() || "غير مصنف",
      difficulty: parseDifficultyCell(String(row[6] || "")),
      points: Number(row[7]) || 1,
      hint: String(row[8] || "").trim(),
      explanation: String(row[9] || "").trim(),
    };
    if (cellId) {
      if (!byId.has(cellId)) byId.set(cellId, []);
      byId.get(cellId)!.push(q);
    }
    if (label) {
      if (!byLabel.has(label)) byLabel.set(label, []);
      byLabel.get(label)!.push(q);
    }
  }

  if (!byId.size && !byLabel.size) return null;

  return roomBoard.map((cell) => {
    const bank = byId.get(cell.id) || byLabel.get(cell.label) || [];
    if (!bank.length) return cell;
    const first = bank[0];
    return {
      ...cell,
      question: first.question,
      answer: first.answer,
      category: first.category,
      difficulty: first.difficulty,
      points: first.points,
      hint: first.hint,
      explanation: first.explanation,
      ...({ questionBank: bank } as any),
    };
  });
}

export function mergeBoardFromWorkbook(wb: XLSX.WorkBook, roomBoard: BoardCell[]): BoardCell[] | null {
  const matrix = matrixFromSheet(wb, [BOARD_SHEET, wb.SheetNames[0] || ""]);
  return mergeBoardFromExcelMatrix(matrix, roomBoard);
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
    if (!letter || !question || !answer) continue;

    const normLetter = normalizeArabicLetter(letter);
    const normAns = normalizeArabicLetter(answer);
    if (normLetter !== normAns) continue;

    if (!templateName && nameCol) templateName = nameCol;

    if (!banks.has(letter)) banks.set(letter, []);
    banks.get(letter)!.push({
      letter,
      question,
      answer,
      category: String(row[5] || "").trim() || "غير مصنف",
      difficulty: parseDifficultyCell(String(row[6] || "")),
      points: 1,
      hint: "",
      explanation: "",
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

  return {
    id: `u_${Date.now()}`,
    name: templateName,
    categories,
    level,
    questions: boardBanks.flatMap((b) => b.questionBank.map((q: any) => q.question)),
    boardBanks,
    createdAt: new Date().toISOString(),
    userCreated: true,
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
    for (const q of b.questionBank || []) {
      n += 1;
      rows.push([
        tpl.name,
        String(n),
        b.label,
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

  const safe = `template-${tpl.name.replace(/[/\\?*[\]]/g, "-")}.xlsx`;
  XLSX.writeFile(wb, safe);
}
