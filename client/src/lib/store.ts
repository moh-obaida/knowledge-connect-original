// ═══════════════════════════════════════════════════════════════
// وصلة المعرفة — Data Models
// Core concept: each board cell has its own saved question.
// Host assigns questions to cells before the game.
// ═══════════════════════════════════════════════════════════════

// ── Cell (letter) with its own question ──────────────────────
export interface BoardCell {
  id: string;           // e.g. "cell-0"
  label: string;        // e.g. "أ"
  question: string;     // question text (empty = no question yet)
  answer: string;       // correct answer
  category: string;
  difficulty: "easy" | "medium" | "hard";
  points: number;
  hint: string;
  explanation: string;
  used: boolean;        // has this cell's question been shown?
  claimedBy: 0 | 1 | 2; // 0=unclaimed, 1=team1, 2=team2
}

export interface Team {
  name: string;
  color: string;
  initials: string;
}

// ── Active question state (what's on screen right now) ────────
export interface ActiveQuestion {
  cellId: string;
  cellLabel: string;
  question: string;
  answer: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  points: number;
  hint: string;
  explanation: string;
}

// ── Full room state (synced via Firebase) ─────────────────────
export interface RoomState {
  roomCode: string;
  gameTitle: string;
  createdAt: number;
  gameStatus: "lobby" | "active" | "finished";
  gridSize: 4 | 5 | 6;
  cellLabelStyle: "arabic" | "english" | "numbers";
  winningMode: "path" | "points" | "manual";
  timerSetting: number;
  stealMode: "none" | "steal" | "manual";
  team1: Team;
  team2: Team;
  team1Score: number;
  team2Score: number;
  board: BoardCell[];
  activeQuestion: ActiveQuestion | null;
  answerVisibleToHost: boolean;
  answerVisibleToParticipants: boolean;
  hintVisibleToParticipants: boolean;
  activeTeam: 1 | 2;
  timerValue: number;
  timerRunning: boolean;
  timerMax: number;
  winnerMessage: string;
  questionStatus: "idle" | "active" | "answer_revealed" | "correct" | "wrong" | "skipped" | "time_up";
  players: Record<string, { name: string; joinedAt: number }>;
}

// ── Arabic cell labels ────────────────────────────────────────
const ARABIC_LETTERS = [
  "أ","ب","ت","ث","ج","ح","خ","د","ذ","ر",
  "ز","س","ش","ص","ض","ط","ظ","ع","غ","ف",
  "ق","ك","ل","م","ن","هـ","و","ي"
];
const ENGLISH_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function getCellLabel(index: number, style: RoomState["cellLabelStyle"]): string {
  if (style === "arabic") return index < ARABIC_LETTERS.length ? ARABIC_LETTERS[index] : String(index + 1);
  if (style === "english") return index < ENGLISH_LETTERS.length ? ENGLISH_LETTERS[index] : String(index + 1);
  return String(index + 1);
}

// ── Generate empty board (all cells have no question yet) ─────
export function generateBoard(gridSize: number, cellLabelStyle: RoomState["cellLabelStyle"]): BoardCell[] {
  const count = gridSize * gridSize;
  return Array.from({ length: count }, (_, i) => ({
    id: `cell-${i}`,
    label: getCellLabel(i, cellLabelStyle),
    question: "",
    answer: "",
    category: "",
    difficulty: "easy" as const,
    points: 1,
    hint: "",
    explanation: "",
    used: false,
    claimedBy: 0 as const,
  }));
}

// ── Default room state ────────────────────────────────────────
export function defaultRoomState(roomCode: string): RoomState {
  return {
    roomCode,
    gameTitle: "تحدي وصلة المعرفة",
    createdAt: Date.now(),
    gameStatus: "lobby",
    gridSize: 5,
    cellLabelStyle: "arabic",
    winningMode: "path",
    timerSetting: 30,
    stealMode: "none",
    team1: { name: "الفريق الأخضر", color: "#16a34a", initials: "خ" },
    team2: { name: "الفريق الأزرق", color: "#2563eb", initials: "ز" },
    team1Score: 0,
    team2Score: 0,
    board: generateBoard(5, "arabic"),
    activeQuestion: null,
    answerVisibleToHost: false,
    answerVisibleToParticipants: false,
    hintVisibleToParticipants: false,
    activeTeam: 1,
    timerValue: 30,
    timerRunning: false,
    timerMax: 30,
    winnerMessage: "",
    questionStatus: "idle",
    players: {},
  };
}

// ── localStorage — host device only ──────────────────────────
// Used only for: last room code (convenience), not for game state.
// All game state lives in Firebase.
const LS_LAST_ROOM = "kc_last_room";

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function safeSet(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.error(e); }
}

export const loadLastRoomCode = (): string => safeGet<string>(LS_LAST_ROOM, "");
export const saveLastRoomCode = (code: string) => safeSet(LS_LAST_ROOM, code);

// ── BFS path-win detection ────────────────────────────────────
// Team 1 wins by connecting left column → right column (horizontal path)
// Team 2 wins by connecting top row → bottom row (vertical path)
export function checkWinner(board: BoardCell[], gridSize: number): 0 | 1 | 2 {
  if (bfsWin(board, gridSize, 1, "horizontal")) return 1;
  if (bfsWin(board, gridSize, 2, "vertical")) return 2;
  return 0;
}

function bfsWin(board: BoardCell[], size: number, team: 1 | 2, dir: "horizontal" | "vertical"): boolean {
  const visited = new Set<number>();
  const queue: number[] = [];
  if (dir === "horizontal") {
    for (let r = 0; r < size; r++) {
      const i = r * size;
      if (board[i]?.claimedBy === team) { queue.push(i); visited.add(i); }
    }
  } else {
    for (let c = 0; c < size; c++) {
      if (board[c]?.claimedBy === team) { queue.push(c); visited.add(c); }
    }
  }
  while (queue.length) {
    const cur = queue.shift()!;
    const r = Math.floor(cur / size), c = cur % size;
    if (dir === "horizontal" && c === size - 1) return true;
    if (dir === "vertical" && r === size - 1) return true;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      const ni = nr * size + nc;
      if (!visited.has(ni) && board[ni]?.claimedBy === team) { visited.add(ni); queue.push(ni); }
    }
  }
  return false;
}
