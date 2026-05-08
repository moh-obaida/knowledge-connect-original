// ═══════════════════════════════════════════════════════════════
// وصلة المعرفة — Data Models
// ═══════════════════════════════════════════════════════════════

export interface BoardCell {
  id: string;
  label: string;
  position: number;
  question: string;
  answer: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  points: number;
  hint: string;
  explanation: string;
  used: boolean;
  claimedBy: 0 | 1 | 2;
}

export interface Team {
  name: string;
  color: string;
  initials: string;
}

export type QuestionTypeValue = "fill" | "mcq" | "tf" | "image" | "open";

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

export interface RoomState {
  roomCode: string;
  gameTitle: string;
  logoText: string;
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
  questionStatus: "idle" | "active" | "answer_revealed" | "correct" | "wrong" | "skipped" | "time_up";
  gameMode?: "classic" | "speed" | "points" | "connection" | "teacher" | "training";
  activePowerUp?: "none" | "double_points" | "extra_time" | "switch_question";
  buzzerEnabled?: boolean;
  buzzerFirstPlayer?: string;
  buzzerAt?: number;
  roundNumber: number;
  players: Record<string, Player>;
}

// ── Arabic letter sets ────────────────────────────────────────
const ARABIC_4x4 = ["أ","ب","ت","ث","ج","ح","خ","د","ذ","ر","ز","س","ش","ص","ض","ط"];
const ARABIC_5x5 = ["أ","ب","ت","ث","ج","ح","خ","د","ذ","ر","ز","س","ش","ص","ض","ط","ظ","ع","غ","ف","ق","ك","ل","م","ن"];
const ARABIC_6x6 = [...ARABIC_5x5,"هـ","و","ي","ء","ؤ","ئ","ة","ى","لا","آ","إ"];
const ENGLISH_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function getDefaultLabels(gridSize: 4 | 5 | 6, style: RoomState["cellLabelStyle"]): string[] {
  const count = gridSize * gridSize;
  if (style === "arabic") {
    const src = gridSize === 4 ? ARABIC_4x4 : gridSize === 5 ? ARABIC_5x5 : ARABIC_6x6;
    return Array.from({ length: count }, (_, i) => src[i] ?? String(i + 1));
  }
  if (style === "english") {
    return Array.from({ length: count }, (_, i) => i < ENGLISH_LETTERS.length ? ENGLISH_LETTERS[i] : String(i + 1));
  }
  return Array.from({ length: count }, (_, i) => String(i + 1));
}

export function generateBoard(gridSize: 4 | 5 | 6, cellLabelStyle: RoomState["cellLabelStyle"]): BoardCell[] {
  const labels = getDefaultLabels(gridSize, cellLabelStyle);
  return labels.map((label, i) => ({
    id: `cell-${i}`,
    label,
    position: i,
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

export function defaultRoomState(roomCode: string): RoomState {
  const gridSize: 4 | 5 | 6 = 5;
  const language = (typeof window !== "undefined" ? localStorage.getItem("kc_language") : "ar") === "en" ? "en" : "ar";
  const cellLabelStyle: RoomState["cellLabelStyle"] = language === "en" ? "english" : "arabic";
  return {
    roomCode,
    gameTitle: "وصلة المعرفة",
    logoText: "",
    createdAt: Date.now(),
    gameStatus: "lobby",
    gridSize,
    cellLabelStyle,
    winningMode: "path",
    timerSetting: 0,
    stealMode: "none",
    team1: { name: language === "en" ? "Blue Team" : "الفريق الأزرق", color: "#2563eb", initials: language === "en" ? "B" : "ز" },
    team2: { name: language === "en" ? "Red Team" : "الفريق الأحمر", color: "#ef4444", initials: language === "en" ? "R" : "ح" },
    team1Score: 0,
    team2Score: 0,
    board: generateBoard(gridSize, cellLabelStyle),
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
