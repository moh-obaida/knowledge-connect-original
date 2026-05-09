// ═══════════════════════════════════════════════════════════════
// وصلة المعرفة — Data Models
// ═══════════════════════════════════════════════════════════════

import { normalizeTfCanonical } from "./questionTypes";

export interface BoardCell {
  id: string;
  /** @deprecated Prefer displayLetter — kept for Firebase / UI compatibility */
  label: string;
  /** What the hex shows (may differ from letterKey only for أ→ا style display) */
  displayLetter?: string;
  /** Stable identity for matching imports, banks, and saves — never use grid index alone */
  letterKey?: string;
  /** Key used with question banks and active questions (usually equals letterKey) */
  questionLetter?: string;
  position: number;
  row?: number;
  col?: number;
  selected?: boolean;
  disabled?: boolean;
  isWinningPath?: boolean;
  questionId?: string;
  question: string;
  answer: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  points: number;
  hint: string;
  explanation: string;
  acceptedAnswers?: string[];
  commonMistakes?: string[];
  teacherNote?: string;
  topic?: string;
  gradeLevel?: string;
  used: boolean;
  claimedBy: 0 | 1 | 2;
}

export interface Team {
  id?: "blue" | "red" | string;
  name: string;
  color: string;
  initials: string;
  direction?: "left-right" | "top-bottom";
  score?: number;
}

export type QuestionTypeValue = "fill" | "mcq" | "tf" | "image" | "open";

/** Normalized question stored in cell.questionBank[] or room.questionBankByLetter */
export type StoredQuestionItem = {
  id: string;
  letter?: string;
  letterKey: string;
  question: string;
  answer: string;
  type?: QuestionTypeValue;
  choices?: string[];
  category: string;
  difficulty: "easy" | "medium" | "hard";
  points: number;
  hint: string;
  explanation: string;
  originalRowNumber?: number;
  isActive?: boolean;
  timeLimit?: number;
  imageUrl?: string;
};

export function newQuestionId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function questionDedupeSignature(q: Pick<StoredQuestionItem, "letterKey" | "question" | "answer">): string {
  return `${q.letterKey}\u0001${q.question.trim()}\u0001${q.answer.trim()}`;
}

/** Coerce legacy / partial bank item; always sets letterKey + id */
export function ensureStoredQuestion(
  raw: Record<string, unknown> | undefined,
  fallbackLetterKey: string,
): StoredQuestionItem | null {
  if (!raw) return null;
  const question = String(raw.question ?? "").trim();
  if (!question) return null;
  const letterKey = normalizeBoardLetter(String(raw.letterKey ?? raw.letter ?? fallbackLetterKey));
  const id = String(raw.id ?? "").trim() || newQuestionId();
  let type: QuestionTypeValue =
    raw.type === "mcq" || raw.type === "tf" || raw.type === "image" || raw.type === "open" ? raw.type : "fill";
  const choices = Array.isArray(raw.choices) ? raw.choices.map((c) => String(c ?? "").trim()).filter(Boolean) : undefined;
  let answer = String(raw.answer ?? "").trim();

  if (!answer) {
    if (type === "mcq" && choices && choices.length >= 2) {
      answer = choices[0];
    } else if (type === "tf") {
      answer = "صح";
    } else {
      return null;
    }
  }

  if (type === "tf") {
    const canon = normalizeTfCanonical(answer);
    if (canon) answer = canon;
  }

  if (type === "mcq" && choices && choices.length >= 2 && answer && !choices.includes(answer)) {
    const loose = choices.find((c) => c.trim() === answer.trim());
    if (loose) answer = loose;
  }

  const p = Number(raw.points);
  const points = Number.isFinite(p) && p > 0 ? p : 10;

  return {
    id,
    letter: String(raw.letter ?? letterKey),
    letterKey,
    question,
    answer,
    type,
    choices,
    category: String(raw.category ?? "").trim() || "غير مصنف",
    difficulty:
      raw.difficulty === "easy" || raw.difficulty === "hard" || raw.difficulty === "medium" ? raw.difficulty : "medium",
    points,
    hint: String(raw.hint ?? "").trim(),
    explanation: String(raw.explanation ?? "").trim(),
    originalRowNumber: typeof raw.originalRowNumber === "number" ? raw.originalRowNumber : undefined,
    isActive: raw.isActive === false ? false : true,
    timeLimit: typeof raw.timeLimit === "number" ? raw.timeLimit : undefined,
    imageUrl: raw.imageUrl ? String(raw.imageUrl) : undefined,
  };
}

/**
 * Per-letter overflow when the board has no cell for that letterKey.
 * When the host adds that letter to the board later, merge these into the matching cell's questionBank (optional UX).
 */
export type QuestionBankByLetter = Record<string, StoredQuestionItem[]>;

export function getQuestionsForCell(cell: BoardCell, questionBankByLetter?: QuestionBankByLetter | null): StoredQuestionItem[] {
  const key = getBoardLetterKey(cell);
  const bank = Array.isArray((cell as BoardCell & { questionBank?: unknown }).questionBank)
    ? ((cell as BoardCell & { questionBank: unknown[] }).questionBank as Record<string, unknown>[])
    : [];
  const local: StoredQuestionItem[] = [];
  for (const q of bank) {
    const item = ensureStoredQuestion(q as Record<string, unknown>, key);
    if (!item) continue;
    const qk = normalizeBoardLetter(item.letterKey);
    if (qk !== key && qk) continue;
    local.push(item);
  }
  const global = (questionBankByLetter?.[key] || []).filter((q) => q.isActive !== false);
  const merged: StoredQuestionItem[] = [];
  const seen = new Set<string>();
  for (const q of [...local, ...global]) {
    const sig = questionDedupeSignature(q);
    if (seen.has(sig)) continue;
    seen.add(sig);
    merged.push(q);
  }
  return merged;
}

export interface ActiveQuestion {
  cellId: string;
  cellLabel: string;
  letterKey?: string;
  questionLetter?: string;
  questionId?: string;
  /** Unique id for this «round» so clients can ignore stale submissions */
  roundId?: string;
  question: string;
  answer: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  points: number;
  hint: string;
  explanation: string;
  type?: QuestionTypeValue;
  choices?: string[];
  imageUrl?: string;
}

export interface Player {
  id: string;
  name: string;
  team: 0 | 1 | 2;
  joinedAt: number;
  joinMethod: "self" | "manual";
}

export const CURRENT_SCHEMA_VERSION = 2;
export const CURRENT_BOARD_VERSION = "arabic-letter-keys-v3";

/** 28-letter Arabic sequence (ه as single letter, not هـ) */
export const ARABIC_28 = [
  "ا", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "ه", "و", "ي",
] as const;

export type ArabicLetterSet = "basic" | "extended" | "custom";

export type RoomLifecycleStatus = "setup" | "active" | "paused" | "ended" | "archived";
export type GameEventType =
  | "room_created"
  | "game_started"
  | "cell_selected"
  | "answer_revealed"
  | "hint_revealed"
  | "cell_claimed"
  | "question_skipped"
  | "team_switched"
  | "timer_updated"
  | "game_ended"
  | "room_normalized";

export interface GameEvent {
  id: string;
  type: GameEventType;
  timestamp: number;
  teamId?: 1 | 2;
  cellId?: string;
  letter?: string;
  questionId?: string;
  message: string;
}

export interface RoomFeatureFlags {
  authReady: boolean;
  aiReady: boolean;
  integrationsReady: boolean;
  powerUpsEnabled: boolean;
  practiceModeEnabled: boolean;
}

export interface RoomSettings {
  defaultTimerSeconds: number;
  gameMode: "classic" | "speed" | "points" | "connection" | "teacher" | "training";
  hintsEnabled: boolean;
  powerUpsEnabled: boolean;
  soundEnabled: boolean;
  reducedMotion: boolean;
  displayTheme: "classic" | "night" | "gold" | "high-contrast" | "school";
}

export interface LocalAnalyticsSnapshot {
  gamesPlayed: number;
  questionsUsed: number;
  mostUsedLetters: string[];
  reviewLetters: string[];
  averageDurationMs: number;
}

export interface RoomState {
  id?: string;
  code?: string;
  roomCode: string;
  status?: RoomLifecycleStatus;
  schemaVersion?: number;
  boardVersion?: string;
  gameTitle: string;
  logoText: string;
  createdAt: number;
  updatedAt?: number;
  gameStatus: "lobby" | "active" | "finished";
  gridSize: 4 | 5 | 6;
  cellLabelStyle: "arabic" | "english" | "numbers";
  /** When cellLabelStyle is arabic: which letter sequence fills the grid */
  arabicLetterSet?: ArabicLetterSet;
  /** Comma- or whitespace-separated letters for custom mode (RTL text ok) */
  customArabicLetters?: string;
  winningMode: "path" | "points" | "manual";
  timerSetting: number;
  stealMode: "none" | "steal" | "manual";
  team1: Team;
  team2: Team;
  team1Score: number;
  team2Score: number;
  board: BoardCell[];
  /** أسئلة للحروف غير الموجودة حالياً على اللوحة؛ تُدمج تلقائياً عند عرض الخانة إن وُجدت */
  questionBankByLetter?: QuestionBankByLetter;
  selectedCellId: string;
  activeQuestion: ActiveQuestion | null;
  answerVisibleToHost: boolean;
  answerVisibleToParticipants: boolean;
  hintVisibleToParticipants: boolean;
  activeTeam: 1 | 2;
  timerValue: number;
  timerRunning: boolean;
  timerMax: number;
  winnerMessage: string;
  winnerTeam: 0 | 1 | 2;
  winningPath?: string[];
  questionStatus: "idle" | "active" | "answer_revealed" | "correct" | "wrong" | "skipped" | "time_up";
  gameMode?: "classic" | "speed" | "points" | "connection" | "teacher" | "training";
  activePowerUp?: "none" | "double_points" | "extra_time" | "switch_question";
  buzzerEnabled?: boolean;
  buzzerFirstPlayer?: string;
  buzzerAt?: number;
  roundNumber: number;
  players: Record<string, Player>;
  eventLog?: GameEvent[];
  questionHistory?: GameEvent[];
  participants?: Record<string, Player>;
  settings?: RoomSettings;
  featureFlags?: RoomFeatureFlags;
  analytics?: LocalAnalyticsSnapshot;
}

// ── Arabic letter sets ────────────────────────────────────────
const ENGLISH_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const LEGACY_DISPLAY_LETTERS: Record<string, string> = { "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا" };

const TATWEEL_RE = /\u0640/g;
const BOARD_INVISIBLE_RE = /[\u200C\u200D\uFEFF]/g;
const BOARD_DIACRITICS_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const BOARD_ALIF_VARIANTS: Record<string, string> = { أ: "ا", إ: "ا", آ: "ا", ٱ: "ا" };

/** Strict identity for board cells: trim, strip tatweel/invisible/diacritics; أإآٱ→ا only; never ة↔ه nor ى↔ي */
export function normalizeBoardLetter(value?: string): string {
  let s = String(value ?? "")
    .trim()
    .replace(BOARD_INVISIBLE_RE, "")
    .replace(TATWEEL_RE, "")
    .replace(BOARD_DIACRITICS_RE, "");
  const ch = s.charAt(0);
  return BOARD_ALIF_VARIANTS[ch] || ch;
}

export function normalizeLetterForDisplay(label: string): string {
  const stripped = String(label).replace(TATWEEL_RE, "");
  if (stripped === "ه" && label !== stripped) return "ه";
  return LEGACY_DISPLAY_LETTERS[label] || LEGACY_DISPLAY_LETTERS[stripped] || stripped;
}

export function getBoardLetterKey(cell: Pick<BoardCell, "letterKey" | "label">): string {
  const raw = cell.letterKey || cell.label || "";
  return normalizeBoardLetter(raw);
}

export function getCellDisplayLetter(cell: Pick<BoardCell, "displayLetter" | "label">): string {
  const d = (cell.displayLetter || cell.label || "").trim();
  return normalizeLetterForDisplay(d);
}

export function getQuestionLetter(cell: Pick<BoardCell, "questionLetter" | "letterKey" | "label">): string {
  if (cell.questionLetter && cell.questionLetter.trim()) return normalizeBoardLetter(cell.questionLetter);
  return getBoardLetterKey(cell);
}

/** Ensures label + letter identity fields stay aligned (call after edits / load) */
export function syncBoardCellLetters(cell: BoardCell): BoardCell {
  const displaySource = (cell.displayLetter || cell.label || "").trim();
  const letterKey = normalizeBoardLetter(cell.letterKey || cell.label || displaySource);
  const displayLetter = normalizeLetterForDisplay(displaySource || letterKey);
  const questionLetter = cell.questionLetter?.trim()
    ? normalizeBoardLetter(cell.questionLetter)
    : letterKey;
  return {
    ...cell,
    label: displayLetter,
    displayLetter,
    letterKey,
    questionLetter,
  };
}

const ARABIC_GRID_SUPPLEMENT = ["ء", "ؤ", "ئ", "ة", "ى", "لا", "آ", "إ"] as const;

export function getDefaultArabicLabels(
  gridSize: 4 | 5 | 6,
  letterSet: ArabicLetterSet = "basic",
  customRaw?: string,
): string[] {
  const count = gridSize * gridSize;
  if (letterSet === "custom") {
    const parts = String(customRaw || "")
      .split(/[\s,،]+/)
      .map((p) => normalizeBoardLetter(p))
      .filter(Boolean);
    return Array.from({ length: count }, (_, i) => parts[i] || String(i + 1));
  }

  const basicSequentialFill = (): string[] => {
    if (count <= ARABIC_28.length) {
      return Array.from({ length: count }, (_, i) => ARABIC_28[i] as string);
    }
    const extra = count - ARABIC_28.length;
    const pad = ARABIC_GRID_SUPPLEMENT.slice(0, extra);
    return [...(ARABIC_28 as unknown as string[]), ...pad].slice(0, count);
  };

  if (letterSet === "basic") return basicSequentialFill();

  // extended: ا…ك + ه،و،ي on 5×5 / 4×4 style boards; large grids use full alphabet + supplement
  if (count >= 4 && count <= ARABIC_28.length) {
    const headLen = count - 3;
    const head = ARABIC_28.slice(0, headLen) as unknown as string[];
    return [...head, "ه", "و", "ي"];
  }
  return basicSequentialFill();
}

export function getDefaultLabels(
  gridSize: 4 | 5 | 6,
  style: RoomState["cellLabelStyle"],
  arabicLetterSet: ArabicLetterSet = "basic",
  customArabicLetters?: string,
): string[] {
  const count = gridSize * gridSize;
  if (style === "arabic") {
    return getDefaultArabicLabels(gridSize, arabicLetterSet, customArabicLetters);
  }
  if (style === "english") {
    return Array.from({ length: count }, (_, i) => (i < ENGLISH_LETTERS.length ? ENGLISH_LETTERS[i] : String(i + 1)));
  }
  return Array.from({ length: count }, (_, i) => String(i + 1));
}

export function generateBoard(
  gridSize: 4 | 5 | 6,
  cellLabelStyle: RoomState["cellLabelStyle"],
  options: { arabicLetterSet?: ArabicLetterSet; customArabicLetters?: string } = {},
): BoardCell[] {
  const arabicLetterSet = options.arabicLetterSet ?? "basic";
  const labels = getDefaultLabels(gridSize, cellLabelStyle, arabicLetterSet, options.customArabicLetters);
  return labels.map((label, i) =>
    syncBoardCellLetters({
      id: `cell-${i}`,
      label,
      position: i,
      row: Math.floor(i / gridSize),
      col: i % gridSize,
      question: "",
      answer: "",
      category: "",
      difficulty: "easy" as const,
      points: 1,
      hint: "",
      explanation: "",
      used: false,
      claimedBy: 0 as const,
    }),
  );
}

function mergeStoredQuestionListsForRebuild(lists: StoredQuestionItem[][]): StoredQuestionItem[] {
  const seen = new Set<string>();
  const out: StoredQuestionItem[] = [];
  for (const list of lists) {
    for (const q of list) {
      const sig = questionDedupeSignature(q);
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push(q);
    }
  }
  return out;
}

/**
 * Rebuilds the grid for new size / style / Arabic letter set and keeps all questions:
 * places them on matching letter keys, and leaves the rest in questionBankByLetter.
 */
export function rebuildBoardPreservingBanks(
  oldRoom: RoomState,
  gridSize: 4 | 5 | 6,
  cellLabelStyle: RoomState["cellLabelStyle"],
  boardOpts: { arabicLetterSet?: ArabicLetterSet; customArabicLetters?: string } = {},
): { board: BoardCell[]; questionBankByLetter: QuestionBankByLetter } {
  const newBoard = generateBoard(gridSize, cellLabelStyle, boardOpts);
  const activeKeys = new Set(newBoard.map((c) => getBoardLetterKey(c)));

  const listsByKey = new Map<string, StoredQuestionItem[][]>();
  const pushList = (key: string, list: StoredQuestionItem[]) => {
    if (!key || !list.length) return;
    if (!listsByKey.has(key)) listsByKey.set(key, []);
    listsByKey.get(key)!.push(list);
  };

  for (const cell of oldRoom.board) {
    const key = getBoardLetterKey(cell);
    const local: StoredQuestionItem[] = [];
    const qb = (cell as BoardCell & { questionBank?: unknown[] }).questionBank;
    if (Array.isArray(qb)) {
      for (const raw of qb) {
        const q = ensureStoredQuestion(raw as Record<string, unknown>, key);
        if (q) local.push(q);
      }
    }
    if (!local.length && String(cell.question || "").trim()) {
      const q = ensureStoredQuestion(
        {
          question: cell.question,
          answer: cell.answer,
          category: cell.category,
          difficulty: cell.difficulty,
          points: cell.points,
          hint: cell.hint,
          explanation: cell.explanation,
        } as Record<string, unknown>,
        key,
      );
      if (q) local.push(q);
    }
    if (local.length) pushList(key, local);
  }

  for (const [k, items] of Object.entries(oldRoom.questionBankByLetter || {})) {
    const key = normalizeBoardLetter(k);
    const local: StoredQuestionItem[] = [];
    for (const item of items) {
      const q = ensureStoredQuestion(item as Record<string, unknown>, key);
      if (q) local.push(q);
    }
    if (local.length) pushList(key, local);
  }

  const mergedByKey = new Map<string, StoredQuestionItem[]>();
  listsByKey.forEach((lists, key) => {
    mergedByKey.set(key, mergeStoredQuestionListsForRebuild(lists));
  });

  const reserve: QuestionBankByLetter = {};
  const board = newBoard.map((cell) => {
    const key = getBoardLetterKey(cell);
    const items = mergedByKey.get(key) || [];
    if (!items.length) {
      return syncBoardCellLetters({
        ...cell,
        question: "",
        answer: "",
        category: "",
        difficulty: "easy",
        points: 1,
        hint: "",
        explanation: "",
      });
    }
    const first = items[0];
    return syncBoardCellLetters({
      ...cell,
      question: first.question,
      answer: first.answer,
      category: first.category,
      difficulty: first.difficulty,
      points: first.points,
      hint: first.hint,
      explanation: first.explanation,
      ...( { questionBank: items } as Partial<BoardCell> ),
    });
  });

  mergedByKey.forEach((items, key) => {
    if (!activeKeys.has(key) && items.length) reserve[key] = items;
  });

  return { board, questionBankByLetter: reserve };
}

export function shuffleBoard(board: BoardCell[]): BoardCell[] {
  const positions = board.map((_, i) => i);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return board.map((cell, i) => ({ ...cell, position: positions[i] }));
}

export function sortedBoard(board: BoardCell[]): BoardCell[] {
  return [...board].sort((a, b) => a.position - b.position);
}

export function normalizeBoardForDisplay(board: BoardCell[], gridSize: RoomState["gridSize"] = 5): BoardCell[] {
  if (!Array.isArray(board) || board.length === 0) return generateBoard(gridSize, "arabic");
  return board.map((cell, index) => {
    const position = typeof cell.position === "number" && Number.isFinite(cell.position) ? cell.position : index;
    const merged: BoardCell = {
      ...cell,
      id: cell.id || `cell-${index}`,
      label: cell.label || "",
      position,
      row: typeof cell.row === "number" && Number.isFinite(cell.row) ? cell.row : Math.floor(position / gridSize),
      col: typeof cell.col === "number" && Number.isFinite(cell.col) ? cell.col : position % gridSize,
      question: cell.question || "",
      answer: cell.answer || "",
      category: cell.category || "",
      difficulty: cell.difficulty || "easy",
      points: Number(cell.points) || 1,
      hint: cell.hint || "",
      explanation: cell.explanation || "",
      used: Boolean(cell.used),
      claimedBy: cell.claimedBy === 1 || cell.claimedBy === 2 ? cell.claimedBy : 0,
    };
    return syncBoardCellLetters(merged);
  });
}

export function roomStatusFromGameStatus(gameStatus: RoomState["gameStatus"]): RoomLifecycleStatus {
  if (gameStatus === "active") return "active";
  if (gameStatus === "finished") return "ended";
  return "setup";
}

export function createGameEvent(type: GameEventType, message: string, details: Partial<GameEvent> = {}): GameEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    timestamp: Date.now(),
    message,
    ...details,
  };
}

export function isLegacyRoom(room: Partial<RoomState> | null | undefined): boolean {
  if (!room) return false;
  const schemaVersion = Number(room.schemaVersion || 0);
  const hasLegacyLetters = Array.isArray(room.board) && room.board.some((cell) => cell?.label === "أ");
  return schemaVersion < CURRENT_SCHEMA_VERSION || room.boardVersion !== CURRENT_BOARD_VERSION || hasLegacyLetters;
}

export function canSafelyUpgradeRoom(room: Partial<RoomState> | null | undefined): boolean {
  if (!room || !Array.isArray(room.board)) return false;
  const gridSize = room.gridSize || 5;
  const hasClaims = room.board.some((cell) => cell.claimedBy !== 0 || cell.used);
  return gridSize === 5 && room.board.length === 25 && !hasClaims && (room.gameStatus || "lobby") === "lobby";
}

export function normalizeRoomState(raw: Partial<RoomState> | null): RoomState | null {
  if (!raw) return null;
  const code = raw.roomCode || raw.code || "";
  const gridSize = ([4, 5, 6].includes(raw.gridSize as number) ? raw.gridSize : 5) as 4 | 5 | 6;
  const base = defaultRoomState(code);
  const merged: RoomState = {
    ...base,
    ...raw,
    id: raw.id || code,
    code,
    roomCode: code,
    schemaVersion: Number(raw.schemaVersion || 1),
    boardVersion: raw.boardVersion || "legacy",
    updatedAt: Number(raw.updatedAt || raw.createdAt || Date.now()),
    gridSize,
    arabicLetterSet: (raw.arabicLetterSet as ArabicLetterSet) || base.arabicLetterSet || "basic",
    customArabicLetters: raw.customArabicLetters ?? base.customArabicLetters ?? "",
    board: normalizeBoardForDisplay(raw.board || base.board, gridSize),
    team1: { ...base.team1, ...(raw.team1 || {}), id: "blue", direction: "left-right", score: raw.team1Score ?? raw.team1?.score ?? 0 },
    team2: { ...base.team2, ...(raw.team2 || {}), id: "red", direction: "top-bottom", score: raw.team2Score ?? raw.team2?.score ?? 0 },
    status: raw.status || roomStatusFromGameStatus(raw.gameStatus || base.gameStatus),
    settings: { ...base.settings!, ...(raw.settings || {}) },
    featureFlags: { ...base.featureFlags!, ...(raw.featureFlags || {}) },
    eventLog: Array.isArray(raw.eventLog) ? raw.eventLog.slice(-80) : base.eventLog,
    questionHistory: Array.isArray(raw.questionHistory) ? raw.questionHistory.slice(-80) : base.questionHistory,
    participants: raw.participants || raw.players || {},
    analytics: { ...base.analytics!, ...(raw.analytics || {}) },
    questionBankByLetter: sanitizeQuestionBankByLetter(raw.questionBankByLetter),
  };
  return merged;
}

function sanitizeQuestionBankByLetter(raw: unknown): QuestionBankByLetter {
  if (!raw || typeof raw !== "object") return {};
  const out: QuestionBankByLetter = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = normalizeBoardLetter(k);
    if (!key) continue;
    if (!Array.isArray(v)) continue;
    const list: StoredQuestionItem[] = [];
    for (const item of v) {
      const q = ensureStoredQuestion(item as Record<string, unknown>, key);
      if (q) list.push(q);
    }
    if (list.length) out[key] = list;
  }
  return out;
}

export function upgradeRoomBoardVersion(room: RoomState): Partial<RoomState> {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    boardVersion: CURRENT_BOARD_VERSION,
    updatedAt: Date.now(),
    board: normalizeBoardForDisplay(room.board, room.gridSize),
    status: roomStatusFromGameStatus(room.gameStatus),
    eventLog: [
      ...(room.eventLog || []).slice(-79),
      createGameEvent("room_normalized", "تم تحديث اللوحة للإصدار الحالي."),
    ],
  };
}

export function defaultRoomState(roomCode: string): RoomState {
  const gridSize: 4 | 5 | 6 = 5;
  const language: "ar" = "ar";
  const cellLabelStyle: RoomState["cellLabelStyle"] = "arabic";
  return {
    roomCode,
    id: roomCode,
    code: roomCode,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    boardVersion: CURRENT_BOARD_VERSION,
    gameTitle: "وصلة المعرفة",
    logoText: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "setup",
    gameStatus: "lobby",
    gridSize,
    cellLabelStyle,
    arabicLetterSet: "basic",
    customArabicLetters: "",
    winningMode: "path",
    timerSetting: 0,
    stealMode: "none",
    team1: { id: "blue", name: "الفريق الأزرق", color: "#2563eb", initials: "أز", direction: "left-right", score: 0 },
    team2: { id: "red", name: "الفريق الأحمر", color: "#ef4444", initials: "أح", direction: "top-bottom", score: 0 },
    team1Score: 0,
    team2Score: 0,
    board: generateBoard(gridSize, cellLabelStyle, { arabicLetterSet: "basic" }),
    selectedCellId: "",
    activeQuestion: null,
    answerVisibleToHost: false,
    answerVisibleToParticipants: false,
    hintVisibleToParticipants: false,
    activeTeam: 1,
    timerValue: 0,
    timerRunning: false,
    timerMax: 0,
    winnerMessage: "",
    winnerTeam: 0,
    questionStatus: "idle",
    gameMode: "classic",
    activePowerUp: "none",
    buzzerEnabled: false,
    buzzerFirstPlayer: "",
    buzzerAt: 0,
    roundNumber: 1,
    players: {},
    participants: {},
    eventLog: [createGameEvent("room_created", "تم إنشاء الغرفة.")],
    questionHistory: [],
    settings: {
      defaultTimerSeconds: 0,
      gameMode: "classic",
      hintsEnabled: true,
      powerUpsEnabled: false,
      soundEnabled: false,
      reducedMotion: false,
      displayTheme: "classic",
    },
    featureFlags: {
      authReady: false,
      aiReady: false,
      integrationsReady: false,
      powerUpsEnabled: false,
      practiceModeEnabled: true,
    },
    analytics: {
      gamesPlayed: 0,
      questionsUsed: 0,
      mostUsedLetters: [],
      reviewLetters: [],
      averageDurationMs: 0,
    },
    questionBankByLetter: {},
  };
}

// ── localStorage ──────────────────────────────────────────────
const LS_LAST_ROOM = "kc_last_room";
function safeGet<T>(key: string, fb: T): T {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) as T : fb; } catch { return fb; }
}
function safeSet(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.error(e); }
}
export const loadLastRoomCode = (): string => safeGet<string>(LS_LAST_ROOM, "");
export const saveLastRoomCode = (code: string) => safeSet(LS_LAST_ROOM, code);

// ── BFS path-win ──────────────────────────────────────────────
export function checkWinner(board: BoardCell[], gridSize: number): 0 | 1 | 2 {
  if (findWinningPath(board, gridSize, 1).length) return 1;
  if (findWinningPath(board, gridSize, 2).length) return 2;
  return 0;
}
export function getHexNeighbors(index: number, size: number): number[] {
  const r = Math.floor(index / size), c = index % size;
  // Board rendering uses odd rows shifted to the right (odd-r horizontal layout).
  // Neighbor offsets must follow the same coordinate system to correctly detect
  // curved / zigzag connected paths for Hex wins.
  const deltas = r % 2 === 0
    ? [[-1, 0], [-1, -1], [0, -1], [0, 1], [1, 0], [1, -1]]
    : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];
  const out: number[] = [];
  for (const [dr, dc] of deltas) {
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
    out.push(nr * size + nc);
  }
  return out;
}
export function findWinningPath(board: BoardCell[], size: number, team: 1|2): string[] {
  const s = sortedBoard(board);
  const queue: number[] = [];
  const visited = new Set<number>();
  const parent = new Map<number, number>();
  const horizontal = team === 1;

  for (let i = 0; i < s.length; i++) {
    const r = Math.floor(i / size), c = i % size;
    const isStart = horizontal ? c === 0 : r === 0;
    if (isStart && s[i]?.claimedBy === team) { queue.push(i); visited.add(i); }
  }
  while (queue.length) {
    const cur = queue.shift()!;
    const r = Math.floor(cur / size), c = cur % size;
    const isTarget = horizontal ? c === size - 1 : r === size - 1;
    if (isTarget) {
      const path: number[] = [cur];
      let p = cur;
      while (parent.has(p)) { p = parent.get(p)!; path.push(p); }
      path.reverse();
      return path.map(i => s[i].id);
    }
    for (const ni of getHexNeighbors(cur, size)) {
      if (visited.has(ni)) continue;
      if (s[ni]?.claimedBy !== team) continue;
      visited.add(ni);
      parent.set(ni, cur);
      queue.push(ni);
    }
  }
  return [];
}
